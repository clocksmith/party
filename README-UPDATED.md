# 🎭 DMX Laser Control System v3.0

> Professional-grade DMX512 lighting control system with pattern animation, automatic device discovery, dynamic profile management, and real-time control.

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](package.json)

## 📋 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [CLI Commands](#-cli-commands)
- [Pattern Animator](#-pattern-animator)
- [Device Profiles](#-device-profiles)
- [API Documentation](#-api-documentation)
- [Sub-Documentation](#-sub-documentation)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🌟 Features

### Core Capabilities
- **🎨 Pattern Animator** - Vector-based pattern generation and animation system
- **🔌 Automatic DMX Interface Detection** - Finds ENTTEC, FTDI, and compatible interfaces
- **📁 Dynamic Device Profile System** - JSON-based device configurations
- **🔍 Pattern Discovery Mode** - Interactive pattern mapping and profile generation
- **🎮 Real-time Control Panel** - Professional UI with presets and live monitoring
- **✅ Profile Validation** - Ensures device profiles are correct before use
- **🧪 Hardware-free Testing** - Complete mock system for development
- **📊 Comprehensive Logging** - Detailed logs for debugging

### New in v3.0 - Pattern Animator
- **Pattern Editor UI** - Interactive parametric editor with real-time visualization
- **7+ Geometric Patterns** - Circle, Square, Spiral, Star, Wave, Line, Grid
- **Pattern Library** - Save, load, and manage custom patterns
- **Timeline Controller** - Synchronization and cue points
- **State Inspector** - Real-time monitoring of pattern parameters
- **Canvas Visualization** - Live preview with grid and guides
- **Demo Mode** - Showcase patterns without manual control

### v2.0 Features
- Profile-based device control (no hardcoded values)
- Automated profile generation from pattern discovery
- Multi-device support through profiles
- Enhanced CLI with setup wizard
- Robust error handling and recovery

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface Layer                   │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  CLI (dmx)   │  │ Pattern Editor│  │  Control UI  │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                Pattern Animator Layer (NEW)              │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │Pattern Engine│  │Timeline Control│  │Channel Mapper│ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│                    [Pattern Library]                     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│              Device Control Layer                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │Profile-Based │  │Device Profiles│  │  Validation  │ │
│  │   Control    │  │   Manager     │  │   Engine     │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  DMX Protocol Layer                      │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │DMX Controller│  │Channel Manager│  │Frame Generator│ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                Hardware Interface Layer                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │Serial Port   │  │ENTTEC Driver  │  │Mock Interface│ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Layer Documentation

| Layer | README | Description |
|-------|--------|-------------|
| **Pattern Animator** | [pattern-animator/README.md](pattern-animator/README.md) | Pattern generation and animation system |
| **Device Control** | [device-control/README.md](device-control/README.md) | Profile-based device management |
| **DMX Protocol** | [dmx-core/README.md](dmx-core/README.md) | Core DMX512 protocol implementation |
| **Patterns** | [patterns/README.md](patterns/README.md) | Pattern library and creation guide |

## 📦 Installation

### Prerequisites
- Node.js v16.0.0 or higher
- DMX interface (ENTTEC DMX USB Pro or compatible)
- Admin/sudo access for serial port permissions

### Install Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/dmx-laser-control.git
cd dmx-laser-control

# Install dependencies
npm install

# Create required directories
mkdir -p device-profiles patterns/saved

# Make CLI globally available (optional)
npm link
```

### Permissions Setup

#### Linux
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

#### macOS
```bash
# May need to allow terminal access to serial ports
sudo chmod 666 /dev/tty.usbserial*
```

#### Windows
- Install FTDI drivers if needed
- Run terminal as Administrator

## 🚀 Quick Start

### 1. Setup Your Device

```bash
# Run interactive setup wizard
dmx setup
```

### 2. Try Pattern Animator (NEW!)

```bash
# Launch Pattern Editor UI
dmx pattern

# Or run the demo
dmx pattern --demo
```

### 3. Control Your Device

```bash
# Launch control panel
dmx control

# Use specific profile
dmx control --profile my-laser.json
```

## 📖 CLI Commands

### Main Commands

| Command | Description | Options |
|---------|-------------|---------|
| `dmx setup` | Interactive setup wizard | None |
| `dmx pattern` | Launch Pattern Animator Editor | `--demo` Run demo mode |
| `dmx control` | Launch device control panel | `--profile <file>` Use specific profile |
| `dmx discover` | Pattern discovery mode | `--output <file>` Save profile |
| `dmx test` | Run test sequences | `--mock` Use mock device |
| `dmx validate` | Validate device profiles | `<file|directory>` Target to validate |
| `dmx generate` | Generate device profiles | `--interactive` Interactive mode |

### NPM Scripts

```bash
npm start            # Launch control panel
npm run pattern-editor  # Launch Pattern Editor
npm run animator     # Alias for pattern-editor
npm run setup        # Run setup wizard
npm run discover     # Pattern discovery mode
npm test            # Run test suite
npm run test:mock   # Test with mock device
```

## 🎨 Pattern Animator

The Pattern Animator is a powerful new layer that generates animated patterns and translates them to DMX values.

### Features

- **Vector-Based Patterns**: Mathematical pattern generation for smooth scaling
- **Real-time Preview**: Live visualization with grid and guides
- **Parametric Control**: Adjust speed, size, color, and effects
- **Pattern Library**: Save and load custom patterns
- **Timeline Support**: Synchronization and cue points
- **State Inspector**: Monitor all parameters in real-time

### Pattern Editor UI

```bash
# Launch the Pattern Editor
dmx pattern

# Controls:
SPACE    Start/Stop animation
S        Save pattern
L        Load pattern (NEW - fully functional!)
P        Select pattern type
1-9      Adjust parameters
↑↓←→     Fine control
R        Reset
B        Blackout
Q        Quit
```

### Available Patterns

| Pattern | Description | Parameters |
|---------|-------------|------------|
| **Circle** | Rotating circle | radius, speed, segments |
| **Square** | Square path | size, speed, rotation |
| **Spiral** | Expanding spiral | turns, speed, expansion |
| **Star** | Multi-point star | points, inner/outer radius |
| **Wave** | Sine wave | amplitude, frequency, orientation |
| **Line** | Scanning line | angle, length, scan mode |
| **Grid** | Point grid | rows, cols, spacing |

### Pattern Demo

```bash
# Run interactive demo
dmx pattern --demo

# Or directly via node
node pattern-demo.js
```

### Creating Custom Patterns

See [patterns/README.md](patterns/README.md) for detailed pattern creation guide.

## 📁 Device Profiles

Device profiles define how your laser/light responds to DMX commands.

### Profile Structure

```json
{
  "id": "my-laser",
  "name": "My Laser XYZ",
  "channelCount": 32,
  "channels": {
    "mode": {
      "channel": 1,
      "type": "enum",
      "values": {
        "off": 0,
        "dmx": { "min": 1, "max": 99 }
      }
    },
    "pattern": {
      "channel": 2,
      "type": "range",
      "min": 0,
      "max": 255
    }
  },
  "presets": {
    "test": {
      "channels": {
        "mode": 50,
        "pattern": 10
      }
    }
  }
}
```

### Profile Management

```bash
# Validate profiles
dmx validate device-profiles/

# Generate from discovery
dmx discover --output my-device.json
dmx generate --from my-device.json

# Use in control
dmx control --profile my-device.json
```

## 📊 API Documentation

### Using Pattern Animator Programmatically

```javascript
import { PatternAnimator } from './pattern-animator.js';
import { PatternFactory } from './patterns/geometric-patterns.js';

// Create animator
const animator = new PatternAnimator({
    dmxController: myDmxController,
    deviceProfile: myProfile,
    frameRate: 30
});

// Load and activate pattern
const circle = PatternFactory.create('circle', {
    radius: 0.3,
    speed: 1.0,
    color: { r: 255, g: 0, b: 0 }
});

animator.loadPattern('circle', circle);
animator.setActivePattern('circle');
animator.start();

// Update parameters
animator.updatePatternState({
    speed: 2.0,
    color: { r: 0, g: 255, b: 0 }
});

// Stop
animator.stop();
```

### Using Profile-Based Control

```javascript
import { ProfileBasedDeviceControl } from './dmx-profile-based-control.js';
import { DeviceProfileManager } from './dmx-device-control.js';

// Load profile
const profileManager = new DeviceProfileManager();
const profile = await profileManager.loadProfile('my-laser.json');

// Create device control
const device = new ProfileBasedDeviceControl({
    dmxController,
    profile,
    startAddress: 1
});

// Control device
device.setChannel('mode', 'dmx_manual');
device.setChannel('pattern', 'circle');
device.applyPreset('party');
```

## 📚 Sub-Documentation

For detailed information about specific components:

### Core Systems
- **[Pattern Animator Guide](pattern-animator/README.md)** - Complete pattern system documentation
- **[Device Profiles Guide](device-profiles/README.md)** - Profile creation and management
- **[DMX Protocol Guide](dmx-core/README.md)** - Low-level DMX implementation
- **[Testing Guide](test/README.md)** - Test suite and mock system

### Pattern Development
- **[Pattern Creation Guide](patterns/README.md)** - How to create custom patterns
- **[Pattern Library](patterns/library/README.md)** - Pre-built pattern collection
- **[Effects Pipeline](patterns/effects/README.md)** - Adding effects to patterns

### Advanced Topics
- **[Error Handling](docs/error-handling.md)** - Error recovery strategies
- **[Performance Tuning](docs/performance.md)** - Optimization guide
- **[Hardware Compatibility](docs/hardware.md)** - Supported devices

## 🔧 Troubleshooting

### Common Issues

#### Pattern Editor won't start
```bash
# Check blessed is installed
npm install blessed blessed-contrib

# Run directly
node pattern-editor-cli.js
```

#### No patterns visible
- Ensure laser is in DMX mode
- Check profile has position/color channels mapped
- Verify DMX address matches device

#### Saved patterns not loading
```bash
# Check patterns directory exists
mkdir -p patterns/saved

# Verify files are valid JSON
cat patterns/saved/pattern_*.json
```

### Debug Mode

```bash
# Enable debug logging
export DMX_LOG_LEVEL=DEBUG
dmx pattern

# Check logs
tail -f dmx-cli.log
```

## 🔬 Development

### Project Structure

```
dmx-laser-control/
├── dmx-cli.js                    # Main CLI application
├── pattern-animator.js           # Pattern animation engine
├── pattern-editor-cli.js         # Pattern editor UI
├── pattern-demo.js              # Pattern demonstration
├── patterns/
│   ├── geometric-patterns.js    # Basic patterns
│   ├── saved/                   # User-saved patterns
│   └── README.md               # Pattern documentation
├── dmx-profile-based-control.js # Profile-based control
├── device-profiles/             # Device profiles
│   ├── generic-laser.json
│   └── README.md
├── dmx.js                      # Core DMX control
├── dmx-mock.js                 # Mock system
├── test/                       # Test suite
└── README.md                   # This file
```

### Testing

```bash
# Run all tests
npm test

# Test with mock hardware
npm run test:mock

# Test pattern animator
node pattern-demo.js

# Test specific component
npx mocha test/pattern-animator.test.js
```

### Creating New Patterns

1. Extend the `Pattern` base class
2. Implement `generate(time, state)` method
3. Return position, color, and other properties
4. Add to `PatternFactory`

Example:
```javascript
export class MyPattern extends Pattern {
    generate(time, state) {
        return {
            position: { x: 0.5, y: 0.5 },
            color: { r: 255, g: 0, b: 0 },
            intensity: 1.0
        };
    }
}
```

## 🤝 Contributing

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-pattern`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

### Adding Device Support

1. Use discovery to map the device
   ```bash
   dmx discover --output raw.json
   ```

2. Generate a profile
   ```bash
   dmx generate --from raw.json --output profiles/new-device.json
   ```

3. Validate the profile
   ```bash
   dmx validate profiles/new-device.json
   ```

4. Submit PR with:
   - Device profile JSON
   - Test results
   - Device documentation link

### Adding Patterns

1. Create pattern class in `patterns/`
2. Add to `PatternFactory`
3. Include demo in `pattern-demo.js`
4. Update documentation
5. Submit PR with examples

## 📄 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- DMX512 protocol by USITT
- SerialPort.js community
- ENTTEC for hardware documentation
- Blessed/Blessed-contrib for UI components
- All contributors and testers

## 📮 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/dmx-laser-control/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/dmx-laser-control/discussions)
- **Wiki**: [Project Wiki](https://github.com/yourusername/dmx-laser-control/wiki)

---

**Happy Lighting! 🎉🎭🎨✨**

*Always use appropriate eye protection with laser devices. Follow local regulations for laser displays.*