# Phase 1

## Regenerate

```bash
node _samples/codex_roboticist/solution/phase1/planner.js
```

This writes `_samples/codex_roboticist/solution/phase1/routines.json`.

## Strategy

This sample solves all 10 visible scenes from scene data: IK endpoint candidates, kind-aware bin
assignment, transit poses, bounded bidirectional RRT, and full simulator replay
before each committed pickup. The planner emits `move_joint` steps to avoid
depending on reviewer-time IK branch choices.

## Walkthrough

On `06_combined`, the sample routes held parts through high transit poses when
the direct joint segment would collide with an obstacle, while preserving
restricted bin capacity for matching part kinds.

## Tradeoffs

The search is bounded and still local: it rejects unsafe candidates and moves
on rather than proving global optimality across every possible ordering.
