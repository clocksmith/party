# Take-home Exercise: Robot Routine Planner

## Overview

Build a motion planner for a simulated 2D multi-axis robot arm. Plan safe routines for a fixed benchmark, then redesign the Planning API so it regenerates safe routines when the scene changes slightly.

An engineer will review your submission through the same lens as a regular production PR.

## Scenario

You are writing planning code that runs on a robot workcell. The arm picks parts from source positions and places them into bins across a set of scenes with obstacles, kind-restricted bins, capacity limits, and precedence constraints. Some scenes have no single "correct" answer — you decide what to prioritize and defend the choice.

Two phases:

- **Phase 1 — static routines.** Produce a `routines.json` bundle that solves the fixed benchmark. The safety/planning floor.
- **Phase 2 — runnable v2.** Ship a browser-runnable Planning API v2 for **one** variant family (capacity, precedence, or obstacle_routing). The simulator imports your module and runs it on small scene variants. A perfect Phase 1 scoreboard with a facade Phase 2 is not a strong submission.

## Deliverables

1. **`candidate/routines.json`** — Phase 1 bundle, valid against `src/schema.json`, covering at least the 6 required scenes.
2. **`candidate/phase1_planner.{js,py,…}`** — your Phase 1 planner source. Any language. If non-obvious, add `candidate/phase1/README.md` documenting how the bundle was produced.
3. **`candidate/planning_api_v2/index.js`** — browser-runnable ES module exporting `plan(scene, context)` for your chosen variant family. No build step, no network dependency.
4. **`REPORT.md`** — single written walkthrough (template at end). Read cold pre-interview; also walked live in the 30-min session.

## What's Important

- **Safety first.** A careful planner that safely skips a scene beats a confident one that crashes the arm. Violations weigh more than scene count.
- **Partial completion is scored.** Required set (01–06) first, then stretch (07–08). Bonus (09–10) is top-end exploration only — discussion material, not scene-completion scoring.
- **Phase 2 must be runnable in the browser.** v2 that hardcodes public-scene outputs fails on private variants. Use scene data in the API boundary.
- **Named tradeoffs.** Every scope cut, axis of "better," and thing-v2-makes-worse belongs in `REPORT.md`.
- **Communication.** Explain assumptions, cuts, and tradeoffs in `REPORT.md`.

## Simulator Contract

2D planar world, X right / Y up / meters. Arm base at origin; N-joint planar revolute arm with per-joint limits. Deterministic: same scene + same routine = same result.

**Robot API — exactly these five wire step types:**

| Step | Effect |
| --- | --- |
| `{type: "move_joint", angles: […]}` | Linear interpolate joint-space to `angles`. |
| `{type: "move_pose", x, y}` | IK solves + interpolates EE to `(x, y)`. |
| `{type: "grip_close"}` | Attach nearest graspable part within `gripper_radius + part.r`. |
| `{type: "grip_open"}` | Release at current EE; place if inside accepting bin. |
| `{type: "wait", duration}` | Advance elapsed time; no motion. |

**Safety violations (any one ends the scene):** `collision_obstacle`, `collision_floor`, `collision_self`, `joint_limit`, `ik_no_converge`, `carry_collision`, `drop_outside_bin`, `bin_rejects`, `bin_full`, `precedence_violation`, `double_grip`.

The sim does **not** model dynamics, inertia, gravity, sensing, force, weight, randomness, mobile bases, or continuous time.

See `src/schema.json` for the full scene and result formats.

**Frozen surface (do not modify):** `index.html`, `src/app.js`, `src/renderer.js`, `src/style.css`, `src/schema.json`, `src/sim.js`, `src/arm.js`, `src/scene.js`, `src/harness.js`, `scenarios/*.json`, `phase2_examples/*.json`. Contents are checksummed in `SEALED.json`; tampering is detected. Put your work under `candidate/`. If you find a real bug, leave it and document in the report — do not patch around it.

## Phase 1 — routines for fixed scenes

Use `src/planning_api.js` to build `routines.json`. How you produce it is your business: a JS planner, a Python solver, a hand-authored plan, an LLM-generated plan, whatever.

> **Scoring policy (read before optimizing):**
>
> 1. Tamper-free and schema-valid (gate)
> 2. Fewer safety violations
> 3. More parts placed
> 4. More scenes completed — required first, then stretch; bonus not counted
> 5. Lower path length (tie-breaker)
> 6. Lower elapsed micro-steps (weak tie-breaker)
>
> `reval.mjs` exits 0 regardless of scene pass/fail; the list above is how we actually compare submissions.

| Scene | Status | Tests | Baseline |
| --- | --- | --- | --- |
| `01_warmup` | required | single pick/place | should pass |
| `02_row` | required | sequencing + reach | should pass |
| `03_kinds` | required | kind matching + capacity | should pass |
| `04_wall` | required | obstacle routing | fails without routing |
| `05_maze` | required | tight clearance with held part | fails without routing |
| `06_combined` | required | routing + assignment + capacity | fails without stronger strategy |
| `07_precedence` | stretch | DAG ordering + bins | partial safe completion fine |
| `08_dense` | stretch | scale + packed geometry | partial safe completion fine |
| `09_precedence_wall` | bonus | precedence × obstacle routing | top-end exploration only |
| `10_capacity_trap` | bonus | global assignment vs greedy | top-end exploration only |

A **complete submission** attempts all six required scenes. Stretch optional. Bonus only after required + Phase 2 + REPORT are done — leaving bonus empty and saying so beats quietly overrunning.

## Phase 2 — runnable Planning API v2 for one variant family

Phase 1 produces static routines; Phase 2 regenerates routines for small scene variants. Pick **one** family:

| Family | What varies | Public example |
| --- | --- | --- |
| `capacity` | part counts, bin capacities, accepted kinds | `phase2_examples/capacity_example.json` |
| `precedence` | dependency edges, order constraints | `phase2_examples/precedence_example.json` |
| `obstacle_routing` | obstacle placement, pick/drop geometry | `phase2_examples/obstacle_routing_example.json` |

Your v2 only needs to support your chosen family. It should cleanly refuse the others rather than pretend.

**Module contract:** `candidate/planning_api_v2/index.js` must be a browser-native ES module. Export:

```js
export const family = "capacity"; // or "precedence" / "obstacle_routing"

export function plan(scene, context) {
  return { steps: [/* Robot API wire steps */] };
}
```

The simulator imports your module, calls `plan(scene, context)`, loads the returned routine, and plays it on the canvas. Context is `{family, variantId, source: "public" | "private"}`. Reviewers run the same module against private variants you will not see.

A focused v2 that solves one family cleanly beats a broad facade. v2 that emits hardcoded public-scene routines is weak even if Phase 1 is perfect.

## Submission

```
candidate/
  phase1_planner.{js,py,…}
  phase1/README.md            (only if non-obvious)
  routines.json
  planning_api_v2/
    index.js                  exports plan(scene, context)
    README.md                 optional: design notes, limits, predictions
REPORT.md                     single written walkthrough
```

Push to a private repository and email the link when ready. After submission, we run `node tests/reval.mjs --bundle candidate/routines.json --suite benchmark` and exercise your Phase 2 module in the simulator against variants from your chosen family. Live session is 30 min (10 min walking `REPORT.md`, 20 min discussion).

## Ground rules

- **Do not modify the frozen surface.** See above.
- **Keep your submission private.** Base kit lives at `https://github.com/clocksmith/party/tree/main/standard_takehome`.
- **Use any tools you want**, including AI. Document which decisions were yours in `REPORT.md`.
- **Ask questions.** Email <takehome@standardbots.example> if anything is genuinely ambiguous.

## Getting Started

```bash
git clone https://github.com/clocksmith/party.git
cd party/standard_takehome

python3 -m http.server 8000                      # local dev, then open http://localhost:8000
node tests/smoke.mjs                             # sanity-check
node tests/reval.mjs --bundle your_bundle.json   # scored run
```

In the simulator UI: pick a scene, click **run baseline** to see the naive planner, upload your `routines.json` to evaluate, export `results.json` for debugging. For Phase 2, use the Phase 2 panel to run your `candidate/planning_api_v2/index.js` against public variant examples.

Then read: `src/schema.json`, `src/planning_api.js`, `examples/example_planner.js`, `scenarios/`, `phase2_examples/`.

## FAQ

**Does the programming language matter for Phase 1?**
No. Any language. The simulator only consumes `routines.json`. Phase 2's module must be browser-runnable JS (ES module, no build step).

**Can I use AI tooling?**
Yes. Say which decisions were yours and which were the AI's in `REPORT.md`. We probe this in the Q&A.

**How long do candidates typically spend?**
Most successful submissions land in 4–6 hours. Stop at 6 — an honest stopper beats a stealth overrun. We do not score hours.

**What if a scene looks unsolvable?**
Document the geometric argument and emit an empty routine.

## REPORT.md template

Copy the block below into `REPORT.md` at the repo root. Keep each section scannable — short bullets, one small code block, one small diagram if helpful. Three pages ceiling. The arc doubles as your live walkthrough.

```markdown
# REPORT

## Framing
How I read the problem in one paragraph. The one assumption that shaped everything else.

## Phase 1 — strategy
The algorithm in 3–6 sentences. Scenes I skipped or partially solved, and why. What didn't work and what I cut.

## One scene walked end-to-end
Pick one scene and walk the routine. Name a specific ordering/routing decision and why you rejected the alternative. Concrete enough to anchor the live walkthrough.

## Phase 2 — v2
- **Family I chose:** capacity / precedence / obstacle_routing. Why this one.
- **The rough edge in v1:** a code snippet from Phase 1 that felt wrong.
- **My axis of "better":** callsite LOC, concept count, reuse, testability, extensibility, readability, or robustness under variation (or a different axis, defended).
- **v2 design:** small code sample. Include the `plan(scene, context)` boundary.
- **Before/after callsite:** literal v1 snippet and equivalent v2 snippet — small enough to compare directly.
- **Named guarantee (if applicable):** what class of invalid routine v2 prevents or detects earlier. If your axis isn't about correctness, say so — not a penalty.
- **Variant behavior:** what recomputes when the scene changes? What's cached? How does v2 refuse unsupported variants?
- **Public Phase 2 result:** which `phase2_examples/*.json` I ran and what happened.
- **Extension seam:** if oriented parts, a second arm, or a new family were added, what changes first? What doesn't need to change?
- **Evidence:** before/after LOC or concept count; public variant parts placed; public variant violations.
- **What v2 makes worse.**
- **What I would keep from v1.**

## Tradeoffs
The 2–3 design calls I'm least sure about. Case for and against each.
**AI disclosure:** which specific decisions did the AI make, and where did I diverge?

## What this exercise tests well, and what it doesn't
Push back. Where is this a realistic proxy for the work? Where is it not?
```

## Submit checklist

- [ ] `candidate/routines.json` valid against `src/schema.json`, covers at least the 6 required scenes.
- [ ] `candidate/phase1_planner.*` exists (or `candidate/phase1/README.md` documents production method).
- [ ] `candidate/planning_api_v2/index.js` is browser-importable and exports `plan(scene, context)`.
- [ ] `REPORT.md` filled in: before/after callsites, variant behavior, what v2 makes worse.
- [ ] `node tests/reval.mjs --bundle candidate/routines.json` runs without `TAMPER`.
- [ ] You stopped at 6 hours; if not, `REPORT.md` names what you would cut.
