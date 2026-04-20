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

export function isScene(value) {
  return !!value
    && typeof value === "object"
    && value.arm
    && Array.isArray(value.parts)
    && Array.isArray(value.bins);
}

export function normalizePhase2Input(rawInput) {
  if (rawInput && typeof rawInput === "object" && isScene(rawInput.scene)) {
    return rawInput;
  }
  if (isScene(rawInput)) return { scene: rawInput };
  return rawInput;
}

export function phase2Routine(output) {
  if (!output || typeof output !== "object") return null;
  if (Array.isArray(output.steps)) {
    return { steps: output.steps, notes: output.notes ?? "" };
  }
  if (output.routine && Array.isArray(output.routine.steps)) {
    return { steps: output.routine.steps, notes: output.routine.notes ?? output.notes ?? "" };
  }
  return null;
}

function validateStep(step, path) {
  const issues = [];
  if (!step || typeof step !== "object") {
    issues.push(`${path} must be an object`);
    return issues;
  }
  if (step.type === "move_joint") {
    if (!Array.isArray(step.angles) || step.angles.some(v => !Number.isFinite(v))) {
      issues.push(`${path}.angles must be an array of finite numbers`);
    }
  } else if (step.type === "move_pose") {
    if (!Number.isFinite(step.x) || !Number.isFinite(step.y)) {
      issues.push(`${path}.x and ${path}.y must be finite numbers`);
    }
  } else if (step.type === "wait") {
    if (!Number.isFinite(step.duration) || step.duration < 0) {
      issues.push(`${path}.duration must be a non-negative number`);
    }
  } else if (step.type !== "grip_open" && step.type !== "grip_close") {
    issues.push(`${path}.type is not a supported robot step`);
  }
  return issues;
}

export function validatePhase2Output(output) {
  const issues = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return ["phase2 output must be an object"];
  }

  const routine = phase2Routine(output);
  if (!routine) {
    issues.push("phase2 output must expose a routine as steps[] or routine.steps[]");
  } else {
    for (let i = 0; i < routine.steps.length; i++) {
      issues.push(...validateStep(routine.steps[i], `steps[${i}]`));
    }
  }

  if (output.refusal != null) {
    if (!output.refusal || typeof output.refusal !== "object" || Array.isArray(output.refusal)) {
      issues.push("refusal must be an object");
    } else {
      if (typeof output.refusal.reason !== "string" || !output.refusal.reason) {
        issues.push("refusal.reason must be a non-empty string");
      }
      if (output.refusal.scope != null && typeof output.refusal.scope !== "string") {
        issues.push("refusal.scope must be a string when present");
      }
    }
    if (routine && routine.steps.length > 0) {
      issues.push("refusal outputs must not also return executable steps");
    }
  }

  if (output.dropped != null) {
    if (!Array.isArray(output.dropped)) {
      issues.push("dropped must be an array when present");
    } else {
      for (let i = 0; i < output.dropped.length; i++) {
        const d = output.dropped[i];
        if (!d || typeof d !== "object" || Array.isArray(d)) {
          issues.push(`dropped[${i}] must be an object`);
          continue;
        }
        if (typeof d.partId !== "string" || !d.partId) issues.push(`dropped[${i}].partId must be a non-empty string`);
        if (typeof d.reason !== "string" || !d.reason) issues.push(`dropped[${i}].reason must be a non-empty string`);
      }
    }
  }

  if (output.assignments != null && !Array.isArray(output.assignments)) {
    issues.push("assignments must be an array when present");
  }

  return issues;
}

export function evaluatePhase2Output(rawInput, output, opts = {}) {
  const input = normalizePhase2Input(rawInput);
  const issues = validatePhase2Output(output);
  const routine = phase2Routine(output);
  const scene = input?.scene;
  if (!isScene(scene)) {
    return { input, scene: null, routine, result: null, trace: null, issues: issues.concat("phase2 input must contain a scene") };
  }
  if (!routine || issues.length) {
    return { input, scene, routine, result: null, trace: null, issues };
  }
  const { result, trace } = runRoutine(scene, routine, { recordTrace: !!opts.recordTrace });
  return { input, scene, routine, result, trace, issues };
}
