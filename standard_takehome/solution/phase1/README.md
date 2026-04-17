# Phase 1

## Regenerate

```bash
node solution/phase1/planner.js
```

This writes `solution/phase1/routines.json`, the only static routines file in
the submission.

## Strategy

The planner treats the frozen simulator as the source of truth. For each
ready part, it generates multiple IK endpoint candidates for pickup and drop,
prefers kind-specific bins before shared bins, and emits `move_joint` steps so
the submitted routine does not depend on review-time IK choices.

For each candidate transition it checks joint interpolation with
`checkConfiguration`. If straight interpolation fails, it tries transit poses
above or around obstacles, then a bounded bidirectional RRT in joint space. A
candidate pickup is only committed after replaying the full routine prefix
with `runRoutine`, because local edge checks alone can miss held-part
collisions and bin-state failures after earlier placements.

## Scene Cuts

The intended behavior is conservative: skip a part or stop a scene before
emitting a known-unsafe move. On the current fixed benchmark geometry, this
bundle solves all 10 visible scenes, including the bonus scenes, with zero
violations.

## Walkthrough

On `06_combined`, the planner orders reachable parts by obstacle-aware
position instead of raw input order. It protects restricted bin capacity by
assigning kind-specific bins before `any` bins, then routes each held part
through a high transit configuration when the direct pickup-to-drop joint
segment intersects the obstacle. Each accepted placement is replayed against
the simulator before the next part is considered.

## What Did Not Work

Pure `move_pose` callsites were too dependent on the simulator's IK branch and
produced avoidable collision or convergence failures. A global optimal search
over all part orderings also did not fit the time budget; the implemented
planner uses local candidate rejection plus replay instead.
