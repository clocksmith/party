// Public simulator exports for optional JS tooling. Candidates rarely need
// to import from here directly. For Phase 1, use src/planning_api.js. The
// only true contract is src/schema.json (the routine wire format) and the
// simulator contract documented in README.md.
//
// Two ways to participate:
//
//   1. Produce a routines.json bundle by any means and any language. Drop it
//      into the simulator UI. The simulator runs it, scores it, and emits a
//      results.json. This is the recommended path.
//
//   2. (Optional) Author a planner directly in JS. Implement a function with
//      this signature:
//
//        function plan(scene) -> { steps: RoutineStep[] }
//
//      and call `runPlannerInBrowser(plan, scenes)` to generate routines on
//      the fly. The output is identical to (1).
//
// The simulator's behavior is fully defined by sim.js + the scene JSON. There
// is no hidden randomness. Same routine + same scene => same result, always.

export { fk, ik, endEffector, reach } from "./arm.js";
export { runRoutine, checkConfiguration } from "./sim.js";
export { runBundle, validateRoutineBundle } from "./harness.js";
export { loadScene, loadSceneIndex, validateScene } from "./scene.js";

import { runBundle } from "./harness.js";

export function runPlannerInBrowser(plannerFn, scenes) {
  const bundle = { generator: "in-browser planner", scenarios: {} };
  for (const scene of scenes) {
    try {
      const r = plannerFn(scene);
      bundle.scenarios[scene.id] = { steps: r.steps ?? r };
    } catch (err) {
      bundle.scenarios[scene.id] = { steps: [], notes: `planner threw: ${err.message}` };
    }
  }
  const results = runBundle(scenes, bundle);
  return { bundle, results };
}
