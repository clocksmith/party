// Starter Planning API v1 — the helpers used in Phase 1.
//
// This is the higher-level layer that sits on top of the fixed Robot API
// (the five wire step types in src/schema.json). It is provided for Phase 1.
// You may use it, ignore it, or replace it entirely in Phase 2 (your
// redesign lives at candidate/planning_api_v2/).
//
// Design notes that you should feel free to push back on:
//   - It is imperative and step-emitting; you may prefer declarative goals.
//   - It assumes straight-line pose moves; obstacle-aware routing is your job.
//   - It has no notion of cost, ordering, or batching.
//   - Errors are out-of-band; the simulator catches them later.
//
// In Phase 2 you will design a v2 of this layer. Read it with that in mind.

import { fk, ik, endEffector, reach } from "./arm.js";

export class Routine {
  constructor() { this.steps = []; this.notes = ""; }
  add(step) { this.steps.push(step); return this; }
  moveJoint(angles) { return this.add({ type: "move_joint", angles }); }
  movePose(x, y) { return this.add({ type: "move_pose", x, y }); }
  gripOpen() { return this.add({ type: "grip_open" }); }
  gripClose() { return this.add({ type: "grip_close" }); }
  wait(duration) { return this.add({ type: "wait", duration }); }
  build() { return { steps: this.steps, notes: this.notes }; }
}

export function findPart(scene, id) {
  return scene.parts.find(p => p.id === id) || null;
}

export function findBin(scene, id) {
  return scene.bins.find(b => b.id === id) || null;
}

export function binCenter(bin) {
  return { x: bin.x + bin.w / 2, y: bin.y + bin.h / 2 };
}

export function partsByKind(scene, kind) {
  return scene.parts.filter(p => (p.kind ?? "default") === kind);
}

export function precedenceMet(part, placedIds) {
  const req = part.requires;
  if (!req || req.length === 0) return true;
  const placed = placedIds instanceof Set ? placedIds : new Set(placedIds);
  for (const id of req) if (!placed.has(id)) return false;
  return true;
}

export function topologicalPickOrder(scene) {
  const parts = scene.parts.slice();
  const placed = new Set();
  const order = [];
  while (order.length < parts.length) {
    const next = parts.find(p => !placed.has(p.id) && precedenceMet(p, placed));
    if (!next) return null;
    order.push(next);
    placed.add(next.id);
  }
  return order;
}

export function compatibleBins(scene, part) {
  const kind = part.kind ?? "default";
  return scene.bins.filter(b => {
    const a = b.accepts ?? "any";
    if (a === "any") return true;
    return Array.isArray(a) && (a.includes(kind) || a.includes(part.id));
  });
}

export function homePose(scene) {
  const n = scene.arm.links.length;
  return scene.arm.initial_angles
    ? scene.arm.initial_angles.slice()
    : new Array(n).fill(0).map((_, i) => i === 1 ? 1.2 : 0);
}

export function reachable(scene, x, y) {
  const r = reach(scene.arm.links.map(l => l.length));
  const dx = x - scene.arm.base[0];
  const dy = y - scene.arm.base[1];
  return Math.hypot(dx, dy) <= r - 1e-3;
}

// Naive pick-and-place. Drives the gripper to the part, closes, drives to
// the bin center, opens. Does not route around obstacles. Will fail in
// scenes where straight-line motion is unsafe.
export function pickAndPlace(routine, scene, partId, binId) {
  const part = findPart(scene, partId);
  const bin = findBin(scene, binId);
  if (!part || !bin) throw new Error(`unknown part ${partId} or bin ${binId}`);
  const c = binCenter(bin);
  routine.movePose(part.x, part.y);
  routine.gripClose();
  routine.movePose(c.x, c.y);
  routine.gripOpen();
  return routine;
}

// A naive solver: for each part, pick the first compatible bin and run
// pickAndPlace in topological-then-declaration order. Solves easy scenes;
// fails when obstacles or capacity matter, and may not find a feasible
// schedule if precedence is dense.
export function naiveSolve(scene) {
  const r = new Routine();
  const used = {};
  const order = topologicalPickOrder(scene) ?? scene.parts;
  for (const part of order) {
    const bins = compatibleBins(scene, part);
    let chosen = null;
    for (const b of bins) {
      const cap = b.capacity ?? Infinity;
      if ((used[b.id] ?? 0) < cap) { chosen = b; break; }
    }
    if (!chosen) continue;
    used[chosen.id] = (used[chosen.id] ?? 0) + 1;
    pickAndPlace(r, scene, part.id, chosen.id);
  }
  return r.build();
}
