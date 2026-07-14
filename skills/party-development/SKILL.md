---
name: party-development
description: Implement Party laser and DMX features safely. Use for device profiles, pattern generation, frame transport, discovery, CLI controls, tests, or other changes under laser/, cli/, device-profiles/, patterns/, and test/.
---

# Party Development

Build the requested laser-control behavior while preserving fixture limits and a
mock-first validation path.

## Establish The Contract

1. Read `README.md`, `laser/README.md`, `EMOJI.md`, and the nearest instructions.
2. Identify the fixture profile, DMX channel map, transport, pattern, and CLI path
   involved.
3. State the expected input, generated DMX frames, amplitude limits, and observable
   fixture behavior.
4. Inspect `git status --short` and preserve unrelated work.

## Route The Change

- Put protocol, frame, discovery, and controller behavior in `laser/`.
- Put operator commands and argument handling in `cli/`.
- Put fixture channel maps and hard limits in `device-profiles/`.
- Put reusable motion or beam programs in `patterns/`.
- Put hardware-independent regression coverage in `test/`.

Do not encode fixture limits only in a UI or CLI. The frame-producing boundary must
enforce them. Do not change creative intent, intensity, or device risk tolerance
without an explicit user decision.

## Implement Safely

1. Validate profile fields and channel bounds before opening a transport.
2. Clamp or reject unsafe values according to the existing profile contract; never
   emit a frame beyond the declared amplitude limits.
3. Keep discovery deterministic and identify devices from observed protocol data.
4. Make mock transports expose the exact frames that real transports would send.
5. Add a regression test for profile selection, frame bytes, limit enforcement, or
   error handling at the narrowest stable boundary.

## Validate

Run the relevant ladder:

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:devices
node test/system/test-run.js
```

Use real-device commands only when the user requests hardware validation and the
correct fixture profile and safety conditions are confirmed. Mock results prove
frame logic, not physical output. Finish with `git diff --check`.

## Report

Name the fixture profile, frame path, enforced limits, tests run, and whether any
real hardware was exercised.
