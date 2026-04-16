# REPORT

## Framing

I treated the frozen simulator as the source of truth, not the scenario guide. The assumption that shaped the work was: a routine with zero safety violations is more valuable than a visually plausible route. For the current post-P0 scenes, that means routing through obstacle scenes with simulator-checked joint-space paths and using full-prefix replay before each pickup is committed.

## Phase 1 - strategy

The planner generates IK candidates for pick and drop targets, then emits only `move_joint` steps after replaying the simulator's micro-step collision checks. Direct motion is tried first, then verified transit poses, then a bounded bidirectional RRT fallback in joint space. Every candidate pickup is committed only after replaying the full routine prefix with `runRoutine`; local checks are not trusted as the final authority.

The current result is all public scenes complete with zero violations: 6/6 required, 2/2 stretch, and 2/2 bonus. Two fixes mattered after the first pass: trying alternate routes when full-prefix replay rejects a locally valid route, and reserving mixed-bin capacity in `10_capacity_trap` so `b` parts do not get starved by closer `a` placements.

Reviewer run:

```text
required: 6/6 scenes, 17/17 parts, 0 violations
stretch:  2/2 scenes, 16/16 parts, 0 violations
bonus:    11/11 parts, 0 violations
```

## One scene walked end-to-end

I would walk `06_combined`. It combines routing, kind matching, and capacity. The first version found a locally valid route for `p4` that failed full replay with a carry collision, so I changed the planner to keep a per-part rejection set and try alternate routes before blocking the part. That turned `06_combined` from 4/5 to 5/5 without relaxing safety.

## Phase 2 - v2

- **The rough edge in v1.** v1 makes safety an external habit:

```js
routine.movePose(part.x, part.y);
routine.gripClose();
routine.movePose(c.x, c.y);
routine.gripOpen();
// Only the simulator later tells you whether this was safe.
```

- **My axis of "better":** diagnosability/testability. I want planning code to return a structured preflight result before the routine becomes a shipped artifact.

- **v2 design:**

```js
const planner = plan(scene, { axis: "testability" })
  .placeAll({ refuseUnsafe: true, dryRun: true });

const routine = planner.build();
const check = planner.dryRun(routine);
```

- **Scene I re-solved with v2:** `08_dense`, because it exercises the current fixed obstacle geometry and scale. The v2 route is intentionally the same lowered wire routine; the improvement is the callsite contract and structured dry-run result, not path quality.

| Metric | v1 | v2 |
| --- | ---: | ---: |
| Callsite LOC | about 20 in the Phase 1 loop | 2 |
| Concepts touched | routine, order, bins, routing, safety replay, commit | intent planner, dryRun |
| Routine step count (`08_dense`) | 82 | 82 |
| Path length (`08_dense`) | 37.311 | 37.311 |
| Named axis: diagnosability/testability | external simulator call | first-class API method |

- **What v2 makes worse.** It wraps failure one level deeper. Debugging a skipped or partial scene requires inspecting planner notes plus `dryRun`, not just reading emitted primitive steps.
- **What I would keep from v1.** The five-step wire format is small and reviewable. I would keep it as the lowering target.

## Tradeoffs

The biggest tradeoff is that the RRT fallback is bounded and heuristic. It is good enough for these scenes, but it is not a completeness proof. I kept the full-prefix replay gate so a failed search becomes a safe skip rather than an unsafe routine.

The bin assignment heuristic now prefers specific bins over mixed bins. The upside is that `10_capacity_trap` completes; the downside is that this is still a heuristic, not a global assignment optimizer.

I used `move_joint` rather than `move_pose`. The benefit is deterministic submitted behavior; the cost is less readable `routines.json`.

The v2 implementation reuses the Phase 1 planning core. That keeps the slice runnable, but a fuller v2 would split assignment, ordering, routing, emission, and dry-run diagnostics into separate compiler passes.

**AI disclosure:** AI helped draft the joint-space planner and the v2 surface. I kept the simulator-prefix validation, alternate-route rejection set, and mixed-bin reservation because I wanted to own the failure modes; I rejected the earlier infeasibility framing once the current post-P0 scene geometry made obstacle routing valid.

## What this exercise tests well, and what it doesn't

It tests whether a candidate reads the simulator contract, respects safety ordering, and can explain a planning design under ambiguity. It also tests whether they can change their conclusion when the benchmark geometry changes.

It does not test physical robotics dynamics, calibration, sensing, or control-loop robustness. The routing here is still deterministic 2D joint-space search, not production arm control.
