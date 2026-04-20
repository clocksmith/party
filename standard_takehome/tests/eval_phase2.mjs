// Reviewer CLI: scores a candidate's solution/phase2/index.js against the
// public phase2_examples/ set and, if present, the reviewer-only private
// variants under _private/phase2_variants/.
//
//   node tests/eval_phase2.mjs --module solution/phase2/index.js
//                              [--family capacity|precedence|obstacle_routing]
//                              [--budget-ms 2000]
//                              [--include-private]
//
// Per RUBRIC.md:
//   - Each variant has a 2-second wall-clock budget (override with --budget-ms).
//     Enforced with worker_threads + worker.terminate(); synchronous planners
//     that blow the budget are killed, not awaited.
//   - Normal + stress variants score +1 per part placed safely.
//   - Unsolvable variants score +1 for correct refusal (empty routine, or a
//     routine that runs to completion with parts_placed == 0 and zero
//     violations). Any non-empty routine that violates on an unsolvable
//     variant trips the safety gate.
//   - Timeouts score 0 but do not trip the gate.
//
// Exit codes:
//   0 — evaluation completed (safety gate status is in the JSON output)
//   2 — usage, IO, module-load, or schema failure

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Worker } from "node:worker_threads";
import { runRoutine } from "../src/sim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function argv(key, def) {
  const i = process.argv.indexOf(key);
  return i > 0 ? process.argv[i + 1] : def;
}
function argvFlag(key) {
  return process.argv.includes(key);
}

const modulePath = argv("--module", "solution/phase2/index.js");
const familyFilter = argv("--family", null);
const budgetMs = Number(argv("--budget-ms", 2000));
const includePrivate = argvFlag("--include-private")
  || fs.existsSync(path.join(root, "_private/phase2_variants"));

if (!fs.existsSync(path.join(root, modulePath))) {
  console.error(`module not found: ${modulePath}`);
  process.exit(2);
}

// Pre-load the module once in the main thread purely to read its `family`
// export and surface declared family in reports. Worker reloads per variant
// to get the budget wall around plan() itself.
let declaredFamily = null;
try {
  const mod = await import(new URL(path.join(root, modulePath), "file://").href
    .replace("file:///", "file:///"));
  declaredFamily = mod.family ?? null;
} catch {
  // Worker will surface the import error per-variant.
}

function loadVariantSet(dir, source) {
  const idxPath = path.join(dir, "index.json");
  if (!fs.existsSync(idxPath)) return [];
  const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
  const out = [];
  for (const [family, entries] of Object.entries(idx.families ?? {})) {
    if (familyFilter && family !== familyFilter) continue;
    if (declaredFamily && family !== declaredFamily) continue;
    for (const entry of entries) {
      const scenePath = path.join(dir, entry.path);
      if (!fs.existsSync(scenePath)) continue;
      out.push({
        family,
        source,
        type: entry.type ?? "normal",
        id: entry.id,
        scene: JSON.parse(fs.readFileSync(scenePath, "utf8"))
      });
    }
  }
  return out;
}

const variants = [
  ...loadVariantSet(path.join(root, "phase2_examples"), "public"),
  ...(includePrivate ? loadVariantSet(path.join(root, "_private/phase2_variants"), "private") : [])
];

function normalizeRoutine(value, sceneId) {
  if (Array.isArray(value)) return { steps: value };
  if (value?.steps && Array.isArray(value.steps)) return value;
  const bundled = value?.scenarios?.[sceneId];
  if (bundled?.steps && Array.isArray(bundled.steps)) return bundled;
  throw new Error("plan() must return {steps:[...]}, a steps array, or a bundle entry for this scene");
}

function planWithBudget(scene, context) {
  return new Promise((resolve) => {
    const workerUrl = new URL("./_phase2_worker.mjs", import.meta.url);
    const worker = new Worker(workerUrl, {
      workerData: { modulePath, scene, context }
    });
    const start = performance.now();
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ status: "timeout", elapsed_ms: performance.now() - start });
    }, budgetMs);
    worker.once("message", (msg) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(msg);
    });
    worker.once("error", (err) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ status: "threw", error: err?.message ?? String(err), elapsed_ms: performance.now() - start });
    });
  });
}

const out = {
  module: modulePath,
  declared_family: declaredFamily,
  budget_ms: budgetMs,
  variants: [],
  summary: {
    safety_gate: "pass",
    coverage: 0,
    parts_placed: 0,
    refusals_correct: 0,
    refusals_expected: 0,
    timeouts: 0,
    violations: 0,
    variants_total: variants.length
  }
};

for (const v of variants) {
  const context = { family: v.family, variantId: v.scene.id, source: v.source };
  const msg = await planWithBudget(v.scene, context);

  const row = {
    family: v.family,
    source: v.source,
    type: v.type,
    id: v.id,
    elapsed_ms: Math.round(msg.elapsed_ms ?? 0),
    parts_placed: 0,
    parts_total: v.scene.parts.length,
    violations: [],
    steps: 0,
    score: 0,
    outcome: "pending"
  };

  if (msg.status === "timeout") {
    row.outcome = "timeout";
    row.elapsed_ms = budgetMs;
    out.summary.timeouts += 1;
    out.variants.push(row);
    continue;
  }
  if (msg.status === "threw" || msg.status === "bad_module") {
    row.outcome = msg.status;
    row.error = msg.error;
    out.variants.push(row);
    continue;
  }

  let normalized;
  try { normalized = normalizeRoutine(msg.routine, v.scene.id); }
  catch (e) {
    row.outcome = "bad_shape";
    row.error = e.message;
    out.variants.push(row);
    continue;
  }

  row.steps = normalized.steps.length;
  const { result } = runRoutine(v.scene, normalized, { recordTrace: false });
  row.parts_placed = result.parts_placed;
  row.violations = result.violations;

  if (result.violations.length > 0) {
    row.outcome = "violated";
    out.summary.safety_gate = "fail";
    out.summary.violations += result.violations.length;
  } else if (v.type === "unsolvable") {
    out.summary.refusals_expected += 1;
    if (result.parts_placed === 0) {
      row.outcome = "refused_correctly";
      row.score = 1;
      out.summary.refusals_correct += 1;
      out.summary.coverage += 1;
    } else {
      row.outcome = "unexpectedly_solvable";
    }
  } else {
    row.outcome = result.success ? "completed" : "partial_safe";
    row.score = result.parts_placed;
    out.summary.parts_placed += result.parts_placed;
    out.summary.coverage += result.parts_placed;
  }

  out.variants.push(row);
}

const outPath = path.join(root, "reval_phase2.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

const gate = out.summary.safety_gate.toUpperCase();
console.log(`phase 2 evaluation — module: ${modulePath}`);
if (declaredFamily) console.log(`declared family: ${declaredFamily}`);
console.log(`variants: ${out.summary.variants_total}  budget: ${budgetMs}ms\n`);

for (const row of out.variants) {
  const tag = row.outcome.padEnd(22);
  console.log(`  [${row.source.padEnd(7)}] ${row.type.padEnd(10)} ${row.id.padEnd(32)} ${tag} parts=${row.parts_placed}/${row.parts_total} viol=${row.violations.length} steps=${row.steps} ${row.elapsed_ms}ms`);
}

console.log(`\nsafety gate: ${gate}`);
console.log(`coverage:    ${out.summary.coverage}   (parts_placed=${out.summary.parts_placed}, refusals=${out.summary.refusals_correct}/${out.summary.refusals_expected})`);
console.log(`timeouts:    ${out.summary.timeouts}`);
console.log(`violations:  ${out.summary.violations}`);
console.log(`\nrubric: RUBRIC.md — safety gate (above), coverage (scalar), tradeoff clarity (from solution/README.md).`);
console.log(`wrote ${path.relative(root, outPath)}`);

process.exit(0);
