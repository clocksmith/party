# 🎨 Pattern Animator Documentation

> Advanced pattern generation and animation system for DMX lighting control

## Overview

The Pattern Animator is a high-level layer that generates animated patterns and translates them to DMX channel values. It provides a complete system for creating, editing, and performing with dynamic lighting patterns.

## Architecture

```
┌────────────────────────────────────────────────────┐
│              Pattern Animator System               │
├────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌─────────────┐  ┌────────────┐│
│ │Pattern Engine│  │Timeline Ctrl│  │Channel Map ││
│ └──────┬───────┘  └──────┬──────┘  └─────┬──────┘│
│        │                  │                │       │
│ ┌──────▼───────────────────▼───────────────▼─────┐│
│ │           Animation Loop (30/60 FPS)            ││
│ └──────────────────────┬──────────────────────────┘│
│                        │                           │
│ ┌──────────────────────▼──────────────────────────┐│
│ │              DMX Output Interface                ││
│ └──────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────┘
```

## Core Components

### PatternAnimator Class

The main engine that orchestrates pattern generation and DMX output.

```javascript
import { PatternAnimator } from './pattern-animator.js';

const animator = new PatternAnimator({
    dmxController: controller,    // DMX controller instance
    deviceProfile: profile,       // Device profile for channel mapping
    frameRate: 30,               // Animation frame rate
    priority: 100,                // DMX channel priority
    exclusiveMode: false         // Exclusive channel control
});
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `start()` | Begin animation loop |
| `stop()` | Stop animation |
| `loadPattern(name, pattern)` | Load a pattern instance |
| `setActivePattern(name, state)` | Activate a pattern |
| `updatePatternState(updates)` | Update pattern parameters |
| `emergencyStop()` | Emergency blackout |

#### Events

| Event | Data | Description |
|-------|------|-------------|
| `start` | None | Animation started |
| `stop` | None | Animation stopped |
| `frame` | `{time, pattern, dmx}` | Frame generated |
| `error` | Error object | Error occurred |
| `patternChanged` | Pattern name | Active pattern changed |

### Timeline Controller

Manages synchronization and cue points for complex shows.

```javascript
const timeline = animator.timeline;

// Add cue points
timeline.addCue(5000, { action: 'changePattern', pattern: 'spiral' });
timeline.addCue(10000, { action: 'changeColor', color: { r: 255, g: 0, b: 0 } });

// Reset timeline
timeline.reset();
```

### Channel Mapper

Translates normalized pattern data to device-specific DMX channels.

```javascript
const mapper = new ChannelMapper(deviceProfile);

// Maps pattern frame to DMX values
const dmxValues = mapper.map({
    position: { x: 0.5, y: 0.75 },  // Normalized 0-1
    color: { r: 255, g: 128, b: 0 },
    intensity: 0.8,
    size: 0.3
});
// Returns: { 5: 128, 6: 191, 11: 255, 12: 128, 13: 0 }
```

## Pattern System

### Base Pattern Class

All patterns extend the base Pattern class:

```javascript
export class Pattern {
    constructor(options = {}) {
        this.name = options.name || 'Pattern';
        this.parameters = options.parameters || {};
    }
    
    generate(time, state) {
        // Must return frame data
        return {
            position: { x: 0.5, y: 0.5 },
            color: { r: 255, g: 255, b: 255 },
            intensity: 1.0,
            size: 0.1,
            pattern: 'mypattern'
        };
    }
}
```

### Coordinate System

Patterns work in normalized coordinates (0-1 range):
- `(0, 0)` = Top-left
- `(0.5, 0.5)` = Center
- `(1, 1)` = Bottom-right

This ensures patterns are device-independent and scale properly.

### Available Patterns

| Pattern | Parameters | Description |
|---------|------------|-------------|
| **Circle** | `radius`, `speed`, `segments` | Circular path |
| **Square** | `size`, `speed`, `rotation` | Square perimeter |
| **Spiral** | `turns`, `speed`, `expansion` | Expanding spiral |
| **Star** | `points`, `outerRadius`, `innerRadius` | Multi-point star |
| **Wave** | `amplitude`, `frequency`, `vertical` | Sine wave |
| **Line** | `angle`, `length`, `scan` | Scanning line |
| **Grid** | `rows`, `cols`, `spacing` | Point grid |

## Pattern Editor UI

### Launching the Editor

```bash
# Via CLI
dmx pattern

# Directly
node pattern-editor-cli.js

# Via npm
npm run pattern-editor
```

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│ Pattern Preview          │ Patterns    │ Library    │
│ (Canvas with grid)       │ ○ Circle    │ [New]      │
│                         │ ○ Square    │ pattern1   │
│      · · · · ·          │ ● Spiral    │ pattern2   │
│    · · · + · · ·        │ ○ Star      │ ...        │
│  · · · · · · · · ·      │             │            │
│    · · · + · · ·        ├─────────────┼────────────│
│      · · · · ·          │ Parameters  │ State      │
│                         │ Speed: ████ │ Pos: 0.5,0.5│
│                         │ Size:  ██── │ RGB: 255,0,0│
├─────────────────────────┤ Color: RGB  │ Time: 3.2s │
│ Timeline ═══════────    ├─────────────┼────────────│
│                         │ Effects     │ Controls   │
│ Status: Running         │ Strobe: OFF │ SPACE: Run │
└─────────────────────────────────────────────────────┘
```

### Keyboard Controls

| Key | Action |
|-----|--------|
| **SPACE** | Start/Stop animation |
| **S** | Save current pattern |
| **L** | Load saved pattern |
| **P** | Focus pattern selector |
| **1-9** | Adjust parameters |
| **↑↓←→** | Fine position control |
| **R** | Reset pattern |
| **B** | Blackout |
| **Q** | Quit |

### Saving and Loading Patterns

Patterns are saved as JSON files in `patterns/saved/`:

```json
{
  "type": "spiral",
  "parameters": {
    "speed": 75,
    "size": 40,
    "color": { "r": 255, "g": 0, "b": 128 }
  },
  "state": {
    "turns": 3,
    "expansion": 0.15,
    "transform": {
      "offset": { "x": 0, "y": 0 },
      "rotation": 0,
      "scale": 1
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Pattern Demo

### Running the Demo

```bash
# Via CLI
dmx pattern --demo

# Directly
node pattern-demo.js
```

### Demo Features

1. **Pattern Selection** - Choose from all available patterns
2. **Color Control** - Random color changes
3. **Speed Adjustment** - Variable animation speeds
4. **Demo Sequence** - Automatic pattern showcase
5. **Mock/Real DMX** - Works with or without hardware

### Demo Controls

| Key | Action |
|-----|--------|
| **1-7** | Select pattern |
| **8** | Run demo sequence |
| **SPACE** | Start/Stop |
| **C** | Change color |
| **S** | Change speed |
| **B** | Blackout |
| **F** | Toggle frame display |
| **Q** | Quit |

## Creating Custom Patterns

### Step 1: Create Pattern Class

```javascript
// patterns/my-custom-pattern.js
import { Pattern } from './geometric-patterns.js';

export class MyCustomPattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'MyCustom',
            parameters: {
                complexity: options.complexity || 5,
                speed: options.speed || 1.0,
                color: options.color || { r: 255, g: 255, b: 255 }
            }
        });
    }
    
    generate(time, state) {
        const { complexity, speed, color } = { ...this.parameters, ...state };
        
        // Calculate position based on time
        const t = (time / 1000) * speed;
        const angle = t * Math.PI * 2;
        const radius = 0.3 * (1 + Math.sin(t * complexity) * 0.3);
        
        return {
            position: {
                x: 0.5 + radius * Math.cos(angle),
                y: 0.5 + radius * Math.sin(angle)
            },
            color,
            intensity: 0.5 + 0.5 * Math.sin(t * 2),
            size: 0.1,
            pattern: 'mycustom'
        };
    }
}
```

### Step 2: Register with Factory

```javascript
// patterns/geometric-patterns.js
PatternFactory.patterns['mycustom'] = MyCustomPattern;
```

### Step 3: Use in Animator

```javascript
const pattern = PatternFactory.create('mycustom', {
    complexity: 8,
    speed: 1.5
});

animator.loadPattern('mycustom', pattern);
animator.setActivePattern('mycustom');
```

## Performance Optimization

### Frame Rate Considerations

- **30 FPS**: Standard for most applications
- **60 FPS**: Smoother animation, higher CPU usage
- **15 FPS**: Power-saving mode

### Optimization Tips

1. **Pre-calculate Constants**
   ```javascript
   // Good - calculated once
   const TWO_PI = Math.PI * 2;
   
   // Bad - calculated every frame
   const angle = time * Math.PI * 2;
   ```

2. **Batch DMX Updates**
   ```javascript
   // Good - single update
   dmxController.setChannels({ 5: x, 6: y, 11: r, 12: g, 13: b });
   
   // Bad - multiple updates
   dmxController.setChannel(5, x);
   dmxController.setChannel(6, y);
   ```

3. **Use Rate Limiting**
   ```javascript
   animator.safety.maxChangeRate = 10; // Max DMX change per frame
   ```

## Safety Features

### Emergency Stop

```javascript
// Immediate blackout
animator.emergencyStop();

// Reset after emergency
animator.resetEmergencyStop();
```

### Rate Limiting

Prevents seizure-inducing rapid changes:

```javascript
const animator = new PatternAnimator({
    safety: {
        maxChangeRate: 10,    // Max DMX value change per frame
        minFrameTime: 16      // Min 16ms between frames (60fps cap)
    }
});
```

### Exclusive Mode

Prevents conflicts with other control sources:

```javascript
const animator = new PatternAnimator({
    exclusiveMode: true,     // Take full control
    priority: 100            // High priority
});
```

## Integration Examples

### With Profile-Based Control

```javascript
// Use both systems together
const device = new ProfileBasedDeviceControl({ ... });
const animator = new PatternAnimator({ ... });

// Manual control
device.setChannel('mode', 'dmx_manual');
device.applyPreset('setup');

// Switch to patterns
animator.start();
device.setChannel('mode', 'dmx');  // Ensure DMX mode

// Back to manual
animator.stop();
device.applyPreset('static');
```

### With Timeline Events

```javascript
// Choreographed show
animator.timeline.addCue(0, { pattern: 'circle', color: 'red' });
animator.timeline.addCue(5000, { pattern: 'spiral', speed: 2 });
animator.timeline.addCue(10000, { pattern: 'star', effect: 'strobe' });

animator.timeline.on('cue', (cue) => {
    if (cue.data.pattern) {
        animator.setActivePattern(cue.data.pattern);
    }
});

animator.start();
```

## Troubleshooting

### Pattern Not Visible

1. Check laser is in DMX mode
2. Verify profile has position channels mapped
3. Ensure pattern generates valid coordinates (0-1 range)
4. Check DMX connection

### Jerky Animation

1. Lower frame rate if CPU limited
2. Increase `safety.maxChangeRate`
3. Check for other processes using CPU
4. Use simpler patterns

### Colors Not Working

1. Verify profile has RGB channels mapped
2. Check channel numbers in profile
3. Ensure color values are 0-255
4. Test with manual control first

## API Reference

See [API Documentation](../docs/api/pattern-animator.md) for complete API reference.

## Contributing

See [Contributing Guide](../CONTRIBUTING.md) for information on adding new patterns and features.

---

*Part of the DMX Laser Control System v3.0*