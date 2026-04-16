// Deterministic simulator. Replays a routine against a scene and emits a
// result + trace. Pure function; same input always yields same output.

import { fk, endEffector, ik } from "./arm.js";

const DEFAULTS = {
  arm_thickness: 0.015,
  gripper_radius: 0.04,
  joint_limit_default: [-Math.PI, Math.PI],
  micro_step: 0.02,           // radians per micro-step (move_joint)
  pose_tol: 5e-3,
  max_micro_steps: 20000,
  floor_y: -0.12
};

function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
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

function pointSegmentDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
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

export function checkConfiguration(angles, scene, state) {
  const arm = scene.arm;
  const lengths = arm.links.map(l => l.length);
  const base = { x: arm.base[0], y: arm.base[1] };
  const thickness = arm.thickness ?? DEFAULTS.arm_thickness;
  const gripperR = arm.gripper_radius ?? DEFAULTS.gripper_radius;

  for (let i = 0; i < angles.length; i++) {
    const lim = arm.links[i].limit ?? DEFAULTS.joint_limit_default;
    if (angles[i] < lim[0] - 1e-9 || angles[i] > lim[1] + 1e-9) {
      return { kind: "joint_limit", detail: `joint ${i} angle ${angles[i].toFixed(3)} outside [${lim[0]},${lim[1]}]` };
    }
  }

  const pts = fk(angles, lengths, base);
  const ee = pts[pts.length - 1];

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.y < DEFAULTS.floor_y - 1e-6 || b.y < DEFAULTS.floor_y - 1e-6) {
      return { kind: "collision_floor", detail: `link ${i} below floor` };
    }
    for (const obs of scene.obstacles ?? []) {
      if (segmentRectHit(a, b, obs, thickness / 2)) {
        return { kind: "collision_obstacle", detail: `link ${i} hit obstacle` };
      }
    }
  }

  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      const d = segmentSegmentDist(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (d < thickness) {
        return { kind: "collision_self", detail: `link ${i} hit link ${j}` };
      }
    }
  }

  if (state && state.heldPart) {
    const partR = (scene.parts.find(p => p.id === state.heldPart)?.r) ?? 0.025;
    const carryRadius = gripperR + partR;
    for (const obs of scene.obstacles ?? []) {
      const inflated = {
        x: obs.x - carryRadius,
        y: obs.y - carryRadius,
        w: obs.w + 2 * carryRadius,
        h: obs.h + 2 * carryRadius
      };
      if (pointInRect(ee, inflated)) {
        return { kind: "carry_collision", detail: `held part ${state.heldPart} hit obstacle` };
      }
    }
    if (ee.y - partR < DEFAULTS.floor_y - 1e-6) {
      return { kind: "collision_floor", detail: `held part ${state.heldPart} below floor` };
    }
    for (const other of scene.parts) {
      if (other.id === state.heldPart) continue;
      if (state.placedParts.has(other.id)) continue;
      const otherR = other.r ?? 0.025;
      const op = state.partPositions[other.id];
      const d = Math.hypot(ee.x - op.x, ee.y - op.y);
      if (d < partR + otherR) {
        return { kind: "carry_collision", detail: `held part ${state.heldPart} hit part ${other.id}` };
      }
    }
  }

  return null;
}

function precedenceMet(part, state) {
  const req = part.requires;
  if (!req || req.length === 0) return true;
  for (const id of req) if (!state.placedParts.has(id)) return false;
  return true;
}

function findGraspablePart(state, scene) {
  const arm = scene.arm;
  const gripperR = arm.gripper_radius ?? DEFAULTS.gripper_radius;
  const lengths = arm.links.map(l => l.length);
  const base = { x: arm.base[0], y: arm.base[1] };
  const ee = endEffector(state.angles, lengths, base);

  let best = null;
  let bestD = Infinity;
  let blockedByPrecedence = null;
  for (const part of scene.parts) {
    if (state.placedParts.has(part.id)) continue;
    const pos = state.partPositions[part.id];
    const d = Math.hypot(ee.x - pos.x, ee.y - pos.y);
    const r = part.r ?? 0.025;
    if (d < gripperR + r) {
      if (!precedenceMet(part, state)) {
        if (!blockedByPrecedence || d < blockedByPrecedence.d) blockedByPrecedence = { part, d };
        continue;
      }
      if (d < bestD) { bestD = d; best = part; }
    }
  }
  return { part: best, blockedByPrecedence: blockedByPrecedence?.part ?? null };
}

function tryPlaceHeldPart(state, scene) {
  const arm = scene.arm;
  const lengths = arm.links.map(l => l.length);
  const base = { x: arm.base[0], y: arm.base[1] };
  const ee = endEffector(state.angles, lengths, base);
  const partId = state.heldPart;
  const part = scene.parts.find(p => p.id === partId);

  for (const bin of scene.bins) {
    if (!pointInRect(ee, bin)) continue;
    const accepts = bin.accepts ?? "any";
    if (accepts !== "any" && Array.isArray(accepts) && !accepts.includes(part.kind ?? "default") && !accepts.includes(part.id)) {
      return { placed: false, reason: "bin_rejects", binId: bin.id };
    }
    const inBin = state.binContents[bin.id] ?? [];
    if (bin.capacity != null && inBin.length >= bin.capacity) {
      return { placed: false, reason: "bin_full", binId: bin.id };
    }
    return { placed: true, binId: bin.id };
  }
  return { placed: false, reason: "drop_outside_bin", binId: null };
}

function emptyState(scene) {
  const angles = scene.arm.initial_angles
    ? scene.arm.initial_angles.slice()
    : new Array(scene.arm.links.length).fill(0).map((_, i) => i === 1 ? 1.2 : 0);
  const partPositions = {};
  for (const p of scene.parts) partPositions[p.id] = { x: p.x, y: p.y };
  const binContents = {};
  for (const b of scene.bins) binContents[b.id] = [];
  return {
    angles,
    gripper: "open",
    heldPart: null,
    partPositions,
    placedParts: new Set(),
    binContents,
    elapsed_micro_steps: 0,
    path_length: 0
  };
}

function snapshot(state, scene) {
  const arm = scene.arm;
  const lengths = arm.links.map(l => l.length);
  const base = { x: arm.base[0], y: arm.base[1] };
  return {
    angles: state.angles.slice(),
    points: fk(state.angles, lengths, base),
    gripper: state.gripper,
    heldPart: state.heldPart,
    partPositions: Object.fromEntries(Object.entries(state.partPositions).map(([k, v]) => [k, { ...v }])),
    placedParts: Array.from(state.placedParts),
    elapsed_micro_steps: state.elapsed_micro_steps
  };
}

function moveTowardAngles(state, scene, target, opts) {
  const arm = scene.arm;
  const lengths = arm.links.map(l => l.length);
  const base = { x: arm.base[0], y: arm.base[1] };
  const microStep = DEFAULTS.micro_step;
  const recordTrace = opts.recordTrace;
  const trace = opts.trace;
  const maxSteps = DEFAULTS.max_micro_steps;

  while (true) {
    let maxDelta = 0;
    for (let i = 0; i < target.length; i++) {
      const d = target[i] - state.angles[i];
      if (Math.abs(d) > maxDelta) maxDelta = Math.abs(d);
    }
    if (maxDelta < 1e-6) return null;

    const t = Math.min(1, microStep / maxDelta);
    const next = new Array(target.length);
    for (let i = 0; i < target.length; i++) {
      next[i] = state.angles[i] + (target[i] - state.angles[i]) * t;
    }

    const eePrev = endEffector(state.angles, lengths, base);
    const violation = checkConfiguration(next, scene, state);
    if (violation) return violation;

    state.angles = next;
    if (state.heldPart) {
      const ee = endEffector(state.angles, lengths, base);
      state.partPositions[state.heldPart] = { x: ee.x, y: ee.y };
    }
    const eeNow = endEffector(state.angles, lengths, base);
    state.path_length += Math.hypot(eeNow.x - eePrev.x, eeNow.y - eePrev.y);
    state.elapsed_micro_steps += 1;

    if (recordTrace && (state.elapsed_micro_steps % 2 === 0)) {
      trace.push(snapshot(state, scene));
    }

    if (state.elapsed_micro_steps > maxSteps) {
      return { kind: "step_limit", detail: "exceeded micro-step budget" };
    }
  }
}

export function runRoutine(scene, routine, opts = {}) {
  const recordTrace = opts.recordTrace ?? true;
  const state = emptyState(scene);
  const trace = recordTrace ? [snapshot(state, scene)] : null;
  const violations = [];
  let termination = "completed";
  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const limits = scene.arm.links.map(l => l.limit ?? DEFAULTS.joint_limit_default);

  const initialViolation = checkConfiguration(state.angles, scene, state);
  if (initialViolation) {
    violations.push({ ...initialViolation, step_index: -1 });
    termination = "violation";
    return finalize(scene, state, violations, termination, trace);
  }

  for (let si = 0; si < routine.steps.length; si++) {
    const step = routine.steps[si];

    if (step.type === "move_joint") {
      if (!Array.isArray(step.angles) || step.angles.length !== state.angles.length) {
        violations.push({ kind: "invalid_target", step_index: si, detail: "angles length mismatch" });
        termination = "invalid_step";
        break;
      }
      const v = moveTowardAngles(state, scene, step.angles, { recordTrace, trace });
      if (v) {
        violations.push({ ...v, step_index: si });
        termination = v.kind === "step_limit" ? "step_limit" : "violation";
        break;
      }
    } else if (step.type === "move_pose") {
      const sol = ik(step.x, step.y, state.angles, lengths, { base, limits });
      if (!sol.converged) {
        violations.push({ kind: "ik_no_converge", step_index: si, detail: `target (${step.x},${step.y}) error ${sol.error.toFixed(3)}` });
        termination = "ik_failure";
        break;
      }
      const v = moveTowardAngles(state, scene, sol.angles, { recordTrace, trace });
      if (v) {
        violations.push({ ...v, step_index: si });
        termination = v.kind === "step_limit" ? "step_limit" : "violation";
        break;
      }
    } else if (step.type === "grip_close") {
      if (state.heldPart) {
        violations.push({ kind: "double_grip", step_index: si, detail: `already holding ${state.heldPart}` });
        termination = "violation";
        break;
      }
      const { part, blockedByPrecedence } = findGraspablePart(state, scene);
      if (part) {
        state.heldPart = part.id;
      } else if (blockedByPrecedence) {
        violations.push({ kind: "precedence_violation", step_index: si, detail: `part ${blockedByPrecedence.id} requires [${(blockedByPrecedence.requires ?? []).join(",")}] to be placed first` });
        termination = "violation";
        break;
      }
      state.gripper = "closed";
      if (recordTrace) trace.push(snapshot(state, scene));
    } else if (step.type === "grip_open") {
      if (state.heldPart) {
        const r = tryPlaceHeldPart(state, scene);
        if (r.placed) {
          state.placedParts.add(state.heldPart);
          state.binContents[r.binId].push(state.heldPart);
          state.heldPart = null;
        } else {
          violations.push({ kind: r.reason, step_index: si, detail: `released ${state.heldPart}` });
          state.heldPart = null;
          state.gripper = "open";
          termination = "violation";
          break;
        }
      }
      state.gripper = "open";
      if (recordTrace) trace.push(snapshot(state, scene));
    } else if (step.type === "wait") {
      const n = Math.max(1, Math.round((step.duration ?? 0) / 0.05));
      state.elapsed_micro_steps += n;
      if (recordTrace) trace.push(snapshot(state, scene));
    } else {
      violations.push({ kind: "invalid_target", step_index: si, detail: `unknown step type ${step.type}` });
      termination = "invalid_step";
      break;
    }
  }

  return finalize(scene, state, violations, termination, trace);
}

function finalize(scene, state, violations, termination, trace) {
  const placed = state.placedParts.size;
  const total = scene.parts.length;
  const success = termination === "completed" && violations.length === 0 && placed === total;
  return {
    result: {
      success,
      termination_reason: termination,
      parts_placed: placed,
      parts_total: total,
      violations,
      elapsed_micro_steps: state.elapsed_micro_steps,
      path_length: state.path_length
    },
    trace
  };
}
