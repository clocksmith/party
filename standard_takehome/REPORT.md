# REPORT

## Framing

I treated the frozen simulator as the source of truth, not the scenario guide. The assumption that shaped the work was: a routine with zero safety violations is more valuable than a visually plausible route. Phase 1 therefore emits deterministic `move_joint` routines only after simulator-shaped collision checks and full-prefix replay. Phase 2 keeps that safety posture, but changes the interface from a static bundle to a browser-runnable planner that recomputes a routine from scene data.

## Phase 1 - Strategy

The planner generates IK candidates for pick and drop targets, then plans joint-space transitions between them. Direct interpolation is tried first; if that fails, it tries verified transit poses and then a bounded bidirectional RRT in joint space. Every candidate pickup is committed only after replaying the full routine prefix with `runRoutine`, because local edge checks alone can miss carry collisions after earlier placements. Bin assignment prefers kind-specific bins before shared bins so mixed-capacity scenes do not starve later parts.

Current benchmark result:

```text
required: 6/6 scenes, 17/17 parts, 0 violations
stretch:  2/2 scenes, 16/16 parts, 0 violations
bonus:    11/11 parts, 0 violations
```

What did not work: a single direct joint interpolation worked for easy scenes but clipped obstacles in `04_wall` and `06_combined`. A pure nearest-bin heuristic solved simple scenes but failed `10_capacity_trap`; the fix was a small bin-specificity preference. I did not attempt optimal path length; I optimized for safe completion.

## One Scene Walked End-to-End

I would walk `06_combined`. It combines obstacle routing, kind matching, and bin capacity. The first version found a locally valid route for `p4` that failed full replay with a carry collision, so I changed the planner to keep a per-part rejection set and try alternate routes before blocking the part. That turned `06_combined` from 4/5 to 5/5 without relaxing the safety gate.

## Phase 2 - v2

- **Family I chose:** `obstacle_routing`. It is the family closest to the core robotics signal: pick/drop geometry changes, obstacles move, and a static routine is the wrong abstraction.

- **The rough edge in v1:**

```js
const routine = solveScene(scene);
bundle.scenarios[scene.id] = routine;
// The caller owns all variant loading, safety checks, and refusal behavior.
```

- **My axis of "better":** robustness under obstacle variation at the API boundary. A caller should pass a scene variant and receive either a routine that was planned from that scene or a clear refusal for an unsupported family.

- **v2 design:**

```js
export const family = "obstacle_routing";

export function plan(scene, context) {
  if (context.family !== family) throw new Error("unsupported family");
  return { steps: planObstacleAwareRoutine(scene) };
}
```

- **Before/after callsite:**

```js
// v1: caller chooses solver, bundle key, and validation convention.
bundle.scenarios[scene.id] = solveScene(scene);

// v2: simulator passes the variant and receives a routine directly.
const routine = plan(scene, { family: "obstacle_routing", variantId: scene.id });
```

- **Named guarantee:** v2 refuses non-`obstacle_routing` families instead of silently running an API it does not claim to support. Within the chosen family, it recomputes IK endpoints, transition checks, and RRT routes from the supplied scene rather than loading precomputed benchmark routines.

- **Variant behavior:** nothing is cached across scenes. A changed obstacle or part/bin position causes IK candidates, transit poses, transition checks, and RRT samples to be recomputed. Unsupported families throw a clear error.

- **Public Phase 2 result:** `phase2_examples/obstacle_routing_example.json` passes: 3/3 parts, 0 violations, 20 steps, path length 9.167, 1174 elapsed micro-steps.

- **Extension seam:** a second arm or oriented parts would first change the configuration validity and IK target generation helpers. The API boundary, `plan(scene, context) -> {steps}`, should not need to change.

- **Evidence:** `candidate/planning_api_v2/index.js` is browser-native: no `fs`, `path`, `process`, build step, or network dependency. The returned value is a routine object with a `steps` array, matching the simulator contract.

- **What v2 makes worse:** the browser entrypoint duplicates some simulator-shaped collision math instead of importing the simulator oracle. That keeps the module self-contained, but it creates drift risk if the simulator's collision model changes.

- **What I would keep from v1:** the five-step Robot API wire format is small and reviewable. I would keep it as the lowering target.

## Tradeoffs

The RRT fallback is bounded and heuristic. It is good enough for these scenes and public obstacle variants, but it is not a completeness proof. I kept safe refusal as the failure mode.

The Phase 1 routines use `move_joint` instead of `move_pose`. The benefit is deterministic submitted behavior; the cost is a less readable `routines.json`.

The v2 implementation supports one family intentionally. It would be easy to make it attempt capacity or precedence too, but that would blur the contract. I prefer a narrow API that refuses honestly.

**AI disclosure:** AI helped draft parts of the joint-space planner and prompted the API-shape critique. I kept the simulator-prefix replay, alternate-route rejection, mixed-bin reservation, and one-family v2 refusal because those are the failure modes I wanted to own. I rejected the earlier `dryRun` facade once I checked the current README contract and saw that `plan(scene, context)` must return a routine directly in the browser.

## What This Exercise Tests Well, And What It Doesn't

It tests whether a candidate reads the simulator contract, respects safety ordering, can debug geometry under constraints, and can explain a planning design under ambiguity. It also tests whether they can change course when a prior abstraction does not match the actual contract.

It does not test physical dynamics, calibration, sensing, gripper force, control-loop robustness, or production arm recovery. The routing here is deterministic 2D joint-space search, not a production controller.

## Submit Checklist

- [x] `candidate/routines.json` is valid and covers all 6 required scenes.
- [x] `candidate/phase1_planner.js` exists and regenerates `routines.json`.
- [x] `candidate/phase1/README.md` documents the production method.
- [x] `candidate/planning_api_v2/index.js` is browser-importable and exports `family` plus `plan(scene, context)`.
- [x] `REPORT.md` includes before/after callsites, variant behavior, what v2 makes worse, and AI disclosure.
- [x] `node tests/reval.mjs --bundle candidate/routines.json --suite benchmark` runs without `TAMPER`.
- [x] I would stop at 6 hours in a real submission; additional time would go to reducing duplicated collision math in v2.
