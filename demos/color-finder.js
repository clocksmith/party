#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const TEST_DURATION_MS = 4000; // Hold each color for 4 seconds

// --- Main Demo Logic ---

class ColorFinderDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'ColorFinder', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🎨 DMX Color Finder Demo\n'));
        this.logger.info('This demo will test key values on the master color channel (29).');
        this.logger.info('Please note the color(s) you see for each tested value.\n');
        try {
            this.serialInterface = new DMXSerialInterface({ portPath: PORT_PATH });
            this.controller = new DMXController({ serialInterface: this.serialInterface });
            await this.controller.connect();
            this.device = new DynamicDeviceControl({
                dmxController: this.controller,
                startAddress: DMX_ADDRESS
            });
            await this.device.loadProfile(PROFILE_PATH);
            this.logger.info(chalk.green('✅ Setup complete. Starting test...\n'));
        } catch (error) {
            this.logger.error(chalk.red.bold('\n❌ Initialization Failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async run() {
        // Set a static shape and position that we will use for all color tests
        await this.setStaticShape();

        // The list of DMX values to test on the colorChange channel
        const valuesToTest = [
            { value: 1, note: 'Start of RED range in profile' },
            { value: 16, note: 'Middle of RED range in profile' },
            { value: 32, note: 'Start of GREEN range in profile' },
            { value: 48, note: 'Middle of GREEN range in profile' },
            { value: 64, note: 'Start of BLUE range in profile' },
            { value: 80, note: 'Middle of BLUE range in profile' },
            { value: 192, note: 'Start of WHITE range in profile' },
        ];

        for (const test of valuesToTest) {
            await this.testColorValue(test.value, test.note);
        }

        this.logger.info(chalk.cyan.bold('\n--- Color Test Complete ---\n'));
        await this.cleanup();
    }

    async setStaticShape() {
        this.logger.info('Setting a static base pattern for testing...');
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('pattern1', 10);
        await this.device.setChannelByName('horizontalMovement1', 64);
        await this.device.setChannelByName('verticalMovement1', 64);
        await this.device.setChannelByName('zoom1', 64);
        await this.device.setChannelByName('rotation1', 0);
        await this.device.setChannelByName('strobe', 0);
        await this.device.setChannelByName('secondLampPattern', 0);
        this.logger.info('✅ Base pattern set.\n');
        await this.sleep(100);
    }

    async testColorValue(value, note) {
        this.logger.info(chalk.yellow(`--- Testing colorChange value: ${chalk.bold(value)} ---`));
        this.logger.info(`(Profile says this is: ${note})`);

        // Set only the color channel
        await this.device.setChannelByName('colorChange', value);

        // Hold for observation
        await this.sleep(TEST_DURATION_MS);

        // Reset color to black before next test
        await this.device.setChannelByName('colorChange', 0);
        await this.sleep(200);
    }

    async cleanup() {
        this.logger.info(chalk.cyan('\n🧹 Cleaning up...'));
        if (this.controller && this.controller.isConnected()) {
            const channelsToReset = {};
            for (let i = 1; i <= 32; i++) { channelsToReset[i] = 0; }
            this.controller.updateChannels(channelsToReset);
            await this.sleep(100);
            await this.controller.disconnect();
            this.logger.info(chalk.green('✅ Disconnected.'));
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// --- Execute Demo ---
const demo = new ColorFinderDemo();

const handleInterrupt = async () => {
    await demo.cleanup();
    process.exit(0);
};
process.on('SIGINT', handleInterrupt);
process.on('SIGTERM', handleInterrupt);

(async () => {
    await demo.initialize();
    await demo.run();
})();
