---
name: party-debug
description: Diagnose Party laser and DMX failures. Use when discovery, fixture selection, pattern output, channel mapping, transports, CLI controls, tests, or real-device behavior is wrong or unsafe.
---

# Party Debug

Find the first broken boundary from operator input to emitted DMX frame before
changing patterns or controls.

## Trace The Path

Capture one failing case and inspect, in order:

1. CLI arguments or pattern inputs.
2. Selected file in `device-profiles/` and its channel/amplitude constraints.
3. Pattern output before fixture mapping.
4. Mapped DMX universe, channel numbers, and byte values.
5. Mock or real transport writes.
6. Fixture identity, mode, address, and observed physical result.

Compare the producer's actual object or bytes with the consumer's expected shape.
Do not infer a transport problem from a visual symptom.

## Common Boundaries

- No device: inspect discovery packets, permissions, ports, and profile matching.
- Wrong movement or beam: compare pattern coordinates with fixture channel mapping.
- Unsafe amplitude: stop output, inspect profile limits and the last generated frame,
  then fix enforcement at the frame boundary.
- CLI appears successful but nothing moves: verify transport open/write results and
  DMX address/mode rather than changing CLI text.
- Mock passes and hardware fails: preserve the mock result as logic evidence and
  inspect device identity, cabling, mode, transport, and frame timing separately.

## Fix And Prove

Add a regression that captures the exact profile, pattern input, and expected frame.
Run the focused suite, then `npm test` and `node test/system/test-run.js` when the
change crosses frame generation. Exercise hardware only with explicit authorization
and confirmed safety controls. Report the first broken boundary and the exact proof.
