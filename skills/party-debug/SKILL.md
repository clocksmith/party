---
name: party-debug
description: Diagnose a named Party laser or DMX discovery, fixture, frame, mapping, transport, CLI, test, or device failure; repair it only when requested.
---

# Party Debug

Diagnosis is read-only and mock-first. Patching requires an implementation request; hardware output requires separate explicit authorization.

Find the first broken boundary from operator input to emitted DMX frame before
changing patterns or controls.

## Prerequisites

Supply the failing command or frame, expected output, fixture profile and channel map,
transport mode, and device identity only when real hardware is explicitly in scope.

## Procedure

1. Reproduce through the mock transport and capture the exact fixture/frame identity.
2. Trace the input, pattern, mapping, safety, transport, and device boundaries below.
3. Report the first mismatch; only for a requested repair, patch its owner and rerun
   focused and system checks. Keep hardware output separately authorized.

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

## Authorized Repair And Proof

When repair is requested, add a regression that captures the exact profile, pattern input, and expected frame.
Run the focused suite, then `npm test` and `node test/system/test-run.js` when the
change crosses frame generation. Exercise hardware only with explicit authorization
and confirmed safety controls. Report the first broken boundary and the exact proof.

## Validation

The exact fixture profile and pattern produce the expected bounded frame in the mock
transport; real-device evidence is separate and must name the exercised hardware.

## Stop Conditions

Immediately stop output on an unsafe amplitude, unknown fixture profile, unexpected
device identity, or unavailable emergency control. Never infer physical safety from
mock success.

## Outputs

A fixture-bound diagnosis and mock-frame evidence, plus any authorized repair's test
results. Real-device evidence, when separately authorized, names the device exercised.

## Side Effects

Diagnosis and validation are mock-first. Authorized repair may edit Party and write
test artifacts; real DMX or laser output is never implied by invocation.
