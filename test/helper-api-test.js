#!/usr/bin/env node
/**
 * Quick test for DMX Helper API
 * Tests that all methods work without errors
 */

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { EhahoL2400Helper, GenericLaserHelper } from '../dmx-helpers.js';
import { MockSerialPort } from '../dmx-mock.js';

console.log('🧪 Testing DMX Helper API\n');

// Setup mock DMX
const mockPort = new MockSerialPort('/dev/mock');
const serial = new DMXSerialInterface({ portPath: '/dev/mock' });
serial.port = mockPort;
serial._isConnected = true;

const dmx = new DMXController({ serialInterface: serial });
await dmx.connect();

console.log('✓ Mock DMX connected\n');

// Test Ehaho Helper
console.log('Testing EhahoL2400Helper...');
const laser = new EhahoL2400Helper(dmx, 1);

try {
    // Test all methods
    laser.mode('dmx');
    laser.mode(50);
    console.log('  ✓ mode() - string and number');

    laser.size1('medium');
    laser.size1(96);
    console.log('  ✓ size1() - string and number');

    laser.gallery('beam');
    laser.gallery(0);
    console.log('  ✓ gallery() - string and number');

    laser.pattern1(42);
    console.log('  ✓ pattern1() - number');

    laser.zoom1('static');
    laser.zoom1('in', 0.8);
    laser.zoom1(140);
    console.log('  ✓ zoom1() - string, string+intensity, number');

    laser.rotation1('cw', 0.5);
    laser.rotation1(160);
    console.log('  ✓ rotation1() - string+speed, number');

    laser.position1(0.5, 0.5);
    laser.position1(128, 128);
    console.log('  ✓ position1() - normalized and raw');

    laser.x1('center');
    laser.x1(0.5);
    laser.x1(64);
    console.log('  ✓ x1() - string, normalized, raw');

    laser.y1('center');
    laser.y1(0.5);
    laser.y1(64);
    console.log('  ✓ y1() - string, normalized, raw');

    laser.horizontalMove1('wave_left', 0.6);
    laser.horizontalMove1(140);
    console.log('  ✓ horizontalMove1() - string+intensity, number');

    laser.verticalMove1('move_up', 0.8);
    laser.verticalMove1(200);
    console.log('  ✓ verticalMove1() - string+intensity, number');

    laser.hStretch1(0);
    laser.hStretch1(-0.5);
    laser.hStretch1(128);
    console.log('  ✓ hStretch1() - bipolar and raw');

    laser.vStretch1(0);
    laser.vStretch1(128);
    console.log('  ✓ vStretch1() - bipolar and raw');

    laser.color1('red');
    laser.color1({ r: 255, g: 0, b: 0 });
    laser.color1(16);
    console.log('  ✓ color1() - string, RGB object, number');

    laser.strobe(false);
    laser.strobe('slow');
    laser.strobe(32);
    console.log('  ✓ strobe() - boolean, string, number');

    laser.nodeHighlight1(0.5);
    laser.nodeHighlight1(128);
    console.log('  ✓ nodeHighlight1() - normalized and raw');

    laser.nodeExpansion1(0.3);
    laser.nodeExpansion1(76);
    console.log('  ✓ nodeExpansion1() - normalized and raw');

    laser.gradualDraw1('forward');
    laser.gradualDraw1(64);
    console.log('  ✓ gradualDraw1() - string and number');

    laser.distortion1(0.5);
    laser.distortion1(128);
    console.log('  ✓ distortion1() - normalized and raw');

    laser.distortion2(0.5);
    console.log('  ✓ distortion2() - normalized');

    laser.enablePattern2(true);
    laser.enablePattern2(128);
    console.log('  ✓ enablePattern2() - boolean and number');

    // Pattern 2 methods
    laser.size2('large');
    laser.gallery2('animation');
    laser.pattern2(60);
    laser.zoom2('out', 0.7);
    laser.rotation2('ccw', 0.6);
    laser.position2(0.3, 0.7);
    laser.x2('left');
    laser.y2('top');
    laser.hFlip(true);
    laser.vFlip(false);
    laser.color2('blue');
    laser.globalColor('cycle');
    laser.nodeHighlight2('array');
    laser.nodeExpansion2(0.5);
    laser.gradualDraw2('reverse');
    console.log('  ✓ All Pattern 2 methods work');

    // Convenience methods
    laser.center();
    console.log('  ✓ center()');

    laser.reset();
    console.log('  ✓ reset()');

    laser.blackout();
    console.log('  ✓ blackout()');

    console.log('\n✅ EhahoL2400Helper: All methods work!\n');

} catch (error) {
    console.error('\n❌ EhahoL2400Helper test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}

// Test Generic Helper
console.log('Testing GenericLaserHelper...');
const generic = new GenericLaserHelper(dmx, 1);

try {
    generic.rgb(255, 0, 0);
    console.log('  ✓ rgb()');

    generic.color('red');
    generic.color('orange');
    generic.color('purple');
    console.log('  ✓ color() - named colors');

    console.log('\n✅ GenericLaserHelper: All methods work!\n');

} catch (error) {
    console.error('\n❌ GenericLaserHelper test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}

// Verify DMX state changes
const state = dmx.dmxState;
console.log('Testing DMX state updates...');

laser.mode(50);
if (state[1] !== 50) {
    console.error('❌ Mode not set correctly');
    process.exit(1);
}
console.log('  ✓ Channel 1 (mode) = 50');

laser.pattern1(42);
if (state[4] !== 42) {
    console.error('❌ Pattern not set correctly');
    process.exit(1);
}
console.log('  ✓ Channel 4 (pattern1) = 42');

laser.position1(0.5, 0.5);
// 0.5 normalized = 127.5 -> 128
if (state[7] !== 128 || state[8] !== 128) {
    console.error(`❌ Position not set correctly: ${state[7]}, ${state[8]}`);
    process.exit(1);
}
console.log('  ✓ Channels 7,8 (position) = 128,128');

laser.enablePattern2(true);
if (state[18] !== 128) {
    console.error('❌ Pattern2 enable not set correctly');
    process.exit(1);
}
console.log('  ✓ Channel 18 (enablePattern2) = 128');

console.log('\n✅ DMX state updates verified!\n');

await dmx.disconnect();

console.log('🎉 All helper API tests passed!\n');
process.exit(0);
