# Examples

Example scripts and demonstrations of the DMX laser control framework.

## What's Here

This directory contains working examples that demonstrate various features of the laser control system:

- **demo.js** - Basic demonstration using profile-based device control
- **pattern-demo.js** - Pattern animator demonstration with geometric patterns
- **dmx-canvas-simple-example.js** - Simple canvas drawing example
- **dmx-canvas-demo.js** - Intermediate canvas demonstration with effects
- **dmx-canvas-advanced-examples.js** - Advanced canvas features and techniques

## Why It's Here

Examples serve multiple purposes:
- **Learning resource** - Show how to use the library correctly
- **Quick start** - Copy-paste foundation for new projects
- **Testing** - Manual verification of features
- **Documentation** - Living code examples that stay current

These are separated from tests because they're meant for human consumption and experimentation, not automated validation.

## How It Works

All examples import from the `../laser/` library and demonstrate real-world usage patterns.

### demo.js

Basic demonstration of the DMX control system:

```bash
node examples/demo.js
```

**What it shows:**
- Loading device profiles
- Connecting to DMX interface
- Applying presets
- Running sequences
- Error handling

**Key concepts:**
- `ProfileBasedDeviceControl` - High-level device abstraction
- `DeviceProfileManager` - Profile loading and management
- `DMXLogger` - Logging framework

### pattern-demo.js

Pattern animator demonstration:

```bash
node examples/pattern-demo.js
```

**What it shows:**
- Creating pattern animations
- Parametric pattern control
- Timeline management
- Color and transform effects
- Pattern library usage

**Key concepts:**
- `PatternAnimator` - Animation engine
- `PatternFactory` - Pattern creation
- Frame-based animation
- DMX channel mapping

### dmx-canvas-simple-example.js

Simplest canvas drawing example:

```bash
node examples/dmx-canvas-simple-example.js
```

**What it shows:**
- Basic canvas setup
- Drawing primitives (lines, circles)
- Coordinate system
- Color control

**Key concepts:**
- Canvas abstraction for laser drawing
- Position mapping (0-1 normalized coordinates)
- DMX channel translation

### dmx-canvas-demo.js

Intermediate canvas demonstration:

```bash
node examples/dmx-canvas-demo.js
```

**What it shows:**
- Multiple shapes
- Animation loops
- Color transitions
- Timing control
- Sequence composition

**Key concepts:**
- Animation state management
- Effect timing
- Shape combinations

### dmx-canvas-advanced-examples.js

Advanced canvas features:

```bash
node examples/dmx-canvas-advanced-examples.js
```

**What it shows:**
- Complex geometric patterns
- Parametric curves (Bezier, splines)
- 3D projections
- Custom effects
- Performance optimization

**Key concepts:**
- Advanced geometry
- Transformation matrices
- Optimization techniques
- Custom pattern creation

## Running Examples

### Prerequisites

All examples require:
- DMX interface connected (or use mock mode)
- Device profile configured
- Node.js dependencies installed

### With Real Hardware

```bash
# Make sure your DMX interface is connected
node examples/demo.js --port /dev/ttyUSB0 --profile generic-laser
```

### With Mock Hardware

Many examples support mock mode for testing without hardware:

```bash
node examples/pattern-demo.js --mock
```

### Configuration

Examples typically accept these options:
- `--port <path>` - Serial port path
- `--profile <name>` - Device profile to use
- `--mock` - Use mock DMX interface
- `--duration <ms>` - How long to run

Check each example's help:

```bash
node examples/demo.js --help
```

## Modifying Examples

Examples are meant to be modified! Try:

1. **Copy an example** as a starting point
2. **Modify parameters** (colors, speeds, patterns)
3. **Add your own logic** (new sequences, effects)
4. **Experiment safely** with mock mode first

## Common Patterns

### Basic Setup Template

```javascript
import { ProfileBasedDeviceControl } from '../laser/dmx-profile-based-control.js';
import { DeviceProfileManager } from '../laser/dmx-device-control.js';
import { DMXLogger, LogLevel } from '../laser/dmx-logger.js';

const logger = new DMXLogger({
    moduleName: 'MyExample',
    minLevel: LogLevel.INFO
});

const profileManager = new DeviceProfileManager();
const profile = await profileManager.loadProfile('my-laser.json');

const device = new ProfileBasedDeviceControl({
    profile: profile,
    startAddress: 1
});

await device.connect();
// Your code here
await device.disconnect();
```

### Animation Loop Template

```javascript
const animator = new PatternAnimator({
    dmxController: myController,
    frameRate: 30
});

animator.loadPattern('circle', myCirclePattern);
animator.setActivePattern('circle');

animator.on('frame', (data) => {
    // React to each frame
});

animator.start();
// Run for some duration
animator.stop();
```

## Troubleshooting

### Example Won't Run

1. **Check imports** - Make sure paths point to `../laser/`
2. **Install dependencies** - Run `npm install` in project root
3. **Check hardware** - Verify DMX interface is connected
4. **Try mock mode** - Test without hardware first

### No Visual Output

1. **Check DMX address** - Device start address must match
2. **Check mode channel** - Laser must be in DMX mode
3. **Check profile** - Verify channel mappings are correct
4. **Monitor DMX** - Use `tail -f dmx_received_log.txt`

### Performance Issues

1. **Reduce frame rate** - Lower animation FPS
2. **Simplify patterns** - Use fewer points/curves
3. **Check CPU** - Monitor system resources
4. **Use mock mode** - Isolate serial communication issues

## Next Steps

After exploring examples:
- **Read** [`../laser/README.md`](../laser/README.md) for library documentation
- **Try** [`../cli/`](../cli/README.md) tools for interactive control
- **Create** your own device profile with pattern discovery
- **Build** your own project using these as templates

## Contributing Examples

To contribute a new example:

1. Create a well-commented, self-contained script
2. Add command-line options for flexibility
3. Include both hardware and mock modes
4. Document what it demonstrates
5. Update this README
6. Submit a pull request

Good examples are:
- **Clear** - Easy to understand purpose
- **Focused** - Demonstrates one concept well
- **Reusable** - Useful as a starting point
- **Safe** - Handles errors, includes shutdowns
