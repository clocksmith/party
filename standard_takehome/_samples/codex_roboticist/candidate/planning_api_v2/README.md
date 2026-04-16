# Planning API v2

Canonical axis: diagnosability/testability.

The v1 API makes safety a post-hoc concern: callers emit steps and only learn
whether the sequence is unsafe after the simulator rejects it. This v2 makes
`dryRun` a first-class operation on an intent planner:

```js
const routine = plan(scene, { axis: "testability" })
  .placeAll({ refuseUnsafe: true, dryRun: true })
  .build();
```

Minimal implementation shipped here:

- `index.js` exposes the intent surface and a tiny compiler.
- `dryRun.js` wraps the simulator result into a unit-test-friendly shape.
- `dryRun_test.js` is a co-located smoke test for the introspection contract.

Concrete prediction if extended beyond the timebox: adding a safe-prefix return
mode such as `refuseUnsafe: "prefix"` should touch the compiler and dry-run
result shape, not every scene callsite.
