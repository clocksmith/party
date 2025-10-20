# Tests

Test suites for the laser control framework and Project PARTY components.

## What's Here

Comprehensive testing infrastructure:

```
test/
├── system/         # System-level integration tests
├── devices/        # Hardware-specific device tests
├── unit/           # Unit tests for individual modules
├── integration/    # Integration tests
├── dmx.test.js     # Core DMX functionality tests
└── helper-api-test.js  # Helper API tests
```

## Why It's Here

Tests are separated from source code to:
- Keep library code clean and focused
- Allow running tests independently
- Support multiple test frameworks
- Enable CI/CD integration
- Provide usage examples through test cases

## How It Works

### Test Organization

**System Tests** (`system/`)
- End-to-end testing
- Mock hardware validation
- Full workflow scenarios
- `test-run.js` - Main system test harness

**Device Tests** (`devices/`)
- Hardware-specific validation
- Profile regression testing
- Real hardware integration
- Mock fallback support

**Unit Tests** (`unit/`)
- Individual module testing
- Pure function validation
- Edge case coverage
- Fast execution

**Integration Tests** (`integration/`)
- Multi-module interaction
- API contract validation
- System integration

### Running Tests

**All Tests:**
```bash
npm test
```

**Specific Test Suites:**
```bash
# System tests (no hardware required)
node test/system/test-run.js

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Device tests
npm run test:devices
```

**Hardware Tests:**
```bash
# Ehaho L2400 with mock
npm run test:ehaho

# Ehaho L2400 with real hardware
npm run test:ehaho:hardware -- --port=/dev/ttyUSB0

# Generic laser tests
node test/devices/generic-laser.test.js --port=/dev/ttyUSB0 --full
```

### Test Frameworks

**Testing Tools:**
- `mocha` - Test runner
- `chai` - Assertions
- `sinon` - Mocks and spies

**Mock Hardware:**
- `../laser/dmx-mock.js` - Mock DMX interfaces
- `DMXTestHarness` - Test scenario runner

### Writing Tests

**Unit Test Example:**
```javascript
import { expect } from 'chai';
import { DMXController } from '../laser/dmx.js';

describe('DMXController', () => {
    it('should initialize with 512 zeros', () => {
        const controller = new DMXController();
        expect(controller.dmxState).to.have.lengthOf(512);
        expect(controller.dmxState[0]).to.equal(0);
    });
});
```

**Integration Test Example:**
```javascript
import { DMXTestHarness } from '../laser/dmx-mock.js';

describe('Device Control Integration', () => {
    let harness;

    beforeEach(async () => {
        harness = new DMXTestHarness();
        await harness.setup();
    });

    it('should apply preset correctly', async () => {
        const scenario = {
            name: 'Apply Preset',
            steps: [
                { type: 'connect' },
                { type: 'apply_preset', preset: 'test_pattern' },
                { type: 'assert_state', expected: { mode: 200, pattern: 10 } }
            ]
        };

        const results = await harness.simulateScenario(scenario);
        expect(results.passed).to.be.true;
    });
});
```

**Device Test Example:**
```javascript
describe('Ehaho L2400', () => {
    it('should blackout on channel 1 = 0', async () => {
        await device.connect();
        await device.setChannel(1, 0);

        // Verify with hardware or mock
        const state = await device.getState();
        expect(state.output).to.equal('off');
    });
});
```

## Test Coverage

### Current Coverage

Core modules have comprehensive test coverage:
- DMX Controller: 90%+
- Device Profiles: 85%+
- Mock Hardware: 95%+
- Pattern Animator: 70%+

### Running Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

## Mock vs Hardware Testing

### Mock Testing

**Advantages:**
- Fast execution
- No hardware required
- Deterministic results
- Safe for CI/CD
- Easy to test edge cases

**Use for:**
- Unit tests
- Integration tests
- Automated CI/CD
- Development without hardware

### Hardware Testing

**Advantages:**
- Real-world validation
- Timing accuracy
- Hardware quirks discovered
- End-to-end confidence

**Use for:**
- Device validation
- Profile verification
- Performance testing
- Pre-deployment checks

## Safety Considerations

### Hardware Test Safety

**Always:**
- Use low intensity initially
- Have emergency stop ready (blackout)
- Verify DMX address before testing
- Test in a safe environment
- Wear laser safety glasses

**Never:**
- Run destructive tests on production gear
- Test at full power without verification
- Leave automated tests running unattended
- Skip the mock tests first

### Test Isolation

Tests should:
- Clean up after themselves
- Not affect other tests
- Use unique DMX addresses if parallel
- Close serial ports properly
- Handle timeouts gracefully

## Continuous Integration

### CI/CD Pipeline

Tests run automatically on:
- Every commit (unit tests)
- Pull requests (integration tests)
- Main branch merge (full suite)
- Nightly builds (hardware tests if available)

### CI Configuration

Mock-only tests can run anywhere:
```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test
```

Hardware tests need special runners:
```yaml
- name: Hardware Tests
  run: npm run test:ehaho:hardware -- --port=${{ secrets.DMX_PORT }}
  if: github.event_name == 'schedule'
```

## Test Data

### Test Fixtures

Test data and profiles:
- `test/fixtures/` - Sample profiles
- `test/data/` - Test scenarios
- `../device-profiles/` - Real profiles

### Generating Test Data

```bash
# Discover patterns for testing
node cli/dmx-cli.js discover --mock --output test/fixtures/discovered.json
```

## Debugging Tests

### Verbose Output

```bash
# Mocha verbose mode
npm test -- --reporter spec

# Enable DMX logging
DMX_LOG_LEVEL=debug npm test
```

### Debugging Single Tests

```bash
# Run specific test file
node --inspect-brk test/unit/dmx.test.js

# Use .only to focus on one test
it.only('should do something', () => {
    // This test runs
});
```

### Common Issues

**Serial Port Busy:**
- Close other DMX software
- Check for hung processes: `lsof | grep tty`
- Use mock mode: `--mock`

**Test Timeouts:**
- Increase timeout: `--timeout 10000`
- Check hardware connection
- Verify DMX address

**Flaky Tests:**
- Add delays for hardware settling
- Use proper cleanup in `afterEach`
- Avoid timing-dependent assertions

## Contributing Tests

When contributing code, also provide:

1. **Unit tests** for new modules
2. **Integration tests** for new features
3. **Device tests** if hardware-specific
4. **Documentation** of test approach

### Test Quality Guidelines

Good tests are:
- **Fast** - Run quickly (mock when possible)
- **Isolated** - Don't depend on other tests
- **Repeatable** - Same result every time
- **Clear** - Obvious what's being tested
- **Maintainable** - Easy to update when code changes

## Future Testing

Planned improvements:
- [ ] Visual regression testing (for PARTY project)
- [ ] Performance benchmarking
- [ ] Stress testing with multiple devices
- [ ] Property-based testing
- [ ] Mutation testing
- [ ] Test report dashboard
