// Safety checks and route-shape generators for planning_api_v2.
//
// The inflation math below mirrors checkConfiguration in src/sim.js:
// obstacles get a (gripper_radius + part.r) pad during carry, and
// other-parts are kept at (partR + otherR) distance. That duplication is
// the known tradeoff — if sim.js changes, this file silently drifts from
// it. I'd normally factor the inflation constants into a shared module;
// here the frozen surface is sim.js itself, so I copy the math and flag
// this file as the canonical place to update on a sim bump.

import { endEffector, ik, fk, reach } from "../../../../src/arm.js";
import { checkConfiguration } from "../../../../src/sim.js";

export function isReachable(scene, [x, y]) {
  const r = reach(scene.arm.links.map(l => l.length));
  const dx = x - scene.arm.base[0];
  const dy = y - scene.arm.base[1];
  return Math.hypot(dx, dy) <= r - 1e-3;
}

// Returns the [minY, maxY] extent of the scene's obstacles. Used to pick
// which carry-shape heuristic is plausible (under, over, through).
export function obstacleExtent(scene) {
  let minY = Infinity, maxY = -Infinity;
  for (const o of scene.obstacles ?? []) {
    minY = Math.min(minY, o.y);
    maxY = Math.max(maxY, o.y + o.h);
  }
  return { minY, maxY };
}

// Dense waypoints along (fromX, y) → (toX, y). Dense steps keep the sim's
// per-move_pose IK seeded close to the previous config so it doesn't jump
// branches mid-trajectory.
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

// Shape library. Each shape takes (scene, fromXY, toXY, carryR) and emits a
// candidate sequence of move_pose / move_joint steps. The caller is
// expected to replay against the real sim and pick the first shape that
// comes back clean.
export function shapeCandidates(scene, fromXY, toXY, carryR, partId) {
  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const pad = gripperR + carryR;
  const { minY: obsMinY, maxY: obsMaxY } = obstacleExtent(scene);
  const noObs = !scene.obstacles || scene.obstacles.length === 0;
  const out = [];

  if (noObs) {
    out.push({
      name: "straight",
      steps: [{ type: "move_pose", x: toXY[0], y: toXY[1] }],
    });
    // Dense-part fallback: same wavefront_parts grid router used for obstacle
    // scenes. Needed when other unplaced parts block straight-line carry
    // (07_precedence, 10_capacity_trap stacked columns).
    if (partId) {
      const wvp = wavefrontParts(scene, fromXY, toXY, carryR, partId);
      if (wvp) {
        const steps = wvp.map(([x, y]) => ({ type: "move_pose", x, y }));
        steps.push({ type: "move_pose", x: toXY[0], y: toXY[1] });
        out.push({ name: "wavefront_parts", steps });
      }
    }
    return out;
  }

  // lift_over_parts: mid-height cross. Good when parts are dense at the
  // row height but obstacles are higher up. Placed first because the
  // resulting IK branch (mid-height lift) more reliably leads to a
  // completable carry than the low-corridor arm-wrap.
  if (isFinite(obsMinY)) {
    const yTop = obsMinY - pad - 0.02;
    if (yTop > 0.12) {
      const y = Math.min(yTop, 0.25);
      const wpts = [[fromXY[0], y], ...segmentAtY(fromXY[0], toXY[0], y, 0.1), [toXY[0], y], [toXY[0], toXY[1]]];
      out.push({
        name: "lift_over_parts",
        steps: wpts.map(([x, y]) => ({ type: "move_pose", x, y })),
      });
    }
  }

  // low_corridor: cross at part-row height, under the obstacle band.
  if (isFinite(obsMinY) && obsMinY - pad - 0.02 > 0.05) {
    const y = Math.min(fromXY[1], 0.1);
    out.push({
      name: "low_corridor",
      steps: segmentAtY(fromXY[0], toXY[0], y)
        .concat([[toXY[0], toXY[1]]])
        .map(([x, y]) => ({ type: "move_pose", x, y })),
    });
  }

  // lift_over_block: go above the inflated obstacle top.
  if (isFinite(obsMaxY)) {
    const y = obsMaxY + pad + 0.05;
    if (y < 0.85) {
      const wpts = [[fromXY[0], y], ...segmentAtY(fromXY[0], toXY[0], y, 0.08), [toXY[0], y], [toXY[0], toXY[1]]];
      out.push({
        name: "lift_over_block",
        steps: wpts.map(([x, y]) => ({ type: "move_pose", x, y })),
      });
    }
  }

  // lift_flip: lift high, explicit move_joint to a right-elbow seed, then
  // small-step descend. Reserved for narrow bin corridors where IK
  // continuity from the approach-side picks the wrong branch.
  if (scene.obstacles && scene.obstacles.length > 0 && partId) {
    const liftY = 0.4;
    const steps = [];
    steps.push({ type: "move_pose", x: fromXY[0], y: liftY });
    for (const wp of segmentAtY(fromXY[0], toXY[0], liftY, 0.08)) {
      steps.push({ type: "move_pose", x: wp[0], y: liftY });
    }
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
      const partPositions = Object.fromEntries(
        scene.parts.map(p => [p.id, p.id === partId ? { x: pts[3].x, y: pts[3].y } : { x: p.x, y: p.y }])
      );
      const s = { heldPart: partId, partPositions, placedParts: new Set() };
      const v = checkConfiguration(sol.angles, scene, s);
      if (!v) { descentAngles = sol.angles; break; }
    }
    if (descentAngles) {
      steps.push({ type: "move_joint", angles: descentAngles });
      for (let y = 0.28; y >= toXY[1] + 0.01; y -= 0.04) {
        steps.push({ type: "move_pose", x: toXY[0], y });
      }
      steps.push({ type: "move_pose", x: toXY[0], y: toXY[1] });
      out.push({ name: "lift_flip", steps });
    }
  }

  // wavefront_parts: grid BFS that also treats the other unplaced parts as
  // blockers. This is the shape that makes 07_precedence and 08_dense work —
  // when stacked parts block any straight lift, the grid router threads
  // through the remaining clearance.
  if (partId) {
    const wvp = wavefrontParts(scene, fromXY, toXY, carryR, partId);
    if (wvp) {
      const steps = wvp.map(([x, y]) => ({ type: "move_pose", x, y }));
      steps.push({ type: "move_pose", x: toXY[0], y: toXY[1] });
      out.push({ name: "wavefront_parts", steps });
    }
  }

  // Wavefront grid fallback (carry-aware, obstacles only).
  const wv = wavefront(scene, fromXY, toXY, carryR);
  if (wv) {
    out.push({
      name: "wavefront",
      steps: wv.map(([x, y]) => ({ type: "move_pose", x, y })),
    });
  }

  // Direct single-step fallback — last-resort. Useful for short approach
  // moves where the IK seed continuity from the previous config happens to
  // land in a safe branch.
  out.push({ name: "direct", steps: [{ type: "move_pose", x: toXY[0], y: toXY[1] }] });

  return out;
}

// Wavefront that blocks not just obstacles but every other unplaced part.
// Carry-side shape used when the part grid is dense (07_precedence,
// 08_dense): stacked parts block naive lifts, so the grid router has to
// thread around them.
function wavefrontParts(scene, fromXY, toXY, carryR, partId) {
  const CELL = 0.02;
  const X_MIN = -1.0, Y_MIN = -0.12;
  const X_MAX = 1.0, Y_MAX = 0.9;
  const NX = Math.round((X_MAX - X_MIN) / CELL) + 1;
  const NY = Math.round((Y_MAX - Y_MIN) / CELL) + 1;
  const toCell = (x, y) => [Math.round((x - X_MIN) / CELL), Math.round((y - Y_MIN) / CELL)];
  const toWorld = (cx, cy) => [X_MIN + cx * CELL, Y_MIN + cy * CELL];
  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const pad = gripperR + carryR + 0.005;
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const armReach = reach(scene.arm.links.map(l => l.length)) - 0.02;
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
  for (const p of scene.parts) {
    if (p.id === partId) continue;
    const rb = (p.r ?? 0.025) + carryR + 0.012;
    const cr = Math.ceil(rb / CELL);
    const [bcx, bcy] = toCell(p.x, p.y);
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx * dx + dy * dy > cr * cr) continue;
        const nx = bcx + dx, ny = bcy + dy;
        if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
        blocked[ny * NX + nx] = 1;
      }
    }
  }
  for (let cy = 0; cy < NY; cy++) {
    for (let cx = 0; cx < NX; cx++) {
      const [wx, wy] = toWorld(cx, cy);
      if (wy < 0.02) { blocked[cy * NX + cx] = 1; continue; }
      if (Math.hypot(wx - base.x, wy - base.y) > armReach) blocked[cy * NX + cx] = 1;
    }
  }
  const push = (g) => {
    if (!blocked[g[1] * NX + g[0]]) return g;
    for (let r = 1; r <= 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = g[0] + dx, ny = g[1] + dy;
          if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
          if (!blocked[ny * NX + nx]) return [nx, ny];
        }
      }
    }
    return g;
  };
  const s = push(toCell(fromXY[0], fromXY[1]));
  const g = push(toCell(toXY[0], toXY[1]));
  const parent = new Int32Array(NX * NY).fill(-1);
  const visited = new Uint8Array(NX * NY);
  const q = [s[1] * NX + s[0]];
  visited[q[0]] = 1; parent[q[0]] = q[0];
  const goalIdx = g[1] * NX + g[0];
  let head = 0;
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
  const cells = [];
  let cur = goalIdx;
  while (parent[cur] !== cur) {
    const cx = cur % NX, cy = (cur - cx) / NX;
    cells.push([cx, cy]);
    cur = parent[cur];
  }
  cells.push([s[0], s[1]]);
  cells.reverse();
  const out = [cells[0]];
  for (let i = 2; i < cells.length - 1; i += 2) out.push(cells[i]);
  out.push(cells[cells.length - 1]);
  return out.map(([cx, cy]) => toWorld(cx, cy));
}

// Grid wavefront BFS. Cell 0.02 m, 8-connected, obstacles inflated by
// (gripper_radius + carryR) during carry. Returns an array of [x, y]
// waypoints or null.
function wavefront(scene, fromXY, toXY, carryR) {
  const CELL = 0.02;
  const X_MIN = -1.0, Y_MIN = -0.12;
  const X_MAX = 1.0, Y_MAX = 0.9;
  const NX = Math.round((X_MAX - X_MIN) / CELL) + 1;
  const NY = Math.round((Y_MAX - Y_MIN) / CELL) + 1;
  const toCell = (x, y) => [Math.round((x - X_MIN) / CELL), Math.round((y - Y_MIN) / CELL)];
  const toWorld = (cx, cy) => [X_MIN + cx * CELL, Y_MIN + cy * CELL];

  const gripperR = scene.arm.gripper_radius ?? 0.04;
  const pad = gripperR + (carryR ?? 0) + 0.005;
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
  const push = (g) => {
    if (!blocked[g[1] * NX + g[0]]) return g;
    for (let r = 1; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = g[0] + dx, ny = g[1] + dy;
          if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
          if (!blocked[ny * NX + nx]) return [nx, ny];
        }
      }
    }
    return g;
  };
  const s = push(toCell(fromXY[0], fromXY[1]));
  const g = push(toCell(toXY[0], toXY[1]));
  const parent = new Int32Array(NX * NY).fill(-1);
  const visited = new Uint8Array(NX * NY);
  const q = [s[1] * NX + s[0]];
  visited[q[0]] = 1; parent[q[0]] = q[0];
  const goalIdx = g[1] * NX + g[0];
  let head = 0;
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
  const cells = [];
  let cur = goalIdx;
  while (parent[cur] !== cur) {
    const cx = cur % NX, cy = (cur - cx) / NX;
    cells.push([cx, cy]);
    cur = parent[cur];
  }
  cells.push([s[0], s[1]]);
  cells.reverse();
  const out = [cells[0]];
  for (let i = 3; i < cells.length - 1; i += 3) out.push(cells[i]);
  out.push(cells[cells.length - 1]);
  return out.map(([cx, cy]) => toWorld(cx, cy));
}

// Faithful replay against the real sim rules. Steps through a mixed sequence
// of move_pose / move_joint with the same micro-step budget the sim uses.
export function replaySteps(scene, startAngles, steps, heldPartId, placedPartIds) {
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
      if (!sol.converged) return { ok: false, reason: "ik_no_converge" };
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
      if (v) return { ok: false, reason: v.kind };
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
