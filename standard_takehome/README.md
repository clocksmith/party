# Take-home Exercise: Robot Routine Planner

Build a motion planner for a simulated 2D multi-axis robot arm. Phase 1 plans safe static routines for fixed benchmark scenes. Phase 2 ships a runnable API that regenerates a safe routine when the scene changes. Review focuses on tradeoffs, not optimality — several private variants are adversarial by design.

Read `RUBRIC.md` before you start. It is the single source of truth for how submissions are scored.

## Deliverables

Exactly three files under `solution/`:

```text
solution/
  phase1/routines.json   # static wire-format bundle for benchmark scenes
  phase2/index.js        # browser ES module: export function plan(scene, context)
  README.md              # your writeup (the four questions below)
```

The simulator consumes only `phase1/routines.json` (static) and `phase2/index.js` (generative). Everything else — planner code, regeneration scripts, notes — is optional and lives wherever you like under `solution/`. The reviewer reads one README, not two.

## What to put in `solution/README.md`

Four questions, short answers. One or two paragraphs each.

1. **How do you plan one scene?** Cover both phases in the same answer — if Phase 2 reuses Phase 1's core, say so.
2. **What did you optimize, and what did you knowingly give up?** Safety, coverage, compute budget, simplicity, generalization — pick your axis and name the tradeoff.
3. **Where does your approach break as scene size or drift grows?** Name the smallest case you would fail on and why.
4. **What's the smallest v1 API change** (see `src/planning_api.js`) that would have made your planner easier to write? This is your Phase 2 thesis.

No separate phase READMEs. No required section order. Short is fine; handwaves are not.

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

**Frozen surface (do not modify):** `index.html`, `src/*`, `scenarios/*.json`, `phase2_examples/*.json`. Contents are checksummed in `SEALED.json`; tampering is detected. Put your work under `solution/`.

## Phase 1 — Static Routines

Produce `solution/phase1/routines.json` covering the 10 visible scenes. How you generate it is your business — JS planner, Python solver, hand-authored, AI-assisted — the simulator only consumes the wire format.

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

## Phase 2 — Runnable API v2

Pick **one** family. Ship a browser-native ES module:

```js
// solution/phase2/index.js
export const family = "capacity"; // or "precedence" / "obstacle_routing"

export function plan(scene, context) {
  return { steps: [/* Robot API wire steps */] };
}
```

| Family | What varies | Public example |
| --- | --- | --- |
| `capacity` | part counts, bin capacities, accepted kinds | `phase2_examples/capacity_example.json` |
| `precedence` | dependency edges, order constraints | `phase2_examples/precedence_example.json` |
| `obstacle_routing` | obstacle placement, pick/drop geometry | `phase2_examples/obstacle_routing_example.json` |

The simulator imports your module, calls `plan(scene, context)`, and plays the returned routine. Context is `{family, variantId, source: "public" | "private"}`.

**The reviewer runs Phase 2 against a private variant set you have not seen.** The private set intentionally drifts wider than the public example and includes:

- **Wide-drift variants** — part count, bin geometry, obstacle placement, and arm link lengths all move independently. Hardcoded seed tables and tuned thresholds will break.
- **One stress scene per family** — bigger and intentionally close to intractable; we do not expect optimal. We score the tradeoff you named.
- **At least one unsolvable variant per family** — part outside reach, no compatible bin, etc. Correct behavior is `{steps: [], notes: "..."}`. Crashing, throwing, or attempting an unsafe sequence is counted as a violation.

Each variant has a **2-second wall-clock budget**. Variants that exceed it count as no-op (zero parts placed, zero refusal credit).

Your v2 should clearly refuse unsupported families. Hardcoding a public-example routine is visibly weak and is scored as such.

## Scoring

See `RUBRIC.md`. Three axes:

- **Safe** — zero violations across everything you submit. Pass/fail gate.
- **Coverage** — parts placed across Phase 1 benchmark + Phase 2 public + private variants. Unsolvable variants correctly refused also count.
- **Tradeoff clarity** — your four README answers, graded against your code. Did you name the tradeoff, and does the code match?

No path-length tiebreakers. No elapsed-step tiebreakers. Safety gates, coverage scales, tradeoff-clarity breaks ties.

## Getting Started

```bash
git clone https://github.com/clocksmith/party.git
cd party/standard_takehome

python3 -m http.server 8000          # simulator UI at http://localhost:8000
node tests/smoke.mjs                  # baseline runs on every scene
node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark
```

Then read: `RUBRIC.md`, `src/schema.json`, `src/planning_api.js`, `examples/example_planner.js`, `scenarios/`, and `phase2_examples/`.

## FAQ

**Why only one `routines.json`?** Phase 1 is static, Phase 2 is generative. Phase 1 submits a bundle; Phase 2 submits a module that returns a routine per variant at runtime.

**Does language matter for Phase 1?** No. Any language. The simulator only consumes `routines.json`. Phase 2's module must be browser-runnable JavaScript (no build, no network, no Node-only APIs).

**Can I use AI tooling?** Yes. Say which decisions were yours and which were AI-assisted in `solution/README.md`. We probe this in the Q&A.

**How long do candidates spend?** Most successful submissions land in 4–8 hours. We do not score hours; make the submission clear to a human reviewer.

**What if a scene looks unsolvable?** Document the geometric argument and emit an empty routine. This is the correct answer for the unsolvable variants in the private Phase 2 set as well.

## Submit Checklist

- [ ] `solution/phase1/routines.json` covers at least the 6 required scenes.
- [ ] `solution/phase2/index.js` exports `family` and `plan(scene, context)`, runs in the browser, refuses unsupported families cleanly.
- [ ] `solution/README.md` answers all four questions above.
- [ ] `node tests/reval.mjs --bundle solution/phase1/routines.json --suite benchmark` runs without `TAMPER`.
