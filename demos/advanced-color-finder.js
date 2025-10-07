#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const TEST_DURATION_MS = 5000; // Hold each test state for 5 seconds
const TARGET_COLOR_NAME = 'BLUE';
const TARGET_COLOR_VALUE = 80;

// --- Main Demo Logic ---

class AdvancedColorFinderDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'AdvancedColorFinder', minLevel: LogLevel.INFO });
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🔬 Advanced DMX Color Finder Demo\n'));
        this.logger.info('This will test combinations of gallery and color channels.');
        this.logger.info(`The target color for all tests is ${TARGET_COLOR_NAME}.\n`);
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
        // --- TEST 1: BEAM gallery with forcedColor1 ---
        await this.runTest({
            testName: 'Test 1: BEAM Gallery + forcedColor1',
            galleryValue: 0, // beam
            colorChannel: 'forcedColor1',
            colorValue: TARGET_COLOR_VALUE
        });

        // --- TEST 2: BEAM gallery with colorChange ---
        await this.runTest({
            testName: 'Test 2: BEAM Gallery + colorChange',
            galleryValue: 0, // beam
            colorChannel: 'colorChange',
            colorValue: TARGET_COLOR_VALUE
        });

        // --- TEST 3: ANIMATION gallery with forcedColor1 ---
        await this.runTest({
            testName: 'Test 3: ANIMATION Gallery + forcedColor1',
            galleryValue: 128, // animation
            colorChannel: 'forcedColor1',
            colorValue: TARGET_COLOR_VALUE
        });

        // --- TEST 4: ANIMATION gallery with colorChange ---
        await this.runTest({
            testName: 'Test 4: ANIMATION Gallery + colorChange',
            galleryValue: 128, // animation
            colorChannel: 'colorChange',
            colorValue: TARGET_COLOR_VALUE
        });

        this.logger.info(chalk.cyan.bold('\n--- All Tests Complete ---\n'));
        await this.cleanup();
    }

    async runTest(config) {
        this.logger.info(chalk.yellow(`\n--- ${config.testName} ---`));
        
        // Set a clean, static state
        await this.setStaticShape(config.galleryValue);

        this.logger.info(`Setting ${chalk.bold(config.colorChannel)} to ${chalk.bold(config.colorValue)} (${TARGET_COLOR_NAME}) for ${TEST_DURATION_MS / 1000}s.`);
        await this.device.setChannelByName(config.colorChannel, config.colorValue);

        await this.sleep(TEST_DURATION_MS);
    }

    async setStaticShape(galleryValue) {
        // Set all channels to a neutral state before each test
        const channelsToReset = {};
        for (let i = 1; i <= 32; i++) { channelsToReset[i] = 0; }
        this.controller.updateChannels(channelsToReset);
        await this.sleep(50);

        // Set the basic parameters for a static shape
        await this.device.setChannelByName('mode', 50);
        await this.device.setChannelByName('gallerySelection', galleryValue);
        await this.device.setChannelByName('pattern1', 10);
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
const demo = new AdvancedColorFinderDemo();

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
