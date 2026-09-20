# CATSCAN: party

Parent: none

## Target

Bounded DMX control and camera-guided device discovery.

## Authority

Owns command generation, device profiles, and perception interfaces; user owns creative intent and hardware authorization.

## Scope

Laser framework, CLI, profiles, patterns, and discovery experiments.

## Contracts

Inputs: profile limits and requested behavior. Outputs: DMX frames, observations, calibration records, and bounded APIs.

## Invariants

Never exceed profile amplitude limits. Mock before authorized hardware. Perception cannot bypass safety controls.

## Acceptance

Use mock command tests; physical claims require the real device path, relevant operating limits, and observed output.

## Non-goals

Unrestricted probing, autonomous risk selection, or generated interfaces as proof of calibration.

## Freedom

Implement discovery and control techniques within explicit profiles and accepted evidence boundaries.

Related: [GOALS.md](GOALS.md), [INTENT.md](INTENT.md).
