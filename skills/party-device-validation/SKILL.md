---
name: party-device-validation
description: Validate a prepared Party laser or DMX change against a named fixture profile, mock frame contract, and optionally an explicitly authorized real device.
---

# Party Device Validation

## Prerequisites

- Supply the prepared change, fixture profile, DMX channel map, intended pattern/frame,
  amplitude limits, transport, and expected observable behavior.
- Run from the Party repository root.
- Real-device validation requires explicit user authorization, confirmed device identity,
  safe environment, profile limits, and an available emergency stop.

## Procedure

1. Inspect profile fields, channel bounds, transport selection, and frame-producing code.
2. Run hardware-independent coverage:

   ```bash
   npm run test:unit
   node test/system/test-run.js
   ```

3. Capture the exact mock frames and confirm every channel and amplitude against the
   fixture profile.
4. Run `npm run test:devices` only when its fixtures are safe for the current context.
5. If real hardware was explicitly requested, confirm controls again, exercise the
   smallest bounded output, stop output, and record the observed device response.

## Validation

The mock transport emits the expected bounded frames, all applicable tests pass, and no
frame exceeds its fixture profile. Real-device evidence must separately name the device,
profile, command, observation, and successful stop state.

## Stop Conditions

Stop immediately on an unknown profile/device, out-of-range frame, unexpected movement
or beam, transport ambiguity, unavailable emergency stop, or missing authorization.
Mock success never authorizes or proves physical output.

## Outputs

Validation report containing profile, expected/actual frames, enforced limits, commands,
test results, and whether real hardware was exercised.

## Side Effects

Runs tests and mock transports. When separately authorized, it emits bounded physical
device output; it does not implement features or change creative intent/risk tolerance.
