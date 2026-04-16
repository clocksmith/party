# Phase 1

Regenerate the static benchmark bundle with:

```bash
node _samples/claude_roboticist/solution/phase1/planner.js
```

This writes `_samples/claude_roboticist/solution/phase1/routines.json`.

The planner uses a small library of carry-shape heuristics, topological pick
ordering, bin assignment that protects restricted capacity, and simulator-shaped
safety replay before emitting wire steps.
