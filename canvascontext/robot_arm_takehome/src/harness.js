// Bundle harness: takes a routine bundle + scene set, runs each, summarizes.

import { runRoutine } from "./sim.js";

export function validateRoutineBundle(bundle) {
  const issues = [];
  if (!bundle || typeof bundle !== "object") {
    issues.push("bundle must be an object");
    return issues;
  }
  if (!bundle.scenarios || typeof bundle.scenarios !== "object") {
    issues.push("bundle.scenarios must be an object keyed by scene id");
    return issues;
  }
  for (const [id, entry] of Object.entries(bundle.scenarios)) {
    if (!entry || !Array.isArray(entry.steps)) {
      issues.push(`scenarios.${id}.steps must be an array`);
    }
  }
  return issues;
}

export function runBundle(scenes, bundle, opts = {}) {
  const out = { scenarios: {}, summary: {} };
  let passed = 0;
  let totalViolations = 0;
  let totalParts = 0;
  let totalPlaced = 0;

  for (const scene of scenes) {
    const entry = bundle.scenarios?.[scene.id];
    if (!entry) {
      out.scenarios[scene.id] = {
        success: false,
        termination_reason: "no_routine",
        parts_total: scene.parts.length,
        parts_placed: 0,
        violations: [],
        elapsed_micro_steps: 0,
        path_length: 0
      };
      totalParts += scene.parts.length;
      continue;
    }
    const { result } = runRoutine(scene, entry, { recordTrace: !!opts.recordTrace });
    out.scenarios[scene.id] = result;
    if (result.success) passed += 1;
    totalViolations += result.violations.length;
    totalParts += result.parts_total;
    totalPlaced += result.parts_placed;
  }

  out.summary = {
    scenes_passed: passed,
    scenes_total: scenes.length,
    parts_placed: totalPlaced,
    parts_total: totalParts,
    total_violations: totalViolations
  };
  return out;
}
