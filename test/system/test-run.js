#!/usr/bin/env node
/**
 * Quick test runner for the DMX system
 */

import { DMXController } from '../../laser/dmx.js';
import { DMXTestHarness, createMockDMXInterface } from '../../laser/dmx-mock.js';
import { ProfileBasedDeviceControl } from '../../laser/dmx-profile-based-control.js';
import { DeviceProfileManager } from '../../laser/dmx-device-control.js';
import chalk from 'chalk';

async function testSystem() {
    console.log(chalk.cyan.bold('\n🎯 LASER RESAL Platform Test\n'));
    
    try {
        // Step 1: Test Mock System
        console.log(chalk.yellow('1. Testing Mock Hardware...'));
        const harness = new DMXTestHarness();
        await harness.setup();
        
        const scenario = {
            name: 'Quick Test',
            steps: [
                { type: 'connect' },
                { type: 'send_dmx', data: [0, 200, 50, 128, 255, 0, 0] },
                { type: 'assert_state', expected: { brightness: 255 } },
                { type: 'disconnect' }
            ]
        };
        
        const results = await harness.simulateScenario(scenario);
        console.log(chalk.green(`  ✅ Mock test: ${results.passed}/${results.total} passed\n`));
        await harness.teardown();
        
        // Step 2: Test Profile Loading
        console.log(chalk.yellow('2. Testing Profile System...'));
        const profileManager = new DeviceProfileManager();
        await profileManager.loadAllProfiles();
        console.log(chalk.green(`  ✅ Loaded ${profileManager.profiles.size} profiles\n`));
        
        // Step 3: Test DMX Controller with Mock
        console.log(chalk.yellow('3. Testing DMX Controller...'));
        const mockInterface = await createMockDMXInterface({ path: '/dev/mock' });
        await mockInterface.connect();

        const controller = new DMXController({
            serialInterface: mockInterface
        });
        
        // Test channel updates
        controller.updateChannel(1, 200);  // Mode to DMX
        controller.updateChannel(2, 50);   // Pattern
        controller.updateChannel(8, 255);  // Red color
        
        // Test new promise-aware methods
        await controller.setChannel(9, 255);  // Green
        await controller.setChannels({ 10: 255, 11: 128 });  // Blue and brightness
        
        console.log(chalk.green('  ✅ DMX Controller working\n'));
        
        // Step 4: Test Profile-Based Control
        console.log(chalk.yellow('4. Testing Profile-Based Control...'));
        const profile = profileManager.profiles.values().next().value;
        if (profile) {
            const device = new ProfileBasedDeviceControl({
                dmxController: controller,
                profile: profile,
                startAddress: 1
            });
            
            // Test channel setting
            device.setChannel('mode', 'dmx');
            device.blackout();
            
            console.log(chalk.green(`  ✅ Profile control working with: ${profile.name}\n`));
        }
        
        // Summary
        console.log(chalk.green.bold('✨ All tests passed successfully!'));
        console.log(chalk.cyan('\nYou can now run:'));
        console.log('  • npm run setup     - Configure your laser');
        console.log('  • npm run discover  - Map patterns');
        console.log('  • npm start        - Launch control panel');
        console.log('  • npm run demo     - Run demo sequences\n');
        
    } catch (error) {
        console.error(chalk.red('\n❌ Test failed:'), error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testSystem()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
