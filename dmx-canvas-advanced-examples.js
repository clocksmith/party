/**
 * DMX Canvas - Advanced Examples
 * Complex parametric curves and animations
 */

import { DMXSerialInterface, DMXController } from './dmx.js';
import { DMXCanvas } from './dmx-canvas.js';
import * as Shapes from './dmx-shapes.js';

const PORT = process.env.DMX_PORT || '/dev/tty.usbserial-A50285BI';

/**
 * Example 1: Rotating Galaxy Spiral
 */
async function galaxySpiral(canvas) {
    console.log('\n🌌 Example: Galaxy Spiral\n');

    canvas.clear();

    // Multi-arm spiral galaxy
    const arms = 3;
    for (let arm = 0; arm < arms; arm++) {
        const offset = (arm / arms) * Math.PI * 2;

        const fx = (t) => {
            const angle = t * Math.PI * 6 + offset;
            const radius = 5 + t * 35;
            return 64 + radius * Math.cos(angle);
        };

        const fy = (t) => {
            const angle = t * Math.PI * 6 + offset;
            const radius = 5 + t * 35;
            return 64 + radius * Math.sin(angle);
        };

        canvas.setStrokeStyle(
            Math.floor(100 + 155 * (arm / arms)),
            Math.floor(50 + 205 * (1 - arm / arms)),
            255
        );

        canvas.beginPath();
        canvas.parametric(fx, fy, 0, 1, 150);
        canvas.stroke();
    }

    canvas.speed = 0.8;
    canvas.animate();
}

/**
 * Example 2: DNA Double Helix
 */
async function dnaHelix(canvas) {
    console.log('\n🧬 Example: DNA Double Helix\n');

    canvas.clear();

    // Helix 1
    const helix1 = {
        fx: (t) => 64 + 25 * Math.cos(t * Math.PI * 6),
        fy: (t) => 20 + t * 88
    };

    canvas.setStrokeStyle(255, 0, 0);
    canvas.beginPath();
    canvas.parametric(helix1.fx, helix1.fy, 0, 1, 150);
    canvas.stroke();

    // Helix 2 (180° out of phase)
    const helix2 = {
        fx: (t) => 64 + 25 * Math.cos(t * Math.PI * 6 + Math.PI),
        fy: (t) => 20 + t * 88
    };

    canvas.setStrokeStyle(0, 0, 255);
    canvas.beginPath();
    canvas.parametric(helix2.fx, helix2.fy, 0, 1, 150);
    canvas.stroke();

    canvas.speed = 0.6;
    canvas.animate();
}

/**
 * Example 3: Atomic Orbital
 */
async function atomicOrbital(canvas) {
    console.log('\n⚛️  Example: Atomic Orbital\n');

    canvas.clear();

    // Electron orbits
    const orbits = [
        { radius: 15, speed: 1.0, color: { r: 255, g: 0, b: 0 } },
        { radius: 25, speed: 0.7, color: { r: 0, g: 255, b: 0 } },
        { radius: 35, speed: 0.5, color: { r: 0, g: 0, b: 255 } }
    ];

    for (const orbit of orbits) {
        canvas.setStrokeStyle(orbit.color);
        canvas.circle(64, 64, orbit.radius);
        canvas.stroke();
    }

    canvas.speed = 1.2;
    canvas.animate();
}

/**
 * Example 4: Mathematical Rose Garden
 */
async function roseGarden(canvas) {
    console.log('\n🌹 Example: Rose Garden (Multiple Petals)\n');

    canvas.clear();

    // Different rose curves
    const roses = [
        { n: 3, d: 1, radius: 20, color: { r: 255, g: 0, b: 128 } },
        { n: 5, d: 2, radius: 25, color: { r: 255, g: 128, b: 0 } },
        { n: 7, d: 3, radius: 30, color: { r: 128, g: 0, b: 255 } }
    ];

    for (const rose of roses) {
        const shape = Shapes.rose(64, 64, rose.radius, rose.n, rose.d);
        canvas.setStrokeStyle(rose.color);
        canvas.beginPath();
        canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 200);
        canvas.stroke();
    }

    canvas.speed = 0.7;
    canvas.animate();
}

/**
 * Example 5: Hypnotic Spirograph
 */
async function spirograph(canvas) {
    console.log('\n🎡 Example: Spirograph\n');

    canvas.clear();

    // Classic spirograph pattern
    const R = 30;  // Fixed circle radius
    const r = 10;  // Rolling circle radius
    const d = 8;   // Pen distance from rolling circle center

    const fx = (t) => {
        const angle = t * Math.PI * 20;
        return 64 + (R - r) * Math.cos(angle) + d * Math.cos((R - r) / r * angle);
    };

    const fy = (t) => {
        const angle = t * Math.PI * 20;
        return 64 + (R - r) * Math.sin(angle) - d * Math.sin((R - r) / r * angle);
    };

    canvas.setStrokeStyle(255, 0, 255);
    canvas.beginPath();
    canvas.parametric(fx, fy, 0, 1, 300);
    canvas.stroke();

    canvas.speed = 0.5;
    canvas.animate();
}

/**
 * Example 6: Harmonic Oscillator
 */
async function harmonicOscillator(canvas) {
    console.log('\n〰️  Example: Harmonic Oscillator\n');

    canvas.clear();

    // Lissajous with varying frequencies
    const patterns = [
        { a: 1, b: 2, phase: 0 },
        { a: 2, b: 3, phase: Math.PI / 4 },
        { a: 3, b: 4, phase: Math.PI / 2 }
    ];

    const colors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 }
    ];

    patterns.forEach((pattern, i) => {
        const liss = Shapes.lissajous(64, 64, 40, 40, pattern.a, pattern.b, pattern.phase);
        canvas.setStrokeStyle(colors[i]);
        canvas.beginPath();
        canvas.parametric(liss.fx, liss.fy, liss.tStart, liss.tEnd, 200);
        canvas.stroke();
    });

    canvas.speed = 0.8;
    canvas.animate();
}

/**
 * Example 7: Pulsating Heart
 */
async function pulsatingHeart(canvas) {
    console.log('\n💓 Example: Pulsating Heart\n');

    canvas.clear();

    // Create multiple hearts with different sizes (pulsing effect)
    const hearts = [
        { size: 1.5, color: { r: 255, g: 0, b: 100 } },
        { size: 2.0, color: { r: 255, g: 0, b: 150 } },
        { size: 2.5, color: { r: 255, g: 0, b: 200 } }
    ];

    hearts.forEach(heart => {
        const shape = Shapes.heart(64, 64, heart.size);
        canvas.setStrokeStyle(heart.color);
        canvas.beginPath();
        canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 120);
        canvas.stroke();
    });

    canvas.speed = 1.5;
    canvas.animate();
}

/**
 * Example 8: Trefoil Knot (3D projection)
 */
async function trefoilKnot(canvas) {
    console.log('\n🪢 Example: Trefoil Knot (2D Projection)\n');

    canvas.clear();

    // Trefoil knot projected to 2D
    const fx = (t) => {
        const angle = t * Math.PI * 2;
        return 64 + 30 * Math.sin(angle) + 15 * Math.sin(3 * angle);
    };

    const fy = (t) => {
        const angle = t * Math.PI * 2;
        return 64 + 30 * Math.cos(angle) - 15 * Math.cos(3 * angle);
    };

    canvas.setStrokeStyle(0, 255, 255);
    canvas.beginPath();
    canvas.parametric(fx, fy, 0, 1, 200);
    canvas.stroke();

    canvas.speed = 0.6;
    canvas.animate();
}

/**
 * Example 9: Epicycloid
 */
async function epicycloid(canvas) {
    console.log('\n⚙️  Example: Epicycloid (Gear Curve)\n');

    canvas.clear();

    const R = 20;  // Fixed circle radius
    const r = 5;   // Rolling circle radius

    const fx = (t) => {
        const angle = t * Math.PI * 10;
        return 64 + (R + r) * Math.cos(angle) - r * Math.cos((R + r) / r * angle);
    };

    const fy = (t) => {
        const angle = t * Math.PI * 10;
        return 64 + (R + r) * Math.sin(angle) - r * Math.sin((R + r) / r * angle);
    };

    canvas.setStrokeStyle(255, 128, 0);
    canvas.beginPath();
    canvas.parametric(fx, fy, 0, 1, 250);
    canvas.stroke();

    canvas.speed = 0.7;
    canvas.animate();
}

/**
 * Example 10: Bezier-like Curve
 */
async function bezierCurve(canvas) {
    console.log('\n📐 Example: Bezier-like Curve\n');

    canvas.clear();

    // Cubic Bezier approximation using parametric equations
    const p0 = { x: 20, y: 100 };
    const p1 = { x: 40, y: 20 };
    const p2 = { x: 90, y: 20 };
    const p3 = { x: 110, y: 100 };

    const fx = (t) => {
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        return mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    };

    const fy = (t) => {
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        return mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
    };

    canvas.setStrokeStyle(128, 255, 0);
    canvas.beginPath();
    canvas.parametric(fx, fy, 0, 1, 100);
    canvas.stroke();

    canvas.speed = 1.0;
    canvas.animate();
}

/**
 * Run all examples
 */
async function runExample(name, canvas) {
    const examples = {
        galaxy: galaxySpiral,
        dna: dnaHelix,
        atom: atomicOrbital,
        roses: roseGarden,
        spirograph: spirograph,
        harmonic: harmonicOscillator,
        heart: pulsatingHeart,
        knot: trefoilKnot,
        gear: epicycloid,
        bezier: bezierCurve
    };

    const example = examples[name];
    if (!example) {
        console.error(`Unknown example: ${name}`);
        console.log('\nAvailable examples:');
        Object.keys(examples).forEach(key => console.log(`  - ${key}`));
        return;
    }

    await example(canvas);

    // Run for 15 seconds
    await new Promise(resolve => setTimeout(resolve, 15000));

    canvas.stop();
}

/**
 * Main
 */
async function main() {
    const exampleName = process.argv[2] || 'galaxy';

    console.log('═══════════════════════════════════════');
    console.log('   DMX CANVAS - ADVANCED EXAMPLES');
    console.log('═══════════════════════════════════════');

    // Setup
    const serial = new DMXSerialInterface({ portPath: PORT });
    const dmx = new DMXController({ serialInterface: serial, refreshRateMs: 33 });
    await dmx.connect();

    const canvas = new DMXCanvas(dmx, {
        width: 127,
        height: 127,
        frameRate: 30
    });

    console.log(`\n📡 Connected to ${PORT}`);
    console.log(`🎨 Canvas: ${canvas.width}x${canvas.height}`);

    try {
        if (exampleName === 'all') {
            const examples = [
                'galaxy', 'dna', 'atom', 'roses', 'spirograph',
                'harmonic', 'heart', 'knot', 'gear', 'bezier'
            ];

            for (const ex of examples) {
                await runExample(ex, canvas);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } else {
            await runExample(exampleName, canvas);
        }

        // Cleanup
        canvas.clear();
        await dmx.disconnect();
        console.log('\n✅ Completed\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    galaxySpiral,
    dnaHelix,
    atomicOrbital,
    roseGarden,
    spirograph,
    harmonicOscillator,
    pulsatingHeart,
    trefoilKnot,
    epicycloid,
    bezierCurve
};
