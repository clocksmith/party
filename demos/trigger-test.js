#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const HOLD_MS = 4000;

// --- Discovered Values ---
const CIRCLE_PATTERN = 60;
const OTHER_PATTERN = 65; // The 2x2 grid, just to have something to switch to
const COLOR_GREEN = 48;
const COLOR_BLUE = 80;

// --- Main Demo Logic ---

class TriggerTestDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'TriggerTest', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🔬 DMX Color Trigger Test\n'));
        this.logger.info('This will test if changing the pattern is required to change the color.\n');
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
        // 1. Set the scene: static position, animation gallery
        await this.setStaticBase();

        // 2. Draw the GREEN circle we know works.
        this.logger.info(chalk.green.bold('Step 1: Drawing GREEN circle. You should see a green circle.'));
        await this.device.setChannelByName('pattern1', CIRCLE_PATTERN);
        await this.device.setChannelByName('colorChange', COLOR_GREEN);
        await this.sleep(HOLD_MS);

        // 3. Try to change to BLUE without changing the pattern. (This should fail)
        this.logger.info(chalk.yellow.bold('\nStep 2: Attempting to change to BLUE. Does the color change? (Hypothesis: NO)'));
        await this.device.setChannelByName('colorChange', COLOR_BLUE);
        await this.sleep(HOLD_MS);

        // 4. Now, "re-select" the circle pattern to trigger the color change.
        this.logger.info(chalk.blue.bold('\nStep 3: Re-selecting the pattern. Does it turn BLUE now? (Hypothesis: YES)'));
        await this.device.setChannelByName('pattern1', OTHER_PATTERN); // Switch away for a moment
        await this.sleep(50);
        await this.device.setChannelByName('pattern1', CIRCLE_PATTERN); // Switch back
        await this.sleep(HOLD_MS);

        this.logger.info(chalk.cyan.bold('\n--- Test Complete ---\n'));
        await this.cleanup();
    }

    async setStaticBase() {
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', 128);
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
const demo = new TriggerTestDemo();

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
