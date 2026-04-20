# Rubric

The single source of truth for how submissions are scored. Three axes, one file.

Reviewer has the same visibility as the candidate. Every scene the reviewer scores against, the candidate has already seen. There are no private scenes, no held-out variants, no privileged tooling. `tests/reval.mjs` is the verifier; both parties can run it.

## Axis 1 — Safe (gate, pass/fail)

Zero safety violations when `solution/phase1/routines.json` is replayed by `tests/reval.mjs` against the public scenes.

A violation on any scene flips the gate to **fail**. Skipping a scene with an empty routine is not a violation. Attempting a routine that crashes the arm is.

This is not a tiebreaker and not a gradient. It is a precondition. A submission that violates on one scene is graded below one that refuses correctly on all scenes, regardless of coverage.

Phase 2 is a design doc and does not execute; there is nothing to violate. The safety gate is purely about `routines.json`.

## Axis 2 — Coverage (scalar)

A single integer: parts placed across the 10 public scenes when `routines.json` is replayed.

```text
scenarios/01_warmup through scenarios/10_capacity_trap
```

- Required scenes (01–06) contribute coverage as usual.
- Stretch scenes (07, 08) contribute coverage as usual.
- Bonus scenes (09, 10) count toward coverage, but a strong Phase 2 cannot be rescued by a thick bonus score — see below.

Coverage is scalar, not normalized. We do not divide by scene size. Harder scenes contribute more raw parts-placed than easy ones, which is the intended weighting.

## Axis 3 — Tradeoff clarity (0 / 1 / 2 per README question)

The candidate's `solution/README.md` answers four questions. Each is graded 0, 1, or 2 — eight points total.

| Q | Question | 0 | 1 | 2 |
| --- | --- | --- | --- | --- |
| 1 | How do you plan one scene? | Missing or code-walk only. | Describes the algorithm. | Describes the algorithm and one non-obvious decision. |
| 2 | Optimized / gave up / load-bearing assumption? | No tradeoff, no assumption, or handwave. | Tradeoff + assumption named. | Tradeoff + assumption named, code under `phase1/planner/` visibly matches the claim, and the named assumption is specific enough that a reviewer could construct a scene that falsifies it. |
| 3 | Where does your approach break as drift grows? | "It works." | Names a failure mode. | Names a failure mode **and the smallest case** that would trigger it. |
| 4 | Phase 2 thesis — smallest v1 API change? | Aesthetic rename. | Names a real rough edge in v1. | Names a real rough edge, the proposed change is reflected in `api.schema.json`, at least one fixture demonstrates it, and the README names what v2 makes worse. |

Tradeoff clarity is the tiebreaker between two submissions with identical safety and coverage. It is also the primary signal for seniority: two candidates can both solve everything, and the one who names their tradeoffs precisely is the stronger hire.

## How the axes combine

```text
if  safety_gate == fail:     → no-hire on safety grounds, stop reading
elif coverage low (<50%):    → weak, regardless of prose
else:                        → sort by coverage, break ties by tradeoff clarity
```

There is no weighted sum. Safety is a precondition, coverage is the body, tradeoff clarity is the signal. A candidate who solves 40% cleanly with sharp prose can beat a candidate who solves 70% with handwaves — rare but real.

## Phase 2 evaluation — reading, not running

Phase 2 is a JSON design doc plus prose. The reviewer reads:

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
node tests/reval.mjs --bundle <bundle> --suite benchmark
```

That is the entire reviewer toolchain. There is no `eval_phase2.mjs`, no private holdout runner, no reviewer-only flag. If the reviewer wants to re-run the candidate's planner, they follow the candidate's regen instructions in `solution/README.md`.
