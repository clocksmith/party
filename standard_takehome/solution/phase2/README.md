# Planning API v2

Chosen family: `obstacle_routing`.

The browser entrypoint is `index.js`. It exports:

```js
export const family = "obstacle_routing";

export function plan(scene, context) {
  return { steps: [/* Robot API wire steps */] };
}
```

Axis of improvement: robustness under obstacle variation while preserving the
small five-step Robot API wire format.

The implementation recomputes IK targets, joint-space transitions, carry
collision checks, and a bounded bidirectional RRT route for each scene variant.
It does not import Node APIs and does not load precomputed routines. If the
simulator asks for a non-`obstacle_routing` family, it throws a clear error
instead of pretending to support that family.

`dryRun.js` and `dryRun_test.js` are optional local smoke-test helpers; the
reviewed contract is the browser-runnable `index.js`.

There is intentionally no second `routines.json` for Phase 2. Phase 1 is a
static benchmark bundle; Phase 2 is the generator itself. The simulator calls
`plan(scene, context)` for each variant and uses the routine returned by that
function.
