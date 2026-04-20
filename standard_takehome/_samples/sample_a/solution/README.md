# Solution — sample_a

Regenerate Phase 1:

```bash
node _samples/sample_a/solution/phase1/planner/planner.js
```

Regenerate/check Phase 2:

```bash
node tests/phase2_play.mjs --solution _samples/sample_a/solution/phase2
```

## 1. How do I plan one scene?

A wavefront-based obstacle-aware router builds a free-space grid and runs A* from pick-pose to drop-pose for each part. On top of the grid I keep a small library of carry-shape heuristics (straight-line, over-the-top, around-left, around-right) tried in order; the first that passes `checkConfiguration` at every micro-step wins. I prefer kind-specific bins before `any` bins and route the held-part swept volume, not just the gripper, which catches the `carry_collision` class of failures that a point-based A* misses.

For `08_carry_maze`, the pose-waypoint router stalls, so I added a bounded joint-space fallback adapted from `sample_b`. It emits `move_joint` steps that have already been validated against the simulator, which is a narrower fix than replacing the whole planner.

One non-obvious decision: I expand obstacles by `gripper_radius + part.r` during wavefront build so the planner produces a path that is safe for the widest part in the scene even when different parts share the same waypoint. Small grid waste, big reduction in per-part replanning.

## 2. What did I optimize, what did I give up, and what assumption breaks my submission?

Optimized: **predictable coverage and code uniformity across the required scenes**. The same routine shape runs most scenes, and one hard-scene fallback handles `08_carry_maze` where the pose-waypoint approach cannot preserve a safe IK branch.

Given up: **optimality in assignment**. I assign parts to bins greedily by kind-affinity + Euclidean distance, not by a global search. The redesigned hard scenes expose this: the planner safely leaves some parts unplaced rather than re-plan globally. I chose the predictable partial over a broader global solver that would have pushed me past the time budget.

Load-bearing assumption: **obstacles are axis-aligned rectangles of size comparable to the gripper**. The wavefront grid rasterizer assumes that shape, and the fixed inflation radius assumes obstacles aren't many times larger than the gripper. Rotated rectangles would over-inflate; obstacles a few meters wide would blow the grid out. If the simulator ever admits non-axis-aligned or very large obstacles, this planner fails quietly by finding "no path" when one exists.

## 3. Where does my approach break as scene size or drift grows?

Smallest failure case: **a scene with 15+ parts packed densely enough that the obstacle-inflated wavefront grid fragments into isolated pockets**. Around 12 parts is fine; past that the carry-shape library's fixed four heuristics stop covering the solution space and A* on the inflated grid finds "no path" even when one exists at tighter clearances. I would fix this by adding a falloff on the obstacle inflation radius or by promoting the joint-space fallback from a narrow `08_carry_maze` rescue into a general fallback.

Second failure mode: **non-rectangular obstacles**. The grid rasterizer assumes axis-aligned rectangles, which matches the schema. A circle or a rotated rectangle would collapse to its bounding box and over-inflate.

## 4. Phase 2 thesis — smallest v1 API change

v1 is per-part imperative: `routine.movePose(...).gripClose().movePose(...).gripOpen()` for every part, and the caller owns the assignment loop. For a scene with N parts and M bins, that is N × (pick, transit, drop, transit-back) calls wired up by hand, and the assignment is baked into the caller's control flow.

My proposed v2 is a **batch planner**: `plan({scene})` returns a complete routine for the whole scene with assignment decided internally. See `phase2/api.schema.json` and `phase2/planner.mjs`. The schema says `output.assignments` is a materialized view — the caller can see which part went to which bin — but the *decision* no longer leaks through the API surface. `phase2/fixtures/row.*.json` shows a 3-part scene where the assignment is determined by kind and bin capacity; `phase2/fixtures/shifted_scene.*.json` shows the same family with moved coordinates; `phase2/fixtures/dropped.*.json` shows the partial output when one part has no compatible bin.

What v2 makes worse: **atomicity**. v1 let the caller skip a single part mid-scene and continue with the rest. v2 commits to the whole scene as one returned routine — if one part is infeasible, the whole `plan()` returns a partial routine with that part dropped, which is less ergonomic for callers who want fine-grained control over which parts ship and which don't. I accept that cost because the common case is "do the scene, tell me what you placed," not "place exactly these three parts in exactly this order."

## AI disclosure

Algorithm choice (wavefront + carry-shape heuristics + replay validation) and the Phase 2 batch API framing are my decisions. Grid resolution (0.02m), inflation factor, the four carry-shape heuristics, and the `08_carry_maze` joint-space fallback are AI-assisted — I ran the planner, identified which scenes failed with fewer shapes, and asked for additional transit templates until coverage stabilized.
