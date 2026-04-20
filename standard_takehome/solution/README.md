# Solution

Layout:

```text
phase1/
  planner/planner.js    # Node.js planner; any language allowed per contract
  routines.json         # bundle produced for the 10 public scenes
phase2/
  api.schema.json       # proposed v2 API surface
  fixtures/
    wall.in.json        # sample scene input
    wall.out.json       # routine the proposed API would return
    unsolvable.in.json  # infeasibility scene
    unsolvable.out.json # structured refusal the proposed API would return
README.md               # this file
```

Regenerate Phase 1:

```bash
node solution/phase1/planner/planner.js
```

This writes `solution/phase1/routines.json`. The planner is Node.js; candidates in any other language would document their own regenerate command here.

## 1. How do I plan one scene?

For each unplaced part, the planner generates multiple IK endpoint candidates for pickup and drop (damped least squares with a mix of fixed and randomized seeds), filters to configurations that pass `checkConfiguration`, and prefers kind-specific bins before `any` bins. For each (pick, drop) pair it tries straight joint-space interpolation first, a catalog of transit configurations over obstacles second, and a bounded bidirectional RRT third. A pickup is only committed after replaying the full routine prefix through `runRoutine`, because local edge checks miss held-part collisions and bin-state failures that only appear after earlier placements.

One non-obvious decision: I emit `move_joint` steps rather than `move_pose`. `move_pose` delegates IK to the simulator at replay time and a different IK branch can produce a different configuration than the one I validated, which turned safe candidates into collisions. Committing to the joint-space answer I already proved safe removes that class of surprise.

## 2. What did I optimize, what did I give up, and what assumption breaks my submission?

Optimized: **safety and coverage**. I will skip a part before I will emit a motion I cannot prove safe via replay. Given the choice between a confident routine that might violate and an empty routine with a note, I pick the note every time.

Given up: **optimality, generality to new arm geometry, and compute budget**. `fixedSeeds` is tuned to the 3-link arm used by every scene in this kit; a 4-link or differently-scaled arm would need the seed table regenerated. The planner is slow by design — full replay per candidate pickup.

Load-bearing assumption: **the simulator's `runRoutine` is a faithful oracle for safety**. My whole commit-after-replay strategy rests on that — if `runRoutine` ever accepts a configuration the physical-world collision check would reject, my planner will happily ship the unsafe routine. If, for instance, `checkConfiguration` missed a self-intersection class (say, link 0 vs. link 2 when link 1 folds back), I would not catch it at plan time and the scene would fail at review time. The file to point a reviewer at if they want to falsify this is `src/sim.js` → `collideSelf`.

## 3. Where does my approach break as scene size or drift grows?

The smallest case I would fail on: **a scene with four links instead of three, or with link lengths shifted by more than ~30% from the public set.** `fixedSeeds` contains hardcoded 3-element tuples; with a 4-link arm every seed becomes length-invalid and is filtered out. The planner then depends entirely on random seeds across the joint-limit cube, and for tight-clearance scenes IK convergence from random seeds alone is unreliable.

A second failure mode: **scenes with 12+ parts and non-metric routing costs**. `planPickPlace` is greedy over `orderParts` and will commit early assignments that make later parts infeasible. The replay-validation layer ensures committed steps stay safe, but coverage degrades. I do not claim my planner solves those — I claim it skips them cleanly.

## 4. Phase 2 thesis — smallest v1 API change

v1's rough edge is that every callsite manually owns the same fragile sequence: pick IK targets, try a path, grip, carry, drop, discover violations later at replay. For anything beyond one fixed scene, that hides the intent — "place these parts safely despite scene drift."

My proposed v2 is captured in `phase2/api.schema.json`. The key shape change: `plan(input) → output` where `output` is **either** a routine **or** a structured refusal. That one split does two things v1 couldn't:

1. **Refusal is a first-class return**, not a late violation. See `fixtures/unsolvable.in.json` + `.out.json` — the part at `(0.94, 0.82)` is beyond arm reach, and v2 returns `{steps: [], refusal: {reason: "unreachable", scope: "part", partId: "far"}}` synchronously. v1 would have emitted a `move_pose` to the target, hit `ik_no_converge` at replay, and counted it as a violation.

2. **Routing becomes the planner's job, not the caller's.** See `fixtures/wall.in.json` + `.out.json` — the v2 `plan()` output derives a high-transit path over the obstacle from the scene's `obstacles` field. In v1 the caller had to script each transit manually with `routine.movePose(...)` calls.

Before/after callsite:

```js
// v1
routine.movePose(part.x, part.y).gripClose();
routine.movePose(binCenter.x, binCenter.y).gripOpen();

// v2
const out = plan({ scene, context: { family: "obstacle_routing" } });
if (out.refusal) handleRefusal(out.refusal);
else run(out.steps);
```

**What v2 makes worse**: failure diagnostics are now one level deeper. A v1 caller saw exactly which `movePose` call caused a violation at replay. A v2 caller gets `refusal.reason === "no_safe_route"` with no breadcrumb trail through the routing search. The schema exposes `refusal.detail` for a free-form explanation, but structured tracing (which pick candidate was tried, which transit failed) is not surfaced — I would add a diagnostics return shape in v3 if this turned out to matter in practice.

## AI disclosure

Algorithm choice (damped-LS IK, bidirectional RRT-connect, replay-validated commits) and the Phase 2 refusal-as-return design are my decisions. Specific numerical tuning (damping, step sizes, anchor counts in RRT) and the 17-row fixed-seed table were AI-assisted — I ran the planner, found which scenes failed, and asked for seed candidates that would converge on those. I verified each seed by re-running the planner before accepting it.
