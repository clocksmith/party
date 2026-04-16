# Phase 1 Planner

Generated with:

```bash
node solution/phase1/planner.js
```

The planner emits static wire-format routines to
`solution/phase1/routines.json`.

Implementation summary:

- Generates IK endpoint candidates for grasp/drop targets.
- Emits `move_joint` steps instead of `move_pose` so submitted routines do not
  depend on reviewer-time IK choices.
- Checks every candidate joint interpolation with `checkConfiguration` before
  committing it.
- Uses transit poses plus a bounded bidirectional RRT fallback for obstacle
  scenes.
- Replays the full routine prefix with `runRoutine` before committing each
  pickup, because local edge checks alone are not enough to catch every carry
  failure.
