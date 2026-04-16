# Phase 2

Chosen family: `obstacle_routing`.

The browser entrypoint is `index.js`. It exports `plan(scene, context)` and
emits only the original Robot API wire steps.

Axis of improvement: intent expression. The v2 surface wraps the repeated
route/replay/update pattern behind a higher-level place-part operation, so
safety checking and state updates are owned by the API instead of every callsite.

There is no Phase 2 `routines.json`: Phase 2 is the generator. The simulator
passes each variant scene to `plan(scene, context)` and runs the returned
routine.
