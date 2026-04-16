export const family = "obstacle_routing";

const MICRO_STEP = 0.02;
const FLOOR_Y = -0.12;
const DEFAULT_GRIPPER_RADIUS = 0.04;
const DEFAULT_ARM_THICKNESS = 0.015;

export function plan(scene, context = {}) {
  if (context.family && context.family !== family) {
    throw new Error(`codex_roboticist v2 supports ${family}, not ${context.family}`);
  }
  if (!scene || !Array.isArray(scene.parts) || !Array.isArray(scene.bins)) {
    throw new Error("scene must contain parts and bins");
  }
  return solveScene(scene);
}

function solveScene(scene) {
  const initial = scene.arm.initial_angles ?? new Array(scene.arm.links.length).fill(0);
  let current = roundConfig(initial);
  const steps = [];
  const placed = new Set();
  const used = {};
  const skipped = [];

  if (!validConfig(scene, current, { heldPart: null, placedIds: [] })) {
    return { steps, notes: "initial configuration is unsafe; refused by v2" };
  }

  while (placed.size < scene.parts.length) {
    const ready = orderParts(scene, placed).filter(p => !skipped.includes(p.id));
    if (!ready.length) break;

    let chosen = null;
    for (const part of ready) {
      chosen = planPickPlace(scene, current, placed, used, part);
      if (chosen) break;
      skipped.push(part.id);
    }
    if (!chosen) break;

    appendMotionSteps(steps, chosen.toPick);
    steps.push({ type: "grip_close" });
    appendMotionSteps(steps, chosen.toDrop);
    steps.push({ type: "grip_open" });

    current = chosen.toDrop[chosen.toDrop.length - 1].slice();
    placed.add(chosen.part.id);
    used[chosen.bin.id] = (used[chosen.bin.id] ?? 0) + 1;
  }

  return {
    steps,
    notes: placed.size === scene.parts.length
      ? `planning_api_v2 ${family}: completed ${scene.id}`
      : `planning_api_v2 ${family}: safely placed ${placed.size}/${scene.parts.length}`
  };
}

function planPickPlace(scene, current, placed, used, part) {
  const routeFirst = (scene.obstacles ?? []).length > 0;
  const freeMode = { heldPart: null, placedIds: [...placed] };
  const pickConfigs = solveTargetConfigs(scene, { x: part.x, y: part.y }, freeMode, current, {
    randomSeeds: 120
  });
  const bins = compatibleBins(scene, part, used).sort((a, b) => {
    const pa = binPreference(a, part);
    const pb = binPreference(b, part);
    if (pa !== pb) return pa - pb;
    const ac = binCenter(a);
    const bc = binCenter(b);
    return dist(ac, part) - dist(bc, part);
  });

  const candidates = [];
  for (const pick of pickConfigs.slice(0, 10)) {
    const toPick = planMotion(scene, current, pick, freeMode, `${scene.id}:${part.id}:pick`);
    if (!toPick) continue;

    const heldMode = { heldPart: part.id, placedIds: [...placed] };
    for (const bin of bins) {
      for (const target of binTargetPoints(bin)) {
        const dropConfigs = solveTargetConfigs(scene, target, heldMode, pick, {
          randomSeeds: 140,
          bin
        });
        for (const drop of dropConfigs.slice(0, 10)) {
          const toDrop = planMotion(scene, pick, drop, heldMode, `${scene.id}:${part.id}:drop:${bin.id}`);
          if (!toDrop) continue;
          const candidate = {
            part,
            bin,
            toPick,
            toDrop,
            score: pathCost(toPick) + pathCost(toDrop) + binPreference(bin, part) * 50
          };
          if (routeFirst) return candidate;
          candidates.push(candidate);
        }
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] ?? null;
}

function appendMotionSteps(steps, path) {
  for (const q of path.slice(1)) {
    steps.push({ type: "move_joint", angles: roundConfig(q) });
  }
}

function orderParts(scene, placed) {
  const hasObstacles = (scene.obstacles ?? []).length > 0;
  return scene.parts
    .filter(part => !placed.has(part.id) && precedenceMet(part, placed))
    .sort((a, b) => {
      if (hasObstacles) return (a.x + a.y * 0.35) - (b.x + b.y * 0.35);
      return b.x - a.x || a.y - b.y;
    });
}

function precedenceMet(part, placed) {
  return (part.requires ?? []).every(id => placed.has(id));
}

function compatibleBins(scene, part, used) {
  const kind = part.kind ?? "default";
  return scene.bins.filter(bin => {
    const accepts = bin.accepts ?? "any";
    const accepted = accepts === "any"
      || (Array.isArray(accepts) && (accepts.includes(kind) || accepts.includes(part.id)));
    return accepted && ((used[bin.id] ?? 0) < (bin.capacity ?? Infinity));
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

function binCenter(bin) {
  return { x: bin.x + bin.w / 2, y: bin.y + bin.h / 2 };
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

function solveTargetConfigs(scene, target, mode, current, opts = {}) {
  const lengths = scene.arm.links.map(l => l.length);
  const limits = scene.arm.links.map(l => l.limit ?? [-Math.PI, Math.PI]);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const rng = makeRng(`${scene.id}:target:${target.x}:${target.y}:${mode.heldPart ?? "free"}`);
  const seeds = fixedSeeds(scene, current);
  for (let i = 0; i < (opts.randomSeeds ?? 80); i++) seeds.push(randomSeed(scene, rng));

  const configs = [];
  for (const seed of seeds) {
    const sol = ik(target.x, target.y, seed, lengths, {
      base,
      limits,
      tol: 1e-3,
      maxIter: 650,
      damping: 0.025
    });
    if (!sol.converged) continue;
    const q = roundConfig(sol.angles);
    if (!validConfig(scene, q, mode)) continue;
    const actual = endEffector(q, lengths, base);
    if (opts.bin && !pointInRect(actual, opts.bin)) continue;
    if (!opts.bin && dist(actual, target) > 0.01) continue;
    configs.push(q);
  }

  return dedupeConfigs(configs).sort((a, b) => angleDistance(current, a) - angleDistance(current, b));
}

function transitConfigs(scene, mode, current) {
  const configs = [];
  for (const p of transitTargets(scene)) {
    configs.push(...solveTargetConfigs(scene, p, mode, current, { randomSeeds: 20 }));
  }
  const rng = makeRng(`${scene.id}:transit:${mode.heldPart ?? "free"}:${(mode.placedIds ?? []).join(",")}`);
  for (let i = 0; i < 24; i++) {
    const q = roundConfig(randomSeed(scene, rng));
    if (validConfig(scene, q, mode)) configs.push(q);
  }
  return dedupeConfigs(configs, 0.08);
}

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

function rrtConnect(scene, start, goal, mode, seedText) {
  if (!validConfig(scene, start, mode) || !validConfig(scene, goal, mode)) return null;
  const anchors = transitConfigs(scene, mode, start).filter(q => validConfig(scene, q, mode));
  const rng = makeRng(seedText);
  let treeA = { nodes: [{ q: start.slice(), parent: -1 }] };
  let treeB = { nodes: [{ q: goal.slice(), parent: -1 }] };
  let aIsStart = true;
  const stepSize = 0.12;

  for (let iter = 0; iter < 18000; iter++) {
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

function validConfig(scene, q, mode) {
  if (!Array.isArray(q) || q.length !== scene.arm.links.length) return false;
  if (q.some(v => !Number.isFinite(v))) return false;
  return !checkConfiguration(q, scene, modeState(scene, mode));
}

function transitionValid(scene, from, to, mode) {
  const state = modeState(scene, mode);
  let q = from.slice();
  while (true) {
    let maxDelta = 0;
    for (let i = 0; i < to.length; i++) maxDelta = Math.max(maxDelta, Math.abs(to[i] - q[i]));
    if (maxDelta < 1e-6) return true;
    const t = Math.min(1, MICRO_STEP / maxDelta);
    const next = q.map((v, i) => v + (to[i] - v) * t);
    if (checkConfiguration(next, scene, state)) return false;
    q = next;
  }
}

function checkConfiguration(angles, scene, state) {
  const arm = scene.arm;
  const lengths = arm.links.map(l => l.length);
  const base = { x: arm.base[0], y: arm.base[1] };
  const thickness = arm.thickness ?? DEFAULT_ARM_THICKNESS;
  const gripperR = arm.gripper_radius ?? DEFAULT_GRIPPER_RADIUS;
  const pts = fk(angles, lengths, base);
  const ee = pts[pts.length - 1];

  for (let i = 0; i < angles.length; i++) {
    const lim = arm.links[i].limit ?? [-Math.PI, Math.PI];
    if (angles[i] < lim[0] - 1e-9 || angles[i] > lim[1] + 1e-9) {
      return { kind: "joint_limit", detail: `joint ${i} outside limits` };
    }
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.y < FLOOR_Y - 1e-6 || b.y < FLOOR_Y - 1e-6) return { kind: "collision_floor" };
    for (const obs of scene.obstacles ?? []) {
      if (segmentRectHit(a, b, obs, thickness / 2)) return { kind: "collision_obstacle" };
    }
  }

  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      if (segmentSegmentDist(pts[i], pts[i + 1], pts[j], pts[j + 1]) < thickness) {
        return { kind: "collision_self" };
      }
    }
  }

  if (state?.heldPart) {
    const part = scene.parts.find(p => p.id === state.heldPart);
    const partR = part?.r ?? 0.025;
    const carryRadius = gripperR + partR;
    for (const obs of scene.obstacles ?? []) {
      const inflated = {
        x: obs.x - carryRadius,
        y: obs.y - carryRadius,
        w: obs.w + 2 * carryRadius,
        h: obs.h + 2 * carryRadius
      };
      if (pointInRect(ee, inflated)) return { kind: "carry_collision" };
    }
    if (ee.y - partR < FLOOR_Y - 1e-6) return { kind: "collision_floor" };
    for (const other of scene.parts) {
      if (other.id === state.heldPart || state.placedParts.has(other.id)) continue;
      const otherR = other.r ?? 0.025;
      const op = state.partPositions[other.id];
      if (dist(ee, op) < partR + otherR) return { kind: "carry_collision" };
    }
  }

  return null;
}

function modeState(scene, mode) {
  return {
    heldPart: mode.heldPart ?? null,
    placedParts: new Set(mode.placedIds ?? []),
    partPositions: Object.fromEntries(scene.parts.map(p => [p.id, { x: p.x, y: p.y }]))
  };
}

function fk(angles, lengths, base = { x: 0, y: 0 }) {
  const points = [{ x: base.x, y: base.y }];
  let theta = 0;
  let x = base.x;
  let y = base.y;
  for (let i = 0; i < angles.length; i++) {
    theta += angles[i];
    x += lengths[i] * Math.cos(theta);
    y += lengths[i] * Math.sin(theta);
    points.push({ x, y });
  }
  return points;
}

function endEffector(angles, lengths, base) {
  const pts = fk(angles, lengths, base);
  return pts[pts.length - 1];
}

function ik(targetX, targetY, currentAngles, lengths, opts = {}) {
  const base = opts.base ?? { x: 0, y: 0 };
  const limits = opts.limits ?? null;
  const seeds = [currentAngles.slice()];
  const n = currentAngles.length;
  for (let k = 0; k < 6; k++) {
    const s = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = (k * 0.7 + i * 1.1) % (2 * Math.PI);
      s[i] = a - Math.PI + (i === 0 ? 1.0 : 0);
      if (limits?.[i]) s[i] = clamp(s[i], limits[i][0], limits[i][1]);
    }
    seeds.push(s);
  }

  let best = null;
  for (const seed of seeds) {
    const r = solveIK(targetX, targetY, seed, lengths, base, limits, opts);
    if (r.converged) return r;
    if (!best || r.error < best.error) best = r;
  }
  return best;
}

function solveIK(targetX, targetY, seed, lengths, base, limits, opts) {
  const maxIter = opts.maxIter ?? 400;
  const tol = opts.tol ?? 2e-3;
  const damping = opts.damping ?? 0.03;
  const maxStep = opts.maxStep ?? 0.15;
  const angles = seed.slice();
  const n = angles.length;
  let lastErr = Infinity;
  let stag = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    const pts = fk(angles, lengths, base);
    const ee = pts[n];
    const dx = targetX - ee.x;
    const dy = targetY - ee.y;
    const err = Math.hypot(dx, dy);
    if (err < tol) return { angles, converged: true, iterations: iter, error: err };
    if (Math.abs(lastErr - err) < 1e-6) {
      stag += 1;
      if (stag > 20) break;
    } else {
      stag = 0;
    }
    lastErr = err;

    let jjtxx = damping * damping;
    let jjtyy = damping * damping;
    let jjtxy = 0;
    const jacobian = new Array(n);
    for (let i = 0; i < n; i++) {
      const ax = ee.x - pts[i].x;
      const ay = ee.y - pts[i].y;
      jacobian[i] = [-ay, ax];
      jjtxx += jacobian[i][0] * jacobian[i][0];
      jjtyy += jacobian[i][1] * jacobian[i][1];
      jjtxy += jacobian[i][0] * jacobian[i][1];
    }

    const det = jjtxx * jjtyy - jjtxy * jjtxy;
    if (!isFinite(det) || Math.abs(det) < 1e-18) break;
    const ixx = jjtyy / det;
    const iyy = jjtxx / det;
    const ixy = -jjtxy / det;
    const zx = ixx * dx + ixy * dy;
    const zy = ixy * dx + iyy * dy;

    for (let i = 0; i < n; i++) {
      angles[i] += clamp(jacobian[i][0] * zx + jacobian[i][1] * zy, -maxStep, maxStep);
      if (limits?.[i]) angles[i] = clamp(angles[i], limits[i][0], limits[i][1]);
    }
  }

  const ee = endEffector(angles, lengths, base);
  const error = Math.hypot(targetX - ee.x, targetY - ee.y);
  return { angles, converged: error < (opts.tol ?? 2e-3), iterations: maxIter, error };
}

function fixedSeeds(scene, current) {
  const n = scene.arm.links.length;
  const initial = scene.arm.initial_angles ?? new Array(n).fill(0);
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

function randomConfig(scene, rng) {
  return roundConfig(randomSeed(scene, rng));
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

function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function segmentRectHit(a, b, rect, pad = 0) {
  const r = { x: rect.x - pad, y: rect.y - pad, w: rect.w + 2 * pad, h: rect.h + 2 * pad };
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const c1 = { x: r.x, y: r.y };
  const c2 = { x: r.x + r.w, y: r.y };
  const c3 = { x: r.x + r.w, y: r.y + r.h };
  const c4 = { x: r.x, y: r.y + r.h };
  return segmentsIntersect(a, b, c1, c2)
    || segmentsIntersect(a, b, c2, c3)
    || segmentsIntersect(a, b, c3, c4)
    || segmentsIntersect(a, b, c4, c1);
}

function segmentsIntersect(a, b, c, d) {
  const dx1 = b.x - a.x, dy1 = b.y - a.y;
  const dx2 = d.x - c.x, dy2 = d.y - c.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-14) return false;
  const dx = c.x - a.x, dy = c.y - a.y;
  const t = (dx * dy2 - dy * dx2) / denom;
  const u = (dx * dy1 - dy * dx1) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function pointSegmentDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function segmentSegmentDist(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDist(a, c, d),
    pointSegmentDist(b, c, d),
    pointSegmentDist(c, a, b),
    pointSegmentDist(d, a, b)
  );
}

function dedupeConfigs(configs, minDist = 0.05) {
  const out = [];
  for (const q of configs) {
    if (!out.some(p => angleDistance(p, q) < minDist)) out.push(q);
  }
  return out;
}

function pathCost(path) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) cost += angleDistance(path[i - 1], path[i]);
  return cost;
}

function angleDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roundConfig(q) {
  return q.map(v => Number(v.toFixed(6)));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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
