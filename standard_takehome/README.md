# Take-home Exercise: Robot Routine Planner

Build a motion planner for a simulated 2D multi-axis robot arm. **Phase 1** ships a planner program (any language) plus the routines it produced for the public scenes. **Phase 2** is a design doc — an API schema plus fixtures plus prose — describing how you would redesign the v1 planning surface.

Reviewer has the same visibility as you. Nothing is held out. No private scenes. Read `RUBRIC.md` before you start; it is the single source of truth for how submissions are scored.

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
4. **What is your Phase 2 thesis — the smallest v1 API change that would have made your Phase 1 planner easier to write?** Walk through `api.schema.json`, point at one fixture, and name what v2 makes worse.

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

**Frozen surface (do not modify):** `index.html`, `src/*`, `scenarios/*.json`. Contents are checksummed in `SEALED.json`; tampering is detected. Put your work under `solution/`.

## Phase 1 — Program + Bundle

Ship `solution/phase1/planner/` (your code, any language) and `solution/phase1/routines.json` (the bundle that code produced for the 10 public scenes). Document in `solution/README.md` how to run the planner and regenerate the bundle.

```bash
node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark
```

| Scene | Band | Tests |
| --- | --- | --- |
| `01_warmup` | required | single pick/place |
| `02_row` | required | sequencing + reach |
| `03_kinds` | required | kind matching + capacity |
| `04_wall` | required | obstacle routing |
| `05_maze` | required | tight clearance with held part |
| `06_combined` | required | routing + assignment + capacity |
| `07_precedence` | stretch | DAG ordering + bins |
| `08_dense` | stretch | scale + packed geometry |
| `09_precedence_wall` | bonus | precedence × obstacle routing |
| `10_capacity_trap` | bonus | global assignment vs greedy |

Safety first. A careful planner that safely skips a scene beats a confident one that crashes the arm.

## Phase 2 — Design Doc

There is no runnable Phase 2 module. Phase 2 is a design proposal for a redesigned planning API — the rough edge in v1 you would fix, the shape of your replacement, and example inputs/outputs that demonstrate it.

Ship:

- **`solution/phase2/api.schema.json`** — JSON Schema of your proposed v2 API. Include the input shape, the output shape, and any structured return values (refusal, partial, success) the API exposes.
- **`solution/phase2/fixtures/*.in.json` + `*.out.json`** — at least one pair showing what the API returns for a real scene, and one pair showing what it returns on infeasibility. Scenes can be drawn from `scenarios/` or authored fresh.
- **Prose in `solution/README.md` (question 4)** — walk through the schema, reference one fixture, name what v2 makes worse.

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
node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark
```

Then read: `RUBRIC.md`, `src/schema.json`, `src/planning_api.js` (v1 for reference), and the scene files under `scenarios/`.

## FAQ

**Does language matter for Phase 1?** No. The simulator only consumes `routines.json`. Your planner can be in Python, Go, Rust, JavaScript, whatever — ship it under `solution/phase1/planner/` with a runnable entry point and a note in the README.

**Is Phase 2 executable?** No. It is a design document — schema, fixtures, prose. The fixtures describe what your proposed API would return; no runtime validates them.

**Can I use AI tooling?** Yes. Say which decisions were yours and which were AI-assisted in `solution/README.md`. We probe this in the Q&A.

**What if a scene looks unsolvable?** Document the geometric argument and emit an empty routine for that scene. Your Phase 2 schema should also show how the proposed v2 API would surface infeasibility.

**How long do candidates spend?** Most successful submissions land in 4–8 hours. We do not score hours; make the submission clear to a human reviewer.

## Submit Checklist

- [ ] `solution/phase1/planner/` contains your planner code.
- [ ] `solution/phase1/routines.json` is the bundle your planner produces, covering at least the 6 required scenes.
- [ ] `solution/phase2/api.schema.json` describes your proposed v2 API shape.
- [ ] `solution/phase2/fixtures/` contains at least one in/out pair for a real scene and one for an infeasibility case.
- [ ] `solution/README.md` answers all four questions and names the exact regenerate command.
- [ ] `node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark` runs without `TAMPER`.
