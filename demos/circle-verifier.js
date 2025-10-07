#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const COLOR_HOLD_MS = 4000;   // Hold each color for 4 seconds

// The breakthrough values we discovered!
const CIRCLE_PATTERN_VALUE = 65;

// --- Main Demo Logic ---

class CircleVerifierDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'CircleVerifier', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🔬 DMX Circle Verifier Demo\n'));
        this.logger.info(`This will display pattern ${CIRCLE_PATTERN_VALUE} (the circle) and test colors on it.\n`);
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
        // Lock the laser into a static circle shape
        await this.setStaticCircleShape();

        const colorsToTest = [
            { name: 'RED', value: 16 },
            { name: 'GREEN', value: 48 },
            { name: 'BLUE', value: 80 },
            { name: 'WHITE', value: 192 },
        ];

        this.logger.info(chalk.cyan.bold(`--- Cycling Colors on Pattern ${CIRCLE_PATTERN_VALUE} ---\n`));
        for (const color of colorsToTest) {
            await this.testColor(color.name, color.value);
        }

        this.logger.info(chalk.cyan.bold('\n--- Verification Complete ---\n'));
        await this.cleanup();
    }

    async setStaticCircleShape() {
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', 128);
        await this.device.setChannelByName('pattern1', CIRCLE_PATTERN_VALUE);
        await this.device.setChannelByName('horizontalMovement1', 64);
        await this.device.setChannelByName('verticalMovement1', 64);
        await this.device.setChannelByName('zoom1', 64);
        await this.device.setChannelByName('rotation1', 0);
        await this.device.setChannelByName('strobe', 0);
        await this.device.setChannelByName('secondLampPattern', 0);
        await this.sleep(50);
    }

    async testColor(name, value) {
        this.logger.info(chalk.yellow(`--- Testing Color: ${chalk.bold(name)} (Value: ${value}) ---`));
        await this.device.setChannelByName('colorChange', value);
        await this.sleep(COLOR_HOLD_MS);
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
const demo = new CircleVerifierDemo();

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
