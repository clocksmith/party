# INTENT: party

Parent: none

## Need

Operators and developers need to understand fixture behavior while preserving hardware limits and the user's control over creative and safety decisions.

## Target

Support explicit DMX control and bounded camera-guided discovery that connects a command hypothesis to observed device behavior.

## Invariants

Enforce device-profile amplitude limits. Test command logic with mocks before explicitly authorized physical trials. Camera feedback and model confidence cannot authorize higher intensity or bypass safeguards. Keep discovery stages and intermediate evidence inspectable.

## Evidence

Compare profile, generated DMX frames, fixture identity, camera observations, and calibration results. Mock evidence establishes logic only; real output claims require the actual device path and operating conditions. Retain unsuccessful hypotheses rather than hiding them behind generated interfaces.

## Non-goals

No unrestricted probing, autonomous choice of accepted hardware risk, or visual polish offered as proof of a working control boundary.

## Truth

[laser/README.md](laser/README.md) describes the framework and [docs/FUTURE-DEVELOPMENT.md](docs/FUTURE-DEVELOPMENT.md) describes research direction. Their plans are not evidence that every discovery stage is implemented. Device profiles and recorded trials bound supported behavior.

Related: [GOALS.md](GOALS.md), [CATSCAN.md](CATSCAN.md).
