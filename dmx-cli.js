#!/usr/bin/env node
/**
 * Enhanced DMX CLI with Pattern Discovery and Testing Tools
 * Provides improved user experience and device configuration
 */

import readline from 'readline';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import fs from 'fs/promises';
import path from 'path';

import { DMXSerialInterface, DMXController } from './dmx.js';
import { MockSerialPort, DMXTestHarness } from './dmx-mock.js';
import { DMXLogger, LogLevel } from './dmx-logger.js';
import { DeviceProfileManager } from './dmx-device-control.js';
import { ProfileBasedDeviceControl } from './dmx-profile-based-control.js';
import { ProfileValidator } from './dmx-profile-validator.js';
import { ProfileGenerator } from './dmx-profile-generator.js';

const logger = new DMXLogger({
    moduleName: 'DMX-CLI',
    minLevel: LogLevel.INFO,
    enableFile: true,
    logFilePath: './dmx-cli.log'
});

class DMXCLIApplication {
    constructor() {
        this.serialInterface = null;
        this.dmxController = null;
        this.laserDevice = null;
        this.profileManager = new DeviceProfileManager({ profilesDir: './device-profiles' });
        this.profileValidator = new ProfileValidator();
        this.profileGenerator = new ProfileGenerator();
        this.currentProfile = null;
        this.isConnected = false;
        this.discoveredPatterns = new Map();
        this.screen = null;
    }
    
    /**
     * Interactive Device Setup Wizard
     */
    async setupWizard() {
        console.clear();
        console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════╗
║      DMX Laser Controller Setup Wizard      ║
║         Professional Lighting Control        ║
╚════════════════════════════════════════════╝
        `));
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (query) => new Promise(resolve => rl.question(query, resolve));
        
        try {
            // Step 1: Select Device Profile
            console.log(chalk.yellow('\n📋 Step 1: Select Device Profile'));
            const profiles = Object.keys(deviceProfiles.devices);
            profiles.forEach((profile, index) => {
                const device = deviceProfiles.devices[profile];
                console.log(`  ${chalk.green(`[${index + 1}]`)} ${device.name} (${device.channelCount} channels)`);
            });
            
            const profileChoice = await question('\nSelect profile number: ');
            const selectedProfile = profiles[parseInt(profileChoice) - 1] || deviceProfiles.defaultDevice;
            this.currentProfile = deviceProfiles.devices[selectedProfile];
            logger.info(`Selected device profile: ${selectedProfile}`);
            
            // Step 2: Find Serial Port
            console.log(chalk.yellow('\n🔌 Step 2: Detecting DMX Interface...'));
            const spinner = ora('Scanning serial ports...').start();
            
            const ports = await DMXSerialInterface.listPorts();
            spinner.stop();
            
            if (ports.length === 0) {
                console.log(chalk.red('❌ No serial ports detected!'));
                console.log(chalk.yellow('Please check:'));
                console.log('  1. DMX interface is connected');
                console.log('  2. Drivers are installed');
                console.log('  3. You have permission to access serial ports');
                rl.close();
                return false;
            }
            
            console.log(chalk.green(`✅ Found ${ports.length} port(s):`));
            ports.forEach((port, index) => {
                const info = [];
                if (port.manufacturer) info.push(port.manufacturer);
                if (port.serialNumber) info.push(`S/N: ${port.serialNumber}`);
                console.log(`  ${chalk.green(`[${index + 1}]`)} ${port.path} ${info.length ? `(${info.join(', ')})` : ''}`);
            });
            
            const portChoice = await question('\nSelect port number: ');
            const selectedPort = ports[parseInt(portChoice) - 1];
            
            if (!selectedPort) {
                console.log(chalk.red('Invalid selection'));
                rl.close();
                return false;
            }
            
            // Step 3: DMX Address Configuration
            console.log(chalk.yellow('\n⚙️  Step 3: DMX Configuration'));
            const startAddress = await question('Enter DMX start address (1-512) [1]: ') || '1';
            
            // Step 4: Test Connection
            console.log(chalk.yellow('\n🔗 Step 4: Testing Connection...'));
            const connectSpinner = ora('Connecting to DMX interface...').start();
            
            try {
                this.serialInterface = new DMXSerialInterface({
                    portPath: selectedPort.path
                });
                
                this.dmxController = new DMXController({
                    serialInterface: this.serialInterface
                });
                
                this.laserDevice = new ProfileBasedDeviceControl({
                    dmxController: this.dmxController,
                    profile: this.currentProfile,
                    startAddress: parseInt(startAddress)
                });
                
                await this.laserDevice.connect();
                this.isConnected = true;
                
                connectSpinner.succeed('Connected successfully!');
                
                // Send test pattern
                console.log(chalk.yellow('\n🧪 Sending test pattern...'));
                await this.laserDevice.blackout();
                await this.delay(500);
                
                if (this.currentProfile.presets.test_pattern) {
                    await this.applyPreset('test_pattern');
                }
                
                console.log(chalk.green.bold('\n✨ Setup Complete! Device is ready.'));
                
            } catch (error) {
                connectSpinner.fail(`Connection failed: ${error.message}`);
                logger.error('Setup failed', { error: error.message });
                rl.close();
                return false;
            }
            
            rl.close();
            return true;
            
        } catch (error) {
            console.error(chalk.red('Setup error:'), error.message);
            rl.close();
            return false;
        }
    }
    
    /**
     * Pattern Discovery Tool
     */
    async discoverPatterns() {
        if (!this.isConnected) {
            console.log(chalk.red('Not connected. Run setup first.'));
            return;
        }
        
        console.log(chalk.cyan.bold('\n🔍 Pattern Discovery Mode'));
        console.log('This will cycle through channel values to discover patterns.');
        console.log('Watch your laser device and note the patterns you see.\n');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const patternChannel = this.currentProfile.channels.pattern1?.channel || 2;
        
        console.log(chalk.yellow(`Testing channel ${patternChannel} (Pattern Selection)`));
        console.log('Press ENTER to move to next value, type pattern name to save it.\n');
        
        for (let value = 0; value <= 255; value += 10) {
            // Set pattern value
            await this.dmxController.setChannel(patternChannel, value);
            
            process.stdout.write(`Value ${chalk.green(value.toString().padStart(3))}: `);
            
            const input = await new Promise(resolve => {
                rl.question('', answer => resolve(answer.trim()));
            });
            
            if (input) {
                this.discoveredPatterns.set(value, input);
                console.log(chalk.green(`  ✓ Saved: ${input}`));
            }
            
            // Check if user wants to stop
            if (input.toLowerCase() === 'stop') {
                break;
            }
        }
        
        rl.close();
        
        // Save discovered patterns
        if (this.discoveredPatterns.size > 0) {
            await this.saveDiscoveredPatterns();
        }
    }
    
    /**
     * Interactive Control Panel
     */
    async launchControlPanel() {
        if (!this.isConnected) {
            console.log(chalk.red('Not connected. Run setup first.'));
            return;
        }
        
        // Create blessed screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'DMX Laser Control Panel'
        });
        
        // Create layout
        const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
        
        // Title
        const title = grid.set(0, 0, 1, 12, blessed.box, {
            content: ' DMX Laser Control Panel - ' + this.currentProfile.name,
            align: 'center',
            style: { fg: 'cyan', bold: true }
        });
        
        // Channel Sliders
        const sliderBox = grid.set(1, 0, 6, 8, blessed.box, {
            label: ' Channels ',
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } }
        });
        
        // Pattern List
        const patternList = grid.set(1, 8, 6, 4, blessed.list, {
            label: ' Patterns ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                selected: { bg: 'blue' }
            },
            keys: true,
            mouse: true,
            items: Object.keys(this.currentProfile.patterns || {})
        });
        
        // Preset Buttons
        const presetBox = grid.set(7, 0, 2, 12, blessed.box, {
            label: ' Presets ',
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } }
        });
        
        // Log Output
        const logBox = grid.set(9, 0, 3, 12, contrib.log, {
            label: ' Activity Log ',
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } }
        });
        
        // Add preset buttons
        let presetX = 2;
        Object.keys(this.currentProfile.presets || {}).forEach(presetName => {
            const preset = this.currentProfile.presets[presetName];
            const button = blessed.button({
                parent: presetBox,
                content: presetName,
                left: presetX,
                top: 1,
                width: presetName.length + 4,
                height: 3,
                style: {
                    fg: 'white',
                    bg: 'blue',
                    hover: { bg: 'cyan' }
                },
                mouse: true
            });
            
            button.on('press', async () => {
                await this.applyPreset(presetName);
                logBox.log(`Applied preset: ${presetName}`);
            });
            
            presetX += presetName.length + 6;
        });
        
        // Handle pattern selection
        patternList.on('select', async (item, index) => {
            const patternName = patternList.items[index].content;
            const pattern = this.currentProfile.patterns[patternName];
            if (pattern) {
                await this.dmxController.setChannel(
                    this.currentProfile.channels.pattern1.channel,
                    pattern.value
                );
                logBox.log(`Selected pattern: ${patternName}`);
            }
        });
        
        // Keyboard shortcuts
        this.screen.key(['q', 'C-c'], () => {
            this.screen.destroy();
            process.exit(0);
        });
        
        this.screen.key('b', async () => {
            await this.laserDevice.blackout();
            logBox.log('Blackout activated');
        });
        
        this.screen.key('t', async () => {
            await this.runTestSequence();
            logBox.log('Test sequence started');
        });
        
        // Instructions
        const helpText = blessed.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: ' [Q]uit | [B]lackout | [T]est | Use mouse to interact ',
            style: { fg: 'yellow' }
        });
        
        this.screen.render();
        
        // Start refresh loop for displaying current values
        this.startMonitoring(logBox);
    }
    
    /**
     * Apply a preset configuration
     */
    async applyPreset(presetName) {
        const preset = this.currentProfile.presets[presetName];
        if (!preset) {
            logger.warn(`Preset not found: ${presetName}`);
            return;
        }
        
        for (const [channelName, value] of Object.entries(preset.channels)) {
            const channelDef = this.currentProfile.channels[channelName];
            if (channelDef) {
                await this.dmxController.setChannel(channelDef.channel, value);
            }
        }
        
        logger.info(`Applied preset: ${presetName}`);
    }
    
    /**
     * Run automated test sequence
     */
    async runTestSequence() {
        const sequences = [
            { name: 'Blackout', action: () => this.laserDevice.blackout() },
            { name: 'Red Circle', action: () => {
                this.dmxController.setChannel(8, 255);  // Red
                this.dmxController.setChannel(2, 10);   // Circle pattern
            }},
            { name: 'Green Square', action: () => {
                this.dmxController.setChannel(8, 0);    // Red off
                this.dmxController.setChannel(9, 255);  // Green
                this.dmxController.setChannel(2, 20);   // Square pattern
            }},
            { name: 'Blue Wave', action: () => {
                this.dmxController.setChannel(9, 0);    // Green off
                this.dmxController.setChannel(10, 255); // Blue
                this.dmxController.setChannel(2, 80);   // Wave pattern
            }},
            { name: 'Rainbow Strobe', action: () => {
                this.dmxController.setChannel(30, 200); // Color change
                this.dmxController.setChannel(31, 150); // Strobe
            }}
        ];
        
        for (const seq of sequences) {
            logger.info(`Test sequence: ${seq.name}`);
            await seq.action();
            await this.delay(3000);
        }
        
        await this.laserDevice.blackout();
        logger.info('Test sequence complete');
    }
    
    /**
     * Start monitoring DMX activity
     */
    startMonitoring(logWidget) {
        setInterval(() => {
            const stats = this.dmxController?.getStatistics();
            if (stats && logWidget) {
                logWidget.log(`FPS: ${stats.fps} | Frames: ${stats.frameCount}`);
            }
        }, 1000);
    }
    
    /**
     * Save discovered patterns to file
     */
    async saveDiscoveredPatterns(outputFile = null) {
        const filename = outputFile || `patterns-${Date.now()}.json`;
        
        // Generate a complete device profile from discoveries
        const profile = {
            id: `discovered-${Date.now()}`,
            name: this.currentProfile.name || 'Discovered Device',
            manufacturer: 'Unknown',
            model: 'Discovered via Pattern Scan',
            channelCount: this.currentProfile.channelCount || 32,
            dmxStartAddress: 1,
            channels: {
                mode: {
                    channel: 1,
                    type: 'enum',
                    description: 'Operation mode',
                    values: {
                        off: 0,
                        dmx: 200
                    }
                },
                pattern: {
                    channel: 2,
                    type: 'range',
                    description: 'Pattern selection',
                    min: 0,
                    max: 255,
                    patterns: Object.fromEntries(this.discoveredPatterns)
                }
            },
            presets: {
                blackout: {
                    description: 'All off',
                    channels: { mode: 0 }
                }
            },
            metadata: {
                version: '1.0.0',
                created: new Date().toISOString(),
                discoveryMethod: 'Pattern scan',
                patternsFound: this.discoveredPatterns.size
            }
        };
        
        // Add discovered patterns as presets
        for (const [value, name] of this.discoveredPatterns) {
            const presetName = name.toLowerCase().replace(/\s+/g, '_');
            profile.presets[presetName] = {
                description: `Show ${name} pattern`,
                channels: {
                    mode: 200,
                    pattern: parseInt(value)
                }
            };
        }
        
        await fs.writeFile(filename, JSON.stringify(profile, null, 2));
        console.log(chalk.green(`\n✅ Device profile saved to ${filename}`));
        console.log(chalk.cyan(`  Found ${this.discoveredPatterns.size} patterns`));
        console.log(chalk.cyan(`  To use: dmx control --profile ${filename}`));
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async cleanup() {
        if (this.laserDevice) {
            await this.laserDevice.blackout();
            await this.laserDevice.disconnect();
        }
        if (this.screen) {
            this.screen.destroy();
        }
    }
}

// CLI Commands
program
    .name('dmx-cli')
    .description('Professional DMX Laser Control System')
    .version('2.0.0');

program
    .command('setup')
    .description('Interactive setup wizard')
    .action(async () => {
        const app = new DMXCLIApplication();
        await app.setupWizard();
    });

program
    .command('discover')
    .description('Discover and map DMX patterns')
    .action(async () => {
        const app = new DMXCLIApplication();
        if (await app.setupWizard()) {
            await app.discoverPatterns();
        }
        await app.cleanup();
    });

program
    .command('control')
    .description('Launch interactive control panel')
    .action(async () => {
        const app = new DMXCLIApplication();
        if (await app.setupWizard()) {
            await app.launchControlPanel();
        }
    });

program
    .command('pattern')
    .description('Launch Pattern Animator Editor')
    .option('-d, --demo', 'Run pattern demo mode')
    .action(async (options) => {
        if (options.demo) {
            // Run the pattern demo
            console.log(chalk.cyan('Launching Pattern Animator Demo...'));
            const { spawn } = await import('child_process');
            const demo = spawn('node', ['pattern-demo.js'], {
                stdio: 'inherit'
            });
            demo.on('close', (code) => {
                process.exit(code);
            });
        } else {
            // Launch the pattern editor UI
            console.log(chalk.cyan('Launching Pattern Editor...'));
            const { spawn } = await import('child_process');
            const editor = spawn('node', ['pattern-editor-cli.js'], {
                stdio: 'inherit'
            });
            editor.on('close', (code) => {
                process.exit(code);
            });
        }
    });

program
    .command('test')
    .description('Run automated test sequence')
    .option('-m, --mock', 'Use mock device for testing')
    .action(async (options) => {
        const app = new DMXCLIApplication();
        
        if (options.mock) {
            // Use mock for testing without hardware
            const harness = new DMXTestHarness();
            await harness.setup();
            console.log(chalk.green('Running tests with mock device...'));
            
            const scenario = {
                name: 'Basic Test',
                steps: [
                    { type: 'connect' },
                    { type: 'send_dmx', data: [0, 255, 10, 128] },
                    { type: 'assert_state', expected: { brightness: 255 } },
                    { type: 'disconnect' }
                ]
            };
            
            const results = await harness.simulateScenario(scenario);
            console.log(chalk.cyan('Test Results:'), results);
            await harness.teardown();
        } else {
            if (await app.setupWizard()) {
                await app.runTestSequence();
            }
            await app.cleanup();
        }
    });

program.parse();

// Handle cleanup on exit
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down...'));
    process.exit(0);
});