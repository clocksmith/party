# 📋 DMX Quick Reference Card

> One-page cheat sheet for Ehaho L2400 laser control

## Essential Channels

| Ch | Function | Quick Values | Notes |
|:--:|----------|--------------|-------|
| **1** | **Mode** | `50` = DMX Control | ⚠️ MUST be set for control |
| **3** | **Gallery** | `0` = Beam, `200` = Animation | Choose pattern library |
| **4** | **Pattern** | `0-255` device-specific | Select what to show |
| **7** | **X Position** | `0`=Left, `64`=Center, `127`=Right | Horizontal position |
| **8** | **Y Position** | `0`=Bottom, `64`=Center, `127`=Top | Vertical position |
| **11** | **Color** | `16`=R, `48`=G, `80`=B, `240`=Cycle | Force color |

## Safe Defaults (Copy These!)

```javascript
{
  "1": 50,   "2": 96,   "3": 0,    "4": 20,   "5": 64,   "6": 0,
  "7": 64,   "8": 64,   "9": 128,  "10": 128, "11": 16,  "12": 0,
  "13": 0,   "14": 0,   "15": 0,   "16": 0,   "17": 0,   "18": 0
}
```

## Complete Channel Map

### Pattern 1 (Primary)

| Ch | Control | Values | Effect |
|----|---------|--------|--------|
| 1 | Mode | `0`=Off, `1-99`=DMX, `100-199`=Sound, `200+`=Auto | Operation mode |
| 2 | Size | `0-63`=S, `64-127`=M, `128-191`=L, `192+`=XL | Pattern size |
| 3 | Gallery | `0-127`=Beam, `128-255`=Animation | Pattern library |
| 4 | Pattern | `0-255` | Pattern selection |
| 5 | Zoom | `0-127`=Static, `128-159`=In, `160-191`=Out, `192+`=Flip | Zoom effect |
| 6 | Rotation | `0-127`=Static, `128-191`=CW, `192+`=CCW | Rotation |
| 7 | H-Move | `0-127`=Pos, `128-159`=WaveL, `160-191`=WaveR, `192-223`=Left, `224+`=Right | X movement |
| 8 | V-Move | `0-127`=Pos, `128-159`=WaveUp, `160-191`=WaveDown, `192-223`=Up, `224+`=Down | Y movement |
| 9 | H-Stretch | `0`=Narrow, `128`=Normal, `255`=Wide | X stretch |
| 10 | V-Stretch | `0`=Flat, `128`=Normal, `255`=Tall | Y stretch |
| 11 | Color | `0`=Orig, `16`=R, `48`=G, `80`=B, `112`=Y, `144`=C, `176`=M, `208`=W, `240`=Cycle | Force color |
| 12 | Strobe | `0`=Off, `1-63`=Slow, `64-127`=Med, `128-191`=Fast, `192-223`=Rand, `224+`=Sound | Flash |
| 13 | NodeHL | `0-127`=Brighten, `128-255`=Lines | Highlight nodes |
| 14 | NodeExp | `0`=Full, `255`=Hidden | Point-by-point |
| 15 | Draw | `0`=Off, `1-127`=Forward, `128-255`=Reverse | Draw effect |
| 16 | Distort1 | `0-255` | Warp intensity |
| 17 | Distort2 | `0-255` | Warp intensity 2 |

### Pattern 2 (Secondary Layer)

| Ch | Control | Note |
|----|---------|------|
| 18 | Enable | `0`=Off, `128`=On | ⚠️ Must enable for Ch19-32 |
| 19 | Size | Same as Ch2 | Pattern 2 size |
| 20 | Gallery | Same as Ch3 | Pattern 2 library |
| 21 | Pattern | Same as Ch4 | Pattern 2 selection |
| 22 | Zoom | Same as Ch5 | Pattern 2 zoom |
| 23 | Rotation | Same as Ch6 | Pattern 2 rotation |
| 24 | H-Move | Same as Ch7 | Pattern 2 X |
| 25 | V-Move | Same as Ch8 | Pattern 2 Y |
| 26 | H-Flip | `0`=Normal, `128`=Flip | Mirror X |
| 27 | V-Flip | `0`=Normal, `128`=Flip | Mirror Y |
| 28 | Color | Same as Ch11 | Pattern 2 color |
| 29 | GlobalColor | `0`=Off, `224-239`=Cycle, `240+`=Move | Master color |
| 30 | NodeHL2 | `200`=**Array Mode** | ⭐ Project P1 on P2 nodes |
| 31 | NodeExp2 | Same as Ch14 | Pattern 2 expansion |
| 32 | Draw2 | Same as Ch15 | Pattern 2 draw |

## Common Patterns

### Static Centered Circle
```javascript
{ 1:50, 3:0, 4:20, 7:64, 8:64, 11:16 }
```

### Rotating Spiral
```javascript
{ 1:50, 4:60, 6:160, 11:80 }
```

### Moving Wave
```javascript
{ 1:50, 4:50, 7:140, 11:48 }
```

### Dual Pattern (Red Circle + Green Square)
```javascript
{ 1:50, 4:10, 11:16, 18:128, 21:20, 28:48 }
```

### Array Effect (Small circles on grid)
```javascript
{ 1:50, 4:10, 11:16, 18:128, 21:80, 28:48, 30:200 }
```

## Color Codes (CH11, CH28, CH29)

| Value | Color | Hex |
|-------|-------|-----|
| 0 | Original | - |
| 16 | Red | #FF0000 |
| 48 | Green | #00FF00 |
| 80 | Blue | #0000FF |
| 112 | Yellow | #FFFF00 |
| 144 | Cyan | #00FFFF |
| 176 | Magenta | #FF00FF |
| 208 | White | #FFFFFF |
| 240 | Color Cycle | Rainbow |

## Troubleshooting

| Problem | Check | Fix |
|---------|-------|-----|
| Nothing visible | Ch1 mode | Set `Ch1 = 50` |
| Pattern off-screen | Position | Set `Ch7 = 64, Ch8 = 64` |
| Wrong color | Color override | Check `Ch11, Ch29` |
| Pattern 2 not working | Enable flag | Set `Ch18 = 128` |
| Jerky movement | Dynamic mode active | Check `Ch7, Ch8` < 128 for static |
| Strobe warning | High strobe value | Set `Ch12 = 0` or `< 64` |

## Runtime Control Code

```javascript
import { DMXController, DMXSerialInterface } from './dmx.js';

const serial = new DMXSerialInterface({ portPath: '/dev/tty.usbserial' });
const dmx = new DMXController({ serialInterface: serial });
await dmx.connect();

// Set channels
dmx.updateChannels({
  1: 50,    // DMX mode
  4: 20,    // Pattern
  7: 64,    // X center
  8: 64,    // Y center
  11: 16    // Red
});

// Or single channel
dmx.updateChannel(4, 30);  // Change pattern
```

## Profile-Based Control

```javascript
import { DynamicDeviceControl, DeviceProfileManager } from './dmx-device-control.js';

const manager = new DeviceProfileManager();
const profile = await manager.loadProfile('ehaho-l2400.json');
const device = new DynamicDeviceControl({ dmxController: dmx, profileManager: manager });
await device.loadProfile('ehaho-l2400');

// Use named channels
device.setChannelByName('mode', 50);
device.setChannelByName('pattern1', 30);
device.setChannelByName('forcedColor1', 'red');

// Apply presets
await device.applyPreset('party_mode');
```

## Safety Tips

⚠️ **Strobe Warning:** Ch12 > 128 can trigger photosensitivity
⚠️ **DMX Mode Required:** Ch1 must be 1-99 for control
⚠️ **Enable Pattern 2:** Ch18 must be > 0 for Ch19-32 to work
✅ **Safe Starting Point:** Use defaults above
✅ **Test with Ch1=50, Ch4=20, Ch7=64, Ch8=64, Ch11=16**

## Position Grid Reference

```
Y-axis (Ch8)
    127 (Top)
     ↑
     |
    96  ┌─────────┐
     |  │    ↑    │
    64  │← Center→│
     |  │    ↓    │
    32  └─────────┘
     |
     ↓
     0 (Bottom)

     0   32   64   96  127
     ←  X-axis (Ch7)  →
   Left            Right
```

## Movement Modes (Ch7, Ch8)

| Value | X (Ch7) | Y (Ch8) |
|-------|---------|---------|
| 0-127 | Static position | Static position |
| 128-159 | Wave left | Wave up |
| 160-191 | Wave right | Wave down |
| 192-223 | Move left | Move up |
| 224-255 | Move right | Move down |

---

**Quick Hotline:** If laser not responding: `Ch1=50, Ch3=0, Ch4=20, Ch7=64, Ch8=64, Ch11=16, Ch12=0`

**Full Docs:** [DMX-CHANNEL-REFERENCE.md](DMX-CHANNEL-REFERENCE.md)

**Last Updated:** 2025-01-07
