#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const PATTERN_HOLD_MS = 1000; // Time to see the pattern before color change
const COLOR_HOLD_MS = 2000;   // Time to observe each color

// --- Main Demo Logic ---

class PatternAndColorFinderDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'PatternFinder', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🔬 DMX Pattern & Color Finder Demo\n'));
        this.logger.info('This will search for a pattern that is a circle AND can be a single color.');
        this.logger.info(chalk.yellow('Your task: Watch for a solid-colored circle and note the Pattern and Color values.') + '\n');
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
        // Set a static position for all tests
        await this.setStaticPosition();

        const colorValuesToTest = [0, 16, 80, 192]; // Test default, red, blue, white

        // Iterate through patterns
        for (let patternValue = 0; patternValue <= 255; patternValue += 5) {
            this.logger.info(chalk.blue.bold(`\n--- Testing Pattern Value: ${patternValue} ---`));
            await this.device.setChannelByName('pattern1', patternValue);
            await this.sleep(PATTERN_HOLD_MS);

            // For this pattern, test a few colors
            for (const colorValue of colorValuesToTest) {
                this.logger.info(chalk.yellow(`  --- Testing Color Value: ${colorValue} ---`));
                await this.device.setChannelByName('colorChange', colorValue);
                await this.sleep(COLOR_HOLD_MS);
            }
        }

        this.logger.info(chalk.cyan.bold('\n--- Search Complete ---\n'));
        await this.cleanup();
    }

    async setStaticPosition() {
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', 128); // Use Animation gallery, it is more likely to allow overrides
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
const demo = new PatternAndColorFinderDemo();

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
