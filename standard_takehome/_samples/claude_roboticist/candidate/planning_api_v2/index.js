// Planning API v2 — intent-first surface.
//
// v1 gave me a Routine builder and a handful of pure helpers (find, sort,
// topologize). The common pickup shape in my Phase 1 planner was:
//
//     route → replay → if ok route to bin → replay → if ok emit steps
//
// Five named concepts (Routine, route, replay, assignBin, topologicalPickOrder)
// and five places where I had to remember to recheck safety. The two most
// common mistakes on that surface are (1) forgetting the second replay after
// smoothing a path and (2) forgetting to update `placedParts` between pickups
// so a downstream precedence check passes on stale state. Both are silent.
//
// v2 collapses a pickup to one call: `placePart(scene, state, partId, binId, opts)`.
// It returns either emitted wire steps plus an updated state, or a typed
// Refusal (no steps, state unchanged). Safety is the default; an unsafe
// carry is refused before any step is emitted. State is a value, not a
// builder — each placePart returns a new state.
//
// Axis of "better": INTENT EXPRESSION. Not one of the canonical six. I'm
// defending it because the v1 rough edge was not LOC or concept count per
// se; it was that *the candidate had to encode the invariant* (safety-check
// before emit, state update after). v2 makes the invariant the API's
// responsibility, not the caller's. The callsite still shrinks as a side
// effect, but that's downstream of getting the intent right.
//
// The Robot API surface (five wire step types) is untouched; v2 emits only
// those. safety_checks.js mirrors sim.js's geometry (documented tradeoff).

import { endEffector } from "../../../../src/arm.js";
import { binCenter, compatibleBins, precedenceMet } from "../../../../src/planning_api.js";
import { isReachable, shapeCandidates, replaySteps } from "./safety_checks.js";

export function initialState(scene) {
  return {
    angles: (scene.arm.initial_angles ?? [0, 1.2, 0]).slice(),
    placed: new Set(),
    binUsage: {},
  };
}

// Default options. Every flag is "safe on" — the caller opts OUT of safety,
// not in. retryOnIK is flagged false by default because the sim's IK is
// deterministic and our restart seeds already cover the usual failure modes;
// see REPORT.md for why I kept the flag in the signature anyway.
const DEFAULT_OPTS = {
  avoidObstacles: true,
  refuseUnsafe: true,
  retryOnIK: false,
};

export function placePart(scene, state, partId, binId, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const part = scene.parts.find(p => p.id === partId);
  const bin = scene.bins.find(b => b.id === binId);
  if (!part) return refusal("unknown_part", state, { partId });
  if (!bin) return refusal("unknown_bin", state, { binId });

  if (!precedenceMet(part, state.placed)) {
    return refusal("precedence_not_met", state, { partId, requires: part.requires });
  }

  const cap = bin.capacity ?? Infinity;
  const used = state.binUsage[bin.id] ?? 0;
  if (used >= cap) return refusal("bin_full", state, { binId });

  const accepts = bin.accepts ?? "any";
  const kind = part.kind ?? "default";
  if (accepts !== "any" && Array.isArray(accepts) && !accepts.includes(kind) && !accepts.includes(part.id)) {
    return refusal("bin_rejects", state, { binId, kind });
  }

  const lengths = scene.arm.links.map(l => l.length);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };
  const ee = endEffector(state.angles, lengths, base);
  const bc = binCenter(bin);

  if (!isReachable(scene, [part.x, part.y]) || !isReachable(scene, [bc.x, bc.y])) {
    return refusal("unreachable", state, { partId, binId });
  }

  // We pair approach and carry shapes — the approach shape determines the
  // arm's IK branch at pickup, which in turn determines which carry shapes
  // can replay cleanly. Picking the first-ok approach greedily can land the
  // arm in a branch where no carry works; pairing fixes that.
  const approachShapes = shapeCandidates(scene, [ee.x, ee.y], [part.x, part.y], 0, partId);
  const carryShapes = shapeCandidates(scene, [part.x, part.y], [bc.x, bc.y], part.r ?? 0.025, partId);

  let approach = null, carry = null;
  let anyApproachReplayed = false;
  outer: for (const ac of approachShapes) {
    const ra = replaySteps(scene, state.angles, ac.steps, null, state.placed);
    if (!ra.ok) continue;
    anyApproachReplayed = true;
    for (const cc of carryShapes) {
      const rc = replaySteps(scene, ra.angles, cc.steps, partId, state.placed);
      if (rc.ok) {
        approach = { steps: ac.steps, angles: ra.angles, shape: ac.name };
        carry = { steps: cc.steps, angles: rc.angles, shape: cc.name };
        break outer;
      }
    }
  }
  if (!approach) {
    return refusal(anyApproachReplayed ? "no_carry_path" : "no_approach_path", state, { partId, binId });
  }

  const steps = [
    ...approach.steps,
    { type: "grip_close" },
    ...carry.steps,
    { type: "grip_open" },
  ];

  const nextState = {
    angles: carry.angles,
    placed: new Set([...state.placed, partId]),
    binUsage: { ...state.binUsage, [bin.id]: used + 1 },
  };
  return { ok: true, steps, state: nextState, shapes: { approach: approach.shape, carry: carry.shape } };
}

function refusal(reason, state, detail) {
  return { ok: false, reason, detail, steps: [], state };
}

// How many part-kinds does this bin accept? Used to prefer the most-
// restrictive compatible bin for each part, so shared bins stay open for
// parts whose only option is the shared bin.
function binSharedness(scene, bin) {
  const accepts = bin.accepts ?? "any";
  if (accepts === "any") return 1000;
  const kinds = new Set();
  for (const p of scene.parts) kinds.add(p.kind ?? "default");
  let n = 0;
  for (const k of kinds) if (Array.isArray(accepts) && accepts.includes(k)) n++;
  return n;
}

// Layered topological pick order: at each layer, pick the ready part whose
// carry is spatially least likely to sweep over remaining parts (rightmost
// if bins live on the left).
function readyOrder(scene, placed) {
  const binsLeft = scene.bins.every(b => binCenter(b).x < 0);
  const ready = scene.parts.filter(p =>
    !placed.has(p.id) && precedenceMet(p, placed)
  );
  ready.sort((a, b) => binsLeft ? (b.x - a.x) : (a.x - b.x));
  return ready;
}

// Convenience for the common shape: layered topological pick order, bin
// assignment preferring least-shared bin, first-fit-safe. The caller can
// ignore this and sequence placePart calls directly; this is sugar.
export function solveScene(scene, opts = {}) {
  let state = initialState(scene);
  const allSteps = [];
  const log = [];

  while (state.placed.size < scene.parts.length) {
    const ready = readyOrder(scene, state.placed);
    if (ready.length === 0) break;
    let progress = false;
    for (const part of ready) {
      const bins = compatibleBins(scene, part)
        .filter(b => (state.binUsage[b.id] ?? 0) < (b.capacity ?? Infinity))
        .sort((a, b) => {
          const sa = binSharedness(scene, a), sb = binSharedness(scene, b);
          if (sa !== sb) return sa - sb;
          const ca = binCenter(a), cb = binCenter(b);
          return Math.hypot(ca.x - part.x, ca.y - part.y) - Math.hypot(cb.x - part.x, cb.y - part.y);
        });
      let placed = false;
      for (const bin of bins) {
        const r = placePart(scene, state, part.id, bin.id, opts);
        log.push({ part: part.id, bin: bin.id, ok: r.ok, reason: r.reason, shapes: r.shapes });
        if (r.ok) {
          allSteps.push(...r.steps);
          state = r.state;
          progress = true;
          placed = true;
          break;
        }
      }
      if (placed) break; // restart outer loop: topology-ready set has changed
    }
    if (!progress) break;
  }
  return { steps: allSteps, state, log };
}
