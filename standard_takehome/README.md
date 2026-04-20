# Take-home Exercise: Robot Routine Planner

Build a motion planner for a simulated 2D multi-axis robot arm. **Phase 1** ships a planner program (any language) plus the routines it produced for the public scenes. **Phase 2** is a design doc — an API schema plus fixtures plus prose — describing how you would redesign the v1 planning surface.

This is deliberately a take-home about take-homes. The robot benchmark is the concrete substrate; the senior signal is whether you can make the work legible, bounded, and fair to evaluate. Phase 1 asks you to live inside the current surface. Phase 2 asks you to design the next surface so a future candidate could express infeasibility and tradeoffs cleanly instead of relying on hidden side channels.

Reviewer has the same visibility as you. Nothing is held out. No private scenes. Read `RUBRIC.md` before you start; it is the single source of truth for how submissions are scored.

**There is no trick.** The task is: write a planner, ship the `routines.json` it produced for the 10 public scenes, and design the smallest API change that would make scene 10 (the deliberate mixed-feasibility case) straightforward. Safety gate is pass/fail. Coverage is a single integer. Tradeoff clarity is graded against named criteria in `RUBRIC.md`. Extra polish, micro-optimization, or beating the samples on step count is not rewarded; being honest about what you chose, what you skipped, and what you cannot cleanly express *is*.

## Deliverables

```text
solution/
  phase1/
    planner/            # your planner program — required, any language
    routines.json       # the bundle your planner produced for the public scenes
  phase2/
    api.schema.json     # your proposed v2 API surface, as JSON Schema
    fixtures/
      *.in.json         # scene inputs that exercise the proposed API
      *.out.json        # the routine (or refusal) the API would return
  README.md             # four questions, one unified writeup
```

Five artifact shapes, one README. No separate phase READMEs. No runnable Phase 2 module.

`solution/README.md` must include a **"How to regenerate `routines.json`"** section with the exact command you use (e.g. `python planner/main.py`, `node planner/index.js`, `cargo run --release`). The reviewer does not need to re-run anything to score you — the shipped `routines.json` is the evidence — but if they choose to verify, they follow your stated command.

## What to put in `solution/README.md`

Four questions, short answers. One or two paragraphs each.

1. **How do you plan one scene?** Describe the algorithm your Phase 1 planner uses.
2. **What did you optimize, what did you knowingly give up, and what assumption — if wrong — breaks your submission?** Safety, coverage, compute budget, simplicity, generalization — pick your axis and name the tradeoff. Then name one load-bearing assumption (about the simulator, the scene distribution, or the arm) and say what happens if it turns out to be false.
3. **Where does your approach break as scene size or drift grows?** Name the smallest case you would fail on and why.
4. **Scene 10 is Phase 2.** Scene 10 contains parts your planner cannot place (one outside arm reach, one with no compatible bin). v1 gives you no clean way to report this — infeasibility leaks out through late safety violations or ad-hoc side-channel code in your planner. Treat this as a miniature take-home-design problem: show the minimum API change that would have made scene 10 straightforward and reviewable. Your `api.schema.json` must expose a new return shape that addresses infeasibility; at least one fixture pair must demonstrate that shape on a scene-10-style input. Name what your v2 makes worse.

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

**Reference surface:** `index.html`, `src/*`, `tests/*`, and `scenarios/*.json` define the exercise. Put your submitted work under `solution/`. Reviewers can inspect the repository diff if any non-solution files change.

## Phase 1 — Program + Bundle

Ship `solution/phase1/planner/` (your code, any language) and `solution/phase1/routines.json` (the bundle that code produced for the 10 public scenes). Document in `solution/README.md` how to run the planner and regenerate the bundle.

After your planner has generated `solution/phase1/routines.json`, validate the bundle with:

```bash
node tests/reval.mjs --bundle solution/phase1/routines.json
```

| Scene | Band | Tests |
| --- | --- | --- |
| `01_warmup` | required | single pick/place |
| `02_row` | required | sequencing + reach |
| `03_kinds` | required | kind matching + capacity |
| `04_wall` | required | obstacle routing |
| `05_maze` | required | tight clearance with held part |
| `06_combined` | required | routing + assignment + capacity |
| `07_dense_precedence` | hard | deep DAG + kind-tight capacity at scale |
| `08_carry_maze` | hard | narrow corridor with held-part collision |
| `09_obstacle_capacity` | hard | assignment under obstacle routing |
| `10_infeasible` | hard | **mixed feasible/infeasible parts — welds to Phase 2** |

Safety first. A careful planner that safely skips a scene beats a confident one that crashes the arm. Scene 10 deliberately contains parts that cannot be placed; correct behavior is to safely complete what you can and skip what you can't.

## Phase 2 — Design Doc (welded to scene 10)

There is no runnable Phase 2 module. Phase 2 is a narrow, specific design proposal: **how would you redesign v1's API so scene 10 becomes straightforward and fair to review?**

Scene 10 is the sharpest v1 pain point in the benchmark. It contains parts your planner physically cannot place. Under v1, the only ways to handle this are (a) attempt them and violate, failing the safety gate, or (b) implement side-channel feasibility detection inside your planner, which is clunky and leaks into every callsite. Neither is clean. Your Phase 2 is the case for a better API.

The meta task is to design the evaluation surface you wish you had been given: explicit inputs, structured outputs, fixtures that make edge cases reviewable, and prose that names the cost of the new design. A good Phase 2 should feel like the spec for a smaller, fairer version of this take-home.

Ship:

- **`solution/phase2/api.schema.json`** — JSON Schema of your proposed v2 API. It must expose a new return shape (e.g. `refusal`, `dropped`, `partial`) that addresses infeasibility as a first-class concept, not a late violation.
- **`solution/phase2/fixtures/*.in.json` + `*.out.json`** — at least one pair demonstrating that return shape on a scene-10-style input, and at least one pair demonstrating a successful plan on a normal scene. Scenes can be drawn from `scenarios/` or authored fresh.
- **Prose in `solution/README.md` (question 4)** — walk through the schema, point at the infeasibility fixture, and name what your v2 makes worse.

Reviewer reads; nothing executes. The fixtures are claims about your proposed API, not routines to be played in the sim.

## Scoring

See `RUBRIC.md`. Three axes:

- **Safe** — zero violations on `routines.json` when replayed through `tests/reval.mjs`. Pass/fail gate.
- **Coverage** — parts placed across the 10 public scenes. Scalar.
- **Tradeoff clarity** — your README answers graded against your code and your Phase 2 design doc. Tiebreaker.

No path-length tiebreakers. No elapsed-step tiebreakers. No private holdout. Everything the reviewer sees, you see.

## Getting Started

```bash
git clone https://github.com/clocksmith/party.git
cd party/standard_takehome

python3 -m http.server 8000          # simulator UI at http://localhost:8000
node tests/smoke.mjs                  # baseline runs on every scene
```

Then read: `RUBRIC.md`, `src/schema.json`, `src/planning_api.js` (v1 for reference), and the scene files under `scenarios/`. Once your planner has generated `solution/phase1/routines.json`, run `node tests/reval.mjs --bundle solution/phase1/routines.json`.

## FAQ

**Does language matter for Phase 1?** No. The simulator only consumes `routines.json`. Your planner can be in Python, Go, Rust, JavaScript, whatever — ship it under `solution/phase1/planner/` with a runnable entry point and a note in the README.

**Is Phase 2 executable?** No. It is a design document — schema, fixtures, prose. The fixtures describe what your proposed API would return; no runtime validates them.

**Can I use AI tooling?** Yes. Say which decisions were yours and which were AI-assisted in `solution/README.md`. We probe this in the Q&A.

**What if a scene looks unsolvable?** Most of `routines.json` should be full routines. Scene 10 is the deliberate mixed case — emit a routine that places the feasible parts and skips the infeasible ones (safe partial, not empty). For a whole scene that looks unsolvable, emit an empty routine (`{"steps": []}`) for that scene's entry and document the geometric argument in the README.

**How long do candidates spend?** Most candidates should be able to complete Phase 1 in about 4-6 focused hours, then spend another 1-2 hours on Phase 2 and the unified README. The submission window is one calendar week so you can schedule around work, setup, and normal life, not because we expect a week of labor. We do not score hours or polish beyond the artifacts in `RUBRIC.md`; after the routine bundle is safe and the tradeoffs are clear, extra tuning usually has diminishing returns.

## Submit Checklist

- [ ] `solution/phase1/planner/` contains your planner code.
- [ ] `solution/phase1/routines.json` is the bundle your planner produces, covering at least the 6 required scenes.
- [ ] `solution/phase2/api.schema.json` describes your proposed v2 API shape.
- [ ] `solution/phase2/fixtures/` contains at least one in/out pair for a real scene and one for an infeasibility case.
- [ ] `solution/README.md` answers all four questions and names the exact regenerate command.
- [ ] `node tests/reval.mjs --bundle solution/phase1/routines.json` exits 0 (safety gate passed).
