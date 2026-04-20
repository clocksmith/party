# Solution — sample_b

Regenerate Phase 1:

```bash
node _samples/sample_b/solution/phase1/planner/planner.js
```

Regenerate/check Phase 2:

```bash
node tests/phase2_play.mjs --solution _samples/sample_b/solution/phase2
```

## 1. How do I plan one scene?

For each unplaced part, the planner generates multiple IK endpoint candidates for pickup and drop, prefers kind-specific bins over `any` bins, and emits `move_joint` steps so replay does not depend on the simulator's IK branch. For each candidate transition it checks joint interpolation via `checkConfiguration`. If straight interpolation fails, it tries transit poses above the obstacle, then a bounded bidirectional RRT in joint space. A pickup is only committed after replaying the full routine prefix with `runRoutine`, because local edge checks alone miss held-part collisions and bin-state failures after earlier placements.

One non-obvious decision: I emit `move_joint` rather than `move_pose` even when the candidate target is naturally a pose. `move_pose` would delegate IK back to the simulator at replay time, and a different IK branch there can produce a different configuration than the one I validated. Committing to the joint-space answer I already proved safe eliminates that class of surprise.

## 2. What did I optimize, what did I give up, and what assumption breaks my submission?

Optimized: **safety and honest partial completion**. I will skip a part before I emit a motion I cannot prove safe via replay.

Given up: **optimality, generality to different arm geometry, and compute budget**. The `fixedSeeds` table is tuned to the 3-link arm used in this kit; a 4-link arm would need regenerated seeds. The planner is slow by design — full replay per candidate pickup.

Load-bearing assumption: **`runRoutine` is a faithful oracle for safety**. My commit-after-replay strategy rests on that. If `checkConfiguration` ever misses a collision class — say, link 0 vs. link 2 when link 1 folds back — I ship the unsafe routine without catching it at plan time, and the scene fails at review. The code path to point a reviewer at if they want to probe this is `src/sim.js` → `collideSelf`.

## 3. Where does my approach break as scene size or drift grows?

Smallest failure case: **a scene with four links instead of three, or link lengths shifted by more than ~30%**. `fixedSeeds` contains hardcoded 3-element tuples; with a 4-link arm every seed is length-invalid and filtered out. The planner then depends entirely on random seeds, and for tight-clearance configurations IK convergence from random seeds alone is unreliable.

Second failure mode: **scenes with 12+ parts and non-metric routing costs**. `planPickPlace` is greedy over `orderParts` and commits early assignments that make later parts infeasible. The replay-validation keeps committed steps safe, but coverage degrades.

## 4. Phase 2 thesis — smallest v1 API change

v1 forces every callsite to own the same fragile sequence: pick IK targets, try a path, grip, carry, drop, discover violations later at replay. For anything beyond one fixed scene that hides the intent — "place these parts safely despite drift."

My proposed v2 is captured in `phase2/api.schema.json` and `phase2/planner.mjs`. The key shape change: `plan(input) → output` where `output` is **either** a routine **or** a structured refusal. That split does two things v1 couldn't:

1. **Refusal is a first-class return**, not a late violation. `fixtures/unsolvable.in.json` + `.out.json` — the part at `(0.94, 0.82)` is beyond arm reach; v2 returns `{steps: [], refusal: {reason: "unreachable", scope: "part", partId: "far"}}` synchronously. v1 would have emitted a `move_pose` to the target, hit `ik_no_converge` at replay, and counted it as a violation.

2. **Routing becomes the planner's job, not the caller's.** `fixtures/wall.in.json` + `.out.json` — the v2 output delegates obstacle routing to the planner and returns already-validated joint-space steps. In v1 the caller had to script each transit manually and discover unsafe IK branches at replay.

The extra `fixtures/moving_target.*.json` pair is deliberately refused: this v2 is a static batch planner, so a scene with part velocity needs a different sensing/replanning surface rather than pretending a static routine is sound.

What v2 makes worse: **failure diagnostics are one level deeper**. v1 callers saw exactly which `movePose` caused a violation at replay. v2 callers get `refusal.reason === "no_safe_route"` with no breadcrumb trail through the routing search. The schema exposes `refusal.detail` for free-form explanation but not structured tracing. I would add a diagnostics return shape in v3 if this mattered in practice.

## AI disclosure

Algorithm choice (damped-LS IK, bidirectional RRT-connect, replay-validated commits) and the refusal-as-return design are my decisions. Specific numerical tuning (damping, step sizes, RRT anchor counts) and the 17-row fixed-seed table were AI-assisted — I ran the planner, found failing scenes, and asked for seed candidates that would converge. I verified each seed by re-running before accepting it.
