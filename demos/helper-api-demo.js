/**
 * DMX Helper API Demo
 *
 * Demonstrates the simplified helper API for Ehaho L2400 laser control.
 * Run: node demos/helper-api-demo.js
 */

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { EhahoL2400Helper } from '../dmx-helpers.js';

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runDemo() {
    console.log('🎭 DMX Helper API Demo\n');

    // Setup DMX controller
    const serial = new DMXSerialInterface({
        portPath: '/dev/tty.usbserial'  // Change to your port, or use mock
    });

    const dmx = new DMXController({
        serialInterface: serial
    });

    try {
        await dmx.connect();
        console.log('✅ Connected to DMX interface\n');
    } catch (error) {
        console.log('⚠️  No DMX hardware found, using mock mode\n');
    }

    // Create helper
    const laser = new EhahoL2400Helper(dmx, 1);  // Start address 1

    console.log('📋 Demo 1: Simple setup with helper API\n');

    // Simple setup - note how clean this is!
    laser.mode('dmx');           // String enum
    laser.gallery('beam');       // String enum
    laser.pattern1(20);          // Number
    laser.position1(0.5, 0.5);   // Normalized floats (0-1)
    laser.color1('red');         // String color name

    console.log('   ✓ Set mode to DMX manual');
    console.log('   ✓ Selected beam gallery');
    console.log('   ✓ Pattern #20');
    console.log('   ✓ Centered at (0.5, 0.5)');
    console.log('   ✓ Red color\n');

    await sleep(2000);

    console.log('📋 Demo 2: Moving pattern\n');

    laser.pattern1(60);          // Spiral
    laser.rotation1('cw', 0.7);  // Clockwise at 70% speed
    laser.color1('blue');

    console.log('   ✓ Spiral pattern');
    console.log('   ✓ Rotating clockwise at 70% speed');
    console.log('   ✓ Blue color\n');

    await sleep(3000);

    console.log('📋 Demo 3: Position methods\n');

    // Different ways to set position
    laser.position1(0.2, 0.8);           // Normalized
    await sleep(1000);

    laser.x1('left');                    // String position
    await sleep(1000);

    laser.x1('right');
    await sleep(1000);

    laser.position1(0.5, 0.5);           // Back to center
    console.log('   ✓ Moved pattern to various positions\n');

    await sleep(1000);

    console.log('📋 Demo 4: Color examples\n');

    const colors = ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'white'];
    for (const color of colors) {
        laser.color1(color);
        console.log(`   ✓ ${color.toUpperCase()}`);
        await sleep(800);
    }
    console.log();

    await sleep(1000);

    console.log('📋 Demo 5: Dual patterns\n');

    // Enable second pattern
    laser.enablePattern2(true);          // Boolean!
    laser.pattern2(30);
    laser.position2(0.3, 0.3);
    laser.color2('green');

    // Keep pattern 1 different
    laser.pattern1(10);
    laser.position1(0.7, 0.7);
    laser.color1('red');

    console.log('   ✓ Dual patterns enabled');
    console.log('   ✓ Pattern 1: Red at (0.7, 0.7)');
    console.log('   ✓ Pattern 2: Green at (0.3, 0.3)\n');

    await sleep(3000);

    console.log('📋 Demo 6: Advanced effects\n');

    laser.enablePattern2(false);
    laser.pattern1(80);
    laser.zoom1('in', 0.8);              // Zoom in at 80% intensity
    laser.strobe('slow');                // Strobe effect

    console.log('   ✓ Zoom in effect at 80% intensity');
    console.log('   ✓ Slow strobe\n');

    await sleep(3000);

    // Turn off strobe (important!)
    laser.strobe('off');

    console.log('📋 Demo 7: Array effect (advanced)\n');

    // Pattern 2 as grid
    laser.enablePattern2(true);
    laser.pattern2(80);                  // Grid pattern
    laser.color2('green');

    // Pattern 1 will be arrayed on grid points
    laser.pattern1(10);                  // Small circle
    laser.color1('red');
    laser.nodeHighlight2('array');       // The magic happens here!

    console.log('   ✓ Pattern 1 (red circles) arrayed onto Pattern 2 (green grid)');
    console.log('   ✓ This creates a grid of red circles!\n');

    await sleep(4000);

    console.log('📋 Demo 8: Stretch and distortion\n');

    laser.enablePattern2(false);
    laser.pattern1(20);
    laser.position1(0.5, 0.5);
    laser.color1('cyan');

    // Stretch (accepts -1 to 1 range)
    laser.hStretch1(0.5);                // 50% wider
    await sleep(1500);

    laser.hStretch1(-0.5);               // 50% narrower
    await sleep(1500);

    laser.hStretch1(0);                  // Back to normal

    // Distortion (accepts 0-1 normalized)
    laser.distortion1(0.5);
    console.log('   ✓ Horizontal stretch demo');
    console.log('   ✓ Applied distortion\n');

    await sleep(2000);

    console.log('📋 Demo 9: Movement modes\n');

    laser.distortion1(0);
    laser.pattern1(30);

    laser.horizontalMove1('wave_left', 0.6);
    console.log('   ✓ Wave left at 60% intensity');
    await sleep(3000);

    laser.horizontalMove1('move_right', 0.8);
    console.log('   ✓ Moving right at 80% speed');
    await sleep(3000);

    laser.horizontalMove1('static');
    laser.x1('center');
    console.log('   ✓ Back to static center\n');

    await sleep(1000);

    console.log('📋 Demo 10: Convenience methods\n');

    // Center both patterns
    laser.center();
    console.log('   ✓ Centered all patterns');

    await sleep(1000);

    // Reset to defaults
    laser.reset();
    console.log('   ✓ Reset to safe defaults');

    await sleep(2000);

    // Blackout
    laser.blackout();
    console.log('   ✓ Blackout (laser off)\n');

    await sleep(1000);

    console.log('✨ Demo complete!\n');

    console.log('📝 Summary of what you can do:\n');
    console.log('   • Use strings for modes: laser.mode("dmx")');
    console.log('   • Use strings for colors: laser.color1("red")');
    console.log('   • Use floats 0-1 for position: laser.position1(0.5, 0.5)');
    console.log('   • Use booleans: laser.enablePattern2(true)');
    console.log('   • Or raw DMX values: laser.pattern1(42)');
    console.log('   • Everything is validated and clamped!\n');

    // Disconnect
    await dmx.disconnect();
    console.log('👋 Disconnected\n');
}

// Run the demo
runDemo().catch(error => {
    console.error('❌ Demo error:', error);
    process.exit(1);
});
