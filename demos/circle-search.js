#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const HOLD_MS = 2000; // Hold each pattern for only 2 seconds

// The color value we know works!
const GREEN_COLOR_VALUE = 48;

// --- Main Demo Logic ---

class CircleSearchDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'CircleSearch', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🎯 Final Circle Search\n'));
        this.logger.info('This will rapidly display patterns in solid GREEN.');
        this.logger.info(chalk.yellow('Your task: Watch for a circle and tell me the Pattern Value.') + '\n');
        try {
            this.serialInterface = new DMXSerialInterface({ portPath: PORT_PATH });
            this.controller = new DMXController({ serialInterface: this.serialInterface });
            await this.controller.connect();
            this.device = new DynamicDeviceControl({
                dmxController: this.controller,
                startAddress: DMX_ADDRESS
            });
            await this.device.loadProfile(PROFILE_PATH);
            this.logger.info(chalk.green('✅ Setup complete. Starting search...\n'));
        } catch (error) {
            this.logger.error(chalk.red.bold('\n❌ Initialization Failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async run() {
        // Lock the laser into a static, solid green state
        await this.setStaticGreen();

        // Search a narrow, targeted range of patterns
        this.logger.info(chalk.cyan.bold('--- Searching for Circle Pattern (Value 50-80) ---\n'));
        for (let patternValue = 50; patternValue <= 80; patternValue++) {
            this.logger.info(chalk.yellow(`--- Testing Pattern Value: ${chalk.bold(patternValue)} ---`));
            await this.device.setChannelByName('pattern1', patternValue);
            await this.sleep(HOLD_MS);
        }

        this.logger.info(chalk.cyan.bold('\n--- Search Complete ---\n'));
        await this.cleanup();
    }

    async setStaticGreen() {
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', 128);
        await this.device.setChannelByName('horizontalMovement1', 64);
        await this.device.setChannelByName('verticalMovement1', 64);
        await this.device.setChannelByName('zoom1', 64);
        await this.device.setChannelByName('rotation1', 0);
        await this.device.setChannelByName('strobe', 0);
        await this.device.setChannelByName('secondLampPattern', 0);
        await this.device.setChannelByName('colorChange', GREEN_COLOR_VALUE);
        await this.sleep(50);
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
const demo = new CircleSearchDemo();

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
