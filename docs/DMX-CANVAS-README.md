# 🎨 DMX Canvas API

> Canvas-like API for drawing parametric curves with DMX laser control

A complete drawing system that lets you animate parametric curves on DMX-controlled lasers, similar to HTML5 Canvas but outputting directly to DMX hardware at 30-60 fps.

---

## Features

✨ **Canvas-like API** - Familiar drawing methods (beginPath, lineTo, stroke, etc.)
📐 **Parametric Curves** - Draw any mathematical curve using equations
🎬 **Real-time Animation** - Smooth 30-60 fps animation loop
🎨 **Color Support** - RGB color control (device-dependent)
⚡ **Direct DMX Output** - No intermediate layers, goes straight to hardware
🔧 **Configurable** - Adjust frame rate, speed, channel mapping

---

## Quick Start

### Installation

No installation needed - just use the modules:

```javascript
import { DMXCanvas } from './dmx-canvas.js';
import * as Shapes from './dmx-shapes.js';
```

### Basic Usage

```javascript
import { DMXSerialInterface, DMXController } from './dmx.js';
import { DMXCanvas } from './dmx-canvas.js';
import * as Shapes from './dmx-shapes.js';

// 1. Setup DMX controller
const serial = new DMXSerialInterface({
    portPath: '/dev/tty.usbserial-A50285BI'
});

const dmx = new DMXController({
    serialInterface: serial,
    refreshRateMs: 33  // 30 Hz
});

await dmx.connect();

// 2. Create canvas
const canvas = new DMXCanvas(dmx, {
    width: 127,
    height: 127,
    frameRate: 30
});

// 3. Draw a circle
canvas.circle(64, 64, 30);
canvas.stroke();

// 4. Animate it!
canvas.animate();
```

---

## API Reference

### DMXCanvas

Main drawing surface that outputs to DMX hardware.

#### Constructor

```javascript
const canvas = new DMXCanvas(dmxController, options);
```

**Options:**
- `width` (number) - Canvas width in DMX coordinates (default: 127)
- `height` (number) - Canvas height in DMX coordinates (default: 127)
- `frameRate` (number) - Animation frame rate (default: 30)
- `speed` (number) - Animation speed multiplier (default: 1.0)
- `xChannel` (number) - DMX channel for X position (default: 7)
- `yChannel` (number) - DMX channel for Y position (default: 8)
- `colorRChannel` (number) - DMX channel for red (default: 11)
- `colorGChannel` (number) - DMX channel for green (default: 12)
- `colorBChannel` (number) - DMX channel for blue (default: 13)

#### Drawing Methods

```javascript
// Begin new path
canvas.beginPath();

// Move to position (no drawing)
canvas.moveTo(x, y);

// Draw line to position
canvas.lineTo(x, y);

// Draw arc
canvas.arc(cx, cy, radius, startAngle, endAngle, segments);

// Draw circle
canvas.circle(cx, cy, radius, segments);

// Draw rectangle
canvas.rect(x, y, width, height);

// Draw parametric curve
canvas.parametric(fx, fy, tStart, tEnd, samples);

// Close path
canvas.closePath();

// Execute drawing (add to animation)
canvas.stroke();
```

#### Color & Style

```javascript
// Set stroke color (RGB)
canvas.setStrokeStyle(r, g, b);
canvas.setStrokeStyle({ r: 255, g: 0, b: 0 });

// Set line width (affects size channel)
canvas.setLineWidth(width);
```

#### Animation

```javascript
// Start animation loop
canvas.animate(callback);

// Start with callback for per-frame updates
canvas.animate((time) => {
    console.log(`Frame at ${time}s`);
});

// Stop animation
canvas.stop();

// Clear all paths
canvas.clear();
```

#### Events

```javascript
canvas.on('start', () => {
    console.log('Animation started');
});

canvas.on('stop', () => {
    console.log('Animation stopped');
});

canvas.on('frame', ({ time }) => {
    console.log(`Frame: ${time}`);
});
```

---

## Parametric Curves

Parametric curves are defined by two functions: `fx(t)` and `fy(t)`, where `t` goes from 0 to 1.

### Using Built-in Shapes

```javascript
import * as Shapes from './dmx-shapes.js';

// Circle
const shape = Shapes.circle(64, 64, 30);
canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd);

// Heart
const heart = Shapes.heart(64, 64, 2);
canvas.parametric(heart.fx, heart.fy, heart.tStart, heart.tEnd);

// Spiral
const spiral = Shapes.spiral(64, 64, 5, 40, 3);
canvas.parametric(spiral.fx, spiral.fy, spiral.tStart, spiral.tEnd);
```

### Custom Parametric Curves

```javascript
// Define your own curve
const fx = (t) => 64 + 30 * Math.cos(t * Math.PI * 2);
const fy = (t) => 64 + 30 * Math.sin(t * Math.PI * 2);

canvas.beginPath();
canvas.parametric(fx, fy, 0, 1, 100);  // 100 samples
canvas.stroke();
```

### Advanced Example: Rotating Rose

```javascript
const rose = Shapes.rose(64, 64, 30, 5, 1);

canvas.setStrokeStyle(255, 0, 255);  // Magenta
canvas.beginPath();
canvas.parametric(rose.fx, rose.fy, rose.tStart, rose.tEnd, 200);
canvas.stroke();

canvas.animate((time) => {
    // Could modify shape parameters here
});
```

---

## Built-in Shapes

All available in `dmx-shapes.js`:

### Basic Shapes

| Shape | Function | Parameters |
|-------|----------|------------|
| **Circle** | `circle(cx, cy, radius)` | Center X, Y and radius |
| **Ellipse** | `ellipse(cx, cy, rx, ry)` | Center and X/Y radii |
| **Line** | `line(x1, y1, x2, y2)` | Start and end points |
| **Star** | `star(cx, cy, outer, inner, points)` | Center, radii, point count |

### Spirals & Curves

| Shape | Function | Description |
|-------|----------|-------------|
| **Spiral** | `spiral(cx, cy, r1, r2, turns)` | Archimedean spiral |
| **Rose** | `rose(cx, cy, radius, n, d)` | Rose curve (petals) |
| **Lissajous** | `lissajous(cx, cy, w, h, a, b, delta)` | Figure-8 patterns |

### Special Shapes

| Shape | Function | Description |
|-------|----------|-------------|
| **Heart** | `heart(cx, cy, size)` | Heart shape |
| **Infinity** | `infinity(cx, cy, size)` | Infinity symbol (∞) |
| **Butterfly** | `butterfly(cx, cy, size)` | Butterfly curve |
| **Figure-8** | `figure8(cx, cy, radius)` | Figure-eight |

### Waves

| Shape | Function | Description |
|-------|----------|-------------|
| **Sine Wave** | `sineWave(x, y, w, amp, freq)` | Sine wave |
| **Square Wave** | `squareWave(x, y, w, h, periods)` | Square wave |
| **Triangle Wave** | `triangleWave(x, y, w, amp, periods)` | Triangle wave |
| **Sawtooth** | `sawtoothWave(x, y, w, h, periods)` | Sawtooth wave |

### Advanced

| Shape | Function | Description |
|-------|----------|-------------|
| **Cycloid** | `cycloid(x, y, radius, rotations)` | Wheel trace curve |
| **Superellipse** | `superellipse(cx, cy, a, b, n)` | Rounded rectangles |
| **Polygonal Spiral** | `polygonalSpiral(cx, cy, r1, r2, sides)` | Spiral with straight edges |

---

## Examples

### Example 1: Simple Circle Animation

```javascript
import { DMXSerialInterface, DMXController } from './dmx.js';
import { DMXCanvas } from './dmx-canvas.js';

const serial = new DMXSerialInterface({ portPath: '/dev/ttyUSB0' });
const dmx = new DMXController({ serialInterface: serial });
await dmx.connect();

const canvas = new DMXCanvas(dmx);

// Draw red circle
canvas.setStrokeStyle(255, 0, 0);
canvas.circle(64, 64, 30);
canvas.stroke();

// Animate at 30 fps
canvas.animate();

// Stop after 10 seconds
setTimeout(() => {
    canvas.stop();
    dmx.disconnect();
}, 10000);
```

### Example 2: Multiple Shapes

```javascript
canvas.clear();

// Red circle
canvas.setStrokeStyle(255, 0, 0);
canvas.circle(40, 64, 20);
canvas.stroke();

// Green square
canvas.setStrokeStyle(0, 255, 0);
canvas.rect(54, 44, 40, 40);
canvas.stroke();

// Blue triangle
canvas.setStrokeStyle(0, 0, 255);
canvas.beginPath();
canvas.moveTo(64, 30);
canvas.lineTo(50, 50);
canvas.lineTo(78, 50);
canvas.closePath();
canvas.stroke();

canvas.animate();
// Animation will cycle through all three shapes
```

### Example 3: Custom Parametric Heart

```javascript
import * as Shapes from './dmx-shapes.js';

const heart = Shapes.heart(64, 64, 2);

canvas.setStrokeStyle(255, 0, 128);  // Pink
canvas.beginPath();
canvas.parametric(heart.fx, heart.fy, heart.tStart, heart.tEnd, 100);
canvas.stroke();

canvas.animate();
```

### Example 4: Dynamic Custom Curve

```javascript
// Animated spiral that expands and contracts
canvas.beginPath();

const fx = (t) => {
    const angle = t * Math.PI * 10;
    const radius = 10 + 20 * t;
    return 64 + radius * Math.cos(angle);
};

const fy = (t) => {
    const angle = t * Math.PI * 10;
    const radius = 10 + 20 * t;
    return 64 + radius * Math.sin(angle);
};

canvas.setStrokeStyle(0, 255, 255);
canvas.parametric(fx, fy, 0, 1, 200);
canvas.stroke();

canvas.animate();
```

### Example 5: Lissajous with Color

```javascript
import * as Shapes from './dmx-shapes.js';

// Create 3:2 Lissajous curve
const lissajous = Shapes.lissajous(64, 64, 50, 50, 3, 2, Math.PI / 2);

canvas.setStrokeStyle(0, 255, 0);  // Green
canvas.beginPath();
canvas.parametric(lissajous.fx, lissajous.fy, lissajous.tStart, lissajous.tEnd, 200);
canvas.stroke();

canvas.speed = 0.5;  // Slow animation
canvas.animate();
```

### Example 6: Rose Curve

```javascript
import * as Shapes from './dmx-shapes.js';

// 5-petal rose
const rose = Shapes.rose(64, 64, 30, 5, 1);

canvas.setStrokeStyle(255, 0, 255);  // Magenta
canvas.beginPath();
canvas.parametric(rose.fx, rose.fy, rose.tStart, rose.tEnd, 200);
canvas.stroke();

canvas.animate();
```

---

## Running Demos

### Command Line

```bash
# Run specific demo
node dmx-canvas-demo.js circle
node dmx-canvas-demo.js heart
node dmx-canvas-demo.js spiral
node dmx-canvas-demo.js butterfly

# Run all demos
node dmx-canvas-demo.js all

# List available demos
node dmx-canvas-demo.js --help
```

### Available Demos

- `circle` - Simple rotating circle
- `heart` - Animated heart shape
- `spiral` - Expanding spiral
- `lissajous` - Lissajous curve (figure-8)
- `butterfly` - Butterfly curve
- `rose` - Rose curve
- `infinity` - Infinity symbol
- `waves` - Sine wave patterns
- `star` - 5-pointed star
- `multipath` - Multiple shapes cycling
- `custom` - Custom parametric equation
- `all` - Run all demos sequentially

---

## Performance

### Frame Rates

- **Default**: 30 fps (33ms per frame)
- **Smooth**: 40 fps (25ms per frame)
- **Maximum**: 60 fps (16ms per frame)

### Optimization Tips

1. **Reduce sample points** for simple curves:
   ```javascript
   canvas.parametric(fx, fy, 0, 1, 50);  // 50 samples instead of 100
   ```

2. **Use lower frame rate** for complex animations:
   ```javascript
   const canvas = new DMXCanvas(dmx, { frameRate: 20 });
   ```

3. **Limit active paths**:
   ```javascript
   canvas.clear();  // Remove old paths before adding new ones
   ```

4. **Adjust animation speed**:
   ```javascript
   canvas.speed = 0.5;  // Half speed
   ```

---

## DMX Channel Mapping

### Default Mapping (Ehaho L2400)

| Channel | Function | Range |
|---------|----------|-------|
| 1 | Mode | 50 = DMX manual |
| 7 | X Position | 0-127 |
| 8 | Y Position | 0-127 |
| 11 | Color (forced) | 16=Red, 48=Green, 80=Blue |

### Custom Mapping

```javascript
const canvas = new DMXCanvas(dmx, {
    xChannel: 22,        // Custom X channel
    yChannel: 23,        // Custom Y channel
    colorRChannel: 11,   // Separate R channel
    colorGChannel: 12,   // Separate G channel
    colorBChannel: 13    // Separate B channel
});
```

---

## Mathematical Reference

### Parametric Curve Basics

A parametric curve is defined by:
- `x = fx(t)`
- `y = fy(t)`
- where `t` varies from 0 to 1

Example circle:
```javascript
const fx = (t) => cx + r * Math.cos(t * 2 * Math.PI);
const fy = (t) => cy + r * Math.sin(t * 2 * Math.PI);
```

### Common Equations

**Ellipse:**
```javascript
fx: (t) => cx + a * Math.cos(t * 2π)
fy: (t) => cy + b * Math.sin(t * 2π)
```

**Spiral:**
```javascript
fx: (t) => cx + t * r * Math.cos(t * turns * 2π)
fy: (t) => cy + t * r * Math.sin(t * turns * 2π)
```

**Lissajous:**
```javascript
fx: (t) => cx + a * Math.sin(A * t * 2π + δ)
fy: (t) => cy + b * Math.sin(B * t * 2π)
```

---

## Troubleshooting

### Laser not moving

**Check:**
1. DMX controller connected: `dmx.isConnected()`
2. Mode channel set to DMX: Channel 1 = 50
3. Animation started: `canvas.animate()`
4. Paths exist: `canvas.activePaths.length > 0`

**Fix:**
```javascript
// Reinitialize
canvas.clear();
canvas.circle(64, 64, 30);
canvas.stroke();
canvas.animate();
```

### Jerky animation

**Cause:** Frame rate too high or DMX refresh too slow

**Fix:**
```javascript
const canvas = new DMXCanvas(dmx, {
    frameRate: 20  // Lower frame rate
});

const dmx = new DMXController({
    serialInterface: serial,
    refreshRateMs: 33  // 30 Hz
});
```

### Colors not working

**Check:**
- Using correct color channel mapping for your device
- Color values in valid range (0-255)

**For Ehaho L2400:**
```javascript
// Use single forced color channel
const canvas = new DMXCanvas(dmx, {
    colorRChannel: 11,
    colorGChannel: 11,  // Same as R
    colorBChannel: 11   // Same as R
});
```

**For Generic RGB:**
```javascript
// Use separate RGB channels
const canvas = new DMXCanvas(dmx, {
    colorRChannel: 11,
    colorGChannel: 12,
    colorBChannel: 13
});
```

---

## Advanced Usage

### Custom Animation Callback

```javascript
canvas.animate((time) => {
    // Called every frame
    const state = canvas.getState();

    // Dynamic speed changes
    if (time > 5 && time < 10) {
        canvas.speed = 2.0;  // Speed up
    } else {
        canvas.speed = 1.0;
    }

    // Add new shapes dynamically
    if (Math.floor(time) % 5 === 0) {
        console.log('5 seconds elapsed');
    }
});
```

### Multiple Simultaneous Canvases

```javascript
const canvas1 = new DMXCanvas(dmx, { startAddress: 1 });
const canvas2 = new DMXCanvas(dmx, { startAddress: 33 });

// Control two fixtures independently
canvas1.circle(64, 64, 30);
canvas1.stroke();

canvas2.circle(64, 64, 20);
canvas2.stroke();

canvas1.animate();
canvas2.animate();
```

---

## API Compatibility

✅ Works with:
- Ehaho L2400 (32 channels)
- Generic RGB lasers
- Any DMX512 device with X/Y position channels

⚠️ Requires:
- Node.js 16+
- Serial port access
- DMX interface (ENTTEC, FTDI, etc.)

---

## License

MIT License - See LICENSE file

---

## Credits

Part of the DMX Laser Control System v3.0

Built with ❤️ for creative laser control
