#!/usr/bin/env node

import { DMXController, DMXSerialInterface } from '../dmx.js';
import { DynamicDeviceControl } from '../dmx-device-control.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';
import chalk from 'chalk';

// --- Configuration ---
const PORT_PATH = '/dev/tty.usbserial-A50285BI';
const PROFILE_PATH = 'ehaho-l2400.json';
const DMX_ADDRESS = 1;
const PATTERN_DURATION_MS = 3000; // Hold each color for 3 seconds

// --- Main Demo Logic ---

class ColorCircleDemo {
    constructor() {
        this.logger = new DMXLogger({ moduleName: 'ColorCircleDemo', minLevel: LogLevel.INFO });
        this.serialInterface = null;
        this.controller = null;
        this.device = null;
    }

    async initialize() {
        this.logger.info(chalk.cyan.bold('\n🎨 DMX Color Circle Demo\n'));

        try {
            // 1. Setup Serial Interface
            this.serialInterface = new DMXSerialInterface({ portPath: PORT_PATH });

            // 2. Setup DMX Controller
            this.controller = new DMXController({
                serialInterface: this.serialInterface,
                universeSize: 512
            });

            // 3. Connect to the hardware
            this.logger.info(`Connecting to DMX interface at ${PORT_PATH}...`);
            await this.controller.connect();
            this.logger.info(chalk.green('✅ DMX Controller connected successfully.\n'));

            // 4. Load Device Profile
            this.device = new DynamicDeviceControl({
                dmxController: this.controller,
                startAddress: DMX_ADDRESS
            });
            this.logger.info(`Loading device profile: ${PROFILE_PATH}...`);
            await this.device.loadProfile(PROFILE_PATH);
            this.logger.info(chalk.green(`✅ Profile "${this.device.profile.name}" loaded.\n`));

        } catch (error) {
            this.logger.error(chalk.red.bold('\n❌ Initialization Failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async run() {
        try {
            this.logger.info(chalk.cyan.bold('--- Starting Circle Sequence ---\n'));

            // Sequence of colors to draw
            const circleSequence = [
                { colorName: 'RED', colorValue: 16 },
                { colorName: 'GREEN', colorValue: 48 },
                { colorName: 'BLUE', colorValue: 80 },
            ];

            // Ensure laser is in the correct mode to accept DMX
            this.logger.info('Setting device to DMX mode...');
            await this.device.setChannelByName('mode', 50);
            await this.sleep(50); // Small delay to ensure mode change is processed

            for (const circle of circleSequence) {
                await this.drawCircle(circle.colorName, circle.colorValue);
            }

            this.logger.info(chalk.cyan.bold('\n--- Sequence Complete ---\n'));

        } catch (error) {
            this.logger.error(chalk.red.bold('\n❌ An error occurred during the demo:'), error.message);
        } finally {
            await this.cleanup();
        }
    }

    async drawCircle(colorName, colorValue) {
        this.logger.info(chalk.yellow(`🎨 Drawing a ${colorName} circle for ${PATTERN_DURATION_MS / 1000} seconds...`));
        
        // These are the specific channel values for a simple circle on the Ehaho L2400
        await this.device.setChannelByName('gallerySelection', 0);    // beam gallery
        await this.device.setChannelByName('pattern1', 10);          // A simple pattern, likely a circle
        await this.device.setChannelByName('colorChange', colorValue);  // Set the master color
        
        // Set other channels to a neutral state for a clean pattern
        await this.device.setChannelByName('zoom1', 64);
        await this.device.setChannelByName('rotation1', 0);
        await this.device.setChannelByName('horizontalMovement1', 64); // Static Center
        await this.device.setChannelByName('verticalMovement1', 64); // Static Center
        await this.device.setChannelByName('strobe', 0);
        await this.device.setChannelByName('secondLampPattern', 0);

        // Wait for the specified duration
        await this.sleep(PATTERN_DURATION_MS);
    }

    async cleanup() {
        this.logger.info(chalk.cyan('\n🧹 Cleaning up and shutting down...'));
        if (this.device) {
            try {
                this.logger.info('Applying blackout...');
                await this.device.applyPreset('blackout');
                await this.sleep(100); // Allow time for blackout to send
            } catch (e) {
                this.logger.warn('Could not apply blackout preset.');
            }
        }
        if (this.controller && this.controller.isConnected()) {
            try {
                this.logger.info('Disconnecting DMX controller...');
                await this.controller.disconnect();
                this.logger.info(chalk.green('✅ Disconnected successfully.'));
            } catch (e) {
                this.logger.error('Failed to disconnect controller cleanly.');
            }
        }
        this.logger.info(chalk.cyan.bold('\n👋 Demo finished.\n'));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// --- Execute Demo ---
const demo = new ColorCircleDemo();

// Graceful shutdown
const handleInterrupt = async () => {
    await demo.cleanup();
    process.exit(0);
};
process.on('SIGINT', handleInterrupt);
process.on('SIGTERM', handleInterrupt);

// Run the demo
(async () => {
    await demo.initialize();
    await demo.run();
})();
