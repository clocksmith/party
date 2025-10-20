/**
 * DMX Canvas - Simple Example
 * Bare minimum code to get started with parametric curves
 */

import { DMXSerialInterface, DMXController } from '../laser/dmx.js';
import { DMXCanvas } from '../laser/dmx-canvas.js';
import * as Shapes from '../laser/dmx-shapes.js';

// Configuration
const PORT = '/dev/tty.usbserial-A50285BI';  // Change to your port

async function main() {
    console.log('🎨 DMX Canvas - Simple Example\n');

    // 1. Setup DMX
    console.log('Step 1: Connecting to DMX controller...');
    const serial = new DMXSerialInterface({ portPath: PORT });
    const dmx = new DMXController({ serialInterface: serial, refreshRateMs: 33 });
    await dmx.connect();
    console.log('✅ Connected\n');

    // 2. Create Canvas
    console.log('Step 2: Creating canvas...');
    const canvas = new DMXCanvas(dmx, {
        width: 127,
        height: 127,
        frameRate: 30
    });
    console.log('✅ Canvas created\n');

    // 3. Draw a circle
    console.log('Step 3: Drawing circle...');
    canvas.setStrokeStyle(255, 0, 0);  // Red
    canvas.circle(64, 64, 30);         // Center at (64,64), radius 30
    canvas.stroke();
    console.log('✅ Circle drawn\n');

    // 4. Animate!
    console.log('Step 4: Starting animation...');
    canvas.animate();
    console.log('✅ Animating! Press Ctrl+C to stop\n');

    // Keep running until user stops
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Stopping...');
        canvas.stop();
        await dmx.disconnect();
        console.log('✅ Stopped\n');
        process.exit(0);
    });
}

// Run
main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
