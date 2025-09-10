/**
 * Geometric Pattern Generators
 * Vector-based patterns for laser animation
 */

/**
 * Base Pattern class
 */
export class Pattern {
    constructor(options = {}) {
        this.name = options.name || 'Pattern';
        this.parameters = options.parameters || {};
    }
    
    /**
     * Generate pattern frame at given time
     * @returns {Object} Frame data with position, color, etc.
     */
    generate(time, state) {
        throw new Error('Pattern.generate must be implemented by subclass');
    }
    
    /**
     * Normalize value to 0-1 range
     */
    normalize(value, min = 0, max = 1) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }
}

/**
 * Circle Pattern
 * Draws a circle that can rotate and pulsate
 */
export class CirclePattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Circle',
            parameters: {
                radius: options.radius || 0.3,
                speed: options.speed || 1.0,
                segments: options.segments || 32,
                color: options.color || { r: 255, g: 255, b: 255 }
            }
        });
    }
    
    generate(time, state) {
        const { radius, speed, color } = { ...this.parameters, ...state };
        
        // Calculate angle based on time
        const angle = (time / 1000) * speed * 2 * Math.PI;
        
        // Generate circle point
        const x = 0.5 + radius * Math.cos(angle);
        const y = 0.5 + radius * Math.sin(angle);
        
        return {
            position: { x, y },
            color,
            intensity: 1.0,
            size: radius,
            pattern: 'circle'
        };
    }
    
    /**
     * Generate full circle path (for drawing complete circle)
     */
    generatePath(state) {
        const { radius, segments } = { ...this.parameters, ...state };
        const points = [];
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            points.push({
                x: 0.5 + radius * Math.cos(angle),
                y: 0.5 + radius * Math.sin(angle)
            });
        }
        
        return points;
    }
}

/**
 * Square Pattern
 * Draws a square that can rotate and scale
 */
export class SquarePattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Square',
            parameters: {
                size: options.size || 0.4,
                speed: options.speed || 1.0,
                rotation: options.rotation || 0,
                color: options.color || { r: 255, g: 0, b: 0 }
            }
        });
    }
    
    generate(time, state) {
        const { size, speed, rotation, color } = { ...this.parameters, ...state };
        
        // Calculate position along square perimeter
        const t = ((time / 1000) * speed) % 4;
        let x, y;
        
        if (t < 1) {
            // Top edge (left to right)
            x = 0.5 - size/2 + size * t;
            y = 0.5 - size/2;
        } else if (t < 2) {
            // Right edge (top to bottom)
            x = 0.5 + size/2;
            y = 0.5 - size/2 + size * (t - 1);
        } else if (t < 3) {
            // Bottom edge (right to left)
            x = 0.5 + size/2 - size * (t - 2);
            y = 0.5 + size/2;
        } else {
            // Left edge (bottom to top)
            x = 0.5 - size/2;
            y = 0.5 + size/2 - size * (t - 3);
        }
        
        // Apply rotation
        if (rotation) {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const cx = x - 0.5;
            const cy = y - 0.5;
            x = 0.5 + cx * cos - cy * sin;
            y = 0.5 + cx * sin + cy * cos;
        }
        
        return {
            position: { x, y },
            color,
            intensity: 1.0,
            size: size,
            pattern: 'square'
        };
    }
    
    generatePath(state) {
        const { size } = { ...this.parameters, ...state };
        const halfSize = size / 2;
        
        return [
            { x: 0.5 - halfSize, y: 0.5 - halfSize }, // Top-left
            { x: 0.5 + halfSize, y: 0.5 - halfSize }, // Top-right
            { x: 0.5 + halfSize, y: 0.5 + halfSize }, // Bottom-right
            { x: 0.5 - halfSize, y: 0.5 + halfSize }, // Bottom-left
            { x: 0.5 - halfSize, y: 0.5 - halfSize }  // Close
        ];
    }
}

/**
 * Spiral Pattern
 * Draws an expanding or contracting spiral
 */
export class SpiralPattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Spiral',
            parameters: {
                turns: options.turns || 3,
                speed: options.speed || 1.0,
                expansion: options.expansion || 0.1,
                color: options.color || { r: 0, g: 255, b: 255 }
            }
        });
    }
    
    generate(time, state) {
        const { turns, speed, expansion, color } = { ...this.parameters, ...state };
        
        // Calculate spiral parameters
        const t = ((time / 1000) * speed) % (turns * 2 * Math.PI);
        const radius = expansion * t / (2 * Math.PI);
        
        // Generate spiral point
        const x = 0.5 + radius * Math.cos(t);
        const y = 0.5 + radius * Math.sin(t);
        
        // Fade intensity as we get further from center
        const intensity = Math.max(0, 1 - radius * 2);
        
        return {
            position: { x, y },
            color,
            intensity,
            size: 0.05,
            pattern: 'spiral'
        };
    }
}

/**
 * Star Pattern
 * Draws a star with configurable points
 */
export class StarPattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Star',
            parameters: {
                points: options.points || 5,
                outerRadius: options.outerRadius || 0.4,
                innerRadius: options.innerRadius || 0.2,
                speed: options.speed || 1.0,
                color: options.color || { r: 255, g: 255, b: 0 }
            }
        });
    }
    
    generate(time, state) {
        const { points, outerRadius, innerRadius, speed, color } = { ...this.parameters, ...state };
        
        // Calculate position along star path
        const totalPoints = points * 2;
        const t = ((time / 1000) * speed) % totalPoints;
        const index = Math.floor(t);
        const fraction = t - index;
        
        // Get current and next point
        const angle1 = (index / totalPoints) * 2 * Math.PI - Math.PI / 2;
        const angle2 = ((index + 1) / totalPoints) * 2 * Math.PI - Math.PI / 2;
        
        const radius1 = (index % 2 === 0) ? outerRadius : innerRadius;
        const radius2 = ((index + 1) % 2 === 0) ? outerRadius : innerRadius;
        
        // Interpolate between points
        const r = radius1 + (radius2 - radius1) * fraction;
        const a = angle1 + (angle2 - angle1) * fraction;
        
        const x = 0.5 + r * Math.cos(a);
        const y = 0.5 + r * Math.sin(a);
        
        return {
            position: { x, y },
            color,
            intensity: 1.0,
            size: 0.05,
            pattern: 'star'
        };
    }
    
    generatePath(state) {
        const { points, outerRadius, innerRadius } = { ...this.parameters, ...state };
        const path = [];
        
        for (let i = 0; i <= points * 2; i++) {
            const angle = (i / (points * 2)) * 2 * Math.PI - Math.PI / 2;
            const radius = (i % 2 === 0) ? outerRadius : innerRadius;
            
            path.push({
                x: 0.5 + radius * Math.cos(angle),
                y: 0.5 + radius * Math.sin(angle)
            });
        }
        
        return path;
    }
}

/**
 * Wave Pattern
 * Draws a sine wave that can oscillate
 */
export class WavePattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Wave',
            parameters: {
                amplitude: options.amplitude || 0.2,
                frequency: options.frequency || 2,
                speed: options.speed || 1.0,
                vertical: options.vertical || false,
                color: options.color || { r: 128, g: 0, b: 255 }
            }
        });
    }
    
    generate(time, state) {
        const { amplitude, frequency, speed, vertical, color } = { ...this.parameters, ...state };
        
        // Calculate position along wave
        const t = ((time / 1000) * speed) % 1;
        
        let x, y;
        
        if (vertical) {
            // Vertical wave
            y = t;
            x = 0.5 + amplitude * Math.sin(t * frequency * 2 * Math.PI);
        } else {
            // Horizontal wave
            x = t;
            y = 0.5 + amplitude * Math.sin(t * frequency * 2 * Math.PI);
        }
        
        return {
            position: { x, y },
            color,
            intensity: 1.0,
            size: 0.05,
            pattern: 'wave'
        };
    }
    
    generatePath(state) {
        const { amplitude, frequency, vertical } = { ...this.parameters, ...state };
        const points = [];
        const steps = 50;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            if (vertical) {
                points.push({
                    x: 0.5 + amplitude * Math.sin(t * frequency * 2 * Math.PI),
                    y: t
                });
            } else {
                points.push({
                    x: t,
                    y: 0.5 + amplitude * Math.sin(t * frequency * 2 * Math.PI)
                });
            }
        }
        
        return points;
    }
}

/**
 * Line Pattern
 * Draws lines that can scan across the space
 */
export class LinePattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Line',
            parameters: {
                angle: options.angle || 0,
                length: options.length || 0.5,
                speed: options.speed || 1.0,
                scan: options.scan || 'horizontal',
                color: options.color || { r: 255, g: 255, b: 255 }
            }
        });
    }
    
    generate(time, state) {
        const { angle, length, speed, scan, color } = { ...this.parameters, ...state };
        
        // Calculate scan position
        const t = ((time / 1000) * speed) % 2;
        const scanPos = t < 1 ? t : 2 - t; // Bounce back and forth
        
        let x, y;
        
        switch (scan) {
            case 'horizontal':
                x = scanPos;
                y = 0.5;
                break;
            case 'vertical':
                x = 0.5;
                y = scanPos;
                break;
            case 'diagonal':
                x = scanPos;
                y = scanPos;
                break;
            default:
                // Custom angle
                x = 0.5 + Math.cos(angle) * (scanPos - 0.5);
                y = 0.5 + Math.sin(angle) * (scanPos - 0.5);
        }
        
        return {
            position: { x, y },
            color,
            intensity: 1.0,
            size: length,
            pattern: 'line'
        };
    }
}

/**
 * Grid Pattern
 * Draws a grid of points
 */
export class GridPattern extends Pattern {
    constructor(options = {}) {
        super({
            name: 'Grid',
            parameters: {
                rows: options.rows || 4,
                cols: options.cols || 4,
                spacing: options.spacing || 0.8,
                speed: options.speed || 1.0,
                color: options.color || { r: 0, g: 255, b: 0 }
            }
        });
    }
    
    generate(time, state) {
        const { rows, cols, spacing, speed, color } = { ...this.parameters, ...state };
        
        // Calculate current grid point
        const totalPoints = rows * cols;
        const currentPoint = Math.floor(((time / 1000) * speed) % totalPoints);
        
        const row = Math.floor(currentPoint / cols);
        const col = currentPoint % cols;
        
        // Calculate position
        const gridWidth = spacing;
        const gridHeight = spacing;
        const cellWidth = gridWidth / (cols - 1);
        const cellHeight = gridHeight / (rows - 1);
        
        const x = 0.5 - gridWidth/2 + col * cellWidth;
        const y = 0.5 - gridHeight/2 + row * cellHeight;
        
        return {
            position: { x, y },
            color,
            intensity: 1.0,
            size: 0.02,
            pattern: 'grid'
        };
    }
}

/**
 * Pattern Factory
 * Creates pattern instances
 */
export class PatternFactory {
    static patterns = {
        circle: CirclePattern,
        square: SquarePattern,
        spiral: SpiralPattern,
        star: StarPattern,
        wave: WavePattern,
        line: LinePattern,
        grid: GridPattern
    };
    
    static create(type, options = {}) {
        const PatternClass = this.patterns[type.toLowerCase()];
        
        if (!PatternClass) {
            throw new Error(`Unknown pattern type: ${type}`);
        }
        
        return new PatternClass(options);
    }
    
    static getAvailablePatterns() {
        return Object.keys(this.patterns);
    }
}

export default PatternFactory;