# 🎯 DMX Seamless API

> A high-level, unified interface for seamless programmatic control of DMX lighting systems. Zero external dependencies, pure JavaScript.

## Overview

The DMX Seamless API provides a single, elegant interface that abstracts the complexity of the underlying DMX control system. It unifies Pattern Animation, Profile-Based Control, and direct DMX manipulation into one cohesive API with automatic conflict resolution.

## Features

- **🎨 Unified Control** - Single API for patterns, profiles, and direct DMX control
- **⚡ Zero Dependencies** - Pure JavaScript using only Node.js built-in modules
- **🔄 Automatic Conflict Resolution** - Smart handling of control mode switches
- **🛡️ Built-in Safety** - Emergency stops, rate limiting, and error recovery
- **📊 State Management** - Complete state tracking and introspection
- **🎭 Pattern Library** - All geometric patterns included and ready to use
- **💾 Persistence** - Save and load pattern configurations
- **🔌 Mock Mode** - Full functionality without hardware for development
- **📝 Comprehensive Logging** - Configurable logging with file output

## Installation

```javascript
// Simply import the API - no npm install required!
import { createDMXAPI } from './dmx-seamless-api.js';
```

## Quick Start

### Basic Setup

```javascript
import { createDMXAPI } from './dmx-seamless-api.js';

// Create and initialize the API
const dmx = await createDMXAPI({
    profilePath: './device-profiles/my-laser.json',
    mock: false,  // Set to true for development without hardware
    autoConnect: true,
    autoLoadPatterns: true
});

// You're ready to go!
```

### Pattern Animation

```javascript
// Set a pattern and start animating
dmx.setActivePattern('spiral', {
    speed: 1.5,
    turns: 3,
    color: { r: 255, g: 0, b: 128 }
});

dmx.startAnimation();

// Update parameters in real-time
dmx.updatePatternState({
    speed: 2.0,
    color: { r: 0, g: 255, b: 255 }
});

// Transition smoothly between patterns
await dmx.transitionToPattern('star', {
    duration: 2000,
    easing: 'easeInOut'
});
```

### Profile-Based Control

```javascript
// Control via logical channel names
dmx.setChannel('colorRed1', 255);
dmx.setChannel('mode', 'dmx');

// Set multiple channels at once
dmx.setChannels({
    xPosition: 128,
    yPosition: 192,
    scanSpeed: 100
});

// Apply presets
dmx.applyPreset('party');

// Run macros
await dmx.runMacro('startup');
```

## API Reference

### Constructor Options

```javascript
const options = {
    // Connection
    portPath: '/dev/tty.usbserial',  // DMX port (null for auto-detect)
    mock: false,                      // Use mock controller
    autoConnect: true,                // Auto-connect on init
    
    // Device Profile
    deviceProfile: profileObject,     // Profile object
    profilePath: './profile.json',    // OR path to profile file
    startAddress: 1,                  // DMX start address
    
    // Animation
    frameRate: 30,                    // Animation FPS (30 or 60)
    autoLoadPatterns: true,           // Load built-in patterns
    
    // Conflict Resolution
    conflictResolution: 'priority',   // 'priority' or 'exclusive'
    priority: {
        profile: 100,                 // Profile control priority
        pattern: 90                   // Pattern control priority
    },
    
    // Safety
    safety: {
        maxChangeRate: 20,            // Max DMX change per frame
        minFrameTime: 16,             // Min ms between frames
        emergencyStopOnError: true    // Auto e-stop on errors
    },
    
    // Logging
    logging: {
        enabled: true,                // Enable logging
        level: 'info',                // 'error', 'warn', 'info', 'debug'
        file: './dmx.log'             // Log file path (optional)
    }
};
```

### Core Methods

#### Initialization & Connection

| Method | Description | Returns |
|--------|-------------|---------|
| `init()` | Initialize the API | `Promise<void>` |
| `connect()` | Connect to DMX hardware | `Promise<void>` |
| `disconnect()` | Disconnect from hardware | `Promise<void>` |
| `setControlMode(mode)` | Set control mode ('profile' or 'pattern') | `void` |

#### Pattern Control

| Method | Description | Returns |
|--------|-------------|---------|
| `loadPattern(name, pattern)` | Load a pattern | `void` |
| `loadPatternFromFile(path)` | Load pattern from JSON | `Promise<string>` |
| `savePatternToFile(name, path)` | Save pattern to JSON | `Promise<void>` |
| `setActivePattern(name, state)` | Set active pattern | `boolean` |
| `startAnimation()` | Start pattern animation | `boolean` |
| `stopAnimation()` | Stop animation | `void` |
| `updatePatternState(updates)` | Update pattern parameters | `void` |
| `transitionToPattern(name, options)` | Smooth pattern transition | `Promise<void>` |

#### Profile Control

| Method | Description | Returns |
|--------|-------------|---------|
| `setChannel(name, value, intensity)` | Set channel by name | `boolean` |
| `setChannels(updates)` | Set multiple channels | `void` |
| `applyPreset(name)` | Apply preset | `boolean` |
| `runMacro(name)` | Run macro sequence | `Promise<boolean>` |
| `blackout()` | All channels to zero | `void` |

#### Utility Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getState()` | Get current API state | `Object` |
| `getAvailablePatterns()` | List loaded patterns | `string[]` |
| `getAvailablePresets()` | List device presets | `string[]` |
| `getChannelInfo(name)` | Get channel details | `Object` |
| `emergencyStop()` | Emergency shutdown | `void` |

### Events

The API extends EventEmitter and emits the following events:

| Event | Data | Description |
|-------|------|-------------|
| `initialized` | - | API initialized successfully |
| `connected` | - | Connected to DMX hardware |
| `disconnected` | - | Disconnected from hardware |
| `modeChanged` | `mode` | Control mode changed |
| `channelChanged` | `{channel, value}` | Channel value changed |
| `channelsChanged` | `updates` | Multiple channels changed |
| `presetApplied` | `name` | Preset applied |
| `macroExecuted` | `name` | Macro completed |
| `patternLoaded` | `name` | Pattern loaded |
| `patternActivated` | `name` | Pattern activated |
| `animationStarted` | `pattern` | Animation started |
| `animationStopped` | - | Animation stopped |
| `patternStateChanged` | `updates` | Pattern state updated |
| `transitionProgress` | `{from, to, progress}` | Transition progress |
| `transitionComplete` | `{from, to}` | Transition completed |
| `frame` | `frameData` | Animation frame generated |
| `blackout` | - | Blackout activated |
| `emergencyStop` | - | Emergency stop triggered |
| `error` | `Error` | Error occurred |

## Demo Scripts

The `demos/` folder contains comprehensive examples:

### 1. Basic Control (`basic-control.js`)
Simple device control demonstrating channels, presets, and macros.

```bash
node demos/basic-control.js
```

### 2. Pattern Animation (`pattern-animation.js`)
Complete pattern animation showcase with all built-in patterns.

```bash
node demos/pattern-animation.js
```

### 3. Choreographed Show (`choreographed-show.js`)
Timeline-based light show with music synchronization points.

```bash
node demos/choreographed-show.js
```

### 4. Interactive Control (`interactive-control.js`)
Real-time keyboard control with visual feedback.

```bash
node demos/interactive-control.js
```

### 5. Multi-Device (`multi-device.js`)
Control multiple DMX devices with synchronization.

```bash
node demos/multi-device.js
```

## Usage Examples

### Example 1: Simple Pattern Loop

```javascript
import { createDMXAPI } from './dmx-seamless-api.js';

async function patternLoop() {
    const dmx = await createDMXAPI({
        mock: true,
        profilePath: './device-profiles/generic-laser.json'
    });
    
    const patterns = ['circle', 'spiral', 'star', 'wave'];
    
    for (const pattern of patterns) {
        dmx.setActivePattern(pattern, {
            speed: 1.5,
            color: { r: 255, g: 128, b: 0 }
        });
        
        dmx.startAnimation();
        await new Promise(r => setTimeout(r, 5000));
        dmx.stopAnimation();
    }
    
    await dmx.disconnect();
}
```

### Example 2: Color Fade

```javascript
async function colorFade() {
    const dmx = await createDMXAPI({
        mock: true,
        profilePath: './device-profiles/generic-laser.json'
    });
    
    dmx.setActivePattern('circle', { speed: 1.0 });
    dmx.startAnimation();
    
    // Fade through rainbow
    const colors = [
        { r: 255, g: 0, b: 0 },     // Red
        { r: 255, g: 128, b: 0 },   // Orange
        { r: 255, g: 255, b: 0 },   // Yellow
        { r: 0, g: 255, b: 0 },     // Green
        { r: 0, g: 255, b: 255 },   // Cyan
        { r: 0, g: 0, b: 255 },     // Blue
        { r: 128, g: 0, b: 255 }    // Purple
    ];
    
    for (const color of colors) {
        dmx.updatePatternState({ color });
        await new Promise(r => setTimeout(r, 1000));
    }
    
    dmx.stopAnimation();
    await dmx.disconnect();
}
```

### Example 3: Event-Driven Control

```javascript
async function eventDriven() {
    const dmx = await createDMXAPI({
        mock: true,
        profilePath: './device-profiles/generic-laser.json'
    });
    
    // React to events
    dmx.on('patternActivated', (pattern) => {
        console.log(`Pattern activated: ${pattern}`);
    });
    
    dmx.on('frame', (data) => {
        // Process frame data
        if (data.position.x > 0.8) {
            dmx.updatePatternState({ 
                color: { r: 255, g: 0, b: 0 } 
            });
        }
    });
    
    dmx.on('error', (error) => {
        console.error('Error:', error);
        dmx.emergencyStop();
    });
    
    dmx.setActivePattern('spiral');
    dmx.startAnimation();
    
    // Run for 10 seconds
    await new Promise(r => setTimeout(r, 10000));
    
    await dmx.disconnect();
}
```

### Example 4: State Persistence

```javascript
async function statePersistence() {
    const dmx = await createDMXAPI({
        mock: true,
        profilePath: './device-profiles/generic-laser.json'
    });
    
    // Load a saved pattern
    const patternName = await dmx.loadPatternFromFile('./patterns/saved/my-pattern.json');
    
    // Use it
    dmx.setActivePattern(patternName);
    dmx.startAnimation();
    
    // Modify it
    dmx.updatePatternState({
        speed: 2.0,
        color: { r: 0, g: 255, b: 128 }
    });
    
    // Save the modified version
    await dmx.savePatternToFile(patternName, './patterns/saved/my-pattern-v2.json');
    
    await dmx.disconnect();
}
```

## Conflict Resolution

The API handles conflicts between Pattern Animation and Profile Control automatically:

### Priority Mode (Default)
- Higher priority control takes precedence
- Lower priority commands are ignored while higher priority is active
- Default: Profile (100) > Pattern (90)

### Exclusive Mode
- Only one control mode can be active at a time
- Switching modes automatically stops the previous mode
- Ensures clean transitions between control types

```javascript
const dmx = await createDMXOrchestrator({
    conflictResolution: 'exclusive',
    // ...other options
});

// This will stop any running animation
dmx.setChannel('mode', 'manual');

// This will blackout profile control
dmx.startAnimation();
```

## Safety Features

### Emergency Stop
```javascript
// Immediately stops all animation and blacks out
dmx.emergencyStop();
```

### Rate Limiting
Prevents seizure-inducing rapid changes:
```javascript
const dmx = await createDMXOrchestrator({
    safety: {
        maxChangeRate: 10,  // Max DMX value change per frame
        minFrameTime: 33    // Min 33ms between frames (30fps max)
    }
});
```

### Error Handling
```javascript
const dmx = await createDMXOrchestrator({
    safety: {
        emergencyStopOnError: true  // Auto e-stop on errors
    }
});

dmx.on('error', (error) => {
    console.error('DMX Error:', error);
    // emergencyStop already called if emergencyStopOnError is true
});
```

## Mock Mode

Perfect for development without hardware:

```javascript
const dmx = await createDMXOrchestrator({
    mock: true,  // Enable mock mode
    profilePath: './device-profiles/generic-laser.json'
});

// Full API functionality without hardware
dmx.setActivePattern('spiral');
dmx.startAnimation();

// Mock controller logs DMX values to console
// Mock DMX Ch5: 128
// Mock DMX Ch6: 192
```

## Performance Considerations

### Frame Rate
- **30 FPS**: Recommended for most applications
- **60 FPS**: Smoother animation, higher CPU usage
- **15 FPS**: Power-saving mode

### Optimization Tips

1. **Batch Updates**: Use `setChannels()` instead of multiple `setChannel()` calls
2. **Throttle State Updates**: Don't update pattern state on every frame
3. **Use Transitions**: Smooth transitions instead of rapid switching
4. **Monitor Events Carefully**: Frame events fire frequently

## Architecture

```
┌─────────────────────────────────────────┐
│          DMX Seamless API               │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │     Unified Control Interface     │ │
│  └───────────┬───────────────────────┘ │
│              │                          │
│  ┌───────────▼───────────┐             │
│  │  Conflict Resolution  │             │
│  └───────────┬───────────┘             │
│              │                          │
│  ┌───────────▼────────────────────┐    │
│  │     State Management           │    │
│  └───────────┬────────────────────┘    │
│              │                          │
│  ┌───────────▼───────────────────────┐ │
│  │   Pattern    │  Profile  │  DMX   │ │
│  │  Animator    │  Control  │  Core  │ │
│  └──────────────┴───────────┴────────┘ │
└─────────────────────────────────────────┘
```

## Integration with Existing System

The Seamless API sits on top of your existing DMX control system:

```javascript
// You can still access the underlying components if needed
const dmx = await createDMXAPI({ /* options */ });

// Access lower-level APIs
const profileControl = dmx.profileBasedControl;
const animator = dmx.patternAnimator;
const controller = dmx.dmxController;
```

## Troubleshooting

### API Won't Initialize
- Check device profile path is correct
- Verify profile JSON is valid
- Ensure serial port permissions

### Patterns Not Animating
- Verify `startAnimation()` was called
- Check active pattern is set
- Ensure not in blackout state

### Mock Mode Not Working
- Set `mock: true` in options
- Check console for mock DMX output

### Memory Leaks
- Always call `disconnect()` when done
- Remove event listeners when not needed
- Stop animations before switching modes

## Contributing

The API is designed to be extended easily:

1. **Custom Patterns**: Add to PatternFactory
2. **New Events**: Emit from appropriate methods
3. **Additional Safety**: Extend safety options
4. **Enhanced Logging**: Add log levels

## License

MIT

## Support

- Create issues in the main repository
- Check demo scripts for examples
- Review inline JSDoc comments

---

**Happy Lighting! 🎭✨**