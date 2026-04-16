import { runRoutine } from "../../src/sim.js";

export function dryRun(scene, routineOrSteps) {
  const routine = Array.isArray(routineOrSteps)
    ? { steps: routineOrSteps }
    : routineOrSteps;
  const { result } = runRoutine(scene, routine, { recordTrace: false });
  return {
    ok: result.violations.length === 0,
    complete: result.success,
    partsPlaced: result.parts_placed,
    partsTotal: result.parts_total,
    violations: result.violations,
    termination: result.termination_reason,
    pathLength: result.path_length,
    elapsedMicroSteps: result.elapsed_micro_steps
  };
}
