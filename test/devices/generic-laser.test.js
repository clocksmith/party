#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../../laser/dmx.js';
import { DynamicDeviceControl } from '../../laser/dmx-device-control.js';
import { PatternAnimator } from '../../laser/pattern-animator.js';
import chalk from 'chalk';
import ora from 'ora';
import {
    DEFAULT_PORT,
    connectWithTimeout,
    listAvailablePorts,
    verifyHardwarePort
} from './hardware-test-utils.js';

const DEFAULT_PROFILE_PATH = './device-profiles/generic-laser.json';

class LaserTestSuite {
    constructor(options = {}) {
        this.portPath = options.port || DEFAULT_PORT;
        this.profilePath = options.profilePath || DEFAULT_PROFILE_PATH;
        this.timeoutMs = options.timeoutMs;
        this.verbose = options.verbose || false;
        this.controller = null;
        this.serialInterface = null;
        this.device = null;
        this.animator = null;
        this.spinner = ora();
    }

    async initialize() {
        console.log(chalk.cyan.bold('\n🚀 DMX Laser Test Suite\n'));
        console.log(chalk.gray(`Port: ${this.portPath}`));
        console.log(chalk.gray(`Profile: ${this.profilePath}\n`));

        try {
            await verifyHardwarePort(this.portPath, { verbose: this.verbose });

            this.serialInterface = new DMXSerialInterface({
                portPath: this.portPath
            });

            this.controller = new DMXController({
                serialInterface: this.serialInterface,
                universeSize: 512,
                refreshRateMs: 25  // 40Hz refresh rate
            });

            try {
                await connectWithTimeout(this.controller, this.portPath, {
                    timeoutMs: this.timeoutMs
                });
            } catch (error) {
                if (this.serialInterface) {
                    try {
                        await this.serialInterface.disconnect();
                    } catch (_) {
                        // Ignore cleanup failures
                    }
                }
                throw error;
            }

            this.spinner.start('Loading laser profile...');
            this.device = new DynamicDeviceControl({
                dmxController: this.controller,
                profilePath: this.profilePath,
                dmxStartAddress: 1
            });

            await this.device.loadProfile(this.profilePath);
            this.spinner.succeed('Laser profile loaded');

            this.animator = new PatternAnimator(this.controller);

            console.log(chalk.green('\n✅ System initialized successfully!\n'));
        } catch (error) {
            if (this.spinner.isSpinning) {
                this.spinner.fail(`Initialization failed: ${error.message}`);
            } else {
                console.error(chalk.red(`Initialization failed: ${error.message}`));
            }
            throw error;
        }
    }

    async testSafetyShutter() {
        console.log(chalk.yellow('\n🛡️  Testing Safety Shutter\n'));
        
        // Test blackout (safety shutter closed)
        this.spinner.start('Activating blackout (safety)...');
        await this.device.applyPreset('blackout');
        await this.sleep(2000);
        this.spinner.succeed('Blackout activated');

        // Open shutter with safe test pattern
        this.spinner.start('Opening shutter with test pattern...');
        await this.device.applyPreset('test_single');
        await this.sleep(3000);
        this.spinner.succeed('Shutter opened - red circle pattern');

        // Return to blackout
        this.spinner.start('Returning to blackout...');
        await this.device.applyPreset('blackout');
        await this.sleep(1000);
        this.spinner.succeed('Safety test complete');
    }

    async testBasicPatterns() {
        console.log(chalk.yellow('\n🎨 Testing Basic Patterns\n'));

        const patterns = [
            { name: 'Circle', value: 10, color: 'red' },
            { name: 'Square', value: 20, color: 'green' },
            { name: 'Triangle', value: 30, color: 'blue' },
            { name: 'Star', value: 40, color: 'yellow' },
            { name: 'Wave', value: 50, color: 'cyan' },
            { name: 'Spiral', value: 60, color: 'magenta' },
            { name: 'Grid', value: 70, color: 'white' }
        ];

        const colorMap = {
            red: 16,
            green: 48,
            blue: 80,
            yellow: 112,
            cyan: 144,
            magenta: 176,
            white: 208
        };

        for (const pattern of patterns) {
            this.spinner.start(`Testing ${pattern.name} pattern...`);
            
            await this.device.setChannelByName('mode', 50); // DMX manual mode
            await this.device.setChannelByName('pattern1', pattern.value);
            await this.device.setChannelByName('forcedColor1', colorMap[pattern.color]);
            await this.device.setChannelByName('zoom1', 64); // Static zoom
            await this.device.setChannelByName('rotation1', 0); // No rotation
            await this.device.setChannelByName('horizontalMovement1', 128); // Center
            await this.device.setChannelByName('verticalMovement1', 128); // Center

            await this.sleep(3000);
            this.spinner.succeed(`${pattern.name} pattern displayed`);
        }
    }

    async testMovementEffects() {
        console.log(chalk.yellow('\n🔄 Testing Movement Effects\n'));

        // Set base pattern
        await this.device.setChannels({
            mode: 50,
            pattern1: 40,  // Star pattern
            colorRed1: 255,
            colorGreen1: 255,
            colorBlue1: 255
        });

        // Test zoom effects
        this.spinner.start('Testing zoom in/out...');
        await this.device.setChannel('zoom1', 140);  // Dynamic zoom in
        await this.sleep(3000);
        await this.device.setChannel('zoom1', 170);  // Dynamic zoom out
        await this.sleep(3000);
        this.spinner.succeed('Zoom effects tested');

        // Test rotation
        this.spinner.start('Testing rotation...');
        await this.device.setChannel('rotation1', 160);  // Dynamic rotation
        await this.sleep(3000);
        await this.device.setChannel('rotation1', 0);   // Stop rotation
        this.spinner.succeed('Rotation tested');

        // Test position movement
        this.spinner.start('Testing position movement...');
        
        // Move horizontally
        for (let pos = 0; pos <= 255; pos += 5) {
            await this.device.setChannel('horizontalMovement1', pos);
            await this.sleep(30);
        }
        
        // Move vertically
        for (let pos = 0; pos <= 255; pos += 5) {
            await this.device.setChannel('verticalMovement1', pos);
            await this.sleep(30);
        }
        
        // Return to center
        await this.device.setChannels({
            horizontalMovement1: 128,
            verticalMovement1: 128
        });
        
        this.spinner.succeed('Position movement tested');
    }

    async testColorEffects() {
        console.log(chalk.yellow('\n🌈 Testing Color Effects\n'));

        // Set a base pattern
        await this.device.setChannels({
            mode: 50,
            pattern1: 50,  // Wave pattern
            horizontalMovement1: 128,
            verticalMovement1: 128
        });

        // Color fade test
        this.spinner.start('Testing color fades...');
        
        // Fade through RGB
        for (let i = 0; i <= 255; i += 5) {
            await this.device.setChannels({
                colorRed1: 255 - i,
                colorGreen1: i,
                colorBlue1: Math.floor(i / 2)
            });
            await this.sleep(20);
        }
        
        this.spinner.succeed('Color fades tested');

        // Test color macro
        this.spinner.start('Testing color cycle macro...');
        await this.device.runMacro('colorCycle');
        this.spinner.succeed('Color cycle complete');
    }

    async testStrobeEffects() {
        console.log(chalk.yellow('\n⚡ Testing Strobe Effects\n'));
        
        // Warning
        console.log(chalk.red.bold('⚠️  WARNING: Strobe effects - may cause discomfort'));
        await this.sleep(2000);

        await this.device.setChannels({
            mode: 50,
            pattern1: 30,  // Triangle
            colorRed1: 255,
            colorGreen1: 255,
            colorBlue1: 255
        });

        const strobeSettings = [
            { name: 'Slow strobe', value: 64 },
            { name: 'Medium strobe', value: 128 },
            { name: 'Fast strobe', value: 192 }
        ];

        for (const strobe of strobeSettings) {
            this.spinner.start(`Testing ${strobe.name}...`);
            await this.device.setChannel('strobe', strobe.value);
            await this.sleep(2000);
            this.spinner.succeed(`${strobe.name} tested`);
        }

        // Turn off strobe
        await this.device.setChannel('strobe', 0);
    }

    async testPresets() {
        console.log(chalk.yellow('\n📋 Testing Presets\n'));

        const presets = [
            { name: 'Test', duration: 3000 },
            { name: 'Ambient', duration: 5000 },
            { name: 'Party', duration: 5000 }
        ];

        for (const preset of presets) {
            this.spinner.start(`Loading ${preset.name} preset...`);
            await this.device.applyPreset(preset.name.toLowerCase());
            this.spinner.succeed(`${preset.name} preset active`);
            await this.sleep(preset.duration);
        }
    }

    async testAnimatedSequence() {
        console.log(chalk.yellow('\n🎭 Testing Animated Sequence\n'));

        this.spinner.start('Running pattern sequence...');
        
        // Create animated sequence
        const sequence = {
            steps: [
                {
                    channels: {
                        mode: 50,
                        pattern1: 10,
                        forcedColor1: 16, // red
                        zoom1: 64
                    },
                    duration: 2000
                },
                {
                    channels: {
                        pattern1: 30,
                        forcedColor1: 48, // green
                        zoom1: 140
                    },
                    duration: 2000
                },
                {
                    channels: {
                        pattern1: 50,
                        forcedColor1: 80, // blue
                        rotation1: 160
                    },
                    duration: 2000
                },
                {
                    channels: {
                        pattern1: 70,
                        forcedColor1: 208, // white
                        zoom1: 200,
                        rotation1: 200
                    },
                    duration: 2000
                }
            ]
        };

        // Run sequence
        for (const step of sequence.steps) {
            for (const [channel, value] of Object.entries(step.channels)) {
                await this.device.setChannelByName(channel, value);
            }
            await this.sleep(step.duration);
        }

        this.spinner.succeed('Animated sequence complete');
    }

    async testEmergencyStop() {
        console.log(chalk.yellow('\n🛑 Testing Emergency Stop\n'));
        
        // Set active pattern
        await this.device.applyPreset('ambient');
        await this.sleep(2000);

        this.spinner.start('Executing emergency stop...');
        
        // Emergency blackout
        await this.controller.resetChannels();
        
        this.spinner.succeed('Emergency stop executed - all outputs at zero');
    }

    async runFullTest() {
        const tests = [
            { name: 'Safety Shutter', fn: () => this.testSafetyShutter() },
            { name: 'Basic Patterns', fn: () => this.testBasicPatterns() },
            { name: 'Movement Effects', fn: () => this.testMovementEffects() },
            { name: 'Color Effects', fn: () => this.testColorEffects() },
            { name: 'Strobe Effects', fn: () => this.testStrobeEffects() },
            { name: 'Presets', fn: () => this.testPresets() },
            { name: 'Animated Sequence', fn: () => this.testAnimatedSequence() },
            { name: 'Emergency Stop', fn: () => this.testEmergencyStop() }
        ];

        console.log(chalk.cyan.bold('\n📊 Test Suite Overview:'));
        tests.forEach((test, i) => {
            console.log(chalk.gray(`  ${i + 1}. ${test.name}`));
        });

        for (const test of tests) {
            await test.fn();
            await this.sleep(1000);
        }

        console.log(chalk.green.bold('\n✅ All tests completed successfully!\n'));
    }

    async cleanup() {
        if (!this.controller) {
            return;
        }

        console.log(chalk.cyan('\n🧹 Cleaning up...\n'));

        this.spinner.start('Applying blackout...');
        try {
            await this.controller.resetChannels();
            this.spinner.succeed('Blackout applied');
        } catch (error) {
            this.spinner.fail(`Failed to apply blackout: ${error.message}`);
        }

        this.spinner.start('Disconnecting controller...');
        try {
            await this.controller.disconnect();
            this.spinner.succeed('Controller disconnected');
        } catch (error) {
            this.spinner.fail(`Failed to disconnect controller: ${error.message}`);
        }

        console.log(chalk.green('\n👋 Test suite finished\n'));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const options = {
        mode: 'full',
        port: args.find(arg => arg.startsWith('--port='))?.split('=')[1],
        profilePath: args.find(arg => arg.startsWith('--profile='))?.split('=')[1],
        timeoutMs: (() => {
            const value = args.find(arg => arg.startsWith('--timeout='))?.split('=')[1];
            if (!value) return undefined;
            const parsed = Number.parseInt(value, 10);
            if (Number.isNaN(parsed) || parsed <= 0) {
                throw new Error('Invalid --timeout value. Provide timeout in milliseconds, e.g. --timeout=10000');
            }
            return parsed;
        })(),
        verbose: args.includes('--verbose') || args.includes('-v')
    };

    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.cyan.bold('\nDMX Laser Test Suite\n'));
        console.log('Usage: node test/devices/generic-laser.test.js [options]\n');
        console.log('Options:');
        console.log('  --help, -h       Show this help message');
        console.log('  --list-ports     List detected serial devices and exit');
        console.log('  --port=PATH      Override serial port (default auto-detected FTDI path)');
        console.log('  --profile=PATH   Override profile path (default generic laser profile)');
        console.log('  --timeout=MS     Override connection timeout in milliseconds');
        console.log('  --verbose, -v    Print additional hardware metadata during setup');
        console.log('  --safety         Run only the safety tests');
        console.log('  --patterns       Run only pattern-oriented tests');
        console.log('  --effects        Run only movement/color/strobe tests');
        console.log('  --full           Run the entire test suite (default)\n');
        process.exit(0);
    }

    if (args.includes('--list-ports')) {
        await listAvailablePorts();
        process.exit(0);
    }

    if (args.includes('--safety')) {
        options.mode = 'safety';
    } else if (args.includes('--patterns')) {
        options.mode = 'patterns';
    } else if (args.includes('--effects')) {
        options.mode = 'effects';
    } else if (args.includes('--full')) {
        options.mode = 'full';
    }

    const suite = new LaserTestSuite(options);
    let interrupted = false;

    const handleInterrupt = async (signal) => {
        if (interrupted) return;
        interrupted = true;
        console.log(chalk.yellow(`\n\n⚠️  Received ${signal} - executing emergency stop...`));
        try {
            await suite.cleanup();
        } finally {
            process.exit(1);
        }
    };

    process.on('SIGINT', handleInterrupt);
    process.on('SIGTERM', handleInterrupt);

    try {
        await suite.initialize();

        switch (options.mode) {
            case 'safety':
                await suite.testSafetyShutter();
                await suite.testEmergencyStop();
                break;
            case 'patterns':
                await suite.testBasicPatterns();
                await suite.testAnimatedSequence();
                break;
            case 'effects':
                await suite.testMovementEffects();
                await suite.testColorEffects();
                await suite.testStrobeEffects();
                break;
            default:
                await suite.runFullTest();
                break;
        }
    } catch (error) {
        console.error(chalk.red.bold('\n❌ Fatal error:'), error.message);
        process.exitCode = 1;
    } finally {
        process.off('SIGINT', handleInterrupt);
        process.off('SIGTERM', handleInterrupt);
        try {
            await suite.cleanup();
        } catch (cleanupError) {
            console.error(chalk.red('Cleanup error:'), cleanupError.message);
        }
    }
}

// Run the test suite
main().catch(error => {
    console.error(chalk.red('Unhandled error:'), error);
    process.exit(1);
});
