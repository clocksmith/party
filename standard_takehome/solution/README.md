# Solution

Three files per the contract: `phase1/routines.json`, `phase2/index.js`, this README. A generator lives at `phase1/planner.js` but is not part of the submitted contract — the simulator only consumes the JSON and the ES module.

Regenerate Phase 1:

```bash
node solution/phase1/planner.js
```

## 1. How do I plan one scene?

The same algorithm runs both phases; Phase 1 bakes its output into `routines.json`, Phase 2 runs it on each variant the simulator hands in. For each unplaced part, I generate multiple IK endpoint candidates for pickup and drop (damped least squares with a mix of fixed and randomized seeds), filter to configurations that pass `checkConfiguration`, and prefer kind-specific bins before `any` bins. For each (pick, drop) pair I try straight joint-space interpolation first, a catalog of transit configurations over obstacles second, and a bounded bidirectional RRT third. A pickup is only committed after replaying the full routine prefix through `runRoutine`, because local edge checks miss held-part collisions and bin-state failures that only appear after earlier placements.

The one non-obvious decision: I emit `move_joint` steps rather than `move_pose`. `move_pose` delegates IK to the simulator at replay time and a different IK branch can produce a different configuration than the one I validated, which turned safe candidates into collisions. Committing to the joint-space answer I already proved safe removes that class of surprise.

## 2. What did I optimize, and what did I give up?

Optimized: **safety and coverage**. I will skip a part before I will emit a motion I cannot prove safe via replay. Given the choice between a confident routine that might violate and an empty routine with a note, I pick the note every time.

Given up: **optimality, generality to new arm geometry, and compute budget**. The fixed seed table in `fixedSeeds` is tuned to the 3-link arm used by every scene in this kit; a 4-link or differently-scaled arm would need the seed table regenerated or parameterized (this is exactly the smallest case from Q3 below). The planner is also slow by design — it replays each candidate pickup through the full simulator. On the stress variants that replay cost is the first thing to hit the 2s budget.

The code matches: `planPickPlace` sorts candidates on a cost function dominated by `binPreference`, not by path length. No path-length knob. No elapsed-step knob. Just "does this pass full replay, yes or no."

## 3. Where does my approach break as drift grows?

The smallest case I would fail on: **a private variant with four links instead of three, or with link lengths shifted by more than ~30% from the public example.** The concrete failure is `fixedSeeds`, which contains hardcoded 3-element tuples. With a 4-link arm every seed becomes length-invalid and is filtered out in `fixedSeeds()`; the planner then depends entirely on `randomSeed` across the joint-limit cube. For tight-clearance scenes IK convergence from random seeds alone is unreliable, and the 2s budget expires before enough random restarts find a valid configuration.

A second failure mode: **stress variants with 12+ parts and non-metric routing costs**. `planPickPlace` is greedy over `orderParts` and will commit early assignments that make later parts infeasible. I accept this as a tradeoff — the replay-validation layer ensures the *committed* steps stay safe, but coverage degrades. I do not claim my planner solves the stress variants; I claim it skips them cleanly.

## 4. Smallest v1 API change that would have helped

v1 makes every callsite manually own the same fragile sequence: pick IK targets, try a path, grip, carry, drop, discover later whether it violated. For anything beyond one fixed scene, that hides the intent — "place these parts safely despite scene drift."

Before (v1):

```js
routine.movePose(part.x, part.y).gripClose();
routine.movePose(binCenter.x, binCenter.y).gripOpen();
```

After (v2):

```js
const routine = plan(scene, { family: "obstacle_routing", source: "public" });
```

The minimal change to v1 that would have removed my pain: **let the caller pass declarative pick/drop goals and get back a validated path, with refusal as a first-class return rather than a late violation.** Everything else — IK candidate generation, transit poses, RRT — is implementation detail.

What this makes worse: **failure is now one level deeper**. v2 can return a short or empty routine and the caller sees just `{steps: [...]}`. Without the README prose or a structured refusal reason, you cannot tell whether IK refused, route search refused, capacity refused, or replay rejected. I would fix this by returning `{steps, refusal: {reason, scope}}` on refusal — but that is a wire-format change and would have broken the frozen schema, so I kept the return shape minimal and pushed the diagnostic into `notes`.

## AI disclosure

Algorithm choice (damped-LS IK, bidirectional RRT-connect, replay-validated commits) and the tradeoff stance above are my decisions. Specific numerical tuning (damping, step sizes, anchor counts in RRT) and the 17-row fixed-seed table were AI-assisted — I ran the planner, found which scenes failed, and asked for seed candidates that would converge on those. I verified each seed by running `dryRun` before accepting it.
