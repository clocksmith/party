## Code Agent

**Prime Directive:** Write Node.js code for DMX laser control and autonomous hardware discovery.

### Before Starting
- Read `README.md` for project vision and architecture
- Read `laser/README.md` for DMX framework docs
- Read `EMOJI.md` for approved Unicode symbols
- Check `docs/FUTURE-DEVELOPMENT.md` for roadmap

### Key Paths
- `laser/` - DMX512 control framework
- `cli/` - Command-line tools
- `device-profiles/` - Device configuration files
- `patterns/` - Pattern library
- `test/` - Test suites

### Guardrails
- Enforce `EMOJI.md`; use only approved Unicode symbols, no emojis
- Never exceed amplitude limits from `device-profiles/*.json`
- Follow laser safety regulations
- Test with mock hardware before real devices

### Development
```bash
npm install
npm test                        # Run tests
node test/system/test-run.js    # Mock hardware tests
```

## Intent-First Operations

- Treat Party intent as hardware-safe laser/DMX control, not visual show copy.
- If the user asks what a pattern/device/control does, map the device profile, amplitude limits, fixture channels, and test path before recommending changes.
- Do not infer show direction, intensity, or hardware risk tolerance; the user sets creative intent, implementation enforces safety.
- Mock hardware tests prove command logic only. Real hardware claims require the real device path and safety constraints.
- If a fixture behaves incorrectly, inspect the device profile and generated DMX frames before changing UI labels.

## No speculative engineering timelines

- Do not predict how long a coding, software-engineering, product-implementation, refactor, migration, launch, or similar work item will take. Avoid speculative delivery statements such as "1-2 weeks", "four months", or "a quick fix".
- Describe planned work through concrete deltas, dependencies, risks, and validation instead of calendar duration.
- This restriction does not apply to factual status for an already-running command, script, benchmark, training run, skill, deployment, or algorithm. You may report elapsed time, measured runtime, progress, and a grounded ETA when the active process exposes enough evidence.
- Do not invent an ETA for an active process. If it does not expose one, report its current phase, latest output, and whether it is still making progress.

## Pick the real fix

- when you find a correctness bug, the default is to fix it, not to relabel it
- do not use effort or scope framing ("non-trivial", "real engineering effort", "worth its own thread", "we'll address later") as cover for choosing a lesser fix
- do not propose "mark experimental", "add a TODO", or "rewrite the misleading comment" as a substitute for the actual engineering work when the underlying behavior is wrong
- if scope genuinely must be split, describe the concrete deltas and ask the user which path to take, do not pre-decide a smaller version
