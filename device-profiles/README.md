# Device Profiles

DMX device configuration profiles for laser projectors and lighting fixtures.

## What's Here

JSON configuration files that describe how DMX channels map to device functions:

- Device-specific profiles (e.g., `ehaho-l2400.json`)
- Generic profiles for common laser types
- Template profiles for creating new devices
- Auto-discovered profiles from the discovery tool

## Why It's Here

Device profiles are external configuration files because:
- **Hardware varies** - Every laser has different channel mappings
- **Easy editing** - JSON is human-readable and editable
- **Sharing** - Profiles can be distributed and reused
- **Discovery** - CLI tools can generate profiles automatically
- **Versioning** - Profiles can be tracked separately from code

This separation allows the laser control library to work with any device without code changes.

## How It Works

### Profile Format

A device profile is a JSON file with this structure:

```json
{
  "id": "ehaho-l2400",
  "name": "Ehaho L2400",
  "manufacturer": "Ehaho",
  "model": "L2400",
  "channelCount": 32,
  "dmxStartAddress": 1,

  "channels": {
    "mode": {
      "channel": 1,
      "type": "enum",
      "description": "Operation mode",
      "values": {
        "off": 0,
        "auto": 50,
        "sound": 100,
        "dmx": 200
      }
    },
    "pattern": {
      "channel": 2,
      "type": "range",
      "description": "Pattern selection",
      "min": 0,
      "max": 255
    }
  },

  "presets": {
    "blackout": {
      "description": "All off",
      "channels": {
        "mode": 0
      }
    }
  },

  "metadata": {
    "version": "1.0.0",
    "created": "2024-01-01",
    "author": "Your Name"
  }
}
```

### Profile Sections

**Identity** (`id`, `name`, `manufacturer`, `model`)
- Unique identification
- Human-readable names
- Hardware specifications

**Channels** (`channels`)
- Maps logical names to DMX channels
- Defines value ranges and meanings
- Documents channel behavior

**Presets** (`presets`)
- Pre-configured channel combinations
- Common patterns and effects
- Named scenes

**Metadata** (`metadata`)
- Version tracking
- Creation info
- Authorship

### Channel Types

**Enum** - Discrete values with names:
```json
{
  "type": "enum",
  "values": {
    "off": 0,
    "on": 255
  }
}
```

**Range** - Continuous value range:
```json
{
  "type": "range",
  "min": 0,
  "max": 255
}
```

**Color** - RGB color channels:
```json
{
  "type": "color",
  "channels": {
    "red": 7,
    "green": 8,
    "blue": 9
  }
}
```

## Creating Profiles

### Method 1: Discovery Tool (Recommended)

Use the CLI discovery tool to automatically generate profiles:

```bash
# Interactive discovery
node cli/dmx-cli.js discover

# Automated discovery with specific channels
node cli/dmx-cli.js discover --channels 1,2,3,4,5 --step 10 --output my-laser.json

# Capture full state for each pattern
node cli/dmx-cli.js discover --capture-state --output detailed-profile.json
```

The discovery tool:
1. Connects to your DMX device
2. Cycles through channel values
3. Prompts you to name patterns
4. Generates a complete profile JSON

### Method 2: Manual Creation

1. Copy a template or similar profile
2. Edit channel mappings based on device manual
3. Test with the control interface
4. Validate with the validator tool:

```bash
node cli/dmx-cli.js validate my-laser.json
```

### Method 3: From Device Manual

If you have the device's DMX channel table:

1. Create the basic profile structure
2. Map each channel from the manual
3. Add common presets
4. Test each channel individually

## Using Profiles

### In Code

```javascript
import { DeviceProfileManager } from './laser/dmx-device-control.js';

const manager = new DeviceProfileManager({
    profilesDir: './device-profiles'
});

// Load specific profile
const profile = await manager.loadProfile('ehaho-l2400.json');

// Use with device control
const device = new ProfileBasedDeviceControl({
    profile: profile,
    startAddress: 1
});
```

### In CLI

```bash
# Use profile with control interface
node cli/dmx-cli.js control --profile ehaho-l2400.json

# Use profile in setup
node cli/dmx-cli.js setup --profile ehaho-l2400.json --port /dev/ttyUSB0
```

## Profile Organization

### Naming Convention

Use descriptive filenames:
- `manufacturer-model.json` (e.g., `ehaho-l2400.json`)
- `generic-type.json` (e.g., `generic-laser.json`)
- `discovered-timestamp.json` (auto-generated)

### File Structure

Organize profiles by:
```
device-profiles/
├── lasers/
│   ├── ehaho-l2400.json
│   ├── generic-laser.json
│   └── ...
├── moving-heads/
│   └── ...
├── templates/
│   ├── laser-template.json
│   └── fixture-template.json
└── discovered/
    └── (auto-generated profiles)
```

## Profile Validation

### Manual Validation

Check your profile with:

```bash
node cli/dmx-cli.js validate device-profiles/my-laser.json
```

The validator checks:
- JSON syntax
- Required fields present
- Channel numbers valid (1-512)
- No duplicate channels
- Value ranges sensible
- Preset references valid

### Automated Validation

Profiles are validated automatically when:
- Loading in the profile manager
- Used in device control
- Committed to version control (if CI configured)

## Common Profile Patterns

### Standard Laser Channels

Most lasers follow this pattern:

```json
{
  "channels": {
    "mode": {"channel": 1, "type": "enum"},
    "pattern": {"channel": 2, "type": "range"},
    "zoom": {"channel": 3, "type": "range"},
    "x_position": {"channel": 4, "type": "range"},
    "y_position": {"channel": 5, "type": "range"},
    "z_rotation": {"channel": 6, "type": "range"},
    "red": {"channel": 7, "type": "range"},
    "green": {"channel": 8, "type": "range"},
    "blue": {"channel": 9, "type": "range"},
    "strobe": {"channel": 10, "type": "range"},
    "rotation": {"channel": 11, "type": "range"},
    "speed": {"channel": 12, "type": "range"}
  }
}
```

### Useful Presets

Include these common presets:

```json
{
  "presets": {
    "blackout": {
      "description": "All off",
      "channels": {"mode": 0}
    },
    "test_pattern": {
      "description": "Safe test pattern",
      "channels": {
        "mode": 200,
        "pattern": 10,
        "red": 255
      }
    },
    "center_point": {
      "description": "Static center point",
      "channels": {
        "mode": 200,
        "x_position": 128,
        "y_position": 128
      }
    }
  }
}
```

## Troubleshooting

### Profile Not Found

```bash
# List available profiles
node cli/dmx-cli.js list

# Check the profiles directory
ls -la device-profiles/
```

### Invalid Profile

```bash
# Validate syntax
node cli/dmx-cli.js validate device-profiles/my-laser.json

# Check JSON syntax
cat device-profiles/my-laser.json | jq .
```

### Wrong Channel Mappings

1. Check device's manual for correct DMX chart
2. Use discovery tool to verify each channel
3. Test with minimal preset (one channel at a time)
4. Compare with working profile of similar device

## Contributing Profiles

To share a profile:

1. Test thoroughly with real hardware
2. Document any device-specific quirks
3. Include author and version in metadata
4. Add comments for non-obvious mappings
5. Submit via pull request

### Profile Quality Guidelines

Good profiles have:
- **Complete channel mappings** - All documented channels included
- **Clear descriptions** - Explain what each channel does
- **Useful presets** - Common patterns pre-configured
- **Accurate values** - Verified with real hardware
- **Metadata** - Version, author, notes

## Advanced Features

### Channel Groups

Group related channels:

```json
{
  "channelGroups": {
    "position": ["x_position", "y_position", "z_rotation"],
    "color": ["red", "green", "blue"]
  }
}
```

### Curves and Calibration

For non-linear channels:

```json
{
  "channels": {
    "dimmer": {
      "channel": 1,
      "type": "range",
      "curve": "exponential",
      "gamma": 2.2
    }
  }
}
```

### Multi-Mode Devices

Devices with different DMX modes:

```json
{
  "modes": {
    "basic": {
      "channelCount": 8,
      "channels": { ... }
    },
    "extended": {
      "channelCount": 32,
      "channels": { ... }
    }
  }
}
```

## Future Development

For Project PARTY, profiles will be:
- **Auto-generated** by the discovery system
- **Calibrated** with non-linearity curves
- **Validated** through visual feedback
- **Optimized** for drawing primitives
