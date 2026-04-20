# Solution — sample_a

Regenerate Phase 1:

```bash
node _samples/sample_a/solution/phase1/planner/planner.js
```

Phase 2 is a design doc under `phase2/` — schema plus fixtures, no runtime.

## 1. How do I plan one scene?

A wavefront-based obstacle-aware router builds a free-space grid and runs A* from pick-pose to drop-pose for each part. On top of the grid I keep a small library of carry-shape heuristics (straight-line, over-the-top, around-left, around-right) tried in order; the first that passes `checkConfiguration` at every micro-step wins. I prefer kind-specific bins before `any` bins and route the held-part swept volume, not just the gripper, which catches the `carry_collision` class of failures that a point-based A* misses.

One non-obvious decision: I expand obstacles by `gripper_radius + part.r` during wavefront build so the planner produces a path that is safe for the widest part in the scene even when different parts share the same waypoint. Small grid waste, big reduction in per-part replanning.

## 2. What did I optimize, what did I give up, and what assumption breaks my submission?

Optimized: **predictable coverage and code uniformity across scenes**. The same routine shape runs every scene; no scene-ID dispatch. Visible in the planner — `planScene(scene, opts)` is called ten times with ten scene files, no special cases.

Given up: **optimality in assignment**. I assign parts to bins greedily by kind-affinity + Euclidean distance, not by a global search. Scene `10_capacity_trap` exposes this: greedy places 4/6 parts, then refuses the rest rather than re-plan. I chose the predictable partial over a clever global solver that would have pushed me past the time budget.

Load-bearing assumption: **obstacles are axis-aligned rectangles of size comparable to the gripper**. The wavefront grid rasterizer assumes that shape, and the fixed inflation radius assumes obstacles aren't many times larger than the gripper. Rotated rectangles would over-inflate; obstacles a few meters wide would blow the grid out. If the simulator ever admits non-axis-aligned or very large obstacles, this planner fails quietly by finding "no path" when one exists.

## 3. Where does my approach break as scene size or drift grows?

Smallest failure case: **a scene with 15+ parts packed densely enough that the obstacle-inflated wavefront grid fragments into isolated pockets**. Around 12 parts is fine; past that the carry-shape library's fixed four heuristics stop covering the solution space and A* on the inflated grid finds "no path" even when one exists at tighter clearances. I would fix this by adding a falloff on the obstacle inflation radius or by switching to a sample-based planner (RRT) as a fallback, but neither is in the submitted code.

Second failure mode: **non-rectangular obstacles**. The grid rasterizer assumes axis-aligned rectangles, which matches the schema. A circle or a rotated rectangle would collapse to its bounding box and over-inflate.

## 4. Phase 2 thesis — smallest v1 API change

v1 is per-part imperative: `routine.movePose(...).gripClose().movePose(...).gripOpen()` for every part, and the caller owns the assignment loop. For a scene with N parts and M bins, that is N × (pick, transit, drop, transit-back) calls wired up by hand, and the assignment is baked into the caller's control flow.

My proposed v2 is a **batch planner**: `plan({scene})` returns a complete routine for the whole scene with assignment decided internally. See `phase2/api.schema.json`. The schema says `output.routine.assignments` is a materialized view — the caller can see which part went to which bin — but the *decision* no longer leaks through the API surface. `phase2/fixtures/row.in.json` + `.out.json` shows a 3-part scene where the assignment is determined by kind and bin capacity; the caller never wrote a loop.

What v2 makes worse: **atomicity**. v1 let the caller skip a single part mid-scene and continue with the rest. v2 commits to the whole scene as one returned routine — if one part is infeasible, the whole `plan()` returns a partial routine with that part dropped, which is less ergonomic for callers who want fine-grained control over which parts ship and which don't. I accept that cost because the common case is "do the scene, tell me what you placed," not "place exactly these three parts in exactly this order."

## AI disclosure

Algorithm choice (wavefront + carry-shape heuristics + replay validation) and the Phase 2 batch API framing are my decisions. Grid resolution (0.02m), inflation factor, and the four carry-shape heuristics are AI-assisted — I ran the planner, identified which scenes failed with fewer shapes, and asked for additional transit templates until coverage stabilized.
