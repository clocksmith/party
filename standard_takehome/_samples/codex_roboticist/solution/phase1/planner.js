import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { endEffector, ik } from "../../../../src/arm.js";
import { checkConfiguration, runRoutine } from "../../../../src/sim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const OUT = path.join(__dirname, "routines.json");

const MICRO_STEP = 0.02;
function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function roundAngle(a) {
  return Number(a.toFixed(6));
}

function roundConfig(q) {
  return q.map(roundAngle);
}

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seedText) {
  let x = hashString(seedText) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 4294967296);
  };
}

function armModel(scene) {
  return {
    lengths: scene.arm.links.map(l => l.length),
    limits: scene.arm.links.map(l => l.limit ?? [-Math.PI, Math.PI]),
    base: { x: scene.arm.base[0], y: scene.arm.base[1] }
  };
}

function partPositions(scene) {
  return Object.fromEntries(scene.parts.map(p => [p.id, { x: p.x, y: p.y }]));
}

function modeState(scene, mode) {
  return {
    heldPart: mode.heldPart ?? null,
    placedParts: new Set(mode.placedIds ?? []),
    partPositions: partPositions(scene)
  };
}

function validConfig(scene, q, mode) {
  if (!Array.isArray(q) || q.length !== scene.arm.links.length) return false;
  if (q.some(v => !Number.isFinite(v))) return false;
  return !checkConfiguration(q, scene, modeState(scene, mode));
}

function angleDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function transitionValid(scene, from, to, mode) {
  const state = modeState(scene, mode);
  let q = from.slice();
  while (true) {
    let maxDelta = 0;
    for (let i = 0; i < to.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(to[i] - q[i]));
    }
    if (maxDelta < 1e-6) return true;

    const t = Math.min(1, MICRO_STEP / maxDelta);
    const next = q.map((v, i) => v + (to[i] - v) * t);
    if (checkConfiguration(next, scene, state)) return false;
    q = next;
  }
}

function ee(scene, q) {
  const { lengths, base } = armModel(scene);
  return endEffector(q, lengths, base);
}

function pointInBin(p, bin) {
  return p.x >= bin.x && p.x <= bin.x + bin.w && p.y >= bin.y && p.y <= bin.y + bin.h;
}

function compatibleBins(scene, part, used) {
  const kind = part.kind ?? "default";
  return scene.bins.filter(bin => {
    const accepts = bin.accepts ?? "any";
    const acceptsPart = accepts === "any"
      || (Array.isArray(accepts) && (accepts.includes(kind) || accepts.includes(part.id)));
    const cap = bin.capacity ?? Infinity;
    return acceptsPart && ((used[bin.id] ?? 0) < cap);
  });
}

function binPreference(bin, part) {
  const accepts = bin.accepts ?? "any";
  const kind = part.kind ?? "default";
  if (Array.isArray(accepts) && accepts.length === 1 && accepts[0] === kind) return 0;
  if (Array.isArray(accepts) && accepts.includes(kind)) return accepts.length;
  if (accepts === "any") return 100;
  return 50;
}

function binTargetPoints(bin) {
  const margin = 0.035;
  const xs = [
    bin.x + bin.w / 2,
    Math.max(bin.x + margin, bin.x + bin.w * 0.35),
    Math.min(bin.x + bin.w - margin, bin.x + bin.w * 0.65)
  ];
  const ys = [
    bin.y + bin.h / 2,
    Math.min(bin.y + bin.h - margin, bin.y + bin.h * 0.72)
  ];
  const out = [];
  for (const x of xs) {
    for (const y of ys) out.push({ x, y });
  }
  return out;
}

function dedupeConfigs(configs, minDist = 0.05) {
  const out = [];
  for (const q of configs) {
    if (!out.some(p => angleDistance(p, q) < minDist)) out.push(q);
  }
  return out;
}

function fixedSeeds(scene, current) {
  const n = scene.arm.links.length;
  const initial = scene.arm.initial_angles ?? new Array(n).fill(0).map((_, i) => i === 1 ? 1.2 : 0);
  const seeds = [
    current,
    initial,
    [0.15, 1.25, 1.15],
    [0.90, 0.88, 1.16],
    [0.94, -1.05, -1.74],
    [0.35, 1.75, -1.35],
    [0.75, 1.05, -1.65],
    [1.25, 0.75, -1.8],
    [2.07, 1.32, 1.10],
    [2.10, -0.52, -1.55],
    [1.65, -0.55, -1.55],
    [2.25, -1.25, -0.85],
    [2.65, -1.75, 0.55],
    [2.85, -2.05, 1.25],
    [1.05, 1.35, 1.05],
    [1.95, -0.2, -2.05],
    [2.55, 0.85, -2.35]
  ];
  return seeds.filter(s => Array.isArray(s) && s.length === n);
}

function randomSeed(scene, rng) {
  return scene.arm.links.map(link => {
    const lim = link.limit ?? [-Math.PI, Math.PI];
    return lim[0] + rng() * (lim[1] - lim[0]);
  });
}

function solveTargetConfigs(scene, target, mode, current, opts = {}) {
  const { lengths, limits, base } = armModel(scene);
  const rng = makeRng(`${scene.id}:target:${target.x}:${target.y}:${mode.heldPart ?? "free"}`);
  const seeds = fixedSeeds(scene, current);
  for (let i = 0; i < (opts.randomSeeds ?? 120); i++) seeds.push(randomSeed(scene, rng));

  const configs = [];
  for (const seed of seeds) {
    const sol = ik(target.x, target.y, seed, lengths, {
      base,
      limits,
      tol: 1e-3,
      maxIter: 700,
      damping: 0.025
    });
    if (!sol.converged) continue;
    const q = roundConfig(sol.angles);
    if (!validConfig(scene, q, mode)) continue;
    const actual = ee(scene, q);
    if (opts.bin && !pointInBin(actual, opts.bin)) continue;
    const err = Math.hypot(actual.x - target.x, actual.y - target.y);
    if (!opts.bin && err > 0.01) continue;
    configs.push(q);
  }
  return dedupeConfigs(configs).sort((a, b) => angleDistance(current, a) - angleDistance(current, b));
}

const TRANSIT_CACHE = new Map();

function transitTargets(scene) {
  const yTop = Math.min(0.78, (scene.world?.y_max ?? 0.9) - 0.08);
  const obsTop = Math.max(0.52, ...(scene.obstacles ?? []).map(o => o.y + o.h + 0.18));
  const high = Math.min(yTop, obsTop);
  return [
    { x: 0.15, y: high },
    { x: -0.18, y: high },
    { x: 0.42, y: high - 0.03 },
    { x: -0.46, y: high - 0.06 },
    { x: 0.68, y: 0.42 },
    { x: -0.68, y: 0.28 },
    { x: 0.0, y: 0.72 },
    { x: 0.32, y: 0.62 },
    { x: -0.32, y: 0.62 }
  ];
}

function transitConfigs(scene, mode, current) {
  const key = [
    scene.id,
    mode.heldPart ?? "free",
    [...(mode.placedIds ?? [])].sort().join(",")
  ].join("|");
  if (TRANSIT_CACHE.has(key)) return TRANSIT_CACHE.get(key);

  const configs = [];
  for (const p of transitTargets(scene)) {
    configs.push(...solveTargetConfigs(scene, p, mode, current, { randomSeeds: 30 }));
  }
  const rng = makeRng(`${scene.id}:transit:${mode.heldPart ?? "free"}:${[...(mode.placedIds ?? [])].join(",")}`);
  for (let i = 0; i < 30; i++) {
    const q = roundConfig(randomSeed(scene, rng));
    if (validConfig(scene, q, mode)) configs.push(q);
  }
  const out = dedupeConfigs(configs, 0.08);
  TRANSIT_CACHE.set(key, out);
  return out;
}

function steer(from, to, step) {
  const d = angleDistance(from, to);
  if (d <= step) return to.slice();
  const t = step / d;
  return roundConfig(from.map((v, i) => v + (to[i] - v) * t));
}

function nearestIndex(nodes, q) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = angleDistance(nodes[i].q, q);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

function trace(nodes, idx) {
  const out = [];
  let i = idx;
  while (i >= 0) {
    out.push(nodes[i].q);
    i = nodes[i].parent;
  }
  out.reverse();
  return out;
}

function extendTree(scene, tree, target, mode, stepSize) {
  const ni = nearestIndex(tree.nodes, target);
  const from = tree.nodes[ni].q;
  const q = steer(from, target, stepSize);
  if (angleDistance(q, from) < 1e-6) return null;
  if (!validConfig(scene, q, mode)) return null;
  if (!transitionValid(scene, from, q, mode)) return null;
  tree.nodes.push({ q, parent: ni });
  return tree.nodes.length - 1;
}

function connectTree(scene, tree, target, mode, stepSize) {
  let last = null;
  while (true) {
    const ni = nearestIndex(tree.nodes, target);
    const from = tree.nodes[ni].q;
    if (angleDistance(from, target) <= stepSize) {
      if (transitionValid(scene, from, target, mode)) {
        tree.nodes.push({ q: target.slice(), parent: ni });
        return tree.nodes.length - 1;
      }
      return last;
    }
    const next = steer(from, target, stepSize);
    if (!validConfig(scene, next, mode)) return last;
    if (!transitionValid(scene, from, next, mode)) return last;
    tree.nodes.push({ q: next, parent: ni });
    last = tree.nodes.length - 1;
  }
}

function randomConfig(scene, rng) {
  return roundConfig(scene.arm.links.map(link => {
    const lim = link.limit ?? [-Math.PI, Math.PI];
    return lim[0] + rng() * (lim[1] - lim[0]);
  }));
}

function rrtConnect(scene, start, goal, mode, seedText) {
  if (!validConfig(scene, start, mode) || !validConfig(scene, goal, mode)) return null;

  const anchors = transitConfigs(scene, mode, start).filter(q => validConfig(scene, q, mode));
  const rng = makeRng(seedText);
  let treeA = { nodes: [{ q: start.slice(), parent: -1 }] };
  let treeB = { nodes: [{ q: goal.slice(), parent: -1 }] };
  let aIsStart = true;
  const stepSize = 0.12;

  for (let iter = 0; iter < 60000; iter++) {
    let sample;
    if (iter % 9 === 0) {
      sample = goal;
    } else if (anchors.length && iter % 5 === 0) {
      sample = anchors[(iter / 5) % anchors.length | 0];
    } else {
      sample = randomConfig(scene, rng);
      if (!validConfig(scene, sample, mode)) continue;
    }

    const ai = extendTree(scene, treeA, sample, mode, stepSize);
    if (ai != null) {
      const qi = treeA.nodes[ai].q;
      const bi = connectTree(scene, treeB, qi, mode, stepSize);
      if (bi != null && angleDistance(treeB.nodes[bi].q, qi) < 1e-6) {
        const pathA = trace(treeA.nodes, ai);
        const pathB = trace(treeB.nodes, bi);
        return aIsStart
          ? pathA.concat(pathB.slice(0, -1).reverse())
          : pathB.concat(pathA.slice(0, -1).reverse());
      }
    }

    [treeA, treeB] = [treeB, treeA];
    aIsStart = !aIsStart;
  }

  return null;
}

function simplifyPath(scene, path, mode) {
  if (!path || path.length < 2) return path;
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let best = i + 1;
    for (let j = path.length - 1; j > i + 1; j--) {
      if (transitionValid(scene, path[i], path[j], mode)) {
        best = j;
        break;
      }
    }
    out.push(path[best]);
    i = best;
  }
  return out;
}

function planMotion(scene, start, goal, mode, seedText) {
  if (transitionValid(scene, start, goal, mode)) return [start, goal];

  const via = transitConfigs(scene, mode, start)
    .filter(q => validConfig(scene, q, mode))
    .sort((a, b) => (
      angleDistance(start, a) + angleDistance(a, goal)
    ) - (
      angleDistance(start, b) + angleDistance(b, goal)
    ));

  for (const q of via) {
    if (transitionValid(scene, start, q, mode) && transitionValid(scene, q, goal, mode)) {
      return [start, q, goal];
    }
  }

  const rrt = rrtConnect(scene, start, goal, mode, seedText);
  return rrt ? simplifyPath(scene, rrt, mode) : null;
}

function precedenceMet(part, placed) {
  return (part.requires ?? []).every(id => placed.has(id));
}

function orderParts(scene, placed, blockedIds = new Set()) {
  const hasObstacles = (scene.obstacles ?? []).length > 0;
  return scene.parts
    .filter(part => !placed.has(part.id) && !blockedIds.has(part.id) && precedenceMet(part, placed))
    .sort((a, b) => {
      if (hasObstacles) {
        const ax = a.x + a.y * 0.35;
        const bx = b.x + b.y * 0.35;
        return ax - bx;
      }
      return b.x - a.x || a.y - b.y;
    });
}

function candidateKey(candidate) {
  const pick = candidate.toPick[candidate.toPick.length - 1].map(v => v.toFixed(3)).join(",");
  const drop = candidate.toDrop[candidate.toDrop.length - 1].map(v => v.toFixed(3)).join(",");
  return `${candidate.part.id}:${candidate.bin.id}:${pick}:${drop}:${candidate.toDrop.length}`;
}

function planPickPlace(scene, current, placed, used, part, skipKeys = new Set()) {
  const routeFirst = (scene.obstacles ?? []).length > 0;
  const freeMode = { heldPart: null, placedIds: [...placed] };
  const pickConfigs = solveTargetConfigs(
    scene,
    { x: part.x, y: part.y },
    freeMode,
    current,
    { randomSeeds: 160 }
  );
  const bins = compatibleBins(scene, part, used).sort((a, b) => {
    const pa = binPreference(a, part);
    const pb = binPreference(b, part);
    if (pa !== pb) return pa - pb;
    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    return Math.hypot(ca.x - part.x, ca.y - part.y) - Math.hypot(cb.x - part.x, cb.y - part.y);
  });

  let best = null;
  const pickLimit = routeFirst ? 8 : 16;
  const dropLimit = routeFirst ? 8 : 16;

  for (const pick of pickConfigs.slice(0, pickLimit)) {
    const toPick = planMotion(scene, current, pick, freeMode, `${scene.id}:${part.id}:pick`);
    if (!toPick) continue;
    const heldMode = { heldPart: part.id, placedIds: [...placed] };

    for (const bin of bins) {
      for (const target of binTargetPoints(bin)) {
        const binConfigs = solveTargetConfigs(scene, target, heldMode, pick, {
          randomSeeds: 180,
          bin
        });
        for (const drop of binConfigs.slice(0, dropLimit)) {
          const toDrop = planMotion(scene, pick, drop, heldMode, `${scene.id}:${part.id}:drop:${bin.id}`);
          if (!toDrop) continue;
          const score = pathCost(toPick) + pathCost(toDrop) + binPreference(bin, part) * 100;
          const candidate = { part, bin, toPick, toDrop, score };
          if (skipKeys.has(candidateKey(candidate))) continue;
          if (routeFirst) return candidate;
          if (!best || candidate.score < best.score) best = candidate;
        }
      }
    }
  }
  return best;
}

function pathCost(path) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) cost += angleDistance(path[i - 1], path[i]);
  return cost;
}

function appendMotionSteps(steps, path) {
  for (const q of path.slice(1)) {
    steps.push({ type: "move_joint", angles: roundConfig(q) });
  }
}

function candidateSteps(chosen) {
  const out = [];
  appendMotionSteps(out, chosen.toPick);
  out.push({ type: "grip_close" });
  appendMotionSteps(out, chosen.toDrop);
  out.push({ type: "grip_open" });
  return out;
}

function solveScene(scene) {
  const steps = [];
  const placed = new Set();
  const used = {};
  const blocked = new Set();
  let current = roundConfig(scene.arm.initial_angles ?? new Array(scene.arm.links.length).fill(0));
  const notes = [];

  if (!validConfig(scene, current, { heldPart: null, placedIds: [] })) {
    return {
      steps,
      notes: "initial configuration is unsafe; emitted empty routine"
    };
  }

  while (placed.size < scene.parts.length) {
    const ready = orderParts(scene, placed, blocked);
    if (!ready.length) break;

    let chosen = null;
    for (const part of ready) {
      const rejected = new Set();
      const maxAttempts = (scene.obstacles ?? []).length > 0 ? 8 : 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = planPickPlace(scene, current, placed, used, part, rejected);
        if (!candidate) break;
        const trial = { steps: steps.concat(candidateSteps(candidate)) };
        const result = verifyScene(scene, trial);
        if (result.violations.length === 0 && result.parts_placed === placed.size + 1) {
          chosen = candidate;
          break;
        }
        rejected.add(candidateKey(candidate));
        notes.push(`rejected ${part.id}: full replay hit ${result.violations[0]?.kind ?? "no_progress"}`);
      }
      if (chosen) break;
      blocked.add(part.id);
      notes.push(`skipped ${part.id}: no simulator-safe pick/place path found`);
    }
    if (!chosen) break;

    steps.push(...candidateSteps(chosen));

    current = chosen.toDrop[chosen.toDrop.length - 1].slice();
    placed.add(chosen.part.id);
    used[chosen.bin.id] = (used[chosen.bin.id] ?? 0) + 1;
  }

  if (placed.size < scene.parts.length) {
    notes.push(`stopped safely after ${placed.size}/${scene.parts.length} parts`);
  } else {
    notes.push(`completed ${scene.id} with joint-space safety checks`);
  }

  return { steps, notes: notes.join("; ") };
}

function verifyScene(scene, routine) {
  const { result } = runRoutine(scene, routine, { recordTrace: false });
  return result;
}

export {
  solveScene,
  planPickPlace,
  candidateKey,
  planMotion,
  rrtConnect,
  solveTargetConfigs,
  transitConfigs,
  transitionValid,
  validConfig
};

function main() {
  const idx = loadJson("scenarios/index.json");
  const bundle = {
    candidate: "codex_roboticist",
    generator: "_samples/codex_roboticist/solution/phase1/planner.js",
    scenarios: {}
  };

  for (const { id } of idx.scenes) {
    const scene = loadJson(`scenarios/${id}.json`);
    const routine = solveScene(scene);
    const result = verifyScene(scene, routine);
    routine.notes = `${routine.notes}; verified: ${result.parts_placed}/${result.parts_total} parts, ${result.violations.length} violations`;
    bundle.scenarios[id] = routine;
    const mark = result.violations.length === 0 ? "ok" : "VIOLATION";
    console.log(`${mark} ${id}: ${result.parts_placed}/${result.parts_total}, term=${result.termination_reason}, steps=${routine.steps.length}`);
    if (result.violations.length) {
      console.log(JSON.stringify(result.violations, null, 2));
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2) + "\n");
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
