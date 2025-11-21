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
