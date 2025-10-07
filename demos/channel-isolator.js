#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const TEST_DURATION_MS = 4000; // Hold each test state for 4 seconds

// --- Main Demo Logic ---

class ChannelIsolatorDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'ChannelIsolator', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🔬 DMX Channel Isolator Demo\n'));
        try {
            this.serialInterface = new DMXSerialInterface({ portPath: PORT_PATH });
            this.controller = new DMXController({ serialInterface: this.serialInterface });
            await this.controller.connect();
            this.logger.info(chalk.green('✅ DMX Controller connected.'));

            this.device = new DynamicDeviceControl({
                dmxController: this.controller,
                startAddress: DMX_ADDRESS
            });
            await this.device.loadProfile(PROFILE_PATH);
            this.logger.info(chalk.green(`✅ Profile "${this.device.profile.name}" loaded.\n`));
        } catch (error) {
            this.logger.error(chalk.red.bold('\n❌ Initialization Failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async run() {
        this.logger.info(chalk.cyan.bold('--- Starting Channel Isolation Test ---\n'));

        // Set a base pattern that we know is problematic
        await this.device.setChannelByName('pattern1', 10);
        await this.device.setChannelByName('mode', 50); // DMX mode

        // Test channels one by one
        await this.testChannel('forcedColor1', 16, "STATIC RED");
        await this.testChannel('colorChange', 16, "STATIC RED");

        this.logger.info(chalk.cyan.bold('\n--- Test Complete ---\n'));
        await this.cleanup();
    }

    async testChannel(channelName, value, description) {
        this.logger.info(chalk.yellow(`\n--- Testing Channel: ${chalk.bold(channelName)} ---`));
        this.logger.info(`Setting ${chalk.bold(channelName)} to ${chalk.bold(value)} (${description}) for ${TEST_DURATION_MS / 1000}s.`);
        this.logger.info('All other channels will be held at 0 (where possible).');

        // Blackout everything first to create a clean slate
        await this.blackoutAllChannels();
        await this.sleep(100);

        // Set the base mode and the channel to be tested
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('pattern1', 10);
        await this.device.setChannelByName(channelName, value);

        await this.sleep(TEST_DURATION_MS);
    }

    async blackoutAllChannels() {
        this.logger.debug('Resetting all 32 channels to 0.');
        const channelsToReset = {};
        for (let i = 1; i <= 32; i++) {
            channelsToReset[i] = 0;
        }
        this.controller.updateChannels(channelsToReset);
    }

    async cleanup() {
        this.logger.info(chalk.cyan('\n🧹 Cleaning up...'));
        if (this.controller && this.controller.isConnected()) {
            await this.blackoutAllChannels();
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
const demo = new ChannelIsolatorDemo();

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
