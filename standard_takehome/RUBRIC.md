# Rubric

The single source of truth for how submissions are scored. Three axes, one file.

This exercise is intentionally meta. Phase 1 shows whether the candidate can solve a bounded engineering problem; Phase 2 shows whether they can redesign the problem surface so the next version would be clearer, fairer, and easier to review.

Reviewer has the same visibility as the candidate. Every scene the reviewer scores against, the candidate has already seen. There are no private scenes, no held-out variants, no privileged tooling. `tests/reval.mjs` is the verifier; both parties can run it.

## Axis 1 — Safe (gate, pass/fail)

Zero safety violations when `solution/phase1/routines.json` is replayed by `tests/reval.mjs` against the public scenes.

A violation on any scene flips the gate to **fail**. Skipping a scene with an empty routine is not a violation. Attempting a routine that crashes the arm is.

This is not a tiebreaker and not a gradient. It is a precondition. A submission that violates on one scene is graded below one that refuses correctly on all scenes, regardless of coverage.

Phase 2 is a design doc and does not execute; there is nothing to violate. The safety gate is purely about `routines.json`.

## Axis 2 — Coverage (scalar)

A single integer: parts placed across the 10 public scenes when `routines.json` is replayed.

```text
scenarios/01_warmup through scenarios/10_infeasible
```

Two bands:

- **Required (01–06)** — 17 parts total, all feasible. The floor for any credible submission.
- **Hard (07–10)** — 25 raw parts, but 2 parts in `10_infeasible` are structurally infeasible by design (one outside arm reach, one with no compatible bin). The **feasible denominator is 40**: `17 required + 21 hard-feasible + 2 scene-10-feasible`.

Coverage is scalar, not normalized. We do not divide by scene size. A perfect safe submission scores **40/40**, not 42. The two infeasible parts in scene 10 are the Phase 2 hook, not coverage credit. A candidate who attempts them instead of safely skipping trips the safety gate.

## Axis 3 — Tradeoff clarity (0 / 1 / 2 per README question)

The candidate's `solution/README.md` answers four questions. Each is graded 0, 1, or 2 — eight points total.

| Q | Question | 0 | 1 | 2 |
| --- | --- | --- | --- | --- |
| 1 | How do you plan one scene? | Missing or code-walk only. | Describes the algorithm. | Describes the algorithm and one non-obvious decision. |
| 2 | Optimized / gave up / load-bearing assumption? | No tradeoff, no assumption, or handwave. | Tradeoff + assumption named. | Tradeoff + assumption named, code under `phase1/planner/` visibly matches the claim, and the named assumption is specific enough that a reviewer could construct a scene that falsifies it. |
| 3 | Where does your approach break as drift grows? | "It works." | Names a failure mode. | Names a failure mode **and the smallest case** that would trigger it. |
| 4 | Phase 2 thesis — API change that solves scene 10? | Schema is v1 with cosmetic rename; no new return shape for infeasibility. | Schema introduces a feasibility-aware return shape (refusal / dropped / partial). | Schema introduces a feasibility return shape **and** at least one fixture pair demonstrates it on a scene-10-style input **and** the README names what v2 makes worse. |

Tradeoff clarity is the tiebreaker between two submissions with identical safety and coverage. It is also the primary signal for seniority: two candidates can both solve everything, and the one who names their tradeoffs precisely and designs a cleaner evaluation surface is the stronger hire.

## How the axes combine

```text
if  safety_gate == fail:     → no-hire on safety grounds, stop reading
elif coverage low (<50%):    → weak, regardless of prose
else:                        → sort by coverage, break ties by tradeoff clarity
```

There is no weighted sum. Safety is a precondition, coverage is the body, tradeoff clarity is the signal. A candidate who solves 40% cleanly with sharp prose can beat a candidate who solves 70% with handwaves — rare but real.

## Phase 2 evaluation — reading, not running

Phase 2 is a JSON design doc plus prose. Read it as a small take-home redesign proposal, not as a second implementation. The reviewer reads:

1. **`api.schema.json`** — Is the proposed API actually simpler than v1? Does it expose new return shapes (refusal, partial, etc.) that v1 forced the caller to handle out-of-band?
2. **`fixtures/*.in.json` + `*.out.json`** — Do the claimed outputs match what the schema says the API returns? Do they cover both a success case and an infeasibility case?
3. **README question 4** — Does the prose explain what v2 makes *worse*, not just better? Every API redesign has a cost. A README that doesn't name the cost is either dishonest or hasn't thought hard enough.

Fixtures are not executed. They are the candidate's claim about what their proposed API returns; we read them for plausibility and consistency with the schema.

## What we do not score

- **Path length, elapsed micro-steps, step count.** Removed. They were weak tiebreakers that rewarded optimization the prompt never asked for.
- **Hours worked.** Self-reported; not scored.
- **Lines of code, file count, abstraction "elegance."** A 50-line planner that does one thing well is fine.
- **AI-assisted vs. hand-written.** Scored only via the honesty probe in the README and Q&A.
- **Phase 2 runtime correctness.** There is no Phase 2 runtime.

## Reviewer tools — same as candidate's

```bash
python3 -m http.server 8000                           # sim UI (both parties)
node tests/smoke.mjs                                  # baseline check
node tests/reval.mjs --bundle <bundle>
```

That is the entire reviewer toolchain. There is no `eval_phase2.mjs`, no private holdout runner, no reviewer-only flag. If the reviewer wants to re-run the candidate's planner, they follow the candidate's regen instructions in `solution/README.md`.
