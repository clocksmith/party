# party goals

## Mission & Thesis

Party develops bounded DMX laser control and explores camera-guided discovery of unfamiliar fixture behavior. Its research direction is to connect controlled actions, visual observations, calibration, and generated programming interfaces. The useful outcome is an understandable device contract that operates within explicit limits, not an impressive show that obscures how the hardware is being driven.

## Intended Beneficiaries

Operators need predictable fixture behavior and enforced device limits. Developers need reproducible command generation, profiles, and mock paths before touching equipment. Researchers need to distinguish a successful perception or calibration experiment from proof that an unknown device can be controlled autonomously across arbitrary conditions.

## Desired Outcomes

1. Represent supported fixture channels, amplitudes, and capabilities in explicit device profiles.
2. Trace an intended effect through generated DMX frames to observed behavior.
3. Use camera feedback to evaluate calibration and discovery hypotheses instead of trusting a model's description.
4. Produce programming interfaces whose behavior can be tested against the discovered contract.
5. Preserve a clear boundary between command-logic tests, simulated observations, and authorized physical execution.

## Operating Loops

Inspect the profile and known limits, choose a bounded experiment, generate commands, observe the result, and compare it with the hypothesis. Validate prepared changes against mock hardware first. Real-device testing requires explicit authorization and the relevant safety conditions. Keep the documented discovery curriculum and its intermediate evidence intact rather than skipping stages because a final animation appears plausible.

## Strategic Constraints

Amplitude limits from device profiles are enforced constraints. Camera observations do not grant permission to exceed them or to bypass operating safeguards. The user controls creative direction, intensity, and accepted hardware risk; an agent does not infer those choices. Record device identity and the path used when describing physical results. A mock can establish command logic but cannot establish optical output, calibration quality, or safe operation of a physical fixture.

## Explicit Exclusions

Party is not unrestricted autonomous probing, a generic visual-effects marketing project, or permission to energize hardware during documentation work. Do not present the planned perception-action discovery system as universally implemented. Do not treat model confidence, generated APIs, or attractive patterns as substitutes for observed device behavior and the applicable safety boundary.

Related: [INTENT.md](INTENT.md), [CATSCAN.md](CATSCAN.md).
