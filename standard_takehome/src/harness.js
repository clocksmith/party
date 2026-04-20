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

export function classifyResult(result) {
  if (result.success) return "pass";
  if ((result.violations?.length ?? 0) > 0) return "violate";
  if (result.termination_reason === "no_routine") return "missing";
  return "partial";
}

export function coveragePartsTotal(scene) {
  return Number.isFinite(scene.coverage_parts_total)
    ? scene.coverage_parts_total
    : scene.parts.length;
}

export function coveragePartsPlaced(result, scene) {
  return Math.min(result.parts_placed, coveragePartsTotal(scene));
}

export function runBundle(scenes, bundle, opts = {}) {
  const out = { scenarios: {}, summary: {} };
  let passed = 0;
  let totalViolations = 0;
  let totalParts = 0;
  let totalPlaced = 0;
  let totalCoverageParts = 0;
  let totalCoveragePlaced = 0;
  const statusCounts = { pass: 0, partial: 0, missing: 0, violate: 0 };

  for (const scene of scenes) {
    const entry = bundle.scenarios?.[scene.id];
    const coverageTotal = coveragePartsTotal(scene);
    if (!entry) {
      const result = {
        success: false,
        termination_reason: "no_routine",
        parts_total: scene.parts.length,
        parts_placed: 0,
        coverage_parts_total: coverageTotal,
        coverage_parts_placed: 0,
        violations: [],
        elapsed_micro_steps: 0,
        path_length: 0
      };
      out.scenarios[scene.id] = result;
      statusCounts[classifyResult(result)] += 1;
      totalParts += scene.parts.length;
      totalCoverageParts += coverageTotal;
      continue;
    }
    const { result } = runRoutine(scene, entry, { recordTrace: !!opts.recordTrace });
    const coveragePlaced = coveragePartsPlaced(result, scene);
    out.scenarios[scene.id] = {
      ...result,
      coverage_parts_total: coverageTotal,
      coverage_parts_placed: coveragePlaced
    };
    statusCounts[classifyResult(result)] += 1;
    if (result.success) passed += 1;
    totalViolations += result.violations.length;
    totalParts += result.parts_total;
    totalPlaced += result.parts_placed;
    totalCoverageParts += coverageTotal;
    totalCoveragePlaced += coveragePlaced;
  }

  out.summary = {
    scenes_passed: passed,
    scenes_total: scenes.length,
    parts_placed: totalPlaced,
    parts_total: totalParts,
    coverage_parts_placed: totalCoveragePlaced,
    coverage_parts_total: totalCoverageParts,
    total_violations: totalViolations,
    status_counts: statusCounts
  };
  return out;
}
