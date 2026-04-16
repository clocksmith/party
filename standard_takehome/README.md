# Robot Routine Planner — Take-home

Welcome, and thanks for spending time on this. This exercise is meant to look like the work you would actually do here: planning safe motion for a multi-axis arm, making tradeoffs under ambiguity, and explaining your reasoning to other engineers. An engineer will review your submission through the same lens as a production PR.

It is **not** a kinematics quiz, and it is **not** a harness-gaming puzzle. We care about how you frame the problem, where you choose to spend your hours, and how clearly you can defend your choices.

Several scenes have no single "correct" answer — you will have to decide what to prioritize, and defend it.

---

## TL;DR

- **Phase 1:** produce `routines.json` for the fixed benchmark scenes. This is the safety/planning floor.
- **Phase 2:** ship a browser-runnable Planning API v2 for one variant family. The simulator imports your v2, runs it on small scene variants, and plays the generated routine.
- **Both phases are required.** A perfect Phase 1 scoreboard with a facade Phase 2 is not a strong submission.
- **Deliverable:** a single `REPORT.md` that reads cold *and* doubles as the slide deck for the live walkthrough.
- **Timebox:** 4–6 hours. Stop at 6. We do not score the hours you spend; we score what you ship and how you explain it. An honest stopper beats a stealth overrun.

Suggested time split:

| Work | Time |
| --- | ---: |
| Read prompt/schema/API/scenes | 30–45 min |
| Phase 1 planner + routines | 2–3 hr |
| Phase 2 runnable v2 variant family | 60–90 min |
| `REPORT.md` | 30–45 min |
| Packaging/checks | 15 min |

If Phase 1 takes longer than expected, skip bonus scenes before cutting Phase 2. Phase 2 must still contain a runnable browser module; design notes can supplement it, not replace it.

---

## Frozen surface — do not modify

These files define the Robot API and the benchmark. **Do not modify any of them.** Their contents are checksummed in `SEALED.json`; the reviewer runs `node tests/reval.mjs` to detect tampering.

- `index.html`, `src/app.js`, `src/renderer.js`, `src/style.css`
- `src/schema.json`, `src/sim.js`, `src/arm.js`, `src/scene.js`, `src/harness.js`
- `scenarios/*.json` (six required scenes, two stretch scenes, two bonus scenes + `scenarios/index.json`)
- `phase2_examples/*.json` (public Phase 2 variant examples)

Put your work under `candidate/` plus a top-level `REPORT.md`. If you find a real bug in a frozen file, leave it as-is and document it in the report. Do not patch around it.

---

## Simulator contract

The simulator is a *documented interface*, not a puzzle to be reverse-engineered. Everything below is load-bearing; nothing else is.

- **World.** 2D planar. X right, Y up, meters. Floor safety boundary at `y = -0.12` (the visual workbench is `y = 0`; the gripper is allowed to dip between them to grasp).
- **Task plane.** The view is a 2D vertical fixture board, not a gravity/tabletop simulation. Parts are staged in shallow visual nests on the same plane as the robot; a part's JSON `x/y` is its graspable center. These nests are non-colliding decoration. Only the arm, held parts, other unplaced parts during carry checks, explicit `obstacles`, and the floor boundary affect safety.
- **Robot.** N-joint planar revolute arm, angles relative to previous link. Per-joint `[min, max]` limit. Gripper at tip modeled as a circle.
- **Determinism.** Same scene + same routine = same result. No randomness anywhere.

**The Robot API — exactly these five wire step types, no others:**

| Step | Effect |
| --- | --- |
| `{type: "move_joint", angles: [θ₀…θₙ]}` | Linear interpolate in joint space from current to `angles`. |
| `{type: "move_pose", x, y}` | IK solves `angles` to place the end-effector at `(x, y)`, then interpolates. |
| `{type: "grip_close"}` | If a graspable part is within `gripper_radius + part.r` of the EE, attach it. |
| `{type: "grip_open"}` | Releases any held part at the current EE. |
| `{type: "wait", duration}` | Advance elapsed time; no motion. |

**Safety rules** (any one ends the scene with a violation at the offending micro-step):

- `collision_obstacle`, `collision_floor`, `collision_self` — arm link crosses into an obstacle, below the floor, or through another link
- `joint_limit` — a joint leaves its declared range
- `ik_no_converge` — a `move_pose` target is unreachable after deterministic-restart damped-LS IK
- `carry_collision` — a held part crosses an obstacle, the floor, or another part
- `drop_outside_bin` / `bin_rejects` / `bin_full` — `grip_open` places somewhere invalid
- `precedence_violation` — `grip_close` on a part whose `requires: [...]` deps are not yet placed
- `double_grip` — `grip_close` while already holding

**Grip semantics.** `grip_close` picks up the nearest un-placed, dependency-met part within range, or no-op if the EE is far from any part. `grip_open` places the held part if the EE is inside a bin that accepts this kind and has capacity; otherwise the appropriate violation above.

**What the sim does NOT model:** dynamics, inertia, gravity, sensor noise, gripper force, part weight, stochastic execution, mobile bases, continuous time. Don't assume any of these. If you want to argue a Phase 2 API should handle them, that is a report observation, not an implementation ask.

**Scene and result formats:** see `src/schema.json`. Scoring inputs are only the fields defined there. There is no hidden score.

---

## Phase 1 — optimize routines using Planning API v1

Use `src/planning_api.js` to build a `routines.json` bundle. How you produce it is your business: a JS planner, a Python solver, a hand-authored plan, an LLM-generated plan, whatever. The simulator only consumes the wire format (`src/schema.json`).

> **Scoring policy (read this before you optimize anything):**
>
> 1. **Tamper-free and schema-valid** (gate — nothing else counts if this fails)
> 2. **Fewer safety violations** — a plan that crashes the arm is worse than a plan that skips the scene
> 3. **More parts placed** — partial completion counts; it's not a binary pass/fail
> 4. **More scenes completed** — required set (below) first, then stretch. Bonus scenes are discussion material, not scene-completion scoring.
> 5. **Lower path length** — tie-breaker
> 6. **Lower elapsed micro-steps** — weak tie-breaker only
>
> `reval.mjs` exits 0 regardless of scene pass/fail; the ordered list above is how we actually compare submissions.

**Required set (6 scenes):** `01_warmup`, `02_row`, `03_kinds`, `04_wall`, `05_maze`, `06_combined`.
**Stretch (2 scenes):** `07_precedence`, `08_dense`.
**Bonus top-end exploration (2 scenes):** `09_precedence_wall`, `10_capacity_trap`.

A **complete submission** is one that attempts all six required scenes — partial safe completion across them beats risky full completion on any of them. Stretch scenes are optional. Bonus scenes are top-end exploration only: do not attempt them until the required set, Phase 2, and `REPORT.md` are complete. A strong submission can leave both bonus scenes empty, and saying so in the report is better than quietly overrunning the timebox.

**Scenario guide.** This is orientation, not a recipe. Each scene exercises several things; the column below names the most visible pressure.

| Scene | Status | What this scene exercises | Baseline expectation |
| --- | --- | --- | --- |
| `01_warmup` | required | single pick/place and API sanity | should pass |
| `02_row` | required | repeated pick/place, sequencing, reach | should pass |
| `03_kinds` | required | kind matching and capacity-aware assignment | should pass; optimization optional |
| `04_wall` | required | obstacle-aware routing across a wall | fails without routing |
| `05_maze` | required | tight obstacle clearance with a held part | fails without routing |
| `06_combined` | required | routing, assignment, and capacity interaction | fails without a stronger strategy |
| `07_precedence` | stretch | dependency ordering plus bin constraints | stretch; partial safe completion is fine |
| `08_dense` | stretch | scale, heuristics, and packed geometry | stretch; partial safe completion is fine |
| `09_precedence_wall` | bonus | precedence and obstacle routing together | top-end exploration only |
| `10_capacity_trap` | bonus | global assignment vs. greedy capacity use | top-end exploration only |

**Focus on:**

- correctness on solvable scenes
- safety first: a careful planner that skips a scene is better than a confident one that crashes the arm
- honest handling of unreachable targets, tight clearances, and bin capacity

**Nice-to-haves, in rough order of value:**

1. retry or fallback when a plan step fails at execution time
2. obstacle-aware routing beyond straight-line moves
3. sequencing and assignment — which part first, which bin for which part
4. partial completion under failure
5. priority handling when bins fill or parts conflict

Do not attempt all of them. We would rather see two done thoughtfully than five done shallowly.

---

## Phase 2 — runnable Planning API v2 under variation

Phase 1 produces static routines for fixed scenes. Phase 2 asks a harder question: can your API regenerate a safe routine when a scene changes slightly?

Ship a browser-runnable `candidate/planning_api_v2/index.js` module. The simulator imports this module, calls your planner on a Phase 2 variant scene, loads the returned routine, and plays it on the canvas.

**What you can change:** anything above the Robot API — helper functions, planner state, assignment/routing abstractions, scene queries, failure reporting, and how your planner composes decisions.

**What you cannot change:** the Robot API, scene format, simulator, safety rules, or routine wire format. Your v2 still returns the same `{ steps: [...] }` routine shape.

### Pick one variant family

Choose exactly one family:

| Family | What changes between variants | Public example |
| --- | --- | --- |
| `capacity` | part counts, bin capacities, and accepted kinds | `phase2_examples/capacity_example.json` |
| `precedence` | dependency edges and part order constraints | `phase2_examples/precedence_example.json` |
| `obstacle_routing` | obstacle placement and pick/drop geometry | `phase2_examples/obstacle_routing_example.json` |

Your v2 only needs to support your chosen family. It should cleanly refuse unsupported families rather than pretend to solve everything.

### Browser module contract

Create:

```text
candidate/planning_api_v2/index.js
```

It must be a browser-native ES module with no build step and no network dependency. Export a planner function:

```js
export const family = "capacity"; // or "precedence" / "obstacle_routing"

export function plan(scene, context) {
  return { steps: [/* Robot API wire steps */] };
}
```

The simulator also accepts `export default function plan(...)`. The returned value may be either `{ steps: [...] }` or a raw `steps` array.

The `context` object contains:

```js
{
  family: "capacity",
  variantId: "p2_capacity_example",
  source: "public" // reviewers may also run private probes
}
```

### How to run Phase 2 locally

Start the simulator, open the Phase 2 panel, choose the public example for your family, and click **run v2 in sim**. The simulator imports your module, runs your planner, shows the routine in the Routine tab, and animates the result.

Reviewers have private variants for the same three families. You will not see those JSON files. They are small deterministic variants of the public examples, not new physics.

What counts as enough:

- one chosen family
- one browser-runnable `plan(scene, context)` implementation
- the public example for your family runs in the simulator
- the report explains what recomputes when the scene changes
- the report names how v2 refuses unsupported or unsafe variants
- what v2 makes worse

A focused v2 is better than a broad facade. A v2 that simply emits hardcoded public-scene routines is weak even if Phase 1 is perfect.

---

## Submission layout

```
candidate/
  phase1_planner.{js,py,…}        Phase 1 planner source (any language)
  phase1/README.md                ONLY if non-obvious: how you produced routines.json
  routines.json                   Pre-generated bundle for the 6 required + optional stretch/bonus scenes
  planning_api_v2/                Phase 2 browser-runnable implementation (folder)
    index.js                      ES module exporting plan(scene, context)
    README.md                     optional: design notes, limits, and variant predictions
    …                             any additional modules, tests, types, helpers your v2 needs
REPORT.md                         Single written walkthrough (template below). Read pre-interview; also walked live.
```

**Notes:**

- `planning_api_v2/` must contain working browser code at `index.js`. A design-only submission with no runnable v2 is incomplete.
- Your v2 does not need to overwrite `routines.json`; Phase 2 runs directly in the simulator against variant scenes.
- The `routines.json` you ship should cover the 6 required scenes at minimum. Stretch scenes are optional. Bonus scenes are top-end exploration and do not count toward scene-completion scoring; omitting them is fine.
- A submission with `routines.json` but no `phase1_planner.*` and no `phase1/README.md` is incomplete — we need to know how the bundle was produced.

---

## How your submission is reviewed

A reviewer opens three things, in order:

1. `REPORT.md` — your framing, cold.
2. `candidate/routines.json` — what you shipped.
3. `candidate/phase1_planner.*` or `candidate/phase1/README.md`, plus `candidate/planning_api_v2/` — how you got there and your runnable redesign.

Then they run the scored evaluation from a clean checkout:

- `node tests/reval.mjs --bundle candidate/routines.json --suite benchmark` — scores your pre-generated `routines.json` against the visible scenes. The output is split into required, stretch, and bonus bands; bonus scenes are discussion material, not scene-completion scoring.
- In the simulator UI, the reviewer opens the Phase 2 panel, selects the family you chose, and runs your `candidate/planning_api_v2/index.js` on public and private variants. The generated routine is animated in the same canvas as Phase 1.

There is no Phase 1 hidden-scene runner contract. Phase 2 is the generalization check.

The live session is 30 minutes. The first ~10 minutes, you walk us through `REPORT.md` on screen. The rest is discussion — one scene of the reviewer's choice, one Phase 2 decision, one curveball, your questions. Your report is your deck.

---

## Ground rules

- **Timebox: 4–6 hours.** We do not reward going over; we reward stopping on time and naming what you cut. Do not spend bonus-scene time before Phase 2 runs in the simulator.
- **Use whatever tools you want** — AI assistants, libraries, reference code. Say in the report which decisions were yours and which were the AI's. We probe judgment in the Q&A.
- **Do not modify the frozen surface** — see above. Tampering is detected.
- **Ask questions.** Email <takehome@standardbots.example> if anything is genuinely ambiguous. "I assumed X because the prompt was unclear" is a fine answer in the report.
- **Keep your submission private.** The base kit lives at `https://github.com/clocksmith/party/tree/main/standard_takehome` — your candidate/ work and REPORT.md should go in a private fork or private repo. No public posts, gists, or blog write-ups of your solution.

---

## Getting started

```bash
git clone https://github.com/clocksmith/party.git
cd party/standard_takehome

python3 -m http.server 8000                      # local dev server, then open http://localhost:8000
node tests/smoke.mjs                             # sanity-check the sim
node tests/reval.mjs --bundle your_bundle.json   # scored reviewer run
```

In the simulator UI: pick a scene, click "run baseline" to see the provided naive planner, upload your own `routines.json` to evaluate, click "export results.json" to save scores (for your own debugging — the reviewer regenerates). For Phase 2, use the Phase 2 panel to run your `candidate/planning_api_v2/index.js` against public variant examples.

Read in this order: `src/schema.json` → `src/planning_api.js` → `examples/example_planner.js` → `scenarios/`.

---

## Submit checklist

- [ ] `candidate/routines.json` exists, is valid against `src/schema.json`, and covers at least the 6 required scenes.
- [ ] `candidate/phase1_planner.*` exists, or `candidate/phase1/README.md` documents how you produced `routines.json`.
- [ ] `candidate/planning_api_v2/index.js` exists, is browser-importable, and exports `plan(scene, context)` or a default planner function.
- [ ] You chose one Phase 2 family and named it in `REPORT.md`.
- [ ] Your v2 runs in the simulator on the public example for that family.
- [ ] `REPORT.md` is filled in (template below), including before/after callsites, variant behavior, and what v2 makes worse.
- [ ] `node tests/reval.mjs --bundle candidate/routines.json` runs cleanly — no `TAMPER` warning.
- [ ] `git diff` against the original repo shows changes only outside the frozen surface.
- [ ] You stopped at 8 hours. If not, you've said so in `REPORT.md` and named what you would cut.

Good luck. We are looking forward to the conversation.

---

## REPORT.md template (copy this section)

Copy the block below into `REPORT.md` at the repo root and fill it in. The arc doubles as your live walkthrough — keep each section scannable (short bullets, one small code block, one small diagram if helpful). Three pages ceiling.

```markdown
# REPORT

## Framing
How I read the problem in one paragraph. The one assumption that shaped everything else.

## Phase 1 — strategy
The algorithm in 3–6 sentences. Scenes I skipped or partially solved, and why. What didn't work and what I cut.

## One scene walked end-to-end
Pick one scene and walk the routine. Name a specific ordering/routing decision you made and why you rejected the alternative. This is the anchor for the live walkthrough — make it concrete.

## Phase 2 — v2
- **The rough edge in v1.** A code snippet from my Phase 1 planner that felt wrong.
- **Family I chose:** one of {capacity, precedence, obstacle_routing}. Why this family.
- **My axis of "better":** one of {callsite LOC, concept count, reuse, testability, extensibility, readability, robustness under variation} (or a different axis I defend in 1–2 sentences).
- **v2 design:** a small code sample or diagram. Include the exported `plan(scene, context)` boundary.
- **Before/after callsite:** a literal v1 snippet and the equivalent v2 snippet. Keep both small; reviewers should be able to see the claimed simplification, not just the LOC count.
- **Named guarantee (if applicable):** if v2 prevents or detects a class of invalid routine earlier than v1, name it. If your chosen axis is not about correctness guarantees, say so explicitly; this is not a penalty.
- **Variant behavior:** what recomputes when the scene changes? What is cached or reused? How does v2 refuse unsupported variants?
- **Public Phase 2 example result:** which `phase2_examples/*.json` scene I ran in the simulator, and what happened.
- **Extension seam:** if oriented parts, a second arm sharing the workspace, or a second variant family were added later, what part of v2 would change first? What part should not need to change?
- **Side-by-side numbers:**

  | Metric | v1 | v2 |
  | --- | --- | --- |
  | Callsite LOC (candidate-written) | | |
  | Concepts / named functions touched | | |
  | Public variant parts placed | | |
  | Public variant violations | | |
  | Named axis above | | |

- **What v2 makes worse.**
- **What I would keep from v1.**

## Tradeoffs
The 2–3 design calls I'm least sure about. The case for and against each.
**AI disclosure:** which specific decisions did the AI make, and where did I diverge from it? (One or two bullets.)

## What this exercise tests well, and what it doesn't
Push back. Where is this a realistic proxy for the work? Where is it not? Honest criticism is part of the signal.
```
