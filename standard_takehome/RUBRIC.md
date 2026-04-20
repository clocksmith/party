# Rubric

The single source of truth for how submissions are scored. Three axes, one file.

## Axis 1 — Safe (gate, pass/fail)

Zero safety violations across everything the candidate submits:

- Every scene in `solution/phase1/routines.json`.
- Every public example in `phase2_examples/` when run through `solution/phase2/index.js`.
- Every private variant (reviewer-only) when run through `solution/phase2/index.js`.

A violation on any scene flips the gate to **fail**. Skipping a scene with an empty routine is not a violation. Attempting a routine that crashes the arm is.

This is not a tiebreaker and not a gradient. It is a precondition. A submission that violates on one scene is graded below one that refuses correctly on all scenes, regardless of coverage.

## Axis 2 — Coverage (scalar)

A single integer: parts placed + refusals correctly made, summed across:

```text
phase1_benchmark  (10 scenes, visible)
phase2_public     (3 public examples, one per family)
phase2_private    (reviewer-only: wide-drift + stress + unsolvable)
```

Scoring per variant:

| Variant type | Scoring |
| --- | --- |
| Normal | +1 per part placed safely. |
| Stress | +1 per part placed safely. Not expected to be solved fully — partial credit is the point. |
| Unsolvable | +1 for correct refusal (`{steps: [], notes: "..."}`). Any non-empty routine that violates counts 0 and trips the safety gate. |

Budget: each Phase 2 variant has a **2-second wall-clock budget**. Exceeding it counts as no-op — 0 parts, no refusal credit, no violation. This rewards planners that check cheaply and escalate only when they must.

Coverage is scalar, not normalized. We do not divide by scene size. Hard variants contribute more raw parts-placed than easy ones, which is the intended weighting.

## Axis 3 — Tradeoff clarity (0 / 1 / 2 per README question)

The candidate's `solution/README.md` answers four questions. Each is graded 0, 1, or 2 — eight points total.

| Q | Question | 0 | 1 | 2 |
| --- | --- | --- | --- | --- |
| 1 | How do you plan one scene? | Missing or code-walk only. | Describes the algorithm. | Describes the algorithm and one non-obvious decision. |
| 2 | What did you optimize, what did you give up? | No tradeoff named. | Tradeoff named. | Tradeoff named, and the code visibly matches the claim. |
| 3 | Where does your approach break as drift grows? | "It works." | Names a failure mode. | Names a failure mode **and the smallest case** that would trigger it. |
| 4 | Smallest v1 API change that would have helped? | Aesthetic rename. | Names a real rough edge. | Names a real rough edge, shows before/after callsite, and names what the change makes worse. |

Tradeoff clarity is the tiebreaker between two submissions with identical safety and coverage. It is also the primary signal for seniority: two candidates can both solve everything, and the one who names their tradeoffs precisely is the stronger hire.

## How the axes combine

```text
if  safety_gate == fail:     → no-hire on safety grounds, stop reading
elif coverage low (<50%):    → weak, regardless of prose
else:                        → sort by coverage, break ties by tradeoff clarity
```

There is no weighted sum. Safety is a precondition, coverage is the body, tradeoff clarity is the signal. A candidate who solves 40% cleanly with sharp prose can beat a candidate who solves 70% with handwaves — rare but real.

## What we do not score

- **Path length, elapsed micro-steps, step count.** Removed from scoring. They were weak tiebreakers that rewarded optimization the prompt never asked for.
- **Bonus scenes (`09_precedence_wall`, `10_capacity_trap`).** Discussion material in the live session. They do not count toward coverage.
- **Hours worked.** Self-reported; not scored.
- **Lines of code, file count, abstraction "elegance."** A 50-line file that does one thing well is fine.
- **AI-assisted vs. hand-written.** Scored only via the honesty probe in the README and Q&A.

## Stress and unsolvable variants — what the reviewer is looking for

**Stress variant.** A scene that is intentionally close to intractable — 12+ parts, tight capacity, precedence depth, obstacles that break metric routing. The globally optimal assignment/ordering is NP-hard. We are not scoring optimality. We are scoring whether the candidate:

- recognizes that optimal is out of reach and picks a heuristic deliberately, **or**
- attempts optimal, times out cleanly, and ships partial progress, **or**
- refuses the scene with a geometric argument.

All three are defensible. What is not defensible: a heuristic the candidate cannot justify, or code that silently degrades under stress without a note in the README.

**Unsolvable variant.** A scene that has no valid routine — part outside reach, no compatible bin, precedence cycle, capacity zero on the only accepting bin. Correct behavior is `{steps: [], notes: "…"}`. We are scoring refusal as a first-class planner output, not as a fallback.

This is the hardest thing to get right and the clearest senior signal. Most submissions attempt a routine, violate, and the safety gate trips. A planner that detects infeasibility before acting is doing real work.

## Reviewer runner

```bash
node tests/reval.mjs      --bundle solution/phase1/routines.json --suite benchmark
node tests/eval_phase2.mjs --module solution/phase2/index.js
```

`reval.mjs` scores Phase 1 against the visible benchmark (and, when reviewer-only `_private/holdout/` is present, against the Phase 1 holdout suite).

`eval_phase2.mjs` loads the candidate's module, enforces the per-variant 2s budget, runs public + private variants, and emits a scored JSON with parts placed, refusal correctness, violations, and timeouts.

Neither tool decides the final grade. They produce the numbers; `_private/REVIEWER.md` describes how the reviewer reads those numbers alongside the README.
