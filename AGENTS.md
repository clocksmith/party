## Code Agent

When working inside Deco, follow [the workspace operating rules](../AGENTS.md).
This file adds repository-specific guidance; standalone checkouts use it directly.

**Prime Directive:** Write Node.js code for DMX laser control and autonomous hardware discovery.

### References
- Look up `README.md` (vision, architecture) and `laser/README.md` (DMX framework)
- Roadmap: `docs/FUTURE-DEVELOPMENT.md`

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
- The repository skill only validates a prepared change against mock and explicitly
  authorized hardware; feature and show design follow these instructions.
