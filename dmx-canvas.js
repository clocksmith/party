/**
 * DMX Canvas API
 * Canvas-like drawing API for DMX laser control with parametric curves
 *
 * Usage:
 *   const canvas = new DMXCanvas(dmxController, { width: 127, height: 127 });
 *   canvas.circle(64, 64, 30);
 *   canvas.animate();
 */

import { EventEmitter } from 'events';

/**
 * Point in 2D space
 */
export class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Point(this.x, this.y);
    }

    distance(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

/**
 * Path builder for DMX drawing
 */
export class Path {
    constructor() {
        this.points = [];
        this.closed = false;
        this.color = { r: 255, g: 255, b: 255 };
        this.speed = 1.0;
    }

    moveTo(x, y) {
        this.points = [new Point(x, y)];
        return this;
    }

    lineTo(x, y) {
        this.points.push(new Point(x, y));
        return this;
    }

    arc(cx, cy, radius, startAngle, endAngle, segments = 32) {
        const angleRange = endAngle - startAngle;
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (angleRange * i / segments);
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            this.points.push(new Point(x, y));
        }
        return this;
    }

    circle(cx, cy, radius, segments = 32) {
        return this.arc(cx, cy, radius, 0, Math.PI * 2, segments);
    }

    rect(x, y, width, height) {
        this.moveTo(x, y);
        this.lineTo(x + width, y);
        this.lineTo(x + width, y + height);
        this.lineTo(x, y + height);
        this.lineTo(x, y);
        this.closed = true;
        return this;
    }

    closePath() {
        if (this.points.length > 0) {
            this.points.push(this.points[0].clone());
        }
        this.closed = true;
        return this;
    }

    /**
     * Add parametric curve to path
     * @param {Function} fx - Function for x coordinate: (t) => x
     * @param {Function} fy - Function for y coordinate: (t) => y
     * @param {number} tStart - Start parameter value
     * @param {number} tEnd - End parameter value
     * @param {number} samples - Number of sample points
     */
    parametric(fx, fy, tStart = 0, tEnd = 1, samples = 100) {
        for (let i = 0; i <= samples; i++) {
            const t = tStart + (tEnd - tStart) * (i / samples);
            const x = fx(t);
            const y = fy(t);
            this.points.push(new Point(x, y));
        }
        return this;
    }

    /**
     * Get point at position along path (0-1)
     */
    getPointAt(t) {
        if (this.points.length === 0) return new Point(0, 0);
        if (this.points.length === 1) return this.points[0].clone();

        const position = t * (this.points.length - 1);
        const index = Math.floor(position);
        const fraction = position - index;

        if (index >= this.points.length - 1) {
            return this.points[this.points.length - 1].clone();
        }

        const p1 = this.points[index];
        const p2 = this.points[index + 1];

        return new Point(
            p1.x + (p2.x - p1.x) * fraction,
            p1.y + (p2.y - p1.y) * fraction
        );
    }

    /**
     * Get total path length (approximate)
     */
    length() {
        let total = 0;
        for (let i = 1; i < this.points.length; i++) {
            total += this.points[i].distance(this.points[i - 1]);
        }
        return total;
    }
}

/**
 * DMX Canvas - Main drawing surface
 */
export class DMXCanvas extends EventEmitter {
    constructor(dmxController, options = {}) {
        super();

        this.dmx = dmxController;

        // Canvas dimensions (DMX coordinate space)
        this.width = options.width || 127;
        this.height = options.height || 127;

        // Device channel mapping
        this.channels = {
            mode: options.modeChannel || 1,
            pattern: options.patternChannel || 4,
            xPos: options.xChannel || 7,
            yPos: options.yChannel || 8,
            colorR: options.colorRChannel || 11,
            colorG: options.colorGChannel || 12,
            colorB: options.colorBChannel || 13,
            intensity: options.intensityChannel || null,
            size: options.sizeChannel || 2
        };

        // Drawing state
        this.currentPath = null;
        this.activePaths = [];
        this.currentColor = { r: 255, g: 255, b: 255 };
        this.currentLineWidth = 1;
        this.fillStyle = null;
        this.strokeStyle = { r: 255, g: 255, b: 255 };

        // Animation state
        this.isAnimating = false;
        this.animationFrame = null;
        this.frameRate = options.frameRate || 30;
        this.time = 0;
        this.speed = options.speed || 1.0;

        // Current drawing position
        this.currentPoint = new Point(
            this.width / 2,
            this.height / 2
        );

        // Initialize DMX mode
        if (this.dmx && this.dmx.isConnected()) {
            this._initializeDMX();
        }
    }

    /**
     * Initialize DMX to drawing mode
     */
    _initializeDMX() {
        this.dmx.updateChannels({
            [this.channels.mode]: 50,  // DMX manual mode
            [this.channels.xPos]: Math.round(this.width / 2),
            [this.channels.yPos]: Math.round(this.height / 2)
        });
    }

    /**
     * Begin a new path
     */
    beginPath() {
        this.currentPath = new Path();
        return this;
    }

    /**
     * Move to position without drawing
     */
    moveTo(x, y) {
        if (!this.currentPath) this.beginPath();
        this.currentPath.moveTo(x, y);
        this.currentPoint = new Point(x, y);
        return this;
    }

    /**
     * Draw line to position
     */
    lineTo(x, y) {
        if (!this.currentPath) this.beginPath();
        this.currentPath.lineTo(x, y);
        this.currentPoint = new Point(x, y);
        return this;
    }

    /**
     * Draw arc
     */
    arc(x, y, radius, startAngle, endAngle, segments = 32) {
        if (!this.currentPath) this.beginPath();
        this.currentPath.arc(x, y, radius, startAngle, endAngle, segments);
        return this;
    }

    /**
     * Draw circle
     */
    circle(x, y, radius, segments = 32) {
        this.beginPath();
        this.currentPath.circle(x, y, radius, segments);
        this.closePath();
        return this;
    }

    /**
     * Draw rectangle
     */
    rect(x, y, width, height) {
        this.beginPath();
        this.currentPath.rect(x, y, width, height);
        this.closePath();
        return this;
    }

    /**
     * Close current path
     */
    closePath() {
        if (this.currentPath) {
            this.currentPath.closePath();
        }
        return this;
    }

    /**
     * Draw parametric curve
     * @param {Function} fx - X coordinate function: (t) => x
     * @param {Function} fy - Y coordinate function: (t) => y
     * @param {number} tStart - Start parameter
     * @param {number} tEnd - End parameter
     * @param {number} samples - Number of samples
     */
    parametric(fx, fy, tStart = 0, tEnd = 1, samples = 100) {
        if (!this.currentPath) this.beginPath();
        this.currentPath.parametric(fx, fy, tStart, tEnd, samples);
        return this;
    }

    /**
     * Stroke the current path (execute drawing)
     */
    stroke() {
        if (!this.currentPath || this.currentPath.points.length === 0) {
            return this;
        }

        this.currentPath.color = { ...this.strokeStyle };
        this.activePaths.push(this.currentPath);
        this.currentPath = null;

        return this;
    }

    /**
     * Set stroke color
     */
    setStrokeStyle(r, g, b) {
        if (typeof r === 'object') {
            this.strokeStyle = { ...r };
        } else {
            this.strokeStyle = { r, g, b };
        }
        return this;
    }

    /**
     * Set line width (affects DMX size channel if available)
     */
    setLineWidth(width) {
        this.currentLineWidth = width;
        if (this.channels.size && this.dmx) {
            this.dmx.updateChannel(this.channels.size, Math.round(width * 25.5));
        }
        return this;
    }

    /**
     * Clear all paths
     */
    clear() {
        this.activePaths = [];
        this.currentPath = null;
        if (this.dmx && this.dmx.isConnected()) {
            this._initializeDMX();
        }
        return this;
    }

    /**
     * Start animation loop
     */
    animate(callback = null) {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.time = 0;

        const frameInterval = 1000 / this.frameRate;
        let lastFrameTime = Date.now();

        const loop = () => {
            if (!this.isAnimating) return;

            const now = Date.now();
            const deltaTime = now - lastFrameTime;

            if (deltaTime >= frameInterval) {
                this.time += (deltaTime / 1000) * this.speed;
                this._renderFrame(this.time);

                if (callback) {
                    callback(this.time);
                }

                this.emit('frame', { time: this.time });
                lastFrameTime = now;
            }

            this.animationFrame = setTimeout(loop, 1);
        };

        loop();
        this.emit('start');

        return this;
    }

    /**
     * Stop animation
     */
    stop() {
        this.isAnimating = false;
        if (this.animationFrame) {
            clearTimeout(this.animationFrame);
            this.animationFrame = null;
        }
        this.emit('stop');
        return this;
    }

    /**
     * Render single frame
     */
    _renderFrame(time) {
        if (this.activePaths.length === 0 || !this.dmx || !this.dmx.isConnected()) {
            return;
        }

        // Select path to draw (cycle through all paths)
        const pathIndex = Math.floor(time * 0.5) % this.activePaths.length;
        const path = this.activePaths[pathIndex];

        // Calculate position along path
        const t = (time * path.speed) % 1.0;
        const point = path.getPointAt(t);

        // Clamp to canvas bounds
        const x = Math.max(0, Math.min(this.width, Math.round(point.x)));
        const y = Math.max(0, Math.min(this.height, Math.round(point.y)));

        // Update DMX channels
        const updates = {
            [this.channels.xPos]: x,
            [this.channels.yPos]: y
        };

        // Add color if using forced color (single channel)
        if (this.channels.colorR === this.channels.colorG) {
            // Single color channel (like Ehaho forced color)
            const colorValue = this._rgbToForcedColor(path.color);
            updates[this.channels.colorR] = colorValue;
        } else {
            // Separate RGB channels
            if (this.channels.colorR) updates[this.channels.colorR] = path.color.r;
            if (this.channels.colorG) updates[this.channels.colorG] = path.color.g;
            if (this.channels.colorB) updates[this.channels.colorB] = path.color.b;
        }

        this.dmx.updateChannels(updates);
    }

    /**
     * Convert RGB to single forced color value (for devices like Ehaho)
     */
    _rgbToForcedColor(color) {
        const { r, g, b } = color;

        // Determine dominant color
        if (r > g && r > b) return 16;       // Red
        if (g > r && g > b) return 48;       // Green
        if (b > r && b > g) return 80;       // Blue
        if (r > 200 && g > 200) return 112;  // Yellow
        if (g > 200 && b > 200) return 144;  // Cyan
        if (r > 200 && b > 200) return 176;  // Magenta
        if (r > 200 && g > 200 && b > 200) return 208;  // White

        return 16;  // Default to red
    }

    /**
     * Draw and animate in one call
     */
    drawAnimated(drawFunction, options = {}) {
        this.clear();
        this.speed = options.speed || 1.0;

        // Call drawing function
        drawFunction(this);

        // Start animation
        this.animate(options.callback);

        return this;
    }

    /**
     * Get current drawing state
     */
    getState() {
        return {
            width: this.width,
            height: this.height,
            pathCount: this.activePaths.length,
            isAnimating: this.isAnimating,
            time: this.time,
            currentPoint: this.currentPoint.clone(),
            frameRate: this.frameRate
        };
    }
}

export default DMXCanvas;
