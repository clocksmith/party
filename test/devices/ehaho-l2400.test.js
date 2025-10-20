#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../../laser/dmx.js';
import { ProfileBasedDeviceControl } from '../../laser/dmx-profile-based-control.js';
import { DeviceProfileManager } from '../../laser/dmx-device-control.js';
import { MockSerialPort } from '../../laser/dmx-mock.js';
import chalk from 'chalk';
import ora from 'ora';
import {
    DEFAULT_PORT,
    connectWithTimeout,
    listAvailablePorts,
    verifyHardwarePort
} from './hardware-test-utils.js';

class EhahoL2400Test {
    constructor(options = {}) {
        this.useMock = options.mock !== false;
        this.verbose = options.verbose || false;
        this.profilePath = './device-profiles/ehaho-l2400.json';
        this.portPath = options.port || DEFAULT_PORT;
        this.testResults = [];
    }

    async initialize() {
        console.log(chalk.cyan('\n🔬 Ehaho L2400 Device Test Suite\n'));
        console.log(chalk.gray('Profile:'), this.profilePath);
        console.log(chalk.gray('Mode:'), this.useMock ? 'MOCK' : 'HARDWARE');
        console.log(chalk.gray('Port:'), this.portPath);
        console.log();

        const profileManager = new DeviceProfileManager({
            profilesDir: './device-profiles'
        });

        this.profile = await profileManager.loadProfile('ehaho-l2400.json');

        if (this.useMock) {
            const mockPort = new MockSerialPort(this.portPath);
            this.serialInterface = new DMXSerialInterface({
                portPath: this.portPath
            });
            this.serialInterface.port = mockPort;
            this.serialInterface._isConnected = true;
        } else {
            await verifyHardwarePort(this.portPath, { verbose: this.verbose });
            this.serialInterface = new DMXSerialInterface({
                portPath: this.portPath
            });
        }

        this.controller = new DMXController({
            serialInterface: this.serialInterface,
            frameRate: 30
        });

        this.device = new ProfileBasedDeviceControl({
            dmxController: this.controller,
            profile: this.profile,
            startAddress: 1
        });

        if (this.useMock) {
            await this.controller.connect();
        } else {
            try {
                await connectWithTimeout(this.controller, this.portPath);
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
        }
        console.log(chalk.green('✓ Controller connected\n'));
    }

    async testSinglePattern() {
        const spinner = ora('Testing single pattern mode...').start();

        try {
            await this.device.blackout();
            await this.sleep(500);

            await this.device.setChannel('mode', 50);
            await this.device.setChannel('gallerySelection', 0);
            await this.device.setChannel('pattern1', 20);
            await this.device.setChannel('forcedColor1', 16);

            await this.sleep(2000);

            const state = this.controller.dmxState;
            const success = state[1] === 50 && state[4] === 20;

            if (success) {
                spinner.succeed('Single pattern test passed');
                this.testResults.push({ test: 'Single Pattern', status: 'PASS' });
            } else {
                spinner.fail('Single pattern test failed');
                this.testResults.push({ test: 'Single Pattern', status: 'FAIL' });
            }
        } catch (error) {
            spinner.fail(`Single pattern test error: ${error.message}`);
            this.testResults.push({ test: 'Single Pattern', status: 'ERROR', error: error.message });
        }
    }

    async testDualPattern() {
        const spinner = ora('Testing dual pattern mode...').start();

        try {
            await this.device.blackout();
            await this.sleep(500);

            await this.device.setChannel('mode', 50);
            await this.device.setChannel('gallerySelection', 200);
            await this.device.setChannel('pattern1', 30);
            await this.device.setChannel('forcedColor1', 48);

            await this.device.setChannel('secondLampPattern', 128);
            await this.device.setChannel('patternLibrary2', 0);
            await this.device.setChannel('pattern2', 60);
            await this.device.setChannel('forcedColor2', 80);

            await this.sleep(2000);

            const state = this.controller.dmxState;
            const success = state[18] === 128 && state[21] === 60;

            if (success) {
                spinner.succeed('Dual pattern test passed');
                this.testResults.push({ test: 'Dual Pattern', status: 'PASS' });
            } else {
                spinner.fail('Dual pattern test failed');
                this.testResults.push({ test: 'Dual Pattern', status: 'FAIL' });
            }
        } catch (error) {
            spinner.fail(`Dual pattern test error: ${error.message}`);
            this.testResults.push({ test: 'Dual Pattern', status: 'ERROR', error: error.message });
        }
    }

    async testColorCycling() {
        const spinner = ora('Testing color cycling...').start();

        try {
            await this.device.setChannel('mode', 50);
            await this.device.setChannel('pattern1', 10);

            const colors = [
                { name: 'Red', value: 16 },
                { name: 'Green', value: 48 },
                { name: 'Blue', value: 80 },
                { name: 'Yellow', value: 112 },
                { name: 'Cyan', value: 144 },
                { name: 'Magenta', value: 176 },
                { name: 'White', value: 208 }
            ];

            for (const color of colors) {
                spinner.text = `Testing color: ${color.name}`;
                await this.device.setChannel('forcedColor1', color.value);
                await this.sleep(500);
            }

            spinner.succeed('Color cycling test passed');
            this.testResults.push({ test: 'Color Cycling', status: 'PASS' });
        } catch (error) {
            spinner.fail(`Color cycling test error: ${error.message}`);
            this.testResults.push({ test: 'Color Cycling', status: 'ERROR', error: error.message });
        }
    }

    async testMovementEffects() {
        const spinner = ora('Testing movement effects...').start();

        try {
            await this.device.setChannel('mode', 50);
            await this.device.setChannel('pattern1', 40);
            await this.device.setChannel('forcedColor1', 144);

            spinner.text = 'Testing horizontal wave';
            await this.device.setChannel('horizontalMovement1', 140);
            await this.sleep(1500);

            spinner.text = 'Testing vertical wave';
            await this.device.setChannel('horizontalMovement1', 64);
            await this.device.setChannel('verticalMovement1', 140);
            await this.sleep(1500);

            spinner.text = 'Testing zoom effects';
            await this.device.setChannel('verticalMovement1', 64);
            await this.device.setChannel('zoom1', 140);
            await this.sleep(1500);

            spinner.text = 'Testing rotation';
            await this.device.setChannel('zoom1', 64);
            await this.device.setChannel('rotation1', 160);
            await this.sleep(1500);

            spinner.succeed('Movement effects test passed');
            this.testResults.push({ test: 'Movement Effects', status: 'PASS' });
        } catch (error) {
            spinner.fail(`Movement effects test error: ${error.message}`);
            this.testResults.push({ test: 'Movement Effects', status: 'ERROR', error: error.message });
        }
    }

    async testArrayEffect() {
        const spinner = ora('Testing array effect (pattern on pattern nodes)...').start();

        try {
            await this.device.blackout();
            await this.sleep(500);

            await this.device.setChannel('mode', 50);
            await this.device.setChannel('gallerySelection', 0);
            await this.device.setChannel('pattern1', 20);
            await this.device.setChannel('forcedColor1', 16);

            await this.device.setChannel('secondLampPattern', 128);
            await this.device.setChannel('patternLibrary2', 200);
            await this.device.setChannel('pattern2', 80);
            await this.device.setChannel('forcedColor2', 48);

            await this.device.setChannel('nodeHighlight2', 200);

            await this.sleep(3000);

            spinner.succeed('Array effect test passed');
            this.testResults.push({ test: 'Array Effect', status: 'PASS' });
        } catch (error) {
            spinner.fail(`Array effect test error: ${error.message}`);
            this.testResults.push({ test: 'Array Effect', status: 'ERROR', error: error.message });
        }
    }

    async testPresets() {
        const spinner = ora('Testing device presets...').start();

        try {
            const presets = Object.keys(this.profile.presets);

            for (const presetName of presets) {
                spinner.text = `Testing preset: ${presetName}`;
                await this.device.applyPreset(presetName);
                await this.sleep(1500);
            }

            spinner.succeed('Preset tests passed');
            this.testResults.push({ test: 'Presets', status: 'PASS' });
        } catch (error) {
            spinner.fail(`Preset test error: ${error.message}`);
            this.testResults.push({ test: 'Presets', status: 'ERROR', error: error.message });
        }
    }

    async testStrobeEffects() {
        const spinner = ora('Testing strobe effects...').start();

        try {
            await this.device.setChannel('mode', 50);
            await this.device.setChannel('pattern1', 50);
            await this.device.setChannel('forcedColor1', 208);

            const strobeSettings = [
                { name: 'Off', value: 0 },
                { name: 'Slow', value: 32 },
                { name: 'Medium', value: 96 },
                { name: 'Fast', value: 160 },
                { name: 'Random', value: 208 }
            ];

            for (const setting of strobeSettings) {
                spinner.text = `Testing strobe: ${setting.name}`;
                await this.device.setChannel('strobe', setting.value);
                await this.sleep(1000);
            }

            await this.device.setChannel('strobe', 0);

            spinner.succeed('Strobe effects test passed');
            this.testResults.push({ test: 'Strobe Effects', status: 'PASS' });
        } catch (error) {
            spinner.fail(`Strobe effects test error: ${error.message}`);
            this.testResults.push({ test: 'Strobe Effects', status: 'ERROR', error: error.message });
        }
    }

    async cleanup() {
        console.log(chalk.gray('\n🧹 Cleaning up...'));
        await this.device.blackout();
        await this.controller.disconnect();
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        console.log(chalk.cyan('\n📊 Test Results\n'));

        const table = [];
        let passCount = 0;
        let failCount = 0;
        let errorCount = 0;

        for (const result of this.testResults) {
            const status = result.status === 'PASS' ?
                chalk.green('✓ PASS') :
                result.status === 'FAIL' ?
                chalk.red('✗ FAIL') :
                chalk.yellow('⚠ ERROR');

            table.push([result.test, status]);

            if (result.status === 'PASS') passCount++;
            else if (result.status === 'FAIL') failCount++;
            else errorCount++;
        }

        console.table(table);

        console.log(chalk.gray('\n─'.repeat(40)));
        console.log(chalk.green(`Passed: ${passCount}`));
        console.log(chalk.red(`Failed: ${failCount}`));
        console.log(chalk.yellow(`Errors: ${errorCount}`));
        console.log(chalk.gray('─'.repeat(40) + '\n'));

        return failCount === 0 && errorCount === 0;
    }

    async run() {
        try {
            await this.initialize();

            console.log(chalk.cyan('Running test suite...\n'));

            await this.testSinglePattern();
            await this.testDualPattern();
            await this.testColorCycling();
            await this.testMovementEffects();
            await this.testArrayEffect();
            await this.testStrobeEffects();
            await this.testPresets();

            await this.cleanup();

            const success = this.printResults();

            if (success) {
                console.log(chalk.green.bold('✅ All tests passed!'));
                process.exit(0);
            } else {
                console.log(chalk.red.bold('❌ Some tests failed'));
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
            console.error(error.stack);

            try {
                await this.cleanup();
            } catch (cleanupError) {
                console.error(chalk.red('Cleanup failed:', cleanupError.message));
            }

            process.exit(1);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const options = {
        mock: !args.includes('--hardware'),
        verbose: args.includes('--verbose') || args.includes('-v'),
        port: args.find(arg => arg.startsWith('--port='))?.split('=')[1]
    };

    if (args.includes('--list-ports')) {
        await listAvailablePorts();
        process.exit(0);
    }

    if (args.includes('--help') || args.includes('-h')) {
        console.log(chalk.cyan('Ehaho L2400 Device Test'));
        console.log('\nUsage: node ehaho-l2400.test.js [options]');
        console.log('\nOptions:');
        console.log('  --hardware     Use real hardware (default: mock)');
        console.log('  --verbose, -v  Show detailed output');
        console.log('  --port=PATH    Serial port path');
        console.log('  --list-ports   Show detected serial devices and exit');
        console.log('  --help, -h     Show this help');
        process.exit(0);
    }

    const test = new EhahoL2400Test(options);
    await test.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}

export { EhahoL2400Test };
