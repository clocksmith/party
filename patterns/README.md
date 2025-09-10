# 🎭 Pattern Library Documentation

> Collection of vector-based patterns for DMX lighting animation

## Overview

This directory contains all pattern implementations for the Pattern Animator system. Patterns are mathematical functions that generate position, color, and effect data for DMX lighting devices.

## Directory Structure

```
patterns/
├── geometric-patterns.js    # Core geometric patterns
├── saved/                   # User-saved pattern configurations
├── library/                 # Pre-built pattern presets
├── effects/                 # Effect modifiers
└── README.md               # This file
```

## Pattern Types

### Geometric Patterns

Basic mathematical patterns that form the foundation of the animation system.

| Pattern | Class | Description | Complexity |
|---------|-------|-------------|------------|
| **Circle** | `CirclePattern` | Circular motion path | Simple |
| **Square** | `SquarePattern` | Square perimeter trace | Simple |
| **Spiral** | `SpiralPattern` | Expanding/contracting spiral | Medium |
| **Star** | `StarPattern` | Multi-point star shape | Medium |
| **Wave** | `WavePattern` | Sine wave oscillation | Simple |
| **Line** | `LinePattern` | Linear scanning | Simple |
| **Grid** | `GridPattern` | Point matrix | Medium |

### Advanced Patterns (Coming Soon)

| Pattern | Description | Status |
|---------|-------------|--------|
| **Particle System** | Fireworks, rain, snow effects | Planned |
| **Text Scroller** | Display scrolling text | Planned |
| **Logo Drawer** | Draw custom logos/shapes | Planned |
| **Audio Reactive** | Music-synchronized patterns | Planned |
| **3D Projection** | 3D shapes projected to 2D | Planned |

## Creating a New Pattern

### 1. Pattern Class Template

```javascript
import { Pattern } from './geometric-patterns.js';

export class MyPattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'MyPattern',
            parameters: {
                // Define adjustable parameters
                speed: options.speed || 1.0,
                size: options.size || 0.3,
                complexity: options.complexity || 5,
                color: options.color || { r: 255, g: 255, b: 255 }
            }
        });
    }
    
    /**
     * Generate frame data for current time
     * @param {number} time - Time in milliseconds
     * @param {object} state - Current pattern state
     * @returns {object} Frame data
     */
    generate(time, state) {
        // Merge parameters with state overrides
        const params = { ...this.parameters, ...state };
        
        // Calculate pattern position (0-1 normalized)
        const t = (time / 1000) * params.speed;
        const x = 0.5 + Math.cos(t) * params.size;
        const y = 0.5 + Math.sin(t) * params.size;
        
        return {
            position: { x, y },
            color: params.color,
            intensity: 1.0,
            size: params.size,
            pattern: 'mypattern'
        };
    }
    
    /**
     * Optional: Generate complete path for visualization
     */
    generatePath(state) {
        const params = { ...this.parameters, ...state };
        const points = [];
        
        for (let i = 0; i <= 100; i++) {
            const t = (i / 100) * Math.PI * 2;
            points.push({
                x: 0.5 + Math.cos(t) * params.size,
                y: 0.5 + Math.sin(t) * params.size
            });
        }
        
        return points;
    }
}
```

### 2. Register with Factory

Add your pattern to the PatternFactory:

```javascript
// In geometric-patterns.js
PatternFactory.patterns['mypattern'] = MyPattern;
```

### 3. Test Your Pattern

```javascript
// test-pattern.js
import { PatternFactory } from './patterns/geometric-patterns.js';

const pattern = PatternFactory.create('mypattern', {
    speed: 2.0,
    size: 0.4,
    color: { r: 0, g: 255, b: 128 }
});

// Simulate animation
for (let time = 0; time < 5000; time += 33) {
    const frame = pattern.generate(time, {});
    console.log(`t=${time}ms: (${frame.position.x.toFixed(2)}, ${frame.position.y.toFixed(2)})`);
}
```

## Pattern Parameters

### Standard Parameters

Most patterns support these common parameters:

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `speed` | number | 0-10 | Animation speed multiplier |
| `size` | number | 0-1 | Pattern size/radius |
| `color` | RGB | 0-255 | Pattern color |
| `intensity` | number | 0-1 | Brightness level |

### Pattern-Specific Parameters

#### Circle
- `radius`: Circle radius (0-0.5)
- `segments`: Smoothness (8-64)

#### Spiral
- `turns`: Number of spiral turns (1-10)
- `expansion`: Expansion rate (0-0.5)

#### Star
- `points`: Number of points (3-12)
- `innerRadius`: Inner radius (0-0.5)
- `outerRadius`: Outer radius (0-0.5)

#### Wave
- `amplitude`: Wave height (0-0.5)
- `frequency`: Wave frequency (1-10)
- `vertical`: Orientation (true/false)

#### Grid
- `rows`: Grid rows (2-10)
- `cols`: Grid columns (2-10)
- `spacing`: Point spacing (0.1-1.0)

## Frame Data Format

All patterns must return a frame object with these properties:

```javascript
{
    position: {
        x: 0.5,      // Horizontal position (0-1)
        y: 0.5       // Vertical position (0-1)
    },
    color: {
        r: 255,      // Red (0-255)
        g: 128,      // Green (0-255)
        b: 0         // Blue (0-255)
    },
    intensity: 1.0,  // Brightness (0-1)
    size: 0.1,       // Pattern size (0-1)
    pattern: 'name'  // Pattern identifier
}
```

## Saved Patterns

User-created pattern configurations are stored in `patterns/saved/`:

### File Format

```json
{
  "type": "spiral",
  "parameters": {
    "speed": 50,
    "size": 30,
    "color": { "r": 255, "g": 0, "b": 255 }
  },
  "state": {
    "turns": 5,
    "expansion": 0.2,
    "transform": {
      "offset": { "x": 0.1, "y": -0.1 },
      "rotation": 45,
      "scale": 1.2
    }
  },
  "metadata": {
    "name": "Purple Spiral",
    "author": "User",
    "created": "2024-01-01T12:00:00Z",
    "tags": ["spiral", "purple", "medium"]
  }
}
```

### Loading Saved Patterns

```javascript
import fs from 'fs/promises';
import { PatternFactory } from './patterns/geometric-patterns.js';

async function loadSavedPattern(filename) {
    const data = JSON.parse(await fs.readFile(`patterns/saved/${filename}`));
    const pattern = PatternFactory.create(data.type, data.parameters);
    return { pattern, state: data.state };
}

// Use loaded pattern
const { pattern, state } = await loadSavedPattern('my-pattern.json');
animator.loadPattern('saved', pattern);
animator.setActivePattern('saved', state);
```

## Pattern Effects

Effects can be applied to any pattern to modify its output:

### Transform Effects

```javascript
// Apply to pattern state
const state = {
    transform: {
        offset: { x: 0.1, y: 0 },    // Shift position
        rotation: Math.PI / 4,        // Rotate 45°
        scale: 1.5                    // Scale up 150%
    }
};

animator.updatePatternState(state);
```

### Color Effects

```javascript
const state = {
    effects: {
        brightness: 0.5,              // Dim to 50%
        strobe: true,                 // Enable strobe
        strobeRate: 10,              // Strobe frequency
        fade: 0.8                    // Fade to 80%
    }
};
```

### Composite Effects

```javascript
// Combine multiple effects
const complexState = {
    speed: 2.0,
    color: { r: 255, g: 0, b: 0 },
    transform: {
        rotation: time => time / 1000,  // Continuous rotation
        scale: time => 1 + Math.sin(time / 500) * 0.3  // Pulsing
    },
    effects: {
        brightness: time => 0.5 + Math.sin(time / 200) * 0.5  // Breathing
    }
};
```

## Pattern Combinations

### Layering Patterns

```javascript
// Future feature - combine multiple patterns
const composite = new CompositePattern([
    { pattern: circlePattern, weight: 0.5 },
    { pattern: spiralPattern, weight: 0.5 }
]);
```

### Pattern Transitions

```javascript
// Smooth transition between patterns
animator.transitionTo('spiral', {
    duration: 2000,
    easing: 'easeInOut'
});
```

## Performance Guidelines

### Optimization Tips

1. **Minimize Calculations**
   ```javascript
   // Cache expensive calculations
   const TWO_PI = Math.PI * 2;
   const angles = new Float32Array(360).map((_, i) => i * TWO_PI / 360);
   ```

2. **Use Lookup Tables**
   ```javascript
   // Pre-calculate sine values
   const SINE_TABLE = new Float32Array(360);
   for (let i = 0; i < 360; i++) {
       SINE_TABLE[i] = Math.sin(i * Math.PI / 180);
   }
   ```

3. **Avoid Object Creation**
   ```javascript
   // Reuse objects
   const position = { x: 0, y: 0 };
   
   generate(time, state) {
       position.x = ...;  // Modify existing
       position.y = ...;
       return { position, ... };
   }
   ```

### Benchmarking

```javascript
// Measure pattern performance
const iterations = 1000;
const pattern = PatternFactory.create('complex');

console.time('Pattern Generation');
for (let i = 0; i < iterations; i++) {
    pattern.generate(i * 33, {});
}
console.timeEnd('Pattern Generation');
```

## Pattern Gallery

### Simple Patterns

**Circle** - Perfect for testing and calibration
```javascript
PatternFactory.create('circle', {
    radius: 0.3,
    speed: 1.0
});
```

**Line Scanner** - Good for alignment
```javascript
PatternFactory.create('line', {
    scan: 'horizontal',
    speed: 0.5
});
```

### Medium Complexity

**Spiral** - Hypnotic effect
```javascript
PatternFactory.create('spiral', {
    turns: 3,
    expansion: 0.15,
    speed: 1.5
});
```

**Star** - Dynamic shape morphing
```javascript
PatternFactory.create('star', {
    points: 5,
    innerRadius: 0.2,
    outerRadius: 0.4
});
```

### Complex Patterns

**Grid Sequencer** - Matrix effects
```javascript
PatternFactory.create('grid', {
    rows: 4,
    cols: 4,
    speed: 2.0
});
```

## Testing Patterns

### Unit Tests

```javascript
// test/patterns.test.js
import { expect } from 'chai';
import { PatternFactory } from '../patterns/geometric-patterns.js';

describe('Circle Pattern', () => {
    it('should generate valid positions', () => {
        const pattern = PatternFactory.create('circle');
        const frame = pattern.generate(0, {});
        
        expect(frame.position.x).to.be.within(0, 1);
        expect(frame.position.y).to.be.within(0, 1);
    });
    
    it('should complete full circle', () => {
        const pattern = PatternFactory.create('circle');
        const start = pattern.generate(0, { speed: 1 });
        const end = pattern.generate(2000 * Math.PI, { speed: 1 });
        
        expect(start.position.x).to.be.closeTo(end.position.x, 0.01);
        expect(start.position.y).to.be.closeTo(end.position.y, 0.01);
    });
});
```

### Visual Testing

Use the Pattern Editor for visual testing:

```bash
# Launch editor
dmx pattern

# Select pattern and adjust parameters
# Save successful configurations
```

## Contributing

We welcome new pattern contributions! Please:

1. Follow the pattern template structure
2. Include parameter documentation
3. Add unit tests
4. Provide usage examples
5. Test with Pattern Editor
6. Submit PR with demo video/gif if possible

## Resources

- [DMX512 Protocol](https://en.wikipedia.org/wiki/DMX512)
- [Laser Safety](https://www.ilda.com/safety.htm)
- [Mathematical Animations](https://www.mathsisfun.com/geometry/animations.html)
- [Parametric Equations](https://en.wikipedia.org/wiki/Parametric_equation)

---

*Part of the DMX Laser Control System v3.0*