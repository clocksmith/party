/**
 * DMX Channel Helper API
 *
 * Simplified, type-safe helpers for controlling DMX channels.
 * Each helper validates input and maps to the correct DMX value.
 *
 * Usage:
 *   const laser = new LaserHelper(dmxController);
 *   laser.mode('dmx');              // String enum
 *   laser.pattern1(42);             // Number (0-255)
 *   laser.position(0.5, 0.5);       // Normalized floats (0-1)
 *   laser.color('red');             // String color name
 *   laser.enablePattern2(true);     // Boolean
 */

/**
 * Base helper class with validation utilities
 */
class DMXChannelHelper {
    constructor(dmxController, startAddress = 1) {
        this.dmx = dmxController;
        this.startAddress = startAddress;
    }

    /**
     * Set a DMX channel value
     * @private
     */
    _setChannel(relativeChannel, value) {
        const absoluteChannel = this.startAddress + relativeChannel - 1;
        this.dmx.updateChannel(absoluteChannel, Math.round(Math.max(0, Math.min(255, value))));
    }

    /**
     * Set multiple DMX channels
     * @private
     */
    _setChannels(updates) {
        const absoluteUpdates = {};
        for (const [relCh, value] of Object.entries(updates)) {
            const ch = parseInt(relCh);
            absoluteUpdates[this.startAddress + ch - 1] = Math.round(Math.max(0, Math.min(255, value)));
        }
        this.dmx.updateChannels(absoluteUpdates);
    }

    /**
     * Clamp value to 0-255
     * @private
     */
    _clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    /**
     * Map 0-1 normalized value to 0-255
     * @private
     */
    _normalize(value) {
        return this._clamp(value * 255);
    }

    /**
     * Map -1 to 1 range to 0-255 (center at 128)
     * @private
     */
    _bipolar(value) {
        return this._clamp((value + 1) * 127.5);
    }
}

/**
 * Ehaho L2400 Laser Helper
 * Type-safe helpers for all 32 channels
 */
export class EhahoL2400Helper extends DMXChannelHelper {
    constructor(dmxController, startAddress = 1) {
        super(dmxController, startAddress);
    }

    // ============================================================
    // CH1 - MODE
    // ============================================================

    /**
     * Set operating mode
     * @param {string|number} mode - 'off'|'dmx'|'sound'|'auto' OR 0-255
     * @returns {number} The DMX value set
     */
    mode(mode) {
        const modeMap = {
            'off': 0,
            'dmx': 50,
            'dmx_manual': 50,
            'sound': 150,
            'sound_activated': 150,
            'auto': 220,
            'auto_mode': 220
        };

        const value = typeof mode === 'string' ? modeMap[mode.toLowerCase()] || 50 : mode;
        this._setChannel(1, value);
        return value;
    }

    // ============================================================
    // CH2 - PATTERN SIZE 1
    // ============================================================

    /**
     * Set Pattern 1 size
     * @param {string|number} size - 'small'|'medium'|'large'|'xlarge' OR 0-255
     * @returns {number} The DMX value set
     */
    size1(size) {
        const sizeMap = {
            'small': 32,
            's': 32,
            'medium': 96,
            'med': 96,
            'm': 96,
            'large': 160,
            'l': 160,
            'xlarge': 224,
            'xl': 224,
            'extra_large': 224
        };

        const value = typeof size === 'string' ? sizeMap[size.toLowerCase()] || 96 : size;
        this._setChannel(2, value);
        return value;
    }

    // ============================================================
    // CH3 - GALLERY SELECTION
    // ============================================================

    /**
     * Select gallery (pattern library)
     * @param {string|number} gallery - 'beam'|'animation' OR 0-255
     * @returns {number} The DMX value set
     */
    gallery(gallery) {
        const galleryMap = {
            'beam': 0,
            'animation': 200,
            'anim': 200
        };

        const value = typeof gallery === 'string' ? galleryMap[gallery.toLowerCase()] || 0 : gallery;
        this._setChannel(3, value);
        return value;
    }

    // ============================================================
    // CH4 - PATTERN 1 SELECTION
    // ============================================================

    /**
     * Select Pattern 1
     * @param {number} pattern - Pattern number 0-255
     * @returns {number} The DMX value set
     */
    pattern1(pattern) {
        const value = this._clamp(pattern);
        this._setChannel(4, value);
        return value;
    }

    // ============================================================
    // CH5 - ZOOM 1
    // ============================================================

    /**
     * Set Pattern 1 zoom effect
     * @param {string|number} zoom - 'static'|'in'|'out'|'flip' OR 0-255
     * @param {number} [intensity=0.5] - Intensity 0-1 for dynamic modes
     * @returns {number} The DMX value set
     */
    zoom1(zoom, intensity = 0.5) {
        const zoomMap = {
            'static': 64,
            'in': 128 + Math.round(intensity * 31),
            'zoom_in': 128 + Math.round(intensity * 31),
            'out': 160 + Math.round(intensity * 31),
            'zoom_out': 160 + Math.round(intensity * 31),
            'flip': 192 + Math.round(intensity * 63),
            'flip_zoom': 192 + Math.round(intensity * 63)
        };

        const value = typeof zoom === 'string' ? zoomMap[zoom.toLowerCase()] || 64 : zoom;
        this._setChannel(5, value);
        return value;
    }

    // ============================================================
    // CH6 - ROTATION 1
    // ============================================================

    /**
     * Set Pattern 1 rotation
     * @param {string|number} rotation - 'static'|'cw'|'ccw' OR 0-255
     * @param {number} [speed=0.5] - Rotation speed 0-1 for dynamic modes
     * @returns {number} The DMX value set
     */
    rotation1(rotation, speed = 0.5) {
        const rotationMap = {
            'static': 64,
            'cw': 128 + Math.round(speed * 63),
            'clockwise': 128 + Math.round(speed * 63),
            'ccw': 192 + Math.round(speed * 63),
            'counter_clockwise': 192 + Math.round(speed * 63),
            'counterclockwise': 192 + Math.round(speed * 63)
        };

        const value = typeof rotation === 'string' ? rotationMap[rotation.toLowerCase()] || 64 : rotation;
        this._setChannel(6, value);
        return value;
    }

    // ============================================================
    // CH7 & CH8 - POSITION
    // ============================================================

    /**
     * Set Pattern 1 position (both X and Y)
     * @param {number} x - X position 0-1 (0=left, 0.5=center, 1=right) OR 0-255
     * @param {number} y - Y position 0-1 (0=bottom, 0.5=center, 1=top) OR 0-255
     * @returns {{x: number, y: number}} The DMX values set
     */
    position1(x, y) {
        const xValue = x <= 1 ? this._normalize(x) : this._clamp(x);
        const yValue = y <= 1 ? this._normalize(y) : this._clamp(y);

        this._setChannels({
            7: xValue,
            8: yValue
        });

        return { x: xValue, y: yValue };
    }

    /**
     * Set Pattern 1 X position (horizontal)
     * @param {number|string} x - 0-1 normalized OR 0-255 OR 'left'|'center'|'right'
     * @returns {number} The DMX value set
     */
    x1(x) {
        const posMap = {
            'left': 0,
            'center': 64,
            'middle': 64,
            'right': 127
        };

        let value;
        if (typeof x === 'string') {
            value = posMap[x.toLowerCase()] || 64;
        } else {
            value = x <= 1 ? this._normalize(x) : this._clamp(x);
        }

        this._setChannel(7, value);
        return value;
    }

    /**
     * Set Pattern 1 Y position (vertical)
     * @param {number|string} y - 0-1 normalized OR 0-255 OR 'bottom'|'center'|'top'
     * @returns {number} The DMX value set
     */
    y1(y) {
        const posMap = {
            'bottom': 0,
            'center': 64,
            'middle': 64,
            'top': 127
        };

        let value;
        if (typeof y === 'string') {
            value = posMap[y.toLowerCase()] || 64;
        } else {
            value = y <= 1 ? this._normalize(y) : this._clamp(y);
        }

        this._setChannel(8, value);
        return value;
    }

    /**
     * Set Pattern 1 horizontal movement mode
     * @param {string|number} mode - 'static'|'wave_left'|'wave_right'|'move_left'|'move_right' OR 0-255
     * @param {number} [intensity=0.5] - Movement intensity 0-1
     * @returns {number} The DMX value set
     */
    horizontalMove1(mode, intensity = 0.5) {
        const moveMap = {
            'static': 64,
            'wave_left': 128 + Math.round(intensity * 31),
            'wave_right': 160 + Math.round(intensity * 31),
            'move_left': 192 + Math.round(intensity * 31),
            'left': 192 + Math.round(intensity * 31),
            'move_right': 224 + Math.round(intensity * 31),
            'right': 224 + Math.round(intensity * 31)
        };

        const value = typeof mode === 'string' ? moveMap[mode.toLowerCase()] || 64 : mode;
        this._setChannel(7, value);
        return value;
    }

    /**
     * Set Pattern 1 vertical movement mode
     * @param {string|number} mode - 'static'|'wave_up'|'wave_down'|'move_up'|'move_down' OR 0-255
     * @param {number} [intensity=0.5] - Movement intensity 0-1
     * @returns {number} The DMX value set
     */
    verticalMove1(mode, intensity = 0.5) {
        const moveMap = {
            'static': 64,
            'wave_up': 128 + Math.round(intensity * 31),
            'wave_down': 160 + Math.round(intensity * 31),
            'move_up': 192 + Math.round(intensity * 31),
            'up': 192 + Math.round(intensity * 31),
            'move_down': 224 + Math.round(intensity * 31),
            'down': 224 + Math.round(intensity * 31)
        };

        const value = typeof mode === 'string' ? moveMap[mode.toLowerCase()] || 64 : mode;
        this._setChannel(8, value);
        return value;
    }

    // ============================================================
    // CH9 & CH10 - STRETCH/ZOOM
    // ============================================================

    /**
     * Set Pattern 1 horizontal stretch/zoom
     * @param {number} stretch - -1 to 1 (0=normal, -1=narrow, 1=wide) OR 0-255
     * @returns {number} The DMX value set
     */
    hStretch1(stretch) {
        const value = stretch >= -1 && stretch <= 1 ? this._bipolar(stretch) : this._clamp(stretch);
        this._setChannel(9, value);
        return value;
    }

    /**
     * Set Pattern 1 vertical stretch/zoom
     * @param {number} stretch - -1 to 1 (0=normal, -1=flat, 1=tall) OR 0-255
     * @returns {number} The DMX value set
     */
    vStretch1(stretch) {
        const value = stretch >= -1 && stretch <= 1 ? this._bipolar(stretch) : this._clamp(stretch);
        this._setChannel(10, value);
        return value;
    }

    // ============================================================
    // CH11 - COLOR 1
    // ============================================================

    /**
     * Set Pattern 1 forced color
     * @param {string|number|object} color - 'red'|'green'|'blue'|etc OR 0-255 OR {r,g,b}
     * @returns {number} The DMX value set
     */
    color1(color) {
        const colorMap = {
            'original': 0,
            'default': 0,
            'red': 16,
            'r': 16,
            'green': 48,
            'g': 48,
            'blue': 80,
            'b': 80,
            'yellow': 112,
            'y': 112,
            'cyan': 144,
            'c': 144,
            'magenta': 176,
            'm': 176,
            'white': 208,
            'w': 208,
            'cycle': 240,
            'rainbow': 240
        };

        let value;
        if (typeof color === 'string') {
            value = colorMap[color.toLowerCase()] || 0;
        } else if (typeof color === 'object' && color.r !== undefined) {
            // Determine closest color from RGB
            const { r, g, b } = color;
            if (r > 200 && g < 50 && b < 50) value = 16; // Red
            else if (r < 50 && g > 200 && b < 50) value = 48; // Green
            else if (r < 50 && g < 50 && b > 200) value = 80; // Blue
            else if (r > 200 && g > 200 && b < 50) value = 112; // Yellow
            else if (r < 50 && g > 200 && b > 200) value = 144; // Cyan
            else if (r > 200 && g < 50 && b > 200) value = 176; // Magenta
            else if (r > 200 && g > 200 && b > 200) value = 208; // White
            else value = 0; // Original
        } else {
            value = color;
        }

        this._setChannel(11, value);
        return value;
    }

    // ============================================================
    // CH12 - STROBE
    // ============================================================

    /**
     * Set strobe/flash effect
     * @param {string|number|boolean} strobe - 'off'|'slow'|'medium'|'fast'|'random' OR 0-255 OR false/true
     * @returns {number} The DMX value set
     */
    strobe(strobe) {
        const strobeMap = {
            'off': 0,
            'slow': 32,
            'medium': 96,
            'med': 96,
            'fast': 160,
            'random': 208,
            'rand': 208,
            'sound': 240
        };

        let value;
        if (typeof strobe === 'boolean') {
            value = strobe ? 96 : 0; // Medium strobe or off
        } else if (typeof strobe === 'string') {
            value = strobeMap[strobe.toLowerCase()] || 0;
        } else {
            value = strobe;
        }

        this._setChannel(12, value);
        return value;
    }

    // ============================================================
    // CH13-17 - ADVANCED EFFECTS
    // ============================================================

    /**
     * Set node highlighting
     * @param {number} amount - 0-1 normalized OR 0-255
     * @returns {number} The DMX value set
     */
    nodeHighlight1(amount) {
        const value = amount <= 1 ? this._normalize(amount) : this._clamp(amount);
        this._setChannel(13, value);
        return value;
    }

    /**
     * Set node expansion (point-by-point drawing)
     * @param {number} amount - 0-1 normalized OR 0-255
     * @returns {number} The DMX value set
     */
    nodeExpansion1(amount) {
        const value = amount <= 1 ? this._normalize(amount) : this._clamp(amount);
        this._setChannel(14, value);
        return value;
    }

    /**
     * Set gradual drawing effect
     * @param {string|number} mode - 'off'|'forward'|'reverse' OR 0-255
     * @returns {number} The DMX value set
     */
    gradualDraw1(mode) {
        const drawMap = {
            'off': 0,
            'none': 0,
            'forward': 64,
            'fwd': 64,
            'reverse': 192,
            'rev': 192
        };

        const value = typeof mode === 'string' ? drawMap[mode.toLowerCase()] || 0 : mode;
        this._setChannel(15, value);
        return value;
    }

    /**
     * Set distortion degree 1
     * @param {number} amount - 0-1 normalized OR 0-255
     * @returns {number} The DMX value set
     */
    distortion1(amount) {
        const value = amount <= 1 ? this._normalize(amount) : this._clamp(amount);
        this._setChannel(16, value);
        return value;
    }

    /**
     * Set distortion degree 2
     * @param {number} amount - 0-1 normalized OR 0-255
     * @returns {number} The DMX value set
     */
    distortion2(amount) {
        const value = amount <= 1 ? this._normalize(amount) : this._clamp(amount);
        this._setChannel(17, value);
        return value;
    }

    // ============================================================
    // CH18 - ENABLE PATTERN 2
    // ============================================================

    /**
     * Enable/disable Pattern 2 layer
     * @param {boolean|number} enable - true/false OR 0-255
     * @returns {number} The DMX value set
     */
    enablePattern2(enable) {
        const value = typeof enable === 'boolean' ? (enable ? 128 : 0) : this._clamp(enable);
        this._setChannel(18, value);
        return value;
    }

    // ============================================================
    // CH19-32 - PATTERN 2 CONTROLS (mirror Pattern 1)
    // ============================================================

    /**
     * Set Pattern 2 size
     * @param {string|number} size - Same as size1()
     */
    size2(size) {
        const sizeMap = {
            'small': 32, 's': 32,
            'medium': 96, 'med': 96, 'm': 96,
            'large': 160, 'l': 160,
            'xlarge': 224, 'xl': 224
        };
        const value = typeof size === 'string' ? sizeMap[size.toLowerCase()] || 96 : size;
        this._setChannel(19, value);
        return value;
    }

    /**
     * Select Pattern 2 gallery
     * @param {string|number} gallery - Same as gallery()
     */
    gallery2(gallery) {
        const galleryMap = { 'beam': 0, 'animation': 200, 'anim': 200 };
        const value = typeof gallery === 'string' ? galleryMap[gallery.toLowerCase()] || 0 : gallery;
        this._setChannel(20, value);
        return value;
    }

    /**
     * Select Pattern 2
     * @param {number} pattern - Pattern number 0-255
     */
    pattern2(pattern) {
        this._setChannel(21, this._clamp(pattern));
        return this._clamp(pattern);
    }

    /**
     * Set Pattern 2 zoom effect
     * @param {string|number} zoom - Same as zoom1()
     * @param {number} [intensity=0.5]
     */
    zoom2(zoom, intensity = 0.5) {
        const zoomMap = {
            'static': 64,
            'in': 128 + Math.round(intensity * 31),
            'out': 160 + Math.round(intensity * 31),
            'flip': 192 + Math.round(intensity * 63)
        };
        const value = typeof zoom === 'string' ? zoomMap[zoom.toLowerCase()] || 64 : zoom;
        this._setChannel(22, value);
        return value;
    }

    /**
     * Set Pattern 2 rotation
     * @param {string|number} rotation - Same as rotation1()
     * @param {number} [speed=0.5]
     */
    rotation2(rotation, speed = 0.5) {
        const rotationMap = {
            'static': 64,
            'cw': 128 + Math.round(speed * 63),
            'ccw': 192 + Math.round(speed * 63)
        };
        const value = typeof rotation === 'string' ? rotationMap[rotation.toLowerCase()] || 64 : rotation;
        this._setChannel(23, value);
        return value;
    }

    /**
     * Set Pattern 2 position (both X and Y)
     * @param {number} x - Same as position1()
     * @param {number} y
     */
    position2(x, y) {
        const xValue = x <= 1 ? this._normalize(x) : this._clamp(x);
        const yValue = y <= 1 ? this._normalize(y) : this._clamp(y);
        this._setChannels({ 24: xValue, 25: yValue });
        return { x: xValue, y: yValue };
    }

    /**
     * Set Pattern 2 X position
     * @param {number|string} x - Same as x1()
     */
    x2(x) {
        const posMap = { 'left': 0, 'center': 64, 'right': 127 };
        const value = typeof x === 'string' ? posMap[x.toLowerCase()] || 64 :
                      x <= 1 ? this._normalize(x) : this._clamp(x);
        this._setChannel(24, value);
        return value;
    }

    /**
     * Set Pattern 2 Y position
     * @param {number|string} y - Same as y1()
     */
    y2(y) {
        const posMap = { 'bottom': 0, 'center': 64, 'top': 127 };
        const value = typeof y === 'string' ? posMap[y.toLowerCase()] || 64 :
                      y <= 1 ? this._normalize(y) : this._clamp(y);
        this._setChannel(25, value);
        return value;
    }

    /**
     * Set Pattern 2 horizontal flip
     * @param {boolean|number} flip - true/false OR 0-255
     */
    hFlip(flip) {
        const value = typeof flip === 'boolean' ? (flip ? 128 : 0) : this._clamp(flip);
        this._setChannel(26, value);
        return value;
    }

    /**
     * Set Pattern 2 vertical flip
     * @param {boolean|number} flip - true/false OR 0-255
     */
    vFlip(flip) {
        const value = typeof flip === 'boolean' ? (flip ? 128 : 0) : this._clamp(flip);
        this._setChannel(27, value);
        return value;
    }

    /**
     * Set Pattern 2 forced color
     * @param {string|number|object} color - Same as color1()
     */
    color2(color) {
        const colorMap = {
            'original': 0, 'red': 16, 'green': 48, 'blue': 80,
            'yellow': 112, 'cyan': 144, 'magenta': 176, 'white': 208, 'cycle': 240
        };
        let value = typeof color === 'string' ? colorMap[color.toLowerCase()] || 0 : color;
        this._setChannel(28, value);
        return value;
    }

    /**
     * Set global color change (master color control)
     * @param {string|number} color - Same as color1() plus 'dynamic' modes
     */
    globalColor(color) {
        const colorMap = {
            'original': 0, 'red': 16, 'green': 48, 'blue': 80,
            'yellow': 112, 'cyan': 144, 'magenta': 176, 'white': 208,
            'cycle': 232, 'dynamic': 232, 'movement': 248
        };
        const value = typeof color === 'string' ? colorMap[color.toLowerCase()] || 0 : color;
        this._setChannel(29, value);
        return value;
    }

    /**
     * Set Pattern 2 node highlighting (includes array mode!)
     * @param {string|number} mode - 'normal'|'highlight'|'array' OR 0-255
     */
    nodeHighlight2(mode) {
        const modeMap = {
            'normal': 0,
            'highlight': 128,
            'array': 200  // Special: projects Pattern 1 onto Pattern 2 nodes!
        };
        const value = typeof mode === 'string' ? modeMap[mode.toLowerCase()] || 0 : mode;
        this._setChannel(30, value);
        return value;
    }

    /**
     * Set Pattern 2 node expansion
     * @param {number} amount - Same as nodeExpansion1()
     */
    nodeExpansion2(amount) {
        const value = amount <= 1 ? this._normalize(amount) : this._clamp(amount);
        this._setChannel(31, value);
        return value;
    }

    /**
     * Set Pattern 2 gradual drawing
     * @param {string|number} mode - Same as gradualDraw1()
     */
    gradualDraw2(mode) {
        const drawMap = { 'off': 0, 'forward': 64, 'reverse': 192 };
        const value = typeof mode === 'string' ? drawMap[mode.toLowerCase()] || 0 : mode;
        this._setChannel(32, value);
        return value;
    }

    // ============================================================
    // CONVENIENCE METHODS
    // ============================================================

    /**
     * Blackout (all off)
     */
    blackout() {
        this.mode('off');
    }

    /**
     * Reset to safe defaults
     */
    reset() {
        this._setChannels({
            1: 50, 2: 96, 3: 0, 4: 20, 5: 64, 6: 0,
            7: 64, 8: 64, 9: 128, 10: 128, 11: 16, 12: 0,
            13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0
        });
    }

    /**
     * Center pattern (both patterns)
     */
    center() {
        this.position1(0.5, 0.5);
        this.position2(0.5, 0.5);
    }
}

/**
 * Generic Laser Helper (for non-Ehaho devices)
 * Provides RGBW color control instead of forced color enum
 */
export class GenericLaserHelper extends DMXChannelHelper {
    constructor(dmxController, startAddress = 1) {
        super(dmxController, startAddress);
    }

    // Same mode(), gallery(), pattern1() as Ehaho...

    /**
     * Set RGB color (direct control)
     * @param {number} r - Red 0-255
     * @param {number} g - Green 0-255
     * @param {number} b - Blue 0-255
     * @param {number} [w=0] - White 0-255 (optional)
     */
    rgb(r, g, b, w = 0) {
        this._setChannels({
            11: this._clamp(r),
            12: this._clamp(g),
            13: this._clamp(b),
            14: this._clamp(w)
        });
    }

    /**
     * Set color by name (convenience)
     * @param {string} color - 'red'|'green'|'blue'|etc
     */
    color(color) {
        const colorMap = {
            'red': [255, 0, 0],
            'green': [0, 255, 0],
            'blue': [0, 0, 255],
            'yellow': [255, 255, 0],
            'cyan': [0, 255, 255],
            'magenta': [255, 0, 255],
            'white': [255, 255, 255],
            'orange': [255, 128, 0],
            'purple': [128, 0, 255],
            'pink': [255, 64, 128]
        };

        const [r, g, b] = colorMap[color.toLowerCase()] || [255, 255, 255];
        this.rgb(r, g, b);
    }
}

// Export helpers
export default {
    EhahoL2400Helper,
    GenericLaserHelper,
    DMXChannelHelper
};
