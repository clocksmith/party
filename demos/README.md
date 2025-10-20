# Demos

Demonstration scripts and discovery tools for laser hardware exploration.

## What's Here

A collection of specialized demo scripts for testing, discovering, and showcasing laser control capabilities:

**Discovery Tools:**
- `channel-isolator.js` - Isolate and test individual DMX channels
- `color-finder.js` - Discover color channel mappings
- `advanced-color-finder.js` - Advanced color mapping with combinations
- `final-color-finder.js` - Complete color discovery tool
- `circle-search.js` - Find circular pattern channels
- `circle-verifier.js` - Verify circle pattern accuracy
- `pattern-and-color-finder.js` - Combined pattern and color discovery

**Control Demos:**
- `basic-control.js` - Basic DMX control demonstration
- `interactive-control.js` - Interactive control interface
- `helper-api-demo.js` - High-level helper API demonstration
- `pattern-animation.js` - Pattern animation examples

**Show Demos:**
- `color-circle-demo.js` - Colored circle animations
- `choreographed-show.js` - Synchronized show sequences
- `the-final-show.js` - Complete demonstration show
- `trigger-test.js` - Trigger and timing tests

**Advanced:**
- `multi-device.js` - Multi-device orchestration

## Why It's Here

Demos serve different purposes than examples:

- **Examples** (`../examples/`) - Clean, documented code for learning
- **Demos** (`demos/`) - Experimental, discovery, and testing scripts

Demos are:
- More experimental and specialized
- Focused on hardware discovery
- Used for testing and validation
- Often interactive and iterative
- May be less polished than examples

## How It Works

### Discovery Tools

These scripts help you reverse-engineer and understand unknown laser hardware.

**Channel Isolator** - Test one channel at a time:
```bash
node demos/channel-isolator.js --channel 5 --port /dev/ttyUSB0
```

What it does:
- Connects to DMX interface
- Cycles through values on specified channel
- Lets you observe what that channel controls
- Helps build device profiles

**Color Finder** - Discover RGB channel mappings:
```bash
node demos/color-finder.js --port /dev/ttyUSB0
```

What it does:
- Tests combinations of channels
- Cycles through colors
- Identifies which channels control R, G, B
- Auto-detects color mapping

**Circle Search** - Find circular pattern channels:
```bash
node demos/circle-search.js --port /dev/ttyUSB0
```

What it does:
- Tests X/Y position channels
- Looks for circular motion patterns
- Identifies position control channels
- Measures response characteristics

### Control Demos

**Basic Control** - Simple DMX control:
```bash
node demos/basic-control.js --port /dev/ttyUSB0
```

Shows:
- Connecting to DMX interface
- Setting channel values
- Basic sequences
- Error handling

**Interactive Control** - Live interaction:
```bash
node demos/interactive-control.js --port /dev/ttyUSB0
```

Features:
- Keyboard control
- Real-time adjustments
- Multiple presets
- Live monitoring

**Helper API Demo** - High-level API:
```bash
node demos/helper-api-demo.js --port /dev/ttyUSB0
```

Demonstrates:
- Helper functions
- Abstraction layers
- Simplified control
- Common patterns

### Show Demos

**Color Circle Demo**:
```bash
node demos/color-circle-demo.js --port /dev/ttyUSB0
```

Visual demonstration of:
- Circular patterns
- Color transitions
- Synchronized motion
- Timing control

**Choreographed Show**:
```bash
node demos/choreographed-show.js --port /dev/ttyUSB0
```

Complex demonstration featuring:
- Multi-pattern sequences
- Timed transitions
- Color choreography
- Complete show programming

**The Final Show**:
```bash
node demos/the-final-show.js --port /dev/ttyUSB0
```

Comprehensive demo showcasing:
- All major features
- Advanced effects
- Professional show quality
- Full capabilities

### Multi-Device Control

**Multi-Device Demo**:
```bash
node demos/multi-device.js
```

Demonstrates:
- Controlling multiple lasers
- Synchronized effects
- Priority management
- Orchestration

## Using Discovery Tools

### Discovery Workflow

1. **Start with Channel Isolator** - Test each channel individually
   ```bash
   node demos/channel-isolator.js --channel 1
   # Observe what changes, note the function
   # Repeat for channels 2-32
   ```

2. **Use Color Finder** - Identify color controls
   ```bash
   node demos/color-finder.js
   # Automatically detects R, G, B channels
   ```

3. **Run Circle Search** - Find position channels
   ```bash
   node demos/circle-search.js
   # Identifies X, Y, rotation channels
   ```

4. **Pattern Discovery** - Use the CLI tool
   ```bash
   node cli/dmx-cli.js discover --channels 2,3,4
   # Maps pattern selection channels
   ```

5. **Create Profile** - Compile findings into device profile
   ```bash
   # Use discovered information to create
   # device-profiles/my-laser.json
   ```

### Discovery Tips

**Safety First:**
- Start with low intensity
- Use blackout between tests
- Wear laser safety glasses
- Test in controlled environment

**Systematic Approach:**
- Test one channel at a time
- Document every observation
- Use consistent test values
- Verify findings multiple times

**Common Patterns:**
- Channel 1: Usually mode selection
- Channels 7-9: Often RGB colors
- Channels 4-6: Often X/Y position
- Channel 2: Often pattern selection

## Running Demos

### Prerequisites

Most demos require:
- DMX interface connected
- Laser device connected and powered
- Correct DMX address configured
- Serial port access permissions

### Common Options

```bash
# Specify serial port
--port /dev/ttyUSB0

# Set DMX start address
--address 1

# Use mock interface (no hardware)
--mock

# Set duration
--duration 30000

# Verbose logging
--verbose
```

### Safety Options

```bash
# Low intensity mode
--safe

# Dry run (no DMX output)
--dry-run

# Emergency stop timeout
--timeout 5000
```

## Modifying Demos

Demos are meant to be modified and experimented with:

1. **Copy a demo** as starting point
2. **Modify parameters** (channels, values, timing)
3. **Add your own tests**
4. **Document findings**

Example modification:
```javascript
// In color-finder.js, test more channels
const CHANNELS_TO_TEST = [7, 8, 9, 13, 14, 15];  // Add more channels

// Test different value ranges
const TEST_VALUES = [0, 64, 128, 192, 255];  // More granular

// Adjust timing
const DWELL_TIME = 500;  // Longer observation time
```

## Troubleshooting

### Demo Won't Connect

1. Check serial port path: `ls /dev/tty*`
2. Verify permissions: `ls -l /dev/ttyUSB0`
3. Test with mock: `--mock`
4. Check other software using port

### No Visual Output

1. Verify laser is powered on
2. Check DMX address matches
3. Ensure laser is in DMX mode
4. Test with known-good values

### Inconsistent Results

1. Allow settling time between changes
2. Increase dwell times
3. Check for interference
4. Verify cable connections
5. Test with different values

### Discovery Tool Fails

1. Start with simpler tool (channel isolator)
2. Test manually first
3. Verify channel ranges
4. Check for multi-mode device

## Development

### Creating New Demos

Template for new demo:

```javascript
import { DMXSerialInterface, DMXController } from '../laser/dmx.js';

async function main() {
    // Parse command line arguments
    const port = process.argv[2] || '/dev/ttyUSB0';

    // Connect to DMX
    const dmx = new DMXSerialInterface({ portPath: port });
    const controller = new DMXController({ serialInterface: dmx });

    try {
        await controller.connect();

        // Your demo logic here

        // Cleanup
        await controller.blackout();
    } finally {
        await controller.disconnect();
    }
}

main().catch(console.error);
```

### Demo Best Practices

Good demos:
- **Start safely** - Low intensity, blackout state
- **Explain purpose** - Clear comments and console output
- **Handle errors** - Try/catch and cleanup
- **Support mock mode** - Test without hardware
- **Document findings** - Save results to files

## Next Steps

After using demos:

1. **Document findings** in device profile
2. **Validate** with CLI discovery tool
3. **Create examples** using discovered features
4. **Share** profiles and findings
5. **Contribute** improvements to demos

## Future Development

For Project PARTY, demos will evolve into:
- **Autonomous discovery** scripts
- **Visual feedback** integration
- **AI-driven exploration** tools
- **Automatic profiling** systems
- **Validation frameworks** with cameras

These demos represent the manual discovery process that Project PARTY aims to automate.
