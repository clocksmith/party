# Phase 2

Chosen family: `obstacle_routing`.

## Entrypoint

The browser entrypoint is `index.js`. It exports:

```js
export const family = "obstacle_routing";

export function plan(scene, context) {
  return { steps: [/* Robot API wire steps */] };
}
```

There is intentionally no second `routines.json` for Phase 2. Phase 1 is a
static benchmark bundle; Phase 2 is the generator itself. The simulator calls
`plan(scene, context)` for each variant and uses the returned routine.

## Rough Edge In v1

The v1 shape makes every callsite manually own the same fragile sequence:
choose IK targets, try a path, close the gripper, carry the part, open the
gripper, then discover later whether the routine was unsafe. That is workable
for one fixed scene, but it hides the actual intent: "place these parts safely
despite obstacle changes."

## Axis Of Better

Robustness under obstacle variation, while preserving the five Robot API wire
step types. The public API is scene-in/routine-out; the lower-level module owns
IK candidate generation, route search, and refusal behavior.

## Before And After

Before, a caller had to spell out low-level steps:

```js
routine.movePose(part.x, part.y).gripClose();
routine.movePose(binCenter.x, binCenter.y).gripOpen();
```

After, the simulator calls the v2 planner once:

```js
const routine = plan(scene, { family: "obstacle_routing", source: "public" });
```

## Variant Behavior

For each scene variant, the planner recomputes IK targets, compatible bins,
joint-space transitions, carry-collision checks, transit poses, and bounded
bidirectional RRT routes. It does not import Node APIs, does not read
precomputed routines, and throws a clear error for unsupported families.

## Public Example

`phase2_examples/obstacle_routing_example.json` should complete all three
parts with zero violations. The local smoke test is:

```bash
node solution/phase2/dryRun_test.js
```

## What Changes First

Oriented parts would push target generation from points to pose constraints. A
second arm would require ownership and collision checks across both arm states.
A new family should add a new planner module rather than adding hidden branches
inside `obstacle_routing`.

## What v2 Makes Worse

Failures are now one level deeper. A caller sees `plan()` return a short or
empty routine unless the README and notes explain whether IK, route search,
capacity, or simulator replay rejected the candidate. `dryRun.js` helps during
local testing, but the browser contract stays intentionally small.
