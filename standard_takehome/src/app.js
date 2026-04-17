import { loadSceneIndex, loadScene } from "./scene.js";
import { runRoutine } from "./sim.js";
import { validateRoutineBundle, runBundle } from "./harness.js";
import { naiveSolve } from "./planning_api.js";
import { makeView, render } from "./renderer.js";
import { renderMarkdown } from "./md.js";
import { createRingBuffer, pushRing, drawSpark } from "./sparklines.js";
import { initAnalytics } from "./analytics.js";

const DEFAULT_WORLD = { x_min: -1.0, x_max: 1.0, y_min: -0.05, y_max: 0.9 };

// Add ~12cm of below-floor padding in the viewport so the warning band is not
// flush against the bottom edge. Coordinate system is unchanged — world x/y
// still mean the same meters; we just extend the visible y_min downward.
function viewBounds(scene) {
  const w = scene?.world ?? DEFAULT_WORLD;
  return { ...w, y_min: w.y_min - 0.12 };
}

const els = {
  canvas: document.getElementById("stage"),
  scenePrev: document.getElementById("scene-prev"),
  sceneNext: document.getElementById("scene-next"),
  sceneIdx: document.getElementById("scene-idx"),
  sceneName: document.getElementById("scene-name"),
  overlayScene: document.getElementById("overlay-scene"),
  overlayMetrics: document.getElementById("overlay-metrics"),
  runNextOverlay: document.getElementById("run-next-overlay"),
  runBtn: document.getElementById("run"),
  pauseBtn: document.getElementById("pause"),
  resetBtn: document.getElementById("reset"),
  baselineBtn: document.getElementById("baseline"),
  modePill: document.getElementById("mode-pill"),
  githubLink: document.querySelector(".header-link"),
  samplePanel: document.getElementById("sample-panel"),
  sampleSelect: document.getElementById("sample-select"),
  sampleRunBtn: document.getElementById("sample-run"),
  sampleStatus: document.getElementById("sample-status"),
  notesTabBtn: document.getElementById("notes-tab-btn"),
  notesView: document.getElementById("notes-view"),
  bundleInput: document.getElementById("bundle-input"),
  bundleStatus: document.getElementById("bundle-status"),
  speed: document.getElementById("speed"),
  speedVal: document.getElementById("speed-val"),
  result: document.getElementById("result"),
  phase2Family: document.getElementById("phase2-family"),
  phase2Scene: document.getElementById("phase2-scene"),
  phase2LoadBtn: document.getElementById("phase2-load"),
  phase2RunBtn: document.getElementById("phase2-run"),
  phase2Status: document.getElementById("phase2-status"),
  log: document.getElementById("log"),
  routineView: document.getElementById("routine-view"),
  overlay: document.getElementById("overlay"),
  exportBtn: document.getElementById("export-results"),
  tabBtns: Array.from(document.querySelectorAll(".tab-btn")),
  tabBodies: Array.from(document.querySelectorAll(".tab-body"))
};

const state = {
  scenes: [],
  activeSceneId: null,
  scene: null,
  view: null,
  bundle: null,
  trace: null,
  result: null,
  frame: 0,
  playing: false,
  lastTs: 0,
  fps: 60,
  activeTab: "log",
  phase2Catalog: [],
  phase2Active: null,
  sampleMode: false,
  requestedSampleId: null,
  samples: [],
  sampleActive: null,
  activeRoutineStep: null,
  viaSharedLink: location.hash.length > 0,
  analytics: null,
  analyticsQueue: []
};

function log(msg, cls = "") {
  const ts = new Date().toLocaleTimeString();
  const line = document.createElement("div");
  line.className = `line ${cls}`;
  line.innerHTML = `<span class="ts">${ts}</span>${escapeHtml(msg)}`;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

async function init() {
  const idx = await loadSceneIndex();
  state.scenes = idx.scenes;
  els.scenePrev.addEventListener("click", () => selectSceneByIndex(state.sceneIndex - 1));
  els.sceneNext.addEventListener("click", () => selectSceneByIndex(state.sceneIndex + 1));
  els.runNextOverlay.addEventListener("click", runNextFromOverlay);
  els.runBtn.addEventListener("click", runActive);
  els.pauseBtn.addEventListener("click", () => { state.playing = !state.playing; els.pauseBtn.textContent = state.playing ? "■ pause" : "▶ resume"; });
  els.resetBtn.addEventListener("click", () => {
    state.frame = 0;
    state.playing = false;
    updateRoutineHighlight({ force: true, scroll: false });
    draw();
  });
  els.baselineBtn.addEventListener("click", runBaseline);
  if (els.githubLink) els.githubLink.addEventListener("click", () => trackAnalytics("click_github", { via: state.viaSharedLink ? "shared_link" : "direct" }));
  if (els.modePill) els.modePill.addEventListener("click", () => trackAnalytics("click_exit_sample", { via: state.viaSharedLink ? "shared_link" : "direct" }));
  configureSampleMode();
  if (state.viaSharedLink) history.replaceState(null, "", location.pathname + location.search);
  startAnalytics();
  els.bundleInput.addEventListener("change", onBundleUpload);
  els.exportBtn.addEventListener("click", exportResults);
  els.sampleRunBtn.addEventListener("click", runSelectedSample);
  els.phase2Family.addEventListener("change", refreshPhase2SceneOptions);
  els.phase2LoadBtn.addEventListener("click", loadSelectedPhase2Scene);
  els.phase2RunBtn.addEventListener("click", runPhase2V2);
  for (const btn of els.tabBtns) {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  }
  const updateSpeedFill = () => {
    const pct = ((parseInt(els.speed.value, 10) - parseInt(els.speed.min, 10)) / (parseInt(els.speed.max, 10) - parseInt(els.speed.min, 10))) * 100;
    els.speed.style.setProperty("--fill", pct + "%");
  };
  els.speed.addEventListener("input", () => { state.fps = parseInt(els.speed.value, 10); els.speedVal.textContent = `${state.fps}x`; updateSpeedFill(); });
  updateSpeedFill();
  if (state.sampleMode) await initSamples();
  await initPhase2();

  await selectScene(state.scenes[0].id);
  if (state.sampleMode && state.requestedSampleId) await runSelectedSample();
  log("simulator ready. select a scene, drop a routines.json, or use the baseline planner.", "ok");
  requestAnimationFrame(loop);
}

function analyticsContext() {
  return {
    sampleMode: state.sampleMode,
    sampleId: state.requestedSampleId || state.sampleActive?.id || "none",
    via: state.viaSharedLink ? "shared_link" : "direct"
  };
}

function startAnalytics() {
  const context = analyticsContext();
  trackAnalytics("takehome_start", {
    sample_mode: context.sampleMode ? "on" : "off",
    sample_id: context.sampleId,
    via: context.via
  });
  initAnalytics(context).then(tracker => {
    state.analytics = tracker;
    const queued = state.analyticsQueue.splice(0);
    for (const [name, params] of queued) tracker.logEvent(name, params);
  });
}

function trackAnalytics(name, params = {}) {
  if (state.analytics) {
    state.analytics.logEvent(name, params);
    return;
  }
  if (state.analyticsQueue.length < 30) state.analyticsQueue.push([name, params]);
}

function configureSampleMode() {
  const params = new URLSearchParams(location.search);
  const sampleParam = params.get("sample");
  const normalized = String(sampleParam ?? "").toLowerCase();

  // Explicit opt-out: ?sample=off (also accepts 0/false/no/candidate)
  if (["0", "false", "off", "no", "candidate"].includes(normalized)) {
    state.sampleMode = false;
    log("candidate view. Add ?sample=1 to the URL for reviewer/demo mode.", "warn");
    return;
  }

  // Default: sample mode ON. ?sample=<id> picks a specific sample; bare URL
  // lands on codex_roboticist.
  state.sampleMode = true;
  if (normalized && !["1", "true", "on", "samples"].includes(normalized)) {
    state.requestedSampleId = sampleParam;
  } else {
    state.requestedSampleId = "codex_roboticist";
  }

  els.modePill.hidden = false;
  els.samplePanel.hidden = false;
  els.notesTabBtn.hidden = false;
  els.notesView.innerHTML = `<p class="notes-empty">Select and run a sample to view its phase READMEs.</p>`;
}

async function initSamples() {
  try {
    const res = await fetch("./_samples/index.json");
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const idx = await res.json();
    state.samples = Array.isArray(idx.samples) ? idx.samples : [];
    els.sampleSelect.innerHTML = "";
    for (const sample of state.samples) {
      const opt = document.createElement("option");
      opt.value = sample.id;
      opt.textContent = sample.label ?? sample.id;
      els.sampleSelect.appendChild(opt);
    }
    if (!state.samples.length) throw new Error("no samples listed");
    if (state.requestedSampleId) {
      if (state.samples.some(s => s.id === state.requestedSampleId)) {
        els.sampleSelect.value = state.requestedSampleId;
      } else {
        log(`sample ${state.requestedSampleId} is not listed in _samples/index.json`, "warn");
        state.requestedSampleId = null;
      }
    }
    els.sampleRunBtn.disabled = false;
    els.sampleStatus.textContent = `${state.samples.length} known sample solution${state.samples.length === 1 ? "" : "s"} available.`;
    log(`sample mode enabled: loaded ${state.samples.length} sample solution${state.samples.length === 1 ? "" : "s"} from _samples`, "warn");
  } catch (e) {
    state.samples = [];
    els.sampleRunBtn.disabled = true;
    els.sampleStatus.textContent = `_samples unavailable (${e.message}).`;
    log(`sample mode enabled, but _samples could not be loaded: ${e.message}`, "warn");
  }
}

async function selectSceneByIndex(i) {
  const n = state.scenes.length;
  if (!n) return;
  const idx = ((i % n) + n) % n;
  state.sceneIndex = idx;
  await selectScene(state.scenes[idx].id);
}

async function selectScene(id) {
  const i = state.scenes.findIndex(s => s.id === id);
  if (i >= 0) state.sceneIndex = i;
  state.activeSceneId = id;
  state.scene = await loadScene(id);
  state.phase2Active = null;
  state.view = makeView(els.canvas, viewBounds(state.scene));
  state.trace = null;
  state.result = null;
  state.frame = 0;
  state.playing = false;
  state.lastPlaybackEnded = false;
  updateSceneNav();
  if (els.runNextOverlay) els.runNextOverlay.hidden = true;
  updateOverlayScene();
  buildSparklinePanel(state.scene);
  renderResult();
  renderRoutine();
  draw();
  trackAnalytics("select_scene", {
    scene_id: id,
    sample_mode: state.sampleMode ? "on" : "off"
  });
}

function updateSceneNav() {
  const s = state.scenes[state.sceneIndex];
  if (!s) return;
  const parts = s.id.split("_");
  if (els.sceneIdx) els.sceneIdx.textContent = parts[0];
  if (els.sceneName) els.sceneName.textContent = parts.slice(1).join(" ") || s.id;
}

function updateOverlayScene() {
  if (!els.overlayScene) return;
  const sc = state.scene;
  els.overlayScene.textContent = `${sc.id}\n${sc.parts.length} parts | ${sc.bins.length} bins | ${sc.obstacles?.length ?? 0} obstacles`;
}

function buildSparklinePanel(scene) {
  if (!els.overlayMetrics) return;
  els.overlayMetrics.innerHTML = "";
  state.sparks = [];
  const links = scene.arm?.links ?? [];
  for (let i = 0; i < links.length; i++) {
    const lim = links[i].limit ?? [-Math.PI, Math.PI];
    state.sparks.push({
      key: `theta${i}`, label: `θ${i}`,
      min: lim[0], max: lim[1],
      buf: createRingBuffer(1024),
      stroke: "#1a1a1c",
      read: snap => snap.angles[i]
    });
  }
  const w = scene.world ?? DEFAULT_WORLD;
  state.sparks.push({
    key: "ee_x", label: "EE.x",
    min: w.x_min, max: w.x_max,
    buf: createRingBuffer(1024),
    stroke: "#ff6a1f",
    read: snap => snap.points[snap.points.length - 1].x
  });
  state.sparks.push({
    key: "ee_y", label: "EE.y",
    min: w.y_min, max: w.y_max,
    buf: createRingBuffer(1024),
    stroke: "#ff6a1f",
    read: snap => snap.points[snap.points.length - 1].y
  });
  for (const spark of state.sparks) {
    const row = document.createElement("div");
    row.className = "spark-row";
    row.innerHTML = `
      <span class="spark-label">${spark.label}</span>
      <span class="spark-value">—</span>
      <canvas class="spark-canvas" width="120" height="14"></canvas>
      <span class="spark-range">${spark.min.toFixed(2)}..${spark.max.toFixed(2)}</span>
    `;
    els.overlayMetrics.appendChild(row);
    spark.valueEl = row.querySelector(".spark-value");
    spark.canvas = row.querySelector("canvas");
    const dpr = window.devicePixelRatio || 1;
    spark.canvas.width = 120 * dpr;
    spark.canvas.height = 14 * dpr;
    spark.canvas.style.width = "120px";
    spark.canvas.style.height = "14px";
    spark.ctx = spark.canvas.getContext("2d");
    spark.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function updateSparklines(snap) {
  if (!state.sparks.length || !snap) return;
  for (const spark of state.sparks) {
    let v;
    try { v = spark.read(snap); } catch { continue; }
    if (!Number.isFinite(v)) continue;
    pushRing(spark.buf, v);
    spark.valueEl.textContent = (v >= 0 ? "+" : "") + v.toFixed(3);
    drawSpark(spark.ctx, spark.buf, {
      width: 120, height: 14,
      min: spark.min, max: spark.max,
      stroke: spark.stroke
    });
  }
}

async function runNextFromOverlay() {
  els.runNextOverlay.hidden = true;
  trackAnalytics("run_next_overlay", {
    scene_index: state.sceneIndex,
    phase2_active: !!state.phase2Active
  });
  const nextIdx = state.sceneIndex + 1;
  if (nextIdx < state.scenes.length) {
    await selectSceneByIndex(nextIdx);
    runActive();
    return;
  }
  const firstPublic = state.phase2Catalog.find(v => v.source === "public");
  if (!firstPublic) {
    log("no Phase 2 public example available", "warn");
    return;
  }
  els.phase2Family.value = firstPublic.family;
  refreshPhase2SceneOptions();
  els.phase2Scene.value = firstPublic.id;
  await loadSelectedPhase2Scene();
  log(`end of benchmark — loaded Phase 2 ${firstPublic.family} example, running v2 now.`, "ok");
  await runPhase2V2();
}

async function initPhase2() {
  const publicVariants = await loadPhase2Catalog("./phase2_examples/", "public");
  const privateVariants = await loadPhase2Catalog("./_private/phase2_variants/", "private");
  state.phase2Catalog = [...publicVariants, ...privateVariants];

  const families = ["capacity", "precedence", "obstacle_routing"]
    .filter(f => state.phase2Catalog.some(v => v.family === f));
  els.phase2Family.innerHTML = "";
  for (const family of families) {
    const opt = document.createElement("option");
    opt.value = family;
    opt.textContent = family;
    els.phase2Family.appendChild(opt);
  }
  if (!families.length) {
    els.phase2Status.textContent = "No Phase 2 variants found.";
    els.phase2LoadBtn.disabled = true;
    els.phase2RunBtn.disabled = true;
    return;
  }
  refreshPhase2SceneOptions();
  const privateCount = privateVariants.length;
  els.phase2Status.textContent = `${publicVariants.length} public variants${privateCount ? `, ${privateCount} private probes` : ""}.`;
}

async function loadPhase2Catalog(base, source) {
  try {
    const res = await fetch(`${base}index.json`);
    if (!res.ok) return [];
    const idx = await res.json();
    const out = [];
    for (const [family, entries] of Object.entries(idx.families ?? {})) {
      for (const entry of entries) {
        out.push({
          family,
          id: entry.id,
          source,
          path: `${base}${entry.path}`
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function refreshPhase2SceneOptions() {
  const family = els.phase2Family.value;
  const entries = state.phase2Catalog.filter(v => v.family === family);
  els.phase2Scene.innerHTML = "";
  for (const entry of entries) {
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = `${entry.id}${entry.source === "private" ? " (private)" : ""}`;
    els.phase2Scene.appendChild(opt);
  }
}

function selectedPhase2Meta() {
  const family = els.phase2Family.value;
  const id = els.phase2Scene.value;
  return state.phase2Catalog.find(v => v.family === family && v.id === id) ?? null;
}

async function loadSelectedPhase2Scene() {
  const meta = selectedPhase2Meta();
  if (!meta) {
    log("no Phase 2 variant selected", "warn");
    return;
  }
  const res = await fetch(meta.path);
  if (!res.ok) {
    log(`failed to load Phase 2 variant ${meta.id}: ${res.status}`, "err");
    return;
  }
  state.scene = await res.json();
  state.activeSceneId = state.scene.id;
  state.phase2Active = meta;
  state.view = makeView(els.canvas, viewBounds(state.scene));
  state.trace = null;
  state.result = null;
  state.frame = 0;
  state.playing = false;
  els.overlay.textContent = `${state.scene.id}\nPhase 2 ${meta.family} | ${meta.source}\n${state.scene.parts.length} parts | ${state.scene.bins.length} bins | ${state.scene.obstacles?.length ?? 0} obstacles`;
  log(`loaded Phase 2 ${meta.source} variant ${state.scene.id} (${meta.family})`, "ok");
  trackAnalytics("load_phase2_variant", {
    family: meta.family,
    variant_id: meta.id,
    source: meta.source
  });
  renderResult();
  renderRoutine();
  draw();
}

async function runPhase2V2() {
  const meta = selectedPhase2Meta();
  if (!meta) {
    log("no Phase 2 variant selected", "warn");
    return;
  }
  trackAnalytics("run_phase2", { family: meta.family, variant: meta.id, via: analyticsContext().via });
  if (!state.phase2Active || state.phase2Active.id !== meta.id) {
    await loadSelectedPhase2Scene();
  }
  try {
    const v2Base = state.sampleActive?.phase2
      ?? "../solution/phase2/index.js";
    const v2Path = `${v2Base}${v2Base.includes("?") ? "&" : "?"}cache=${Date.now()}`;
    const mod = await import(v2Path);
    if (state.sampleActive) {
      log(`v2 resolved to sample:${state.sampleActive.id} → ${v2Base}`, "warn");
    }
    const planner = mod.plan ?? mod.default;
    if (typeof planner !== "function") {
      throw new Error("solution/phase2/index.js must export plan(scene, context) or a default function");
    }
    if (mod.family && mod.family !== meta.family) {
      log(`v2 module declares family=${mod.family}; running selected family=${meta.family}`, "warn");
    }
    const produced = await planner(state.scene, {
      family: meta.family,
      variantId: state.scene.id,
      source: meta.source
    });
    const entry = normalizePhase2Routine(produced, state.scene.id);
    state.bundle = {
      generator: "solution/phase2/index.js",
      scenarios: { [state.scene.id]: entry }
    };
    els.bundleStatus.textContent = `phase2:${state.scene.id}`;
    log(`v2 generated ${entry.steps.length} steps for ${state.scene.id}`, "ok");
    trackAnalytics("generate_phase2_routine", {
      family: meta.family,
      variant_id: state.scene.id,
      source: meta.source,
      steps: entry.steps.length,
      sample_mode: state.sampleMode ? "on" : "off"
    });
    runActive({ generatePhase2: false });
  } catch (e) {
    log(`Phase 2 v2 failed: ${e.message}`, "err");
  }
}

function normalizePhase2Routine(value, sceneId) {
  if (Array.isArray(value)) return { steps: value };
  if (value?.steps && Array.isArray(value.steps)) return value;
  const bundled = value?.scenarios?.[sceneId];
  if (bundled?.steps && Array.isArray(bundled.steps)) return bundled;
  throw new Error("v2 planner must return {steps:[...]}, a steps array, or a bundle entry for this scene");
}

function setTab(tab) {
  state.activeTab = tab;
  const bodyId = tab === "log" ? "log" : tab === "routine" ? "routine-view" : "notes-view";
  for (const btn of els.tabBtns) btn.classList.toggle("active", btn.dataset.tab === tab);
  for (const body of els.tabBodies) body.classList.toggle("active", body.id === bodyId);
  if (tab === "routine") updateRoutineHighlight({ force: true, scroll: true });
}

async function loadSampleNotes(sample) {
  const docs = [
    ["Phase 1", sample?.phase1_readme],
    ["Phase 2", sample?.phase2_readme]
  ].filter(([, href]) => href);
  if (!docs.length) {
    els.notesView.innerHTML = `<p class="notes-empty">Sample ${esc(sample?.id ?? "?")} has no README paths in _samples/index.json.</p>`;
    return;
  }
  try {
    const rendered = [];
    for (const [label, href] of docs) {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`${href} fetch failed: ${res.status}`);
      const md = await res.text();
      rendered.push(`<div class="notes-header">${esc(sample.label ?? sample.id)} — ${esc(label)} — ${esc(href)}</div>${renderMarkdown(md)}`);
    }
    els.notesView.innerHTML = rendered.join("<hr />");
  } catch (e) {
    els.notesView.innerHTML = `<p class="notes-empty">Notes for ${esc(sample.id)} unavailable (${esc(e.message)}).</p>`;
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}

function runActive(options) {
  const generatePhase2 = options?.generatePhase2 ?? true;
  if (generatePhase2 && state.phase2Active && state.phase2Active.id === state.activeSceneId) {
    runPhase2V2();
    return;
  }
  if (!state.bundle) {
    log("no bundle loaded — drop a routines.json or click 'baseline'", "warn");
    return;
  }
  const entry = state.bundle.scenarios?.[state.activeSceneId];
  if (!entry) {
    log(`bundle has no entry for ${state.activeSceneId}`, "warn");
    return;
  }
  const { result, trace } = runRoutine(state.scene, entry, { recordTrace: true });
  state.result = result;
  state.trace = trace;
  state.frame = 0;
  state.activeRoutineStep = null;
  state.playing = true;
  els.pauseBtn.textContent = "■ pause";
  log(`ran ${state.activeSceneId}: ${result.success ? "PASS" : "FAIL"} (${result.parts_placed}/${result.parts_total}, ${result.violations.length} violations, ${result.elapsed_micro_steps} steps)`, result.success ? "ok" : "err");
  trackAnalytics("run_routine", {
    scene_id: state.activeSceneId,
    sample_mode: state.sampleMode ? "on" : "off",
    sample_id: state.sampleActive?.id || "none",
    phase2_active: !!state.phase2Active,
    success: result.success,
    parts_placed: result.parts_placed,
    parts_total: result.parts_total,
    violations: result.violations.length
  });
  for (const v of result.violations) log(`  violation @ step ${v.step_index}: ${v.kind} — ${v.detail}`, "err");
  renderResult();
  renderRoutine();
  updateRoutineHighlight({ force: true, scroll: state.activeTab === "routine" });
}

async function runSelectedSample() {
  const sample = state.samples.find(s => s.id === els.sampleSelect.value);
  if (!sample) {
    log("no sample selected", "warn");
    return;
  }
  trackAnalytics("run_sample", { sample_id: sample.id, via: analyticsContext().via });
  try {
    const res = await fetch(sample.routines);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const bundle = await res.json();
    const issues = validateRoutineBundle(bundle);
    if (issues.length) {
      for (const i of issues) log(`sample bundle issue: ${i}`, "err");
      return;
    }
    state.bundle = bundle;
    state.sampleActive = sample;
    trackAnalytics("load_sample", {
      sample_id: sample.id
    });
    els.bundleStatus.textContent = `sample:${sample.id}`;
    els.sampleStatus.textContent = `${sample.label ?? sample.id} loaded. Phase 2 v2 now resolves to this sample's module.`;
    const scenes = await Promise.all(state.scenes.map(s => loadScene(s.id)));
    const summary = runBundle(scenes, bundle).summary;
    log(`loaded sample ${sample.id}: ${summary.scenes_passed}/${summary.scenes_total} scenes, ${summary.parts_placed}/${summary.parts_total} parts, ${summary.total_violations} violations`, summary.total_violations ? "warn" : "ok");
    loadSampleNotes(sample);
    if (state.phase2Active && state.phase2Active.id === state.activeSceneId) {
      await selectSceneByIndex(0);
    }
    runActive();
  } catch (e) {
    els.sampleStatus.textContent = `${sample.label ?? sample.id} unavailable (${e.message}).`;
    log(`sample ${sample.id} unavailable: ${e.message}`, "err");
  }
}

function runBaseline() {
  log("running baseline planner across all scenes...");
  const bundle = { generator: "naiveSolve()", scenarios: {} };
  Promise.all(state.scenes.map(s => loadScene(s.id))).then(scenes => {
    for (const sc of scenes) bundle.scenarios[sc.id] = naiveSolve(sc);
    state.bundle = bundle;
    els.bundleStatus.textContent = "baseline";
    const summary = runBundle(scenes, bundle);
    log(`baseline: ${summary.summary.scenes_passed}/${summary.summary.scenes_total} scenes, ${summary.summary.parts_placed}/${summary.summary.parts_total} parts placed`, summary.summary.scenes_passed === summary.summary.scenes_total ? "ok" : "warn");
    runActive();
  });
}

function onBundleUpload(ev) {
  const f = ev.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const bundle = JSON.parse(reader.result);
      const issues = validateRoutineBundle(bundle);
      if (issues.length) {
        for (const i of issues) log(`bundle issue: ${i}`, "err");
        return;
      }
      state.bundle = bundle;
      els.bundleStatus.textContent = f.name;
      log(`loaded bundle ${f.name} with ${Object.keys(bundle.scenarios).length} scenarios`, "ok");
      trackAnalytics("upload_bundle", {
        scenarios: Object.keys(bundle.scenarios).length,
        sample_mode: state.sampleMode ? "on" : "off"
      });
      renderRoutine();
    } catch (e) {
      log(`failed to parse bundle: ${e.message}`, "err");
    }
  };
  reader.readAsText(f);
}

function exportResults() {
  if (!state.bundle) { log("no bundle to evaluate", "warn"); return; }
  Promise.all(state.scenes.map(s => loadScene(s.id))).then(scenes => {
    const out = runBundle(scenes, state.bundle);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.json";
    a.click();
    URL.revokeObjectURL(url);
    log(`exported results.json: ${out.summary.scenes_passed}/${out.summary.scenes_total} scenes passed`, "ok");
    trackAnalytics("export_results", {
      scenes_passed: out.summary.scenes_passed,
      scenes_total: out.summary.scenes_total,
      parts_placed: out.summary.parts_placed,
      violations: out.summary.total_violations
    });
  });
}

function renderResult() {
  const r = state.result;
  if (!r) {
    els.result.innerHTML = `<div class="row"><span class="k">status</span><span class="v status-pending">○ no run</span></div>`;
    return;
  }
  const statusCls = r.success ? "status-pass" : "status-fail";
  const statusSym = r.success ? "● PASS" : "☒ FAIL";
  els.result.innerHTML = `
    <div class="row"><span class="k">status</span><span class="v ${statusCls}">${statusSym}</span></div>
    <div class="row"><span class="k">parts placed</span><span class="v">${r.parts_placed} / ${r.parts_total}</span></div>
    <div class="row"><span class="k">violations</span><span class="v">${r.violations.length}</span></div>
    <div class="row"><span class="k">micro-steps</span><span class="v">${r.elapsed_micro_steps}</span></div>
    <div class="row"><span class="k">path length</span><span class="v">${r.path_length.toFixed(3)}</span></div>
    <div class="row"><span class="k">termination</span><span class="v">${r.termination_reason}</span></div>
  `;
}

function activeRoutineEntry() {
  return state.bundle?.scenarios?.[state.activeSceneId] ?? null;
}

function stepArgs(step) {
  if (!step) return "";
  if (step.type === "move_joint") return `angles=[${(step.angles ?? []).map(v => Number(v).toFixed(3)).join(", ")}]`;
  if (step.type === "move_pose") return `x=${Number(step.x).toFixed(3)} y=${Number(step.y).toFixed(3)}`;
  if (step.type === "wait") return `duration=${step.duration}`;
  return "";
}

function renderRoutine() {
  const entry = activeRoutineEntry();
  if (!state.bundle) {
    els.routineView.innerHTML = `<div class="routine-empty">No bundle loaded.</div>`;
    return;
  }
  if (!entry) {
    els.routineView.innerHTML = `<div class="routine-empty">No routine for ${escapeHtml(state.activeSceneId)}.</div>`;
    return;
  }

  const steps = entry.steps ?? [];
  const r = state.result;
  const firstViolation = r?.violations?.[0]?.step_index;
  const summary = [
    `${steps.length} routine steps`,
    r ? `${r.success ? "PASS" : "FAIL"}` : "not run",
    r ? `${r.parts_placed}/${r.parts_total} parts` : null,
    r ? `${r.violations.length} violations` : null,
    r ? `${r.path_length.toFixed(3)} path` : null,
    r ? `${r.elapsed_micro_steps} micro-steps` : null
  ].filter(Boolean).map(x => `<span>${escapeHtml(x)}</span>`).join("");

  if (!steps.length) {
    els.routineView.innerHTML = `<div class="routine-summary">${summary}</div><div class="routine-empty">Routine has 0 steps.</div>`;
    return;
  }

  const rows = steps.map((step, i) => {
    const cls = i === firstViolation ? "routine-step violation" : "routine-step";
    return `<div class="${cls}" data-step-index="${i}">
      <span class="idx">${i}</span>
      <span class="type">${escapeHtml(step.type)}</span>
      <span>${escapeHtml(stepArgs(step))}</span>
    </div>`;
  }).join("");
  els.routineView.innerHTML = `<div class="routine-summary">${summary}</div>${rows}`;
  state.activeRoutineStep = null;
  updateRoutineHighlight({ force: true, scroll: false });
}

function activeTraceStepIndex() {
  const idx = currentSnapshot()?.step_index;
  return Number.isInteger(idx) && idx >= 0 ? idx : null;
}

function updateRoutineHighlight({ force = false, scroll = false } = {}) {
  const activeStep = activeTraceStepIndex();
  if (!force && activeStep === state.activeRoutineStep) return;
  state.activeRoutineStep = activeStep;

  const rows = els.routineView.querySelectorAll(".routine-step");
  let activeRow = null;
  for (const row of rows) {
    const on = activeStep != null && Number(row.dataset.stepIndex) === activeStep;
    row.classList.toggle("active", on);
    if (on) activeRow = row;
  }
  if (scroll && activeRow && state.activeTab === "routine") {
    activeRow.scrollIntoView({ block: "nearest" });
  }
}

function currentSnapshot() {
  if (!state.trace || state.trace.length === 0) {
    const arm = state.scene.arm;
    const angles = arm.initial_angles ? arm.initial_angles.slice() : new Array(arm.links.length).fill(0).map((_, i) => i === 1 ? 1.2 : 0);
    return { angles, points: pointsFromAngles(state.scene, angles), gripper: "open", heldPart: null, partPositions: Object.fromEntries(state.scene.parts.map(p => [p.id, { x: p.x, y: p.y }])), placedParts: [] };
  }
  const idx = Math.min(state.frame, state.trace.length - 1);
  return state.trace[idx];
}

function pointsFromAngles(scene, angles) {
  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const pts = [{ x: base.x, y: base.y }];
  let theta = 0, x = base.x, y = base.y;
  for (let i = 0; i < angles.length; i++) {
    theta += angles[i];
    x += lengths[i] * Math.cos(theta);
    y += lengths[i] * Math.sin(theta);
    pts.push({ x, y });
  }
  return pts;
}

function draw() {
  if (!state.scene) return;
  const snap = currentSnapshot();
  render(state.view, state.scene, snap);
}

function loop(ts) {
  let advanced = false;
  if (state.playing && state.trace) {
    const dt = ts - state.lastTs;
    if (dt >= 1000 / state.fps) {
      state.frame += Math.max(1, Math.floor(state.fps / 30));
      state.lastTs = ts;
      advanced = true;
      updateRoutineHighlight({ scroll: true });
      if (state.frame >= state.trace.length - 1) {
        state.frame = state.trace.length - 1;
        state.playing = false;
        els.pauseBtn.textContent = "▶ resume";
        onPlaybackEnded();
      }
    }
  }
  if (advanced) updateSparklines(currentSnapshot());
  draw();
  requestAnimationFrame(loop);
}

function onPlaybackEnded() {
  state.lastPlaybackEnded = true;
  if (state.bundle && els.runNextOverlay) els.runNextOverlay.hidden = false;
}

window.addEventListener("resize", () => {
  if (state.scene) state.view = makeView(els.canvas, viewBounds(state.scene));
});

init().catch(e => log(`init failed: ${e.message}`, "err"));
