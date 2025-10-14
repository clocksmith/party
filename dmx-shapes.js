/**
 * DMX Shapes Library
 * Parametric curve definitions for common shapes
 *
 * All functions return { fx, fy } for use with canvas.parametric()
 */

/**
 * Circle (parametric form)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Radius
 */
export function circle(cx, cy, radius) {
    return {
        fx: (t) => cx + radius * Math.cos(t * Math.PI * 2),
        fy: (t) => cy + radius * Math.sin(t * Math.PI * 2),
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Ellipse
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radiusX - X radius
 * @param {number} radiusY - Y radius
 */
export function ellipse(cx, cy, radiusX, radiusY) {
    return {
        fx: (t) => cx + radiusX * Math.cos(t * Math.PI * 2),
        fy: (t) => cy + radiusY * Math.sin(t * Math.PI * 2),
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Line
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 */
export function line(x1, y1, x2, y2) {
    return {
        fx: (t) => x1 + (x2 - x1) * t,
        fy: (t) => y1 + (y2 - y1) * t,
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Spiral (Archimedean)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} startRadius - Starting radius
 * @param {number} endRadius - Ending radius
 * @param {number} turns - Number of turns
 */
export function spiral(cx, cy, startRadius, endRadius, turns = 3) {
    return {
        fx: (t) => {
            const angle = t * turns * Math.PI * 2;
            const r = startRadius + (endRadius - startRadius) * t;
            return cx + r * Math.cos(angle);
        },
        fy: (t) => {
            const angle = t * turns * Math.PI * 2;
            const r = startRadius + (endRadius - startRadius) * t;
            return cy + r * Math.sin(angle);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Heart shape
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Size scale
 */
export function heart(cx, cy, size = 10) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 2;
            return cx + size * 16 * Math.pow(Math.sin(angle), 3);
        },
        fy: (t) => {
            const angle = t * Math.PI * 2;
            return cy - size * (
                13 * Math.cos(angle) -
                5 * Math.cos(2 * angle) -
                2 * Math.cos(3 * angle) -
                Math.cos(4 * angle)
            );
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Star (n-pointed)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} outerRadius - Outer point radius
 * @param {number} innerRadius - Inner point radius
 * @param {number} points - Number of points
 */
export function star(cx, cy, outerRadius, innerRadius, points = 5) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 2;
            const step = Math.floor(t * points * 2) % 2;
            const radius = step === 0 ? outerRadius : innerRadius;
            return cx + radius * Math.cos(angle);
        },
        fy: (t) => {
            const angle = t * Math.PI * 2;
            const step = Math.floor(t * points * 2) % 2;
            const radius = step === 0 ? outerRadius : innerRadius;
            return cy + radius * Math.sin(angle);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Infinity symbol (lemniscate)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Size scale
 */
export function infinity(cx, cy, size = 20) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 2;
            return cx + size * Math.cos(angle) / (1 + Math.pow(Math.sin(angle), 2));
        },
        fy: (t) => {
            const angle = t * Math.PI * 2;
            return cy + size * Math.sin(angle) * Math.cos(angle) / (1 + Math.pow(Math.sin(angle), 2));
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Rose curve
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Base radius
 * @param {number} n - Number of petals (if n/d is odd) or 2n petals (if even)
 * @param {number} d - Denominator
 */
export function rose(cx, cy, radius, n = 3, d = 1) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 2;
            const r = radius * Math.cos((n / d) * angle);
            return cx + r * Math.cos(angle);
        },
        fy: (t) => {
            const angle = t * Math.PI * 2;
            const r = radius * Math.cos((n / d) * angle);
            return cy + r * Math.sin(angle);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Lissajous curve
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} a - X frequency
 * @param {number} b - Y frequency
 * @param {number} delta - Phase shift
 */
export function lissajous(cx, cy, width, height, a = 3, b = 2, delta = Math.PI / 2) {
    return {
        fx: (t) => cx + (width / 2) * Math.sin(a * t * Math.PI * 2 + delta),
        fy: (t) => cy + (height / 2) * Math.sin(b * t * Math.PI * 2),
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Square wave
 * @param {number} x - Start X
 * @param {number} y - Start Y
 * @param {number} width - Wave width
 * @param {number} height - Wave height
 * @param {number} periods - Number of periods
 */
export function squareWave(x, y, width, height, periods = 3) {
    return {
        fx: (t) => x + t * width,
        fy: (t) => {
            const phase = (t * periods) % 1;
            return y + (phase < 0.5 ? 0 : height);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Sine wave
 * @param {number} x - Start X
 * @param {number} y - Center Y
 * @param {number} width - Wave width
 * @param {number} amplitude - Wave amplitude
 * @param {number} frequency - Wave frequency
 */
export function sineWave(x, y, width, amplitude, frequency = 2) {
    return {
        fx: (t) => x + t * width,
        fy: (t) => y + amplitude * Math.sin(t * frequency * Math.PI * 2),
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Sawtooth wave
 * @param {number} x - Start X
 * @param {number} y - Start Y
 * @param {number} width - Wave width
 * @param {number} height - Wave height
 * @param {number} periods - Number of periods
 */
export function sawtoothWave(x, y, width, height, periods = 3) {
    return {
        fx: (t) => x + t * width,
        fy: (t) => y + height * ((t * periods) % 1),
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Triangle wave
 * @param {number} x - Start X
 * @param {number} y - Center Y
 * @param {number} width - Wave width
 * @param {number} amplitude - Wave amplitude
 * @param {number} periods - Number of periods
 */
export function triangleWave(x, y, width, amplitude, periods = 3) {
    return {
        fx: (t) => x + t * width,
        fy: (t) => {
            const phase = (t * periods) % 1;
            return y + amplitude * (phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Cycloid
 * @param {number} x - Start X
 * @param {number} y - Baseline Y
 * @param {number} radius - Wheel radius
 * @param {number} rotations - Number of rotations
 */
export function cycloid(x, y, radius, rotations = 2) {
    return {
        fx: (t) => {
            const angle = t * rotations * Math.PI * 2;
            return x + radius * (angle - Math.sin(angle));
        },
        fy: (t) => {
            const angle = t * rotations * Math.PI * 2;
            return y - radius * (1 - Math.cos(angle));
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Butterfly curve
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} size - Size scale
 */
export function butterfly(cx, cy, size = 10) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 12;
            const r = Math.exp(Math.cos(angle)) -
                     2 * Math.cos(4 * angle) +
                     Math.pow(Math.sin(angle / 12), 5);
            return cx + size * r * Math.sin(angle);
        },
        fy: (t) => {
            const angle = t * Math.PI * 12;
            const r = Math.exp(Math.cos(angle)) -
                     2 * Math.cos(4 * angle) +
                     Math.pow(Math.sin(angle / 12), 5);
            return cy + size * r * Math.cos(angle);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Figure-8 (double loop)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Loop radius
 */
export function figure8(cx, cy, radius) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 2;
            return cx + radius * Math.sin(angle);
        },
        fy: (t) => {
            const angle = t * Math.PI * 2;
            return cy + radius * Math.sin(angle) * Math.cos(angle);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Polygonal spiral
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} startRadius - Start radius
 * @param {number} endRadius - End radius
 * @param {number} sides - Number of sides
 */
export function polygonalSpiral(cx, cy, startRadius, endRadius, sides = 6) {
    return {
        fx: (t) => {
            const angle = Math.floor(t * sides) * (Math.PI * 2 / sides) + (t * sides % 1) * (Math.PI * 2 / sides);
            const r = startRadius + (endRadius - startRadius) * t;
            return cx + r * Math.cos(angle);
        },
        fy: (t) => {
            const angle = Math.floor(t * sides) * (Math.PI * 2 / sides) + (t * sides % 1) * (Math.PI * 2 / sides);
            const r = startRadius + (endRadius - startRadius) * t;
            return cy + r * Math.sin(angle);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Superellipse
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} a - X semi-axis
 * @param {number} b - Y semi-axis
 * @param {number} n - Exponent (2 = ellipse, >2 = rounded rectangle)
 */
export function superellipse(cx, cy, a, b, n = 2.5) {
    return {
        fx: (t) => {
            const angle = t * Math.PI * 2;
            const cosT = Math.cos(angle);
            return cx + a * Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n);
        },
        fy: (t) => {
            const angle = t * Math.PI * 2;
            const sinT = Math.sin(angle);
            return cy + b * Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n);
        },
        tStart: 0,
        tEnd: 1
    };
}

/**
 * Helper: Create custom parametric shape
 * @param {Function} fx - X coordinate function
 * @param {Function} fy - Y coordinate function
 * @param {number} tStart - Start parameter
 * @param {number} tEnd - End parameter
 */
export function custom(fx, fy, tStart = 0, tEnd = 1) {
    return { fx, fy, tStart, tEnd };
}

// Export all as default object
export default {
    circle,
    ellipse,
    line,
    spiral,
    heart,
    star,
    infinity,
    rose,
    lissajous,
    squareWave,
    sineWave,
    sawtoothWave,
    triangleWave,
    cycloid,
    butterfly,
    figure8,
    polygonalSpiral,
    superellipse,
    custom
};
