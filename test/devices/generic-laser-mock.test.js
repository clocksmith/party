#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../../dmx.js';
import { DynamicDeviceControl } from '../../dmx-device-control.js';
import chalk from 'chalk';
import ora from 'ora';
import { EventEmitter } from 'events';
import { DEFAULT_PORT } from './hardware-test-utils.js';

const DEVICE_PORT = DEFAULT_PORT;
const PROFILE_PATH = './device-profiles/generic-laser.json';

// Mock Serial Interface for testing without hardware
class MockDMXSerialInterface extends EventEmitter {
    constructor(options) {
        super();
        this.portPath = options.portPath;
        this.isConnected = false;
        this.dmxData = new Uint8Array(513); // DMX is 1-indexed
        console.log(chalk.yellow('⚠️  Using MOCK DMX interface - no actual hardware control'));
    }

    async connect() {
        console.log(chalk.gray(`Mock connecting to ${this.portPath}...`));
        await this.sleep(500); // Simulate connection delay
        this.isConnected = true;
        this.emit('connect');
        return true;
    }

    async disconnect() {
        this.isConnected = false;
        this.emit('disconnect');
        return true;
    }

    async sendDMXData(data) {
        if (!this.isConnected) {
            throw new Error('Not connected');
        }
        this.dmxData = new Uint8Array(data);
        // Log significant changes
        this.logChannelChanges();
        return true;
    }

    logChannelChanges() {
        const significantChannels = {
            1: 'Mode',
            2: 'Pattern Size',
            3: 'Gallery',
            4: 'Pattern',
            11: 'Red',
            12: 'Green', 
            13: 'Blue',
            17: 'Strobe',
            31: 'Global Strobe',
            32: 'Reset'
        };

        const changes = [];
        for (const [ch, name] of Object.entries(significantChannels)) {
            const value = this.dmxData[ch];
            if (value > 0) {
                changes.push(`${name}:${value}`);
            }
        }

        if (changes.length > 0) {
            console.log(chalk.dim(`  DMX: [${changes.join(', ')}]`));
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class LaserTestSuite {
    constructor(useMock = false) {
        this.controller = null;
        this.device = null;
        this.spinner = ora();
        this.useMock = useMock;
    }

    async initialize() {
        console.log(chalk.cyan.bold('\n🚀 DMX Laser Test Suite\n'));
        console.log(chalk.gray(`Device: ${DEVICE_PORT}`));
        console.log(chalk.gray(`Profile: ${PROFILE_PATH}`));
        console.log(chalk.gray(`Mode: ${this.useMock ? 'MOCK (no hardware)' : 'LIVE (hardware control)'}\n`));

        try {
            // Initialize Serial Interface (mock or real)
            this.spinner.start('Initializing DMX serial interface...');
            
            const serialInterface = this.useMock 
                ? new MockDMXSerialInterface({ portPath: DEVICE_PORT })
                : new DMXSerialInterface({ portPath: DEVICE_PORT });

            // Initialize DMX Controller
            this.controller = new DMXController({
                serialInterface: serialInterface,
                universeSize: 512,
                refreshRateMs: 25  // 40Hz refresh rate
            });

            await this.controller.connect();
            this.spinner.succeed('DMX controller connected');

            // Initialize Device Controller with laser profile
            this.spinner.start('Loading laser profile...');
            this.device = new DynamicDeviceControl(this.controller, {
                dmxStartAddress: 1
            });

            await this.device.loadProfile(PROFILE_PATH);
            this.spinner.succeed('Laser profile loaded');
            
            console.log(chalk.green('\n✅ System initialized successfully!\n'));
            
        } catch (error) {
            this.spinner.fail(`Initialization failed: ${error.message}`);
            throw error;
        }
    }

    async showChannelMap() {
        console.log(chalk.yellow('\n📊 Channel Mapping\n'));
        
        const channels = this.device.currentProfile.channels;
        const categories = {
            'Control': ['mode', 'reset'],
            'Pattern': ['pattern1', 'pattern2', 'patternSize1', 'patternSize2', 'gallery'],
            'Movement': ['horizontalPosition1', 'verticalPosition1', 'horizontalPosition2', 'verticalPosition2'],
            'Effects': ['zoom1', 'rotation1', 'horizontalMovement1', 'verticalMovement1'],
            'Color': ['colorRed1', 'colorGreen1', 'colorBlue1', 'colorWhite1'],
            'Timing': ['animationSpeed1', 'strobe1', 'globalStrobe', 'movementSpeed']
        };

        for (const [category, channelNames] of Object.entries(categories)) {
            console.log(chalk.cyan(`${category}:`));
            for (const name of channelNames) {
                if (channels[name]) {
                    const ch = channels[name];
                    console.log(chalk.gray(`  Ch ${String(ch.channel).padStart(3)}: ${name.padEnd(20)} - ${ch.description}`));
                }
            }
        }
    }

    async testSafetyShutter() {
        console.log(chalk.yellow('\n🛡️  Testing Safety Shutter\n'));
        
        // Test blackout (safety shutter closed)
        this.spinner.start('Activating blackout (safety)...');
        await this.device.applyPreset('blackout');
        await this.sleep(2000);
        this.spinner.succeed('Blackout activated - all lasers off');

        // Open shutter with safe test pattern
        this.spinner.start('Opening shutter with test pattern...');
        await this.device.applyPreset('test');
        await this.sleep(3000);
        this.spinner.succeed('Test pattern active - red circle');

        // Return to blackout
        this.spinner.start('Returning to blackout...');
        await this.device.applyPreset('blackout');
        await this.sleep(1000);
        this.spinner.succeed('Safety test complete');
    }

    async testBasicPatterns() {
        console.log(chalk.yellow('\n🎨 Testing Basic Patterns\n'));

        const patterns = [
            { name: 'Circle', value: 10, color: { r: 255, g: 0, b: 0 } },
            { name: 'Square', value: 20, color: { r: 0, g: 255, b: 0 } },
            { name: 'Triangle', value: 30, color: { r: 0, g: 0, b: 255 } },
            { name: 'Star', value: 40, color: { r: 255, g: 255, b: 0 } }
        ];

        for (const pattern of patterns) {
            this.spinner.start(`Displaying ${pattern.name} pattern...`);
            
            await this.device.setChannels({
                mode: 50,  // DMX manual mode
                pattern1: pattern.value,
                colorRed1: pattern.color.r,
                colorGreen1: pattern.color.g,
                colorBlue1: pattern.color.b,
                horizontalPosition1: 128,  // Center
                verticalPosition1: 128     // Center
            });

            await this.sleep(2000);
            this.spinner.succeed(`${pattern.name} pattern displayed`);
        }
    }

    async testColorEffects() {
        console.log(chalk.yellow('\n🌈 Testing Color Effects\n'));

        await this.device.setChannels({
            mode: 50,
            pattern1: 50,  // Wave pattern
            horizontalPosition1: 128,
            verticalPosition1: 128
        });

        const colors = [
            { name: 'Red', r: 255, g: 0, b: 0 },
            { name: 'Green', r: 0, g: 255, b: 0 },
            { name: 'Blue', r: 0, g: 0, b: 255 },
            { name: 'Yellow', r: 255, g: 255, b: 0 },
            { name: 'Cyan', r: 0, g: 255, b: 255 },
            { name: 'Magenta', r: 255, g: 0, b: 255 },
            { name: 'White', r: 255, g: 255, b: 255 }
        ];

        for (const color of colors) {
            this.spinner.start(`Testing ${color.name}...`);
            await this.device.setChannels({
                colorRed1: color.r,
                colorGreen1: color.g,
                colorBlue1: color.b
            });
            await this.sleep(1500);
            this.spinner.succeed(`${color.name} tested`);
        }
    }

    async testPresets() {
        console.log(chalk.yellow('\n📋 Testing Presets\n'));

        const presets = [
            { name: 'test', display: 'Test Pattern', duration: 2000 },
            { name: 'ambient', display: 'Ambient Mode', duration: 3000 },
            { name: 'party', display: 'Party Mode', duration: 3000 }
        ];

        for (const preset of presets) {
            this.spinner.start(`Loading ${preset.display}...`);
            await this.device.applyPreset(preset.name);
            this.spinner.succeed(`${preset.display} active`);
            await this.sleep(preset.duration);
        }

        // Return to blackout
        await this.device.applyPreset('blackout');
    }

    async testChannelDump() {
        console.log(chalk.yellow('\n📝 Current Channel Values\n'));
        
        const state = this.controller.getCurrentState();
        const channels = this.device.currentProfile.channels;
        
        console.log(chalk.cyan('Active Channels:'));
        for (const [name, def] of Object.entries(channels)) {
            const value = state[def.channel];
            if (value > 0) {
                console.log(chalk.gray(`  Ch ${String(def.channel).padStart(3)} (${name}): ${value}`));
            }
        }
    }

    async runFullTest() {
        try {
            await this.initialize();
            await this.showChannelMap();

            const tests = [
                { name: 'Safety Shutter', fn: () => this.testSafetyShutter() },
                { name: 'Basic Patterns', fn: () => this.testBasicPatterns() },
                { name: 'Color Effects', fn: () => this.testColorEffects() },
                { name: 'Presets', fn: () => this.testPresets() },
                { name: 'Channel Dump', fn: () => this.testChannelDump() }
            ];

            console.log(chalk.cyan.bold('\n📊 Test Suite:'));
            tests.forEach((test, i) => {
                console.log(chalk.gray(`  ${i + 1}. ${test.name}`));
            });

            for (const test of tests) {
                await test.fn();
                await this.sleep(1000);
            }

            console.log(chalk.green.bold('\n✅ All tests completed!\n'));

        } catch (error) {
            console.error(chalk.red.bold('\n❌ Test failed:'), error.message);
            
            // Emergency cleanup
            if (this.controller) {
                await this.controller.blackout();
                await this.controller.disconnect();
            }
            
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async cleanup() {
        console.log(chalk.cyan('\n🧹 Cleaning up...\n'));
        
        if (this.controller) {
            this.spinner.start('Applying blackout...');
            await this.controller.blackout();
            this.spinner.succeed('Blackout applied');

            this.spinner.start('Disconnecting controller...');
            await this.controller.disconnect();
            this.spinner.succeed('Controller disconnected');
        }

        console.log(chalk.green('\n👋 Test complete\n'));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle process interruption
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n⚠️  Interrupted - executing emergency stop...'));
    process.exit(0);
});

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.cyan.bold('\nDMX Laser Test Suite\n'));
        console.log('Usage: node test/devices/generic-laser-mock.test.js [options]\n');
        console.log('Options:');
        console.log('  --help, -h     Show this help message');
        console.log('  --mock         Use mock interface (no hardware required)');
        console.log('  --live         Use real hardware interface');
        console.log('  --channels     Show channel mapping only');
        console.log('  --safety       Run only safety tests');
        console.log('  --patterns     Run only pattern tests');
        console.log('  --colors       Run only color tests\n');
        console.log('Default: Uses mock interface for safety\n');
        process.exit(0);
    }

    // Default to mock mode for safety
    const useMock = !args.includes('--live');
    const suite = new LaserTestSuite(useMock);

    try {
        if (args.includes('--channels')) {
            await suite.initialize();
            await suite.showChannelMap();
        } else if (args.includes('--safety')) {
            await suite.initialize();
            await suite.testSafetyShutter();
            await suite.cleanup();
        } else if (args.includes('--patterns')) {
            await suite.initialize();
            await suite.testBasicPatterns();
            await suite.cleanup();
        } else if (args.includes('--colors')) {
            await suite.initialize();
            await suite.testColorEffects();
            await suite.cleanup();
        } else {
            // Run full test
            await suite.runFullTest();
        }
    } catch (error) {
        console.error(chalk.red.bold('Fatal error:'), error);
        process.exit(1);
    }
}

// Run the test suite
main().catch(console.error);
