#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const TEST_DURATION_MS = 3000; // Hold each color for 3 seconds

// --- Main Demo Logic ---

class FinalColorFinderDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'FinalColorFinder', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🔬 Final DMX Color Finder Demo\n'));
        this.logger.info('This demo will cycle through many values on the master color channel (29).');
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
        // Lock the laser into a static shape
        await this.setStaticShape();

        // Systematically test values on the colorChange channel
        this.logger.info(chalk.cyan.bold('--- Starting Color Value Sweep on Channel 29 ---\n'));
        for (let value = 0; value <= 255; value += 8) {
            await this.testColorValue(value);
        }

        this.logger.info(chalk.cyan.bold('\n--- All Values Tested ---\n'));
        await this.cleanup();
    }

    async setStaticShape() {
        this.logger.info('Setting a static base pattern for all tests...');
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', 0);
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

    async testColorValue(value) {
        this.logger.info(chalk.yellow(`--- Testing colorChange value: ${chalk.bold(value)} ---`));

        // Set only the color channel
        await this.device.setChannelByName('colorChange', value);

        // Hold for observation
        await this.sleep(TEST_DURATION_MS);
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
const demo = new FinalColorFinderDemo();

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
