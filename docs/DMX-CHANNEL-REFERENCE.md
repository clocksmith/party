# DMX Channel Reference Guide

> Complete channel-by-channel documentation for DMX laser control

## Table of Contents

- [Understanding DMX Channels](#understanding-dmx-channels)
- [Ehaho L2400 Complete Reference](#ehaho-l2400-complete-reference)
- [Generic Laser Reference](#generic-laser-reference)
- [Channel Interactions](#channel-interactions)
- [Visual Examples](#visual-examples)
- [Troubleshooting](#troubleshooting)
- [Quick Reference](#quick-reference)

---

## Understanding DMX Channels

### What is a DMX Channel?

A DMX channel is a single control parameter that accepts values from 0-255. Think of it like a slider on a mixing board - each channel controls one aspect of your laser.

### Value Ranges

DMX channels use different value range patterns:

| Range Pattern | Meaning | Example |
|--------------|---------|---------|
| **0** | Off/Disabled | Strobe off, effect disabled |
| **0-127** | Low/Static range | Static position, slow speed |
| **128-255** | High/Dynamic range | Dynamic effects, fast speed |
| **0-63, 64-127, 128-191, 192-255** | Four modes | Small, Medium, Large, X-Large |
| **Specific value** | Enum option | CH3 = 0 for Beam, 240 for Animation |

### Channel Types

This system uses three channel types:

1. **Range** - Continuous 0-255 value (e.g., position, color)
2. **Enum** - Discrete modes/options (e.g., gallery selection)
3. **Boolean** - On/Off (e.g., enable second pattern)

---

## Ehaho L2400 Complete Reference

The Ehaho L2400 is a 32-channel RGB 3D Animation Laser with dual-pattern support.

### Device Setup Channels

#### CH1 - Operating Mode ⚙️

**Controls laser output and main operating mode**

| Value | Mode | Description |
|-------|------|-------------|
| **0** | Off | Laser completely disabled |
| **1-99** | DMX Manual | Full DMX control (YOU control everything) |
| **100-199** | Sound Activated | Laser responds to music/audio input |
| **200-255** | Auto Mode | Built-in automatic programs |

**💡 Best Practice:** Always use **50** (middle of DMX Manual range) for full control

**⚠️ Important:** Must be in DMX Manual mode for channel control to work!

---

#### CH3 - Gallery Selection 🎨

**Choose between two pattern libraries**

| Value | Gallery | Contains |
|-------|---------|----------|
| **0-127** | Beam Gallery | Geometric beams and lines |
| **128-255** | Animation Gallery | Complex animations and effects |

**Common Values:**
- `0` - Beam gallery
- `200` - Animation gallery

**💡 Tip:** Beam gallery is better for clean geometric shapes, Animation for complex effects

---

### Pattern 1 Controls (Primary Layer)

#### CH4 - Pattern Selection 📐

**Select which pattern to display (0-255)**

Values are device-specific. Common patterns:
- `10-30` - Basic shapes (circles, squares)
- `40-60` - Geometric patterns
- `70-90` - Complex patterns
- `100+` - Animations

**💡 Discovery:** Use `dmx discover` command to map your device's patterns

---

#### CH2 - Pattern Size 📏

**Control the overall size of Pattern 1**

| Value | Size | Visual Effect |
|-------|------|---------------|
| **0-63** | Small | Tight, focused pattern |
| **64-127** | Medium | Standard size |
| **128-191** | Large | Expanded pattern |
| **192-255** | Extra Large | Maximum size |

**Common Values:**
- `32` - Small and tight
- `96` - Medium (balanced)
- `160` - Large
- `224` - Extra large

---

#### CH5 - Zoom Effect 🔍

**Static zoom or dynamic zoom animations**

| Value | Mode | Effect |
|-------|------|--------|
| **0-127** | Static | Fixed zoom level (0=small, 127=large) |
| **128-159** | Zoom In | Continuously zooms in |
| **160-191** | Zoom Out | Continuously zooms out |
| **192-255** | Flip Zoom | Alternates between in/out |

**Common Values:**
- `64` - Static medium zoom
- `140` - Smooth zoom in
- `175` - Smooth zoom out
- `220` - Flip zoom effect

**💡 Tip:** Use static values for precise control, dynamic for animated effects

---

#### CH6 - Rotation 🔄

**Pattern rotation control**

| Value | Mode | Effect |
|-------|------|--------|
| **0-127** | Static | Fixed rotation angle (0=0°, 127=180°) |
| **128-191** | Clockwise | Rotating clockwise (speed increases) |
| **192-255** | Counter-clockwise | Rotating CCW (speed increases) |

**Common Values:**
- `0` - No rotation
- `64` - 90° rotation
- `160` - Slow clockwise
- `220` - Fast counter-clockwise

---

#### CH7 - Horizontal Movement ↔️

**X-axis position and movement effects**

| Value | Mode | Effect |
|-------|------|--------|
| **0-127** | Static | Fixed X position (0=left, 64=center, 127=right) |
| **128-159** | Wave Left | Sine wave moving left |
| **160-191** | Wave Right | Sine wave moving right |
| **192-223** | Move Left | Continuous left movement |
| **224-255** | Move Right | Continuous right movement |

**Position Guide (Static mode):**
- `0` - Far left
- `32` - Left quarter
- `64` - Center
- `96` - Right quarter
- `127` - Far right

**Movement Guide:**
- `140` - Gentle wave left
- `175` - Gentle wave right
- `200` - Slow move left
- `240` - Fast move right

---

#### CH8 - Vertical Movement ↕️

**Y-axis position and movement effects**

| Value | Mode | Effect |
|-------|------|--------|
| **0-127** | Static | Fixed Y position (0=bottom, 64=center, 127=top) |
| **128-159** | Wave Up | Sine wave moving up |
| **160-191** | Wave Down | Sine wave moving down |
| **192-223** | Move Up | Continuous upward movement |
| **224-255** | Move Down | Continuous downward movement |

**Position Guide (Static mode):**
- `0` - Bottom
- `32` - Lower quarter
- `64` - Center (most common)
- `96` - Upper quarter
- `127` - Top

---

#### CH9 - Horizontal Zoom/Stretch 📊

**Stretch or compress pattern on X-axis (0-255)**

| Value | Effect |
|-------|--------|
| **0** | Maximum horizontal compression (narrow) |
| **128** | Normal proportions (1:1) |
| **255** | Maximum horizontal stretch (wide) |

**💡 Tip:** 128 is neutral - values below compress, values above stretch

---

#### CH10 - Vertical Zoom/Stretch 📊

**Stretch or compress pattern on Y-axis (0-255)**

| Value | Effect |
|-------|--------|
| **0** | Maximum vertical compression (flat) |
| **128** | Normal proportions (1:1) |
| **255** | Maximum vertical stretch (tall) |

---

#### CH11 - Forced Color 🎨

**Override pattern's default color**

| Value | Color | RGB |
|-------|-------|-----|
| **0** | Original | Pattern's default color |
| **1-31** | Red | Pure red |
| **32-63** | Green | Pure green |
| **64-95** | Blue | Pure blue |
| **96-127** | Yellow | Red + Green |
| **128-159** | Cyan | Green + Blue |
| **160-191** | Magenta | Red + Blue |
| **192-223** | White | All colors |
| **224-255** | Color Cycle | Automatic color changing |

**Common Values:**
- `0` - Use pattern's color
- `16` - Bright red
- `48` - Bright green
- `80` - Bright blue
- `240` - Smooth color cycle

---

#### CH12 - Strobe/Flash ⚡

**Strobing and flash effects**

| Value | Mode | Effect |
|-------|------|--------|
| **0** | Off | Solid output, no strobe |
| **1-63** | Slow Strobe | Gentle flashing |
| **64-127** | Medium Strobe | Moderate flashing |
| **128-191** | Fast Strobe | Rapid flashing |
| **192-223** | Random Flash | Irregular flashing |
| **224-255** | Sound Strobe | Flash to music |

**⚠️ Warning:** Fast strobe (128+) can trigger photosensitivity - use with caution!

---

#### CH13 - Node Highlighting 💎

**Emphasize pattern vertices/points (0-255)**

| Value | Effect |
|-------|--------|
| **0** | Normal rendering |
| **1-127** | Brighten nodes/vertices |
| **128-255** | Broken lines effect |

**💡 Use Case:** Make geometric patterns show corner points more prominently

---

#### CH14 - Node Expansion 🌟

**Draw pattern point-by-point (0-255)**

| Value | Effect |
|-------|--------|
| **0** | Full pattern visible |
| **1-254** | Partial pattern (draw animation) |
| **255** | Fully contracted/hidden |

**💡 Use Case:** Create "drawing" effects where pattern appears gradually

---

#### CH15 - Gradual Drawing ✏️

**Draw/erase pattern over time**

| Value | Mode | Effect |
|-------|------|--------|
| **0** | Off | Full pattern visible |
| **1-127** | Forward Draw | Pattern draws from start to end |
| **128-255** | Reverse Draw | Pattern erases from end to start |

**💡 Combine with CH14** for advanced drawing effects

---

#### CH16 - Distortion Degree 1 🌀

**Primary warping/distortion intensity (0-255)**

| Value | Effect |
|-------|--------|
| **0** | No distortion |
| **128** | Medium distortion |
| **255** | Maximum distortion |

---

#### CH17 - Distortion Degree 2 🌊

**Secondary warping/distortion intensity (0-255)**

Works in combination with CH16 for complex distortion effects.

---

### Dual Pattern Mode (Pattern 2)

#### CH18 - Enable Second Pattern 🔛

**Activate Pattern 2 layer**

| Value | State |
|-------|-------|
| **0** | Single pattern (CH1-17 only) |
| **1-255** | Dual patterns (CH19-32 active) |

**💡 Tip:** Set to 128 to enable Pattern 2

---

#### CH19-32 - Pattern 2 Controls

When CH18 is enabled, channels 19-32 provide similar controls for Pattern 2:

| Channel | Function | Equivalent to |
|---------|----------|---------------|
| **CH19** | Pattern 2 Size | CH2 |
| **CH20** | Pattern 2 Gallery | CH3 |
| **CH21** | Pattern 2 Selection | CH4 |
| **CH22** | Pattern 2 Zoom | CH5 |
| **CH23** | Pattern 2 Rotation | CH6 |
| **CH24** | Pattern 2 Horizontal Movement | CH7 |
| **CH25** | Pattern 2 Vertical Movement | CH8 |
| **CH26** | Horizontal Flip | NEW |
| **CH27** | Vertical Flip | NEW |
| **CH28** | Pattern 2 Forced Color | CH11 |
| **CH29** | Global Color Change | Master color |
| **CH30** | Pattern 2 Node Highlight | CH13 + Array mode |
| **CH31** | Pattern 2 Node Expansion | CH14 |
| **CH32** | Pattern 2 Gradual Drawing | CH15 |

---

#### CH26 - Horizontal Flip (Pattern 2)

| Value | State |
|-------|-------|
| **0** | Normal |
| **128-255** | Flipped horizontally |

---

#### CH27 - Vertical Flip (Pattern 2)

| Value | State |
|-------|-------|
| **0** | Normal |
| **128-255** | Flipped vertically |

---

#### CH29 - Global Color Change 🌈

**Master color control affecting both patterns**

| Value | Mode |
|-------|------|
| **0** | Original colors |
| **1-31** | Red |
| **32-63** | Green |
| **64-95** | Blue |
| **96-127** | Yellow |
| **128-159** | Cyan |
| **160-191** | Magenta |
| **192-223** | White |
| **224-239** | Dynamic color cycle |
| **240-255** | Color movement effect |

---

#### CH30 - Node Highlight 2 (Advanced) ✨

**Special feature: Array Mode**

| Value | Effect |
|-------|--------|
| **0** | Normal |
| **128** | Highlight nodes |
| **200** | **Array Mode** - copies Pattern 1 onto Pattern 2's vertices |

**💡 Array Mode:** Creates complex effects by projecting Pattern 1 at each node of Pattern 2

---

## Generic Laser Reference

For lasers using the generic profile:

### Key Differences from Ehaho L2400

| Feature | Generic | Ehaho L2400 |
|---------|---------|-------------|
| **Color Control** | CH11-14 (RGBW direct) | CH11 (forced color enum) |
| **Position** | CH22-25 (direct position) | CH7-8 (movement modes) |
| **Gallery** | CH3 (beam/animation) | CH3 (same) |
| **Dual Pattern** | CH18 (pattern 2) | CH18 (enable) + CH19-32 |

### Generic CH11-14: Direct RGB Color Control

Unlike Ehaho's forced color enum, generic lasers often have:

- **CH11** - Red (0-255)
- **CH12** - Green (0-255)
- **CH13** - Blue (0-255)
- **CH14** - White (0-255, if supported)

**Example:**
```javascript
// Pure red
CH11 = 255, CH12 = 0, CH13 = 0

// Purple
CH11 = 255, CH12 = 0, CH13 = 255

// Orange
CH11 = 255, CH12 = 128, CH13 = 0
```

---

## Channel Interactions

### Critical Interactions

#### 1. CH1 must be in DMX mode for control
```
CH1 = 0-99 (DMX Manual) → Channels 2-32 respond to your commands
CH1 = 100+ → Channels ignored, device uses internal programs
```

#### 2. CH18 enables Pattern 2 controls
```
CH18 = 0 → Channels 19-32 ignored
CH18 = 1-255 → Channels 19-32 active
```

#### 3. Gallery affects available patterns
```
CH3 = 0-127 (Beam) → CH4 selects from beam patterns
CH3 = 128-255 (Animation) → CH4 selects from animation patterns
```

### Common Channel Combinations

#### Static Centered Pattern
```javascript
CH1 = 50        // DMX manual
CH3 = 0         // Beam gallery
CH4 = 20        // Circle pattern
CH7 = 64        // Center X
CH8 = 64        // Center Y
CH11 = 16       // Red color
```

#### Moving Wave Effect
```javascript
CH1 = 50        // DMX manual
CH4 = 50        // Wave pattern
CH6 = 160       // Slow rotation
CH7 = 140       // Wave left
CH11 = 80       // Blue color
```

#### Dual Pattern Overlay
```javascript
// Pattern 1 (background)
CH1 = 50        // DMX manual
CH3 = 200       // Animation
CH4 = 30        // Large pattern
CH11 = 48       // Green

// Pattern 2 (foreground)
CH18 = 128      // Enable pattern 2
CH20 = 0        // Beam gallery
CH21 = 10       // Small pattern
CH28 = 16       // Red
```

#### Array Effect (Advanced)
```javascript
// Pattern 2 as grid
CH18 = 128      // Enable pattern 2
CH21 = 80       // Grid pattern
CH28 = 0        // Original color

// Pattern 1 arrayed on grid points
CH4 = 20        // Circle
CH11 = 16       // Red
CH30 = 200      // Array mode!
```

---

## Visual Examples

### Pattern Size Comparison (CH2)

```
CH2 = 32 (Small)       CH2 = 96 (Medium)      CH2 = 160 (Large)

     ○                      ●                      ⬤
```

### Rotation Effect (CH6)

```
CH6 = 0 (Static 0°)    CH6 = 64 (Static 90°)  CH6 = 160 (Rotating)

    ▭                       |                      ⟳
                            ▭                      ▭
```

### Horizontal Movement (CH7)

```
CH7 = 0 (Left)         CH7 = 64 (Center)      CH7 = 127 (Right)

●                           ●                              ●
```

```
CH7 = 140 (Wave)       CH7 = 200 (Moving)

 ↝ ● ↜                 ● → → →
```

### Color Examples (CH11)

```
CH11 = 16 (Red)        CH11 = 48 (Green)      CH11 = 80 (Blue)
CH11 = 112 (Yellow)    CH11 = 144 (Cyan)      CH11 = 176 (Magenta)
```

### Dual Pattern Example

```
Pattern 1 (CH4 = 30):          Pattern 2 (CH21 = 10):       Combined:

        ●─●                           ▢                         ●─●
       ●   ●                                                   ● ▢ ●
        ●─●                                                     ●─●
```

---

## Troubleshooting

### Laser Not Responding to DMX

**Check:**
1. ✅ CH1 set to DMX Manual mode (1-99, recommend 50)
2. ✅ DMX address matches device setting
3. ✅ DMX cable connected
4. ✅ Device powered on

**Test:**
```javascript
// Minimal test
CH1 = 50    // DMX mode
CH4 = 10    // Simple pattern
CH11 = 16   // Red
```

---

### Pattern Not Visible

**Check:**
1. ✅ CH4 is not 0
2. ✅ CH3 gallery matches pattern type
3. ✅ CH7/CH8 position is on-screen (try 64/64 for center)
4. ✅ CH2 size is not too small (try 96)
5. ✅ Not in blackout (CH12 = 0)

**Test:**
```javascript
CH1 = 50    // DMX mode
CH2 = 96    // Medium size
CH3 = 0     // Beam gallery
CH4 = 20    // Known good pattern
CH7 = 64    // Center X
CH8 = 64    // Center Y
CH11 = 208  // White
CH12 = 0    // No strobe
```

---

### Pattern Moving Erratically

**Likely cause:** CH7 or CH8 in dynamic range (128+)

**Fix:**
```javascript
CH7 = 64    // Static center X
CH8 = 64    // Static center Y
```

---

### Wrong Color

**Check:**
1. ✅ CH11 forced color is set correctly
2. ✅ CH29 global color is not overriding (set to 0)
3. ✅ For generic lasers: CH11-13 RGB values

**Test:**
```javascript
// Ehaho: Use forced color
CH11 = 16   // Red
CH29 = 0    // No global override

// Generic: Direct RGB
CH11 = 255  // R
CH12 = 0    // G
CH13 = 0    // B
```

---

### Pattern 2 Not Working

**Check:**
1. ✅ CH18 is enabled (set to 128)
2. ✅ CH20 gallery set correctly
3. ✅ CH21 pattern is not 0

**Test:**
```javascript
CH1 = 50     // DMX mode
CH18 = 128   // Enable pattern 2!
CH20 = 0     // Beam gallery
CH21 = 30    // Pattern select
CH28 = 48    // Green
```

---

### Distortion/Warping Issues

**Reset distortion channels:**
```javascript
CH9 = 128    // No horizontal stretch
CH10 = 128   // No vertical stretch
CH16 = 0     // No distortion 1
CH17 = 0     // No distortion 2
```

---

### Strobe Too Fast/Seizure Risk

**Disable or slow down:**
```javascript
CH12 = 0     // Strobe off
// OR
CH12 = 32    // Very slow strobe
```

**⚠️ Never use CH12 > 128 without warning!**

---

## Quick Reference

### Channel Cheat Sheet (Ehaho L2400)

| Ch | Name | Quick Values | Purpose |
|----|------|--------------|---------|
| 1 | Mode | 50 = DMX | Enable control |
| 2 | Size 1 | 32/96/160/224 | Small/Med/Large/XL |
| 3 | Gallery | 0 = Beam, 200 = Anim | Pattern library |
| 4 | Pattern 1 | 0-255 | Select pattern |
| 5 | Zoom 1 | 64 = static, 140 = in | Zoom effect |
| 6 | Rotation 1 | 0 = none, 160 = CW | Rotate |
| 7 | H-Move 1 | 64 = center, 140 = wave | X position |
| 8 | V-Move 1 | 64 = center | Y position |
| 9 | H-Zoom 1 | 128 = normal | X stretch |
| 10 | V-Zoom 1 | 128 = normal | Y stretch |
| 11 | Color 1 | 16=R, 48=G, 80=B | Force color |
| 12 | Strobe | 0 = off, 32 = slow | Flash effect |
| 13 | Node HL 1 | 0 = normal | Highlight points |
| 14 | Node Exp 1 | 0 = full | Draw animation |
| 15 | Draw 1 | 0 = off | Gradual draw |
| 16 | Distort 1 | 0 = none | Warp effect |
| 17 | Distort 2 | 0 = none | Warp effect 2 |
| 18 | Enable P2 | 128 = on | Activate layer 2 |
| 19 | Size 2 | 96 = medium | Pattern 2 size |
| 20 | Gallery 2 | 0 = beam | Pattern 2 library |
| 21 | Pattern 2 | 0-255 | Select pattern 2 |
| 22 | Zoom 2 | 64 = static | Zoom effect 2 |
| 23 | Rotation 2 | 0 = none | Rotate 2 |
| 24 | H-Move 2 | 64 = center | X position 2 |
| 25 | V-Move 2 | 64 = center | Y position 2 |
| 26 | H-Flip | 0 = normal | Mirror X |
| 27 | V-Flip | 0 = normal | Mirror Y |
| 28 | Color 2 | 16=R, 48=G, 80=B | Force color 2 |
| 29 | Global Color | 0 = original | Master color |
| 30 | Node HL 2 | 200 = array | Array effect! |
| 31 | Node Exp 2 | 0 = full | Draw animation 2 |
| 32 | Draw 2 | 0 = off | Gradual draw 2 |

---

### Safe Starting Values (Ehaho L2400)

Copy-paste this for a clean starting point:

```javascript
{
  "1": 50,     // DMX manual mode
  "2": 96,     // Medium size
  "3": 0,      // Beam gallery
  "4": 20,     // Simple pattern
  "5": 64,     // Static zoom
  "6": 0,      // No rotation
  "7": 64,     // Center X
  "8": 64,     // Center Y
  "9": 128,    // No H-stretch
  "10": 128,   // No V-stretch
  "11": 16,    // Red
  "12": 0,     // No strobe
  "13": 0,     // Normal nodes
  "14": 0,     // Full pattern
  "15": 0,     // No drawing effect
  "16": 0,     // No distortion
  "17": 0,     // No distortion
  "18": 0,     // Single pattern only
  "19": 0,
  "20": 0,
  "21": 0,
  "22": 0,
  "23": 0,
  "24": 0,
  "25": 0,
  "26": 0,
  "27": 0,
  "28": 0,
  "29": 0,     // No global color
  "30": 0,
  "31": 0,
  "32": 0
}
```

---

### Runtime Control Examples

#### Using the DMX Controller API

```javascript
import { DMXController, DMXSerialInterface } from './dmx.js';

// Setup
const serial = new DMXSerialInterface({
  portPath: '/dev/tty.usbserial'
});
const controller = new DMXController({
  serialInterface: serial
});

await controller.connect();

// Simple red circle in center
controller.updateChannels({
  1: 50,    // DMX mode
  4: 20,    // Circle pattern
  7: 64,    // Center X
  8: 64,    // Center Y
  11: 16    // Red
});

// Animate: rotating spiral
controller.updateChannels({
  4: 60,    // Spiral pattern
  6: 160,   // Rotate clockwise
  11: 80    // Blue
});

// Dual patterns
controller.updateChannels({
  4: 30,    // Pattern 1
  11: 48,   // Green
  18: 128,  // Enable pattern 2
  21: 50,   // Pattern 2
  28: 16    // Red
});
```

---

### Color Reference

#### Ehaho Forced Colors (CH11, CH28)

| Value | Color | Use Case |
|-------|-------|----------|
| 0 | Original | Default pattern colors |
| 16 | Red | Energy, urgency |
| 48 | Green | Nature, calm |
| 80 | Blue | Cool, tech |
| 112 | Yellow | Warm, happy |
| 144 | Cyan | Modern, digital |
| 176 | Magenta | Creative, bold |
| 208 | White | Clean, bright |
| 240 | Cycling | Dynamic, party |

#### Generic RGB (CH11-13)

```javascript
// Primary colors
Red:     { 11: 255, 12: 0,   13: 0 }
Green:   { 11: 0,   12: 255, 13: 0 }
Blue:    { 11: 0,   12: 0,   13: 255 }

// Secondary colors
Yellow:  { 11: 255, 12: 255, 13: 0 }
Cyan:    { 11: 0,   12: 255, 13: 255 }
Magenta: { 11: 255, 12: 0,   13: 255 }

// Common colors
Orange:  { 11: 255, 12: 128, 13: 0 }
Purple:  { 11: 128, 12: 0,   13: 255 }
Pink:    { 11: 255, 12: 64,  13: 128 }
White:   { 11: 255, 12: 255, 13: 255 }
```

---

## Advanced Techniques

### 1. Creating Wave Patterns

Combine movement channels:

```javascript
// Horizontal wave
CH7 = 140   // Wave left
CH8 = 64    // Center Y

// Vertical wave
CH7 = 64    // Center X
CH8 = 140   // Wave up

// Circular wave (both)
CH7 = 140   // Wave left
CH8 = 140   // Wave up
```

### 2. Layered Patterns

Use dual patterns with different speeds:

```javascript
// Slow background
CH4 = 60    // Large pattern
CH6 = 130   // Very slow rotation
CH11 = 80   // Blue

// Fast foreground
CH18 = 128  // Enable
CH21 = 20   // Small pattern
CH23 = 220  // Fast rotation
CH28 = 16   // Red
```

### 3. Array Effects

Project patterns onto other patterns:

```javascript
// Grid base (Pattern 2)
CH18 = 128
CH21 = 80   // Grid pattern
CH28 = 48   // Green

// Pattern projected at each grid point (Pattern 1)
CH4 = 10    // Small circle
CH11 = 16   // Red
CH30 = 200  // Array mode!
```

### 4. Color Transitions

Smooth color changes:

```javascript
// Start: Red
CH11 = 16

// Wait 2 seconds...

// Transition: Orange
CH11 = 112

// Wait 2 seconds...

// End: Yellow
CH11 = 112

// OR use color cycle
CH11 = 240  // Automatic smooth cycling
```

---

## See Also

- [Device Profile Guide](../device-profiles/README.md)
- [Pattern Animator Guide](../pattern-animator/README.md)
- [DMX Protocol Reference](DMX-PROTOCOL.md)
- [API Documentation](../README-UPDATED.md)

---

**Last Updated:** 2025-01-07
**Document Version:** 1.0.0
**Applies to:** DMX Laser Control System v3.0
