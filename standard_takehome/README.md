# Take-home Exercise: Robot Routine Planner

## Overview

Build a motion planner for a simulated 2D multi-axis robot arm. Phase 1 plans safe static routines for fixed benchmark scenes. Phase 2 redesigns the Planning API so it can generate a safe routine when a scene changes slightly.

An engineer will review your submission like a production PR: safety first, clear tradeoffs, and code that can be run.

## Deliverables

Put your work under `solution/`:

```text
solution/
  phase1/
    README.md
    planner.js
    routines.json
  phase2/
    README.md
    index.js
```

`solution/phase1/routines.json` is the static Phase 1 benchmark bundle. Phase 2 does **not** need a second static routines file: `solution/phase2/index.js` is the deliverable. The simulator imports it and calls `plan(scene, context)` for each variant, then runs the returned routine.

Use the two phase READMEs instead of a separate writeup:

- `solution/phase1/README.md`: explain the Phase 1 strategy, scenes skipped or partially solved, one scene walkthrough, tradeoffs, and how to regenerate `routines.json`.
- `solution/phase2/README.md`: name the chosen variant family, show the v1 rough edge, explain the v2 API, describe variant behavior, include the public example result, and name what v2 makes worse.

## What's Important

- **Safety first.** A careful planner that safely skips a scene beats a confident one that crashes the arm.
- **Partial completion counts.** Required scenes first, then stretch. Bonus scenes are discussion material.
- **Phase 2 must be browser-runnable.** No build step, no network dependency, and no Node-only APIs in `solution/phase2/index.js`.
- **Use scene data.** A v2 that hardcodes a public-scene routine is weak even if Phase 1 is perfect.
- **Explain tradeoffs in the phase READMEs.** Named scope cuts are better than hidden ones.

## Simulator Contract

2D planar world, X right / Y up / meters. Arm base at origin; N-joint planar revolute arm with per-joint limits. Deterministic: same scene + same routine = same result.

**Robot API — exactly these five wire step types:**

| Step | Effect |
| --- | --- |
| `{type: "move_joint", angles: [...]}` | Linear interpolate joint-space to `angles`. |
| `{type: "move_pose", x, y}` | IK solves + interpolates EE to `(x, y)`. |
| `{type: "grip_close"}` | Attach nearest graspable part within `gripper_radius + part.r`. |
| `{type: "grip_open"}` | Release at current EE; place if inside accepting bin. |
| `{type: "wait", duration}` | Advance elapsed time; no motion. |

**Safety violations (any one ends the scene):** `collision_obstacle`, `collision_floor`, `collision_self`, `joint_limit`, `ik_no_converge`, `carry_collision`, `drop_outside_bin`, `bin_rejects`, `bin_full`, `precedence_violation`, `double_grip`.

The sim does **not** model dynamics, inertia, gravity, sensing, force, weight, randomness, mobile bases, or continuous time.

See `src/schema.json` for the full scene and result formats.

**Frozen surface (do not modify):** `index.html`, `src/analytics.js`, `src/app.js`, `src/md.js`, `src/renderer.js`, `src/sparklines.js`, `src/style.css`, `src/schema.json`, `src/sim.js`, `src/arm.js`, `src/scene.js`, `src/harness.js`, `scenarios/*.json`, `phase2_examples/*.json`. Contents are checksummed in `SEALED.json`; tampering is detected. Put your work under `solution/`.

## Phase 1 - Static Routines

Produce:

```text
solution/phase1/routines.json
solution/phase1/planner.js
solution/phase1/README.md
```

How you produce `routines.json` is your business: JS planner, Python solver, hand-authored routines, AI-assisted code, or another approach. The simulator only consumes the wire format.

Run:

```bash
node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark
```

Scoring order:

1. Tamper-free and schema-valid.
2. Fewer safety violations.
3. More parts placed.
4. More scenes completed: required first, then stretch; bonus not counted.
5. Lower path length as a tie-breaker.
6. Lower elapsed micro-steps as a weak tie-breaker.

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
| `09_precedence_wall` | bonus | precedence x obstacle routing | top-end exploration only |
| `10_capacity_trap` | bonus | global assignment vs greedy | top-end exploration only |

In `solution/phase1/README.md`, answer:

- What strategy did you use?
- Which scenes did you skip or partially solve, and why?
- Walk one scene end-to-end. Name one ordering or routing decision.
- What did not work?
- How do we regenerate `routines.json`?

## Phase 2 - Runnable API v2

Pick **one** family:

| Family | What varies | Public example |
| --- | --- | --- |
| `capacity` | part counts, bin capacities, accepted kinds | `phase2_examples/capacity_example.json` |
| `precedence` | dependency edges, order constraints | `phase2_examples/precedence_example.json` |
| `obstacle_routing` | obstacle placement, pick/drop geometry | `phase2_examples/obstacle_routing_example.json` |

Produce:

```text
solution/phase2/index.js
solution/phase2/README.md
```

`solution/phase2/index.js` must be a browser-native ES module:

```js
export const family = "capacity"; // or "precedence" / "obstacle_routing"

export function plan(scene, context) {
  return { steps: [/* Robot API wire steps */] };
}
```

The simulator imports your module, calls `plan(scene, context)`, loads the returned routine, and plays it on the canvas. Context is `{family, variantId, source: "public" | "private"}`. Your v2 only needs to support your chosen family and should clearly refuse unsupported families.

In `solution/phase2/README.md`, answer:

- Which family did you choose, and why?
- What rough edge in v1 are you improving?
- What is your axis of "better"?
- Show the before/after callsite.
- What recomputes when the scene changes?
- What public Phase 2 example did you run, and what happened?
- What would change first for oriented parts, a second arm, or a new family?
- What does v2 make worse?

## Getting Started

```bash
git clone https://github.com/clocksmith/party.git
cd party/standard_takehome

python3 -m http.server 8000
node tests/smoke.mjs
node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark
```

In the simulator UI: pick a scene, click **run baseline**, upload a `routines.json`, or click **run v2 in sim** from the Phase 2 panel.

Then read: `src/schema.json`, `src/planning_api.js`, `examples/example_planner.js`, `scenarios/`, and `phase2_examples/`.

## FAQ

**Why is there only one `routines.json`?**
Because Phase 1 is static and Phase 2 is generative. Phase 1 submits `solution/phase1/routines.json`; Phase 2 submits `solution/phase2/index.js`, which returns a routine for each variant scene at runtime.

**Can I look at `_samples/`?**
Not if you are treating this as a real take-home. `_samples/` is included so the simulator can show completed example runs in sample mode. In a real candidate packet, `_samples/` would not be included.

**Does the programming language matter for Phase 1?**
No. Any language. The simulator only consumes `routines.json`. Phase 2's module must be browser-runnable JavaScript.

**Can I use AI tooling?**
Yes. Say which decisions were yours and which were AI-assisted in the phase READMEs. We probe this in the Q&A.

**How long do candidates typically spend?**
Most successful submissions land in 4-6 hours. We do not score hours; make the submission clear to a human reviewer.

**What if a scene looks unsolvable?**
Document the geometric argument and emit an empty routine.

## Submit Checklist

- [ ] `solution/phase1/routines.json` is valid and covers at least the 6 required scenes.
- [ ] `solution/phase1/planner.js` exists, or `solution/phase1/README.md` explains how the bundle was produced.
- [ ] `solution/phase1/README.md` explains strategy, cuts, one scene walkthrough, and regeneration.
- [ ] `solution/phase2/index.js` is browser-importable and exports `family` plus `plan(scene, context)`.
- [ ] `solution/phase2/README.md` explains the chosen family, before/after API, variant behavior, public result, and what v2 makes worse.
- [ ] `node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark` runs without `TAMPER`.
