/**
 * DMX Canvas Demo
 * Demonstrates parametric curve drawing with DMX laser control
 *
 * Usage:
 *   node dmx-canvas-demo.js [demo-name]
 *
 * Available demos:
 *   - circle         : Simple rotating circle
 *   - heart          : Animated heart shape
 *   - spiral         : Expanding spiral
 *   - lissajous      : Lissajous curve (figure-8 style)
 *   - butterfly      : Butterfly curve
 *   - rose           : Rose curve
 *   - infinity       : Infinity symbol
 *   - waves          : Sine wave patterns
 *   - star           : 5-pointed star
 *   - multipath      : Multiple shapes at once
 *   - custom         : Custom parametric equations
 *   - all            : Run all demos sequentially
 */

import { DMXSerialInterface, DMXController } from './dmx.js';
import { DMXCanvas } from './dmx-canvas.js';
import * as Shapes from './dmx-shapes.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configuration
const PORT_PATH = process.env.DMX_PORT || '/dev/tty.usbserial-A50285BI';
const DEMO_DURATION = 10000; // 10 seconds per demo

/**
 * Setup DMX Canvas
 */
async function setupCanvas() {
    console.log('🎨 Setting up DMX Canvas...');
    console.log(`📡 Connecting to port: ${PORT_PATH}`);

    // Create DMX controller
    const serial = new DMXSerialInterface({ portPath: PORT_PATH });
    const dmx = new DMXController({
        serialInterface: serial,
        refreshRateMs: 33  // 30 Hz
    });

    await dmx.connect();
    console.log('✅ DMX Controller connected');

    // Create canvas
    const canvas = new DMXCanvas(dmx, {
        width: 127,
        height: 127,
        frameRate: 30,
        speed: 1.0,
        // Ehaho L2400 channel mapping
        modeChannel: 1,
        xChannel: 7,
        yChannel: 8,
        colorRChannel: 11,  // Forced color (single channel)
        colorGChannel: 11,  // Same as R for Ehaho
        colorBChannel: 11,  // Same as R for Ehaho
        sizeChannel: 2
    });

    console.log('✅ Canvas created');
    console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);
    console.log(`🎞️  Frame rate: ${canvas.frameRate} fps`);

    return { dmx, canvas };
}

/**
 * Demo: Simple circle
 */
function demoCircle(canvas) {
    console.log('\n🔵 Demo: Circle');

    canvas.clear();
    canvas.setStrokeStyle(255, 0, 0);  // Red
    canvas.circle(64, 64, 30);
    canvas.stroke();
}

/**
 * Demo: Heart shape
 */
function demoHeart(canvas) {
    console.log('\n❤️  Demo: Heart');

    canvas.clear();

    const shape = Shapes.heart(64, 64, 2);
    canvas.setStrokeStyle(255, 0, 128);  // Pink
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 100);
    canvas.stroke();
}

/**
 * Demo: Spiral
 */
function demoSpiral(canvas) {
    console.log('\n🌀 Demo: Spiral');

    canvas.clear();

    const shape = Shapes.spiral(64, 64, 5, 40, 3);
    canvas.setStrokeStyle(0, 255, 255);  // Cyan
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 150);
    canvas.stroke();
}

/**
 * Demo: Lissajous curve
 */
function demoLissajous(canvas) {
    console.log('\n∞  Demo: Lissajous Curve');

    canvas.clear();

    const shape = Shapes.lissajous(64, 64, 50, 50, 3, 2, Math.PI / 2);
    canvas.setStrokeStyle(0, 255, 0);  // Green
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 200);
    canvas.stroke();
}

/**
 * Demo: Butterfly curve
 */
function demoButterfly(canvas) {
    console.log('\n🦋 Demo: Butterfly Curve');

    canvas.clear();

    const shape = Shapes.butterfly(64, 64, 5);
    canvas.setStrokeStyle(255, 128, 0);  // Orange
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 200);
    canvas.stroke();
}

/**
 * Demo: Rose curve
 */
function demoRose(canvas) {
    console.log('\n🌹 Demo: Rose Curve');

    canvas.clear();

    const shape = Shapes.rose(64, 64, 30, 5, 1);
    canvas.setStrokeStyle(255, 0, 255);  // Magenta
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 200);
    canvas.stroke();
}

/**
 * Demo: Infinity symbol
 */
function demoInfinity(canvas) {
    console.log('\n♾️  Demo: Infinity Symbol');

    canvas.clear();

    const shape = Shapes.infinity(64, 64, 25);
    canvas.setStrokeStyle(255, 255, 0);  // Yellow
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 150);
    canvas.stroke();
}

/**
 * Demo: Sine waves
 */
function demoWaves(canvas) {
    console.log('\n〰️  Demo: Sine Waves');

    canvas.clear();

    const shape = Shapes.sineWave(10, 64, 100, 20, 3);
    canvas.setStrokeStyle(0, 255, 255);  // Cyan
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 150);
    canvas.stroke();
}

/**
 * Demo: Star
 */
function demoStar(canvas) {
    console.log('\n⭐ Demo: 5-Pointed Star');

    canvas.clear();

    const shape = Shapes.star(64, 64, 40, 15, 5);
    canvas.setStrokeStyle(255, 255, 0);  // Yellow
    canvas.beginPath();
    canvas.parametric(shape.fx, shape.fy, shape.tStart, shape.tEnd, 100);
    canvas.stroke();
}

/**
 * Demo: Multiple paths
 */
function demoMultiPath(canvas) {
    console.log('\n🎭 Demo: Multiple Paths');

    canvas.clear();

    // Draw three circles
    canvas.setStrokeStyle(255, 0, 0);
    canvas.circle(40, 64, 20);
    canvas.stroke();

    canvas.setStrokeStyle(0, 255, 0);
    canvas.circle(64, 64, 20);
    canvas.stroke();

    canvas.setStrokeStyle(0, 0, 255);
    canvas.circle(88, 64, 20);
    canvas.stroke();

    console.log('   Drawing 3 circles - will cycle through them');
}

/**
 * Demo: Custom parametric equation
 */
function demoCustom(canvas) {
    console.log('\n✨ Demo: Custom Parametric Curve');
    console.log('   Equation: x = t*cos(5t), y = t*sin(5t)');

    canvas.clear();

    // Custom spiral-like shape
    const fx = (t) => 64 + 40 * t * Math.cos(5 * t * Math.PI * 2);
    const fy = (t) => 64 + 40 * t * Math.sin(5 * t * Math.PI * 2);

    canvas.setStrokeStyle(128, 0, 255);  // Purple
    canvas.beginPath();
    canvas.parametric(fx, fy, 0, 1, 200);
    canvas.stroke();
}

/**
 * Demo: Animated drawing
 */
function demoAnimatedDrawing(canvas) {
    console.log('\n🎬 Demo: Animated Drawing');
    console.log('   Watch as shapes are drawn in real-time!');

    canvas.clear();

    // Draw a complex pattern step by step
    const steps = 50;
    let currentStep = 0;

    const drawStep = async () => {
        if (currentStep >= steps) return;

        const t = currentStep / steps;
        const radius = 20 + 15 * Math.sin(t * Math.PI * 4);
        const angle = t * Math.PI * 8;

        const x = 64 + 30 * Math.cos(angle);
        const y = 64 + 30 * Math.sin(angle);

        canvas.setStrokeStyle(
            Math.floor(255 * t),
            Math.floor(255 * (1 - t)),
            128
        );

        canvas.circle(x, y, radius, 16);
        canvas.stroke();

        currentStep++;
        await sleep(200);
        await drawStep();
    };

    return drawStep();
}

/**
 * Run a demo
 */
async function runDemo(name, canvas) {
    const demos = {
        circle: demoCircle,
        heart: demoHeart,
        spiral: demoSpiral,
        lissajous: demoLissajous,
        butterfly: demoButterfly,
        rose: demoRose,
        infinity: demoInfinity,
        waves: demoWaves,
        star: demoStar,
        multipath: demoMultiPath,
        custom: demoCustom
    };

    const demo = demos[name];
    if (!demo) {
        console.error(`❌ Unknown demo: ${name}`);
        console.log('\nAvailable demos:');
        Object.keys(demos).forEach(key => {
            console.log(`  - ${key}`);
        });
        return;
    }

    // Run the demo
    demo(canvas);

    // Start animation
    canvas.animate((time) => {
        // Optional: callback for per-frame updates
        if (Math.floor(time) % 5 === 0 && time - Math.floor(time) < 0.1) {
            process.stdout.write('.');
        }
    });

    // Wait for demo duration
    await sleep(DEMO_DURATION);

    // Stop animation
    canvas.stop();
    console.log('\n✅ Demo completed');
}

/**
 * Run all demos sequentially
 */
async function runAllDemos(canvas) {
    const demos = [
        'circle',
        'heart',
        'spiral',
        'lissajous',
        'butterfly',
        'rose',
        'infinity',
        'waves',
        'star',
        'multipath',
        'custom'
    ];

    console.log(`\n🎪 Running all ${demos.length} demos sequentially`);
    console.log(`⏱️  Each demo runs for ${DEMO_DURATION / 1000} seconds\n`);

    for (const demo of demos) {
        await runDemo(demo, canvas);
        await sleep(2000);  // 2 second pause between demos
    }

    console.log('\n🎉 All demos completed!');
}

/**
 * Interactive mode - let user draw
 */
async function interactiveMode(canvas) {
    console.log('\n🖌️  Interactive Mode');
    console.log('This would open an interactive shell for drawing');
    console.log('(Not implemented in this demo)');

    // Example of how interactive drawing would work:
    canvas.clear();

    // Draw based on user input
    console.log('\nDrawing sample interactive pattern...');

    canvas.setStrokeStyle(255, 0, 255);
    canvas.circle(64, 64, 30);
    canvas.stroke();

    canvas.animate();
    await sleep(5000);
    canvas.stop();
}

/**
 * Main function
 */
async function main() {
    const demoName = process.argv[2] || 'circle';

    console.log('═══════════════════════════════════════');
    console.log('   DMX CANVAS - PARAMETRIC CURVES');
    console.log('═══════════════════════════════════════\n');

    try {
        // Setup
        const { dmx, canvas } = await setupCanvas();

        // Add event listeners
        canvas.on('start', () => {
            console.log('▶️  Animation started');
        });

        canvas.on('stop', () => {
            console.log('⏸️  Animation stopped');
        });

        canvas.on('frame', ({ time }) => {
            // Optional: log every second
            if (Math.floor(time) !== Math.floor(time - 0.033)) {
                // New second
            }
        });

        // Run requested demo
        console.log(`\n🎬 Running demo: ${demoName}`);
        console.log(`⏱️  Duration: ${DEMO_DURATION / 1000} seconds\n`);

        if (demoName === 'all') {
            await runAllDemos(canvas);
        } else if (demoName === 'interactive') {
            await interactiveMode(canvas);
        } else {
            await runDemo(demoName, canvas);
        }

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        canvas.clear();
        await dmx.disconnect();
        console.log('✅ Disconnected\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    setupCanvas,
    demoCircle,
    demoHeart,
    demoSpiral,
    demoLissajous,
    demoButterfly,
    demoRose,
    demoInfinity,
    demoWaves,
    demoStar,
    demoMultiPath,
    demoCustom
};
