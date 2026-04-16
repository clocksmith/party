# Phase 1

Regenerate the static benchmark bundle with:

```bash
node _samples/claude_roboticist/solution/phase1/planner.js
```

This writes `_samples/claude_roboticist/solution/phase1/routines.json`.

The planner uses a small library of carry-shape heuristics, topological pick
ordering, bin assignment that protects restricted capacity, and simulator-shaped
safety replay before emitting wire steps.

Scene cuts are deliberate: when a candidate route cannot be replayed safely,
the sample leaves the routine partial rather than emitting a visually plausible
collision. The intended walkthrough scene is `05_maze`, where route shape
matters more than nearest-bin greediness.
