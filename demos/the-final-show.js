#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const HOLD_DURATION_MS = 3000; // Hold each color for 3 seconds

// --- The Correct, Verified DMX Values ---
const CIRCLE_PATTERN = 60;
const COLOR_RED = 16;
const COLOR_GREEN = 48;
const COLOR_BLUE = 80;

// --- Main Demo Logic ---

class FinalShowDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'FinalShow', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n✨ The Final Show Demo ✨\n'));
        this.logger.info('This will draw a Red, Green, and Blue circle using our discovered values.\n');
        try {
            this.serialInterface = new DMXSerialInterface({ portPath: PORT_PATH });
            this.controller = new DMXController({ serialInterface: this.serialInterface });
            await this.controller.connect();
            this.device = new DynamicDeviceControl({
                dmxController: this.controller,
                startAddress: DMX_ADDRESS
            });
            await this.device.loadProfile(PROFILE_PATH);
            this.logger.info(chalk.green('✅ Setup complete. Starting show...\n'));
        } catch (error) {
            this.logger.error(chalk.red.bold('\n❌ Initialization Failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async run() {
        // Set the static circle shape that will be used for all colors
        await this.setStaticCircleShape();

        // The sequence of colors to display
        const colorSequence = [
            { name: 'RED', value: COLOR_RED },
            { name: 'GREEN', value: COLOR_GREEN },
            { name: 'BLUE', value: COLOR_BLUE },
        ];

        this.logger.info(chalk.cyan.bold(`--- Starting Circle Color Sequence ---`));
        for (const color of colorSequence) {
            this.logger.info(chalk.yellow(`\n--- Drawing ${color.name} Circle ---`));
            await this.device.setChannelByName('colorChange', color.value);
            await this.sleep(HOLD_DURATION_MS);
        }

        this.logger.info(chalk.cyan.bold('\n--- Show Complete ---\n'));
        await this.cleanup();
    }

    async setStaticCircleShape() {
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', 128);
        await this.device.setChannelByName('pattern1', CIRCLE_PATTERN);
        await this.device.setChannelByName('horizontalMovement1', 64);
        await this.device.setChannelByName('verticalMovement1', 64);
        await this.device.setChannelByName('zoom1', 64);
        await this.device.setChannelByName('rotation1', 0);
        await this.device.setChannelByName('strobe', 0);
        await this.device.setChannelByName('secondLampPattern', 0);
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
const demo = new FinalShowDemo();

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
