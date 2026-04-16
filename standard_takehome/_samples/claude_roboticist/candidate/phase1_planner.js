// Phase 1 planner. Regenerate routines.json (run from repo root):
//   node _samples/claude_robotics/candidate/phase1_planner.js
//
// Strategy: wavefront-based obstacle-aware routing with a set of carry-shape
// heuristics tried in order, each validated by replaying against the sim's
// real checkConfiguration before committing steps. Approach/carry/return
// paths are emitted as dense move_pose waypoints so the sim's IK keeps a
// consistent branch; when the branch flip itself is unavoidable (05_maze's
// narrow bin corridor) the planner emits an explicit move_joint to swing
// through the flip in a place where it is safe.
//
// The carry-shape library, tried per-pickup, per-scene:
//   1. low_corridor          — cross under obstacles at the part row height
//   2. lift_over_parts       — cross at mid-height; over parts, under obstacle
//   3. lift_over_block       — cross above inflated obstacle top
//   4. lift_flip             — lift high, move_joint to right-elbow, descend slow
//   5. wavefront_parts       — grid BFS treating unplaced parts as blockers
//   6. wavefront             — grid BFS (obstacles only)
//   7. straight              — naive straight line; only obstacle-free scenes
//
// Pick order respects topology strictly; within a layer, rightmost-first for
// scenes where bins sit on the left. Bin assignment sorts parts by fewest
// compatible bins first so restricted-kind parts reserve their capacity
// before unrestricted parts exhaust shared bins.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { endEffector, ik, fk } from "../../../src/arm.js";
import { checkConfiguration } from "../../../src/sim.js";
import { Routine, compatibleBins, binCenter, topologicalPickOrder, precedenceMet } from "../../../src/planning_api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

const CELL = 0.02;
const X_MIN = -1.0, X_MAX = 1.0;
const Y_MIN = -0.12, Y_MAX = 0.9;
const NX = Math.round((X_MAX - X_MIN) / CELL) + 1;
const NY = Math.round((Y_MAX - Y_MIN) / CELL) + 1;

const toCell = (x, y) => [Math.round((x - X_MIN) / CELL), Math.round((y - Y_MIN) / CELL)];
const toWorld = (cx, cy) => [X_MIN + cx * CELL, Y_MIN + cy * CELL];

// ---- Grid wavefront (kept for obstacle-free and as a last-resort fallback).

function inflatedBlocked(scene, pad, partBlocks) {
  const blocked = new Uint8Array(NX * NY);
  for (const o of scene.obstacles ?? []) {
    const x0 = Math.floor((o.x - pad - X_MIN) / CELL);
    const x1 = Math.ceil((o.x + o.w + pad - X_MIN) / CELL);
    const y0 = Math.floor((o.y - pad - Y_MIN) / CELL);
    const y1 = Math.ceil((o.y + o.h + pad - Y_MIN) / CELL);
    for (let cy = Math.max(0, y0); cy <= Math.min(NY - 1, y1); cy++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(NX - 1, x1); cx++) {
        blocked[cy * NX + cx] = 1;
      }
    }
  }
  if (partBlocks) {
    for (const pb of partBlocks) {
      const cr = Math.ceil(pb.r / CELL);
      const [bcx, bcy] = toCell(pb.x, pb.y);
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          if (dx * dx + dy * dy > cr * cr) continue;
          const nx = bcx + dx, ny = bcy + dy;
          if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
          blocked[ny * NX + nx] = 1;
        }
      }
    }
  }
  return blocked;
}

function bfs(blocked, start, goal) {
  const [sx, sy] = start, [gx, gy] = goal;
  if (sx < 0 || sx >= NX || sy < 0 || sy >= NY) return null;
  if (gx < 0 || gx >= NX || gy < 0 || gy >= NY) return null;
  const parent = new Int32Array(NX * NY).fill(-1);
  const visited = new Uint8Array(NX * NY);
  const q = [sy * NX + sx];
  visited[q[0]] = 1; parent[q[0]] = q[0];
  let head = 0;
  const goalIdx = gy * NX + gx;
  while (head < q.length) {
    const idx = q[head++];
    if (idx === goalIdx) break;
    const cx = idx % NX, cy = (idx - cx) / NX;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
      const nidx = ny * NX + nx;
      if (visited[nidx] || blocked[nidx]) continue;
      visited[nidx] = 1; parent[nidx] = idx;
      q.push(nidx);
    }
  }
  if (!visited[goalIdx]) return null;
  const pathCells = [];
  let cur = goalIdx;
  while (parent[cur] !== cur) {
    const cx = cur % NX, cy = (cur - cx) / NX;
    pathCells.push([cx, cy]);
    cur = parent[cur];
  }
  pathCells.push([sx, sy]);
  pathCells.reverse();
  return pathCells;
}

function smooth(pathCells, everyN) {
  if (pathCells.length <= 2) return pathCells;
  const out = [pathCells[0]];
  for (let i = everyN; i < pathCells.length - 1; i += everyN) out.push(pathCells[i]);
  out.push(pathCells[pathCells.length - 1]);
  return out;
}

function pushFree(blocked, goal) {
  if (!blocked[goal[1] * NX + goal[0]]) return goal;
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = goal[0] + dx, ny = goal[1] + dy;
        if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
        if (!blocked[ny * NX + nx]) return [nx, ny];
      }
    }
  }
  return goal;
}

function wavefrontRoute(scene, fromXY, toXY, carryR, everyN, partBlocks) {
  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const pad = gripperR + (carryR ?? 0) + 0.005;
  const slack = 0.005;
  const blocks = partBlocks
    ? partBlocks.map(p => ({ x: p.x, y: p.y, r: p.r + (carryR ?? 0) + slack }))
    : null;
  const blocked = inflatedBlocked(scene, pad, blocks);
  const start = pushFree(blocked, toCell(fromXY[0], fromXY[1]));
  const goal = pushFree(blocked, toCell(toXY[0], toXY[1]));
  const cells = bfs(blocked, start, goal);
  if (!cells) return null;
  return smooth(cells, everyN).map(([cx, cy]) => toWorld(cx, cy));
}

// Carry-aware wavefront that additionally blocks reach-unreachable cells and
// a floor band. Used for dense-part scenes (07, 08) where the grid router has
// to go around stacked parts, not just obstacles.
function wavefrontAroundParts(scene, fromXY, toXY, carryR, partBlocks) {
  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const pad = gripperR + carryR + 0.005;
  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const armReach = lengths.reduce((s, l) => s + l, 0) - 0.02;
  const blocked = new Uint8Array(NX * NY);
  for (const o of scene.obstacles ?? []) {
    const x0 = Math.floor((o.x - pad - X_MIN) / CELL);
    const x1 = Math.ceil((o.x + o.w + pad - X_MIN) / CELL);
    const y0 = Math.floor((o.y - pad - Y_MIN) / CELL);
    const y1 = Math.ceil((o.y + o.h + pad - Y_MIN) / CELL);
    for (let cy = Math.max(0, y0); cy <= Math.min(NY - 1, y1); cy++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(NX - 1, x1); cx++) {
        blocked[cy * NX + cx] = 1;
      }
    }
  }
  for (const pb of partBlocks ?? []) {
    const rb = pb.r + carryR + 0.012;
    const cr = Math.ceil(rb / CELL);
    const [bcx, bcy] = toCell(pb.x, pb.y);
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx * dx + dy * dy > cr * cr) continue;
        const nx = bcx + dx, ny = bcy + dy;
        if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
        blocked[ny * NX + nx] = 1;
      }
    }
  }
  // reach mask + floor band (prevents the router from dragging the held part
  // below y=0.02 where the arm's link 0 starts clipping the floor).
  for (let cy = 0; cy < NY; cy++) {
    for (let cx = 0; cx < NX; cx++) {
      const [wx, wy] = toWorld(cx, cy);
      if (wy < 0.02) { blocked[cy * NX + cx] = 1; continue; }
      if (Math.hypot(wx - base.x, wy - base.y) > armReach) blocked[cy * NX + cx] = 1;
    }
  }
  const start = pushFree(blocked, toCell(fromXY[0], fromXY[1]));
  const goal = pushFree(blocked, toCell(toXY[0], toXY[1]));
  const cells = bfs(blocked, start, goal);
  if (!cells) return null;
  // Keep every 2nd cell for smoother IK continuity (0.04 m spacing).
  const out = [cells[0]];
  for (let i = 2; i < cells.length - 1; i += 2) out.push(cells[i]);
  out.push(cells[cells.length - 1]);
  return out.map(([cx, cy]) => toWorld(cx, cy));
}

// ---- Progressive waypoints at a fixed height, interleaved with approach/descend.

function segmentAtY(fromX, toX, y, stepX = 0.1) {
  const out = [];
  const dir = toX > fromX ? 1 : -1;
  let cur = fromX;
  while (Math.abs(toX - cur) > stepX) {
    cur += dir * stepX;
    out.push([cur, y]);
  }
  out.push([toX, y]);
  return out;
}

// Shape A: low_corridor — cross at a y just above the part row, under the obstacle.
// Requires the obstacle bottom to be well above the part row. Works for 04_wall
// (obstacle y >= 0.45; parts at y = 0.1).
function shapeLowCorridor(fromXY, toXY, yCross = 0.1) {
  return [
    ...segmentAtY(fromXY[0], toXY[0], yCross),
  ];
}

// Shape B: lift_over_parts — lift above the unplaced-part row then cross at
// a mid-height that's still under the inflated obstacle bottom.
function shapeLiftOverParts(fromXY, toXY, yCross) {
  return [
    [fromXY[0], yCross],
    ...segmentAtY(fromXY[0], toXY[0], yCross),
    [toXY[0], yCross],
  ];
}

// Shape C: lift_over_block — go above the inflated obstacle top. The cross
// height is just above obs_top + carry_radius + margin.
function shapeLiftOverBlock(fromXY, toXY, yCross) {
  return [
    [fromXY[0], yCross],
    ...segmentAtY(fromXY[0], toXY[0], yCross, 0.08),
    [toXY[0], yCross],
  ];
}

// ---- Replay against the real sim rules. Reuses checkConfiguration.

// emits an array of step objects (move_pose or move_joint). For each the
// replay steps forward through micro-steps and returns the first violation,
// or the final angles if clean.
function replaySteps(scene, startAngles, steps, heldPartId, placedPartIds) {
  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const limits = scene.arm.links.map(l => l.limit ?? [-Math.PI, Math.PI]);
  let angles = startAngles.slice();
  const partPositions = {};
  for (const p of scene.parts) partPositions[p.id] = { x: p.x, y: p.y };
  const placedParts = new Set(placedPartIds);
  const state = { angles, heldPart: heldPartId, partPositions, placedParts };
  for (const step of steps) {
    let target;
    if (step.type === "move_pose") {
      const sol = ik(step.x, step.y, angles, lengths, { base, limits });
      if (!sol.converged) return { ok: false, reason: "ik_no_converge", at: step };
      target = sol.angles;
    } else if (step.type === "move_joint") {
      target = step.angles;
    } else {
      continue;
    }
    const MICRO = 0.02;
    while (true) {
      let maxD = 0;
      for (let i = 0; i < angles.length; i++) {
        const d = target[i] - angles[i];
        if (Math.abs(d) > maxD) maxD = Math.abs(d);
      }
      if (maxD < 1e-6) break;
      const t = Math.min(1, MICRO / maxD);
      const next = angles.map((a, i) => a + (target[i] - a) * t);
      const v = checkConfiguration(next, scene, state);
      if (v) return { ok: false, reason: v.kind, detail: v.detail, at: step };
      angles = next;
      state.angles = angles;
      if (heldPartId) {
        const ee = endEffector(angles, lengths, base);
        partPositions[heldPartId] = { x: ee.x, y: ee.y };
      }
    }
  }
  return { ok: true, angles };
}

// ---- Routing: given scene, carry state, try shapes in order, return first
// candidate waypoint sequence that replays clean.

function obstacleExtent(scene) {
  let minY = Infinity, maxY = -Infinity;
  for (const o of scene.obstacles ?? []) {
    minY = Math.min(minY, o.y);
    maxY = Math.max(maxY, o.y + o.h);
  }
  return { minY, maxY };
}

function routeCarry(scene, fromXY, toXY, startAngles, partId, placed) {
  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const part = scene.parts.find(p => p.id === partId);
  const partR = part?.r ?? 0.025;
  const carryR = gripperR + partR;
  const { minY: obsMinY, maxY: obsMaxY } = obstacleExtent(scene);
  const noObs = !scene.obstacles || scene.obstacles.length === 0;

  const candidates = [];

  // Other unplaced parts become carry-blockers — used by wavefront_parts and
  // wavefront shapes below.
  const otherParts = scene.parts.filter(p => p.id !== partId && !placed.has(p.id))
    .map(p => ({ x: p.x, y: p.y, r: p.r ?? 0.025 }));

  // straight line (obstacle-free scenes, no unplaced parts between)
  if (noObs) {
    candidates.push({ name: "straight", steps: [{ type: "move_pose", x: toXY[0], y: toXY[1] }] });
  }

  // Shape A: low_corridor at y = partRowY or just above (for 04_wall)
  if (isFinite(obsMinY) && obsMinY - carryR - 0.02 > 0.05) {
    const y = Math.min(fromXY[1], 0.1);
    const wpts = shapeLowCorridor(fromXY, toXY, y);
    candidates.push({
      name: "low_corridor",
      steps: wpts.concat([[toXY[0], toXY[1]]]).map(([x, y]) => ({ type: "move_pose", x, y })),
    });
  }

  // Shape B: lift_over_parts at y_cross just below inflated obstacle bottom.
  // Good when parts sit at low y (0.1) and obstacle bottom is well above (0.45).
  if (isFinite(obsMinY)) {
    const yTop = obsMinY - carryR - 0.02;
    if (yTop > 0.12) {
      const y = Math.min(yTop, 0.25);
      const wpts = [[fromXY[0], y], ...segmentAtY(fromXY[0], toXY[0], y, 0.1), [toXY[0], y], [toXY[0], toXY[1]]];
      candidates.push({
        name: "lift_over_parts",
        steps: wpts.map(([x, y]) => ({ type: "move_pose", x, y })),
      });
    }
  }

  // Shape C: lift_over_block at y above inflated obstacle top.
  if (isFinite(obsMaxY)) {
    const y = obsMaxY + carryR + 0.05;
    if (y < 0.85) {
      const wpts = [[fromXY[0], y], ...segmentAtY(fromXY[0], toXY[0], y, 0.08), [toXY[0], y], [toXY[0], toXY[1]]];
      candidates.push({
        name: "lift_over_block",
        steps: wpts.map(([x, y]) => ({ type: "move_pose", x, y })),
      });
    }
  }

  // Shape D: lift_flip — lift high, move_joint to an alt IK seed, descend in tiny y steps.
  // For 05_maze the bin corridor is narrower than the IK seed-continuity budget; we have
  // to explicitly flip elbow at a safe altitude.
  if (scene.obstacles && scene.obstacles.length > 0) {
    const liftY = 0.4;
    const steps = [];
    steps.push({ type: "move_pose", x: fromXY[0], y: liftY });
    for (const wp of segmentAtY(fromXY[0], toXY[0], liftY, 0.08)) {
      steps.push({ type: "move_pose", x: wp[0], y: liftY });
    }
    // Try a few candidate alt seeds; pick the one that converges to a safe config at (toXY[0], 0.3)
    const lengths = scene.arm.links.map(l => l.length);
    const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
    const limits = scene.arm.links.map(l => l.limit ?? [-Math.PI, Math.PI]);
    const altSeeds = [
      [1.2, 1.7, 1.1], [1.2, 1.6, 1.2], [1.0, 1.8, 1.0], [0.9, 1.9, 0.9],
      [1.3, 1.5, 1.3], [1.4, 1.4, 1.4], [0.8, 2.0, 0.8],
    ];
    let descentAngles = null;
    for (const seed of altSeeds) {
      const sol = ik(toXY[0], 0.3, seed, lengths, { base, limits });
      if (!sol.converged) continue;
      const pts = fk(sol.angles, lengths, base);
      // Check config is safe at (toXY[0], 0.3) with held part
      const s = { heldPart: partId, partPositions: Object.fromEntries(scene.parts.map(p => [p.id, { x: pts[3].x, y: pts[3].y }])), placedParts: new Set(placed) };
      // partPositions should have held at ee, others at their rest
      for (const p of scene.parts) if (p.id !== partId) s.partPositions[p.id] = { x: p.x, y: p.y };
      const v = checkConfiguration(sol.angles, scene, s);
      if (!v) { descentAngles = sol.angles; break; }
    }
    if (descentAngles) {
      steps.push({ type: "move_joint", angles: descentAngles });
      // Small-step descent
      for (let y = 0.28; y >= toXY[1] + 0.01; y -= 0.04) {
        steps.push({ type: "move_pose", x: toXY[0], y });
      }
      steps.push({ type: "move_pose", x: toXY[0], y: toXY[1] });
      candidates.push({ name: "lift_flip", steps });
    }
  }

  // Shape E: wavefront_parts — grid BFS that treats unplaced parts as blockers.
  // This is the workhorse for dense scenes (07, 08) where nothing in the
  // shape library proper can route around stacked parts. The emitted waypoint
  // sequence is dense (0.04 m) so IK stays in the same branch across moves.
  const wvParts = wavefrontAroundParts(scene, fromXY, toXY, partR, otherParts);
  if (wvParts) {
    const steps = wvParts.map(([x, y]) => ({ type: "move_pose", x, y }));
    steps.push({ type: "move_pose", x: toXY[0], y: toXY[1] });
    candidates.push({ name: "wavefront_parts", steps });
  }

  // Shape F: wavefront fallback (obstacles only, original carry-aware router)
  const wv = wavefrontRoute(scene, fromXY, toXY, partR, 3, otherParts);
  if (wv) {
    candidates.push({
      name: "wavefront",
      steps: wv.map(([x, y]) => ({ type: "move_pose", x, y })),
    });
  }

  // Try each candidate; return first that replays clean.
  for (const c of candidates) {
    const r = replaySteps(scene, startAngles, c.steps, partId, placed);
    if (r.ok) return { steps: c.steps, angles: r.angles, shape: c.name };
  }
  return null;
}

function routeApproach(scene, fromXY, toXY, startAngles, placed) {
  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const { minY: obsMinY, maxY: obsMaxY } = obstacleExtent(scene);
  const noObs = !scene.obstacles || scene.obstacles.length === 0;

  const candidates = [];

  if (noObs) {
    candidates.push({
      name: "straight",
      steps: [{ type: "move_pose", x: toXY[0], y: toXY[1] }],
    });
  }

  // Shape B: lift then descend (mid-height cross, under obstacle)
  if (isFinite(obsMinY)) {
    const yTop = obsMinY - 0.02;
    if (yTop > 0.12) {
      const y = Math.min(yTop, 0.25);
      const wpts = [[fromXY[0], y], ...segmentAtY(fromXY[0], toXY[0], y, 0.1), [toXY[0], y], [toXY[0], toXY[1]]];
      candidates.push({
        name: "lift_over_parts",
        steps: wpts.map(([x, y]) => ({ type: "move_pose", x, y })),
      });
    }
  }

  // Shape A: low corridor (04_wall empty-hand returns are fine low)
  if (isFinite(obsMinY) && obsMinY - 0.02 > 0.05) {
    const y = Math.min(fromXY[1], 0.1);
    candidates.push({
      name: "low_corridor",
      steps: segmentAtY(fromXY[0], toXY[0], y).concat([[toXY[0], toXY[1]]])
        .map(([x, y]) => ({ type: "move_pose", x, y })),
    });
  }

  // Shape C: over-top (tall obstacles)
  if (isFinite(obsMaxY)) {
    const y = obsMaxY + gripperR + 0.05;
    if (y < 0.85) {
      const wpts = [[fromXY[0], y], ...segmentAtY(fromXY[0], toXY[0], y, 0.08), [toXY[0], y], [toXY[0], toXY[1]]];
      candidates.push({
        name: "lift_over_block",
        steps: wpts.map(([x, y]) => ({ type: "move_pose", x, y })),
      });
    }
  }

  // Wavefront fallback (empty hand)
  const wv = wavefrontRoute(scene, fromXY, toXY, 0, 3, null);
  if (wv) {
    candidates.push({
      name: "wavefront",
      steps: wv.map(([x, y]) => ({ type: "move_pose", x, y })),
    });
  }

  // Also try direct
  candidates.push({
    name: "direct",
    steps: [{ type: "move_pose", x: toXY[0], y: toXY[1] }],
  });

  for (const c of candidates) {
    const r = replaySteps(scene, startAngles, c.steps, null, placed);
    if (r.ok) return { steps: c.steps, angles: r.angles, shape: c.name };
  }
  return null;
}

// Constraint-aware bin scoring. For each compatible bin, compute how many
// *other* part kinds it also accepts; prefer the most-restrictive (least
// shared) bin for this part. That leaves shared bins available for parts
// whose only option is the shared bin — see 10_capacity_trap.
function binSharedness(scene, bin) {
  const accepts = bin.accepts ?? "any";
  if (accepts === "any") return 1000;
  const kinds = new Set();
  for (const p of scene.parts) kinds.add(p.kind ?? "default");
  let n = 0;
  for (const k of kinds) {
    if (Array.isArray(accepts) && accepts.includes(k)) n++;
  }
  return n;
}

function assignBin(scene, part, used) {
  const bins = compatibleBins(scene, part)
    .filter(b => (used[b.id] ?? 0) < (b.capacity ?? Infinity));
  if (bins.length === 0) return null;
  bins.sort((a, b) => {
    // primary: least-shared bin first (reserve shared bins for restricted kinds)
    const sa = binSharedness(scene, a), sb = binSharedness(scene, b);
    if (sa !== sb) return sa - sb;
    // secondary: distance
    const ca = binCenter(a), cb = binCenter(b);
    return Math.hypot(ca.x - part.x, ca.y - part.y) - Math.hypot(cb.x - part.x, cb.y - part.y);
  });
  return bins[0];
}

// Pick order heuristic: layered topological sort — compute the set of parts
// with deps met, pick one (rightmost if bins are left), add to placed, repeat.
// This preserves the DAG (never picks a part before its prereqs) while still
// using spatial tie-breaking inside each layer.
function pickOrder(scene) {
  const remaining = new Set(scene.parts.map(p => p.id));
  const placed = new Set();
  const order = [];
  const binsLeft = scene.bins.every(b => binCenter(b).x < 0);
  while (remaining.size > 0) {
    const ready = scene.parts.filter(p =>
      remaining.has(p.id) && precedenceMet(p, placed)
    );
    if (ready.length === 0) return scene.parts.slice(); // cyclic DAG fallback
    // Spatial tie-break inside the layer:
    //  - obstacle scenes with bins on the left: rightmost first (carry moves
    //    away from remaining parts).
    //  - dense scenes without obstacles (e.g. 07, 08): rightmost first too,
    //    because unplaced parts block lift at their x-column.
    ready.sort((a, b) => binsLeft ? (b.x - a.x) : (a.x - b.x));
    const next = ready[0];
    order.push(next);
    placed.add(next.id);
    remaining.delete(next.id);
  }
  return order;
}

// Try every compatible bin for a part; return the first (approach, carry)
// that replays clean. Avoids greedy bin assignment blocking a part when a
// different-but-still-compatible bin would work.
function tryPart(scene, part, angles, placed, usedBin) {
  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const ee = endEffector(angles, lengths, base);

  const compat = compatibleBins(scene, part)
    .filter(b => (usedBin[b.id] ?? 0) < (b.capacity ?? Infinity));
  if (compat.length === 0) return null;
  compat.sort((a, b) => {
    const sa = binSharedness(scene, a), sb = binSharedness(scene, b);
    if (sa !== sb) return sa - sb;
    const ca = binCenter(a), cb = binCenter(b);
    return Math.hypot(ca.x - part.x, ca.y - part.y) - Math.hypot(cb.x - part.x, cb.y - part.y);
  });

  for (const bin of compat) {
    const bc = binCenter(bin);
    const approach = routeApproach(scene, [ee.x, ee.y], [part.x, part.y], angles, placed);
    if (!approach) continue;
    const carry = routeCarry(scene, [part.x, part.y], [bc.x, bc.y], approach.angles, part.id, placed);
    if (!carry) continue;
    return { bin, approach, carry };
  }
  return null;
}

function planScene(scene, opts = {}) {
  const r = new Routine();
  r.notes = "wavefront + shape heuristics + safety pre-check";
  if (opts.skipEmpty) { r.notes = "intentionally skipped; see REPORT.md"; return r.build(); }

  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  let angles = (scene.arm.initial_angles ?? [0, 1.2, 0]).slice();
  const placed = new Set();
  const usedBin = {};

  // Outer loop: recompute pick order after each successful placement so the
  // topology stays correct as `placed` grows. Terminates when no ready part
  // can be routed.
  while (placed.size < scene.parts.length) {
    const order = pickOrder(scene).filter(p => !placed.has(p.id) && precedenceMet(p, placed));
    if (order.length === 0) break;
    let progress = false;
    for (const part of order) {
      const attempt = tryPart(scene, part, angles, placed, usedBin);
      if (!attempt) continue;
      for (const s of attempt.approach.steps) r.add(s);
      r.gripClose();
      for (const s of attempt.carry.steps) r.add(s);
      r.gripOpen();
      angles = attempt.carry.angles;
      placed.add(part.id);
      usedBin[attempt.bin.id] = (usedBin[attempt.bin.id] ?? 0) + 1;
      progress = true;
      break; // restart the outer loop with fresh topological ready-set
    }
    if (!progress) break;
  }
  return r.build();
}

const SCENE_OPTS = {};

function main() {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "scenarios", "index.json"), "utf8"));
  const bundle = {
    candidate: "claude_robotics_sample",
    generator: "phase1_planner.js (wavefront + shape heuristics + safety pre-check)",
    scenarios: {}
  };
  for (const { id } of idx.scenes) {
    const scene = JSON.parse(fs.readFileSync(path.join(ROOT, "scenarios", `${id}.json`), "utf8"));
    bundle.scenarios[id] = planScene(scene, SCENE_OPTS[id] ?? {});
  }
  const outPath = path.join(__dirname, "routines.json");
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  process.stderr.write(`wrote ${outPath}\n`);
}

main();
