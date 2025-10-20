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

import { DMXSerialInterface, DMXController } from '../laser/dmx.js';
import { MockSerialPort, DMXTestHarness } from '../laser/dmx-mock.js';
import { DMXLogger, LogLevel } from '../laser/dmx-logger.js';
import { DeviceProfileManager } from '../laser/dmx-device-control.js';
import { ProfileBasedDeviceControl } from '../laser/dmx-profile-based-control.js';
import { ProfileValidator } from '../laser/dmx-profile-validator.js';
import { ProfileGenerator } from '../laser/dmx-profile-generator.js';

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
        this.connectionTimeoutMs = 8000;
    }
    
    /**
     * Interactive Device Setup Wizard
     */
    async setupWizard(options = {}) {
        // Support non-interactive mode with options
        const nonInteractive = options.nonInteractive || false;
        const configFile = options.configFile || './dmx-config.json';
        
        // Try to load saved config in non-interactive mode
        if (nonInteractive && await this.loadSavedConfig(configFile)) {
            return true;
        }
        
        if (!nonInteractive) {
            console.clear();
            console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════╗
║      DMX Laser Controller Setup Wizard      ║
║         Professional Lighting Control        ║
╚════════════════════════════════════════════╝
            `));
        }
        
        const rl = nonInteractive ? null : readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (query) => nonInteractive ? null : new Promise(resolve => rl.question(query, resolve));
        
        try {
            // Step 1: Load and select device profile
            let selectedProfileId;
            let selectedProfile;
            
            if (options.profile) {
                // Use profile from command line or config
                selectedProfileId = options.profile;
                if (selectedProfileId.endsWith('.json')) {
                    // Load external profile file
                    selectedProfile = await this.profileManager.loadProfile(selectedProfileId);
                } else {
                    // Load from profiles directory
                    await this.profileManager.loadAllProfiles();
                    selectedProfile = this.profileManager.getProfile(selectedProfileId);
                }
            } else if (!nonInteractive) {
                // Interactive profile selection
                console.log(chalk.yellow('\n📋 Step 1: Select Device Profile'));
                
                // Load all available profiles
                await this.profileManager.loadAllProfiles();
                const profiles = Array.from(this.profileManager.profiles.entries());
                
                if (profiles.length === 0) {
                    console.log(chalk.red('No device profiles found!'));
                    console.log(chalk.yellow('Please add profiles to device-profiles/ directory'));
                    if (rl) rl.close();
                    return false;
                }
                
                profiles.forEach(([id, profile], index) => {
                    console.log(`  ${chalk.green(`[${index + 1}]`)} ${profile.name} (${profile.channelCount} channels)`);
                });
                
                const profileChoice = await question('\nSelect profile number: ');
                const selectedIndex = parseInt(profileChoice) - 1;
                
                if (selectedIndex >= 0 && selectedIndex < profiles.length) {
                    [selectedProfileId, selectedProfile] = profiles[selectedIndex];
                } else {
                    // Default to first profile
                    [selectedProfileId, selectedProfile] = profiles[0];
                }
            }
            
            if (!selectedProfile) {
                console.log(chalk.red('No profile selected or found'));
                if (rl) rl.close();
                return false;
            }
            
            this.currentProfile = selectedProfile;
            logger.info(`Selected device profile: ${selectedProfileId}`);
            
            // Step 2: Find Serial Port
            let selectedPort;
            
            if (options.port) {
                // Use port from command line
                selectedPort = { path: options.port };
                console.log(chalk.yellow('\n🔌 Using specified port: ') + chalk.green(options.port));
            } else {
                // Scan for ports
                if (!nonInteractive) {
                    console.log(chalk.yellow('\n🔌 Step 2: Detecting DMX Interface...'));
                }
                const spinner = nonInteractive ? null : ora('Scanning serial ports...').start();
                
                const ports = await DMXSerialInterface.listPorts();
                if (spinner) spinner.stop();
                
                if (ports.length === 0) {
                    console.log(chalk.red('❌ No serial ports detected!'));
                    console.log(chalk.yellow('Please check:'));
                    console.log('  1. DMX interface is connected');
                    console.log('  2. Drivers are installed');
                    console.log('  3. You have permission to access serial ports');
                    if (rl) rl.close();
                    return false;
                }

                if (nonInteractive) {
                    // In non-interactive mode, use first available port
                    selectedPort = ports[0];
                    logger.info(`Auto-selected port: ${selectedPort.path}`);
                    console.log(chalk.yellow('\n🔌 Auto-selected port: ') + chalk.green(selectedPort.path));
                } else {
                    console.log(chalk.green(`✅ Found ${ports.length} port(s):`));
                    ports.forEach((port, index) => {
                        const info = [];
                        if (port.manufacturer) info.push(port.manufacturer);
                        if (port.serialNumber) info.push(`S/N: ${port.serialNumber}`);
                        console.log(`  ${chalk.green(`[${index + 1}]`)} ${port.path} ${info.length ? `(${info.join(', ')})` : ''}`);
                    });
                    
                    const portChoice = await question('\nSelect port number: ');
                    selectedPort = ports[parseInt(portChoice) - 1];
                    
                    if (!selectedPort) {
                        console.log(chalk.red('Invalid selection'));
                        if (rl) rl.close();
                        return false;
                    }
                }
            }
            
            // Step 3: DMX Address Configuration
            let startAddress;
            
            if (options.startAddress) {
                // Use address from command line
                startAddress = options.startAddress;
                console.log(chalk.yellow('\n⚙️  Using DMX start address: ') + chalk.green(startAddress));
            } else if (nonInteractive) {
                // Default to 1 in non-interactive mode
                startAddress = '1';
                console.log(chalk.yellow('\n⚙️  Using default DMX start address: ') + chalk.green(startAddress));
            } else {
                console.log(chalk.yellow('\n⚙️  Step 3: DMX Configuration'));
                startAddress = await question('Enter DMX start address (1-512) [1]: ') || '1';
            }
            
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

                await this.withTimeout(
                    this.laserDevice.connect(),
                    this.connectionTimeoutMs,
                    `Timed out opening ${selectedPort.path}. Check cabling, permissions, or choose a different port.`
                );
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
                await this.cleanup();
                if (rl) rl.close();
                return false;
            }

            // Save config if requested
            if (options.save) {
                await this.saveConfig(configFile, {
                    profile: selectedProfileId,
                    port: selectedPort.path,
                    startAddress: parseInt(startAddress)
                });
                console.log(chalk.green(`\n💾 Configuration saved to ${configFile}`));
            }
            
            if (rl) rl.close();
            return true;
            
        } catch (error) {
            console.error(chalk.red('Setup error:'), error.message);
            if (rl) rl.close();
            return false;
        }
    }
    
    /**
     * Enhanced Pattern Discovery Tool
     */
    async discoverPatterns(options = {}) {
        if (!this.isConnected) {
            console.log(chalk.red('Not connected. Run setup first.'));
            return;
        }
        
        console.log(chalk.cyan.bold('\n🔍 Enhanced Pattern Discovery Mode'));
        console.log('This will cycle through channel values to discover patterns.');
        console.log('Watch your laser device and note the patterns you see.\n');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Discovery configuration
        const config = {
            channels: options.channels || [],
            stepSize: options.stepSize || 10,
            dwellTime: options.dwellTime || 0,
            minValue: options.minValue || 0,
            maxValue: options.maxValue || 255,
            captureState: options.captureState || false
        };
        
        // Determine channels to test
        if (config.channels.length === 0) {
            // Default to pattern channels
            for (const [name, def] of Object.entries(this.currentProfile.channels)) {
                if (name.includes('pattern') || def.description?.toLowerCase().includes('pattern')) {
                    config.channels.push({ name, ...def });
                }
            }
            
            if (config.channels.length === 0) {
                // Fallback to channel 2
                config.channels.push({ name: 'pattern', channel: 2 });
            }
        }
        
        console.log(chalk.yellow('Discovery Configuration:'));
        console.log(`  Channels: ${config.channels.map(c => `${c.name} (${c.channel})`).join(', ')}`);
        console.log(`  Range: ${config.minValue}-${config.maxValue}, Step: ${config.stepSize}`);
        console.log(`  Dwell time: ${config.dwellTime}ms`);
        
        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
        
        // Discovery results
        const discoveries = new Map();
        
        for (const channelDef of config.channels) {
            console.log(chalk.cyan(`\nTesting channel ${channelDef.channel} (${channelDef.name})`));
            console.log('Press ENTER to move to next value, type pattern name to save it.');
            console.log('Type "skip" to skip this channel, "stop" to finish.\n');
            
            const channelDiscoveries = new Map();
            
            for (let value = config.minValue; value <= config.maxValue; value += config.stepSize) {
                // Set channel value
                await this.dmxController.updateChannel(channelDef.channel, value);
                
                // Optional dwell time
                if (config.dwellTime > 0) {
                    await this.delay(config.dwellTime);
                }
                
                process.stdout.write(`Value ${chalk.green(value.toString().padStart(3))}: `);
                
                const input = await question('');
                const trimmedInput = input.trim();
                
                if (trimmedInput && trimmedInput !== '') {
                    if (trimmedInput.toLowerCase() === 'stop') {
                        break;
                    } else if (trimmedInput.toLowerCase() === 'skip') {
                        console.log(chalk.yellow('  Skipping channel'));
                        break;
                    }
                    
                    // Capture current state if requested
                    const discovery = { 
                        value,
                        name: trimmedInput
                    };
                    
                    if (config.captureState) {
                        // Capture all channel values for this pattern
                        discovery.state = {};
                        const startAddr = this.laserDevice?.startAddress || 1;
                        for (const [name, def] of Object.entries(this.currentProfile.channels)) {
                            // Account for fixture's start address
                            const absoluteChannel = startAddr + def.channel - 1;
                            discovery.state[name] = this.dmxController.dmxState[absoluteChannel] || 0;
                        }
                    }
                    
                    channelDiscoveries.set(value, discovery);
                    console.log(chalk.green(`  ✓ Saved: ${trimmedInput}`));
                }
            }
            
            if (channelDiscoveries.size > 0) {
                discoveries.set(channelDef.name, {
                    channel: channelDef.channel,
                    patterns: channelDiscoveries
                });
            }
        }
        
        rl.close();
        
        // Save discovered patterns
        if (discoveries.size > 0) {
            await this.saveEnhancedDiscoveries(discoveries, options.outputFile);
        }
        
        return discoveries;
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
                await this.dmxController.updateChannel(
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
                await this.dmxController.updateChannel(channelDef.channel, value);
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
                this.dmxController.updateChannel(8, 255);  // Red
                this.dmxController.updateChannel(2, 10);   // Circle pattern
            }},
            { name: 'Green Square', action: () => {
                this.dmxController.updateChannel(8, 0);    // Red off
                this.dmxController.updateChannel(9, 255);  // Green
                this.dmxController.updateChannel(2, 20);   // Square pattern
            }},
            { name: 'Blue Wave', action: () => {
                this.dmxController.updateChannel(9, 0);    // Green off
                this.dmxController.updateChannel(10, 255); // Blue
                this.dmxController.updateChannel(2, 80);   // Wave pattern
            }},
            { name: 'Rainbow Strobe', action: () => {
                this.dmxController.updateChannel(30, 200); // Color change
                this.dmxController.updateChannel(31, 150); // Strobe
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
     * Save enhanced discoveries to file
     */
    async saveEnhancedDiscoveries(discoveries, outputFile = null) {
        const filename = outputFile || `discovered-patterns-${Date.now()}.json`;
        
        // Generate complete device profile from discoveries
        const profile = {
            id: `discovered-${Date.now()}`,
            name: `${this.currentProfile.name} - Enhanced Discovery`,
            manufacturer: this.currentProfile.manufacturer || 'Unknown',
            model: this.currentProfile.model || 'Discovered',
            channelCount: this.currentProfile.channelCount || 32,
            dmxStartAddress: 1,
            channels: { ...this.currentProfile.channels },
            presets: {},
            patterns: {},
            metadata: {
                version: '2.0.0',
                created: new Date().toISOString(),
                discoveryMethod: 'Enhanced pattern scan',
                originalProfile: this.currentProfile.id || this.currentProfile.name
            }
        };
        
        // Process discoveries
        for (const [channelName, discovery] of discoveries) {
            // Add discovered patterns to channel definition
            if (profile.channels[channelName]) {
                profile.channels[channelName].discoveredPatterns = {};
                
                for (const [value, pattern] of discovery.patterns) {
                    profile.channels[channelName].discoveredPatterns[pattern.name] = pattern.value;
                    
                    // Create preset if state was captured
                    if (pattern.state) {
                        const presetName = `${channelName}_${pattern.name.toLowerCase().replace(/\s+/g, '_')}`;
                        profile.presets[presetName] = {
                            description: `${pattern.name} (discovered)`,
                            channels: pattern.state
                        };
                    }
                    
                    // Add to global patterns
                    profile.patterns[pattern.name] = {
                        channel: discovery.channel,
                        value: pattern.value,
                        description: `Discovered pattern: ${pattern.name}`
                    };
                }
            }
        }
        
        await fs.writeFile(filename, JSON.stringify(profile, null, 2));
        console.log(chalk.green(`\n✅ Enhanced device profile saved to ${filename}`));
        console.log(chalk.cyan(`  Discovered ${discoveries.size} channels with patterns`));
        console.log(chalk.cyan(`  Created ${Object.keys(profile.presets).length} presets`));
        console.log(chalk.cyan(`  To use: dmx control --profile ${filename}`));
        
        return profile;
    }
    
    /**
     * Save discovered patterns to file (legacy)
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
    
    /**
     * Load saved configuration
     */
    async loadSavedConfig(configFile) {
        try {
            const content = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(content);
            
            // Load the specified profile
            if (config.profile) {
                if (config.profile.endsWith('.json')) {
                    this.currentProfile = await this.profileManager.loadProfile(config.profile);
                } else {
                    await this.profileManager.loadAllProfiles();
                    this.currentProfile = this.profileManager.getProfile(config.profile);
                }
            }
            
            // Connect to specified port
            if (config.port && this.currentProfile) {
                this.serialInterface = new DMXSerialInterface({
                    portPath: config.port
                });
                
                this.dmxController = new DMXController({
                    serialInterface: this.serialInterface
                });
                
                this.laserDevice = new ProfileBasedDeviceControl({
                    dmxController: this.dmxController,
                    profile: this.currentProfile,
                    startAddress: config.startAddress || 1
                });
                
                await this.withTimeout(
                    this.laserDevice.connect(),
                    this.connectionTimeoutMs,
                    `Timed out opening ${config.port}. Check cabling, permissions, or choose a different port.`
                );
                this.isConnected = true;

                logger.info('Loaded configuration from file', { config });
                return true;
            }
        } catch (error) {
            logger.warn('Could not load saved config', { error: error.message });
        }
        return false;
    }
    
    /**
     * Save configuration to file
     */
    async saveConfig(configFile, config) {
        try {
            await fs.writeFile(configFile, JSON.stringify(config, null, 2));
            logger.info('Saved configuration', { file: configFile, config });
        } catch (error) {
            logger.error('Failed to save configuration', { error: error.message });
            throw error;
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async withTimeout(promise, ms, message) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), ms);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async cleanup() {
        if (this.laserDevice) {
            await this.laserDevice.blackout();
            await this.laserDevice.disconnect();
            this.laserDevice = null;
        }
        if (this.screen) {
            this.screen.destroy();
            this.screen = null;
        }
        this.dmxController = null;
        this.serialInterface = null;
        this.isConnected = false;
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
    .option('--profile <profile>', 'Device profile ID or path to JSON file')
    .option('--port <port>', 'Serial port path')
    .option('--address <address>', 'DMX start address', '1')
    .option('--save', 'Save configuration for reuse')
    .option('--config <file>', 'Configuration file path', './dmx-config.json')
    .option('--non-interactive', 'Run in non-interactive mode (requires saved config)')
    .action(async (options) => {
        const app = new DMXCLIApplication();
        await app.setupWizard({
            profile: options.profile,
            port: options.port,
            startAddress: options.address,
            save: options.save,
            configFile: options.config,
            nonInteractive: options.nonInteractive
        });
    });

program
    .command('discover')
    .description('Discover and map DMX patterns')
    .option('-c, --channels <channels>', 'Comma-separated list of channels to test')
    .option('-s, --step <size>', 'Step size for value changes', '10')
    .option('-d, --dwell <ms>', 'Dwell time between changes in ms', '0')
    .option('--min <value>', 'Minimum value to test', '0')
    .option('--max <value>', 'Maximum value to test', '255')
    .option('--capture-state', 'Capture full channel state for each pattern')
    .option('-o, --output <file>', 'Output file for discovered patterns')
    .action(async (options) => {
        const app = new DMXCLIApplication();
        if (await app.setupWizard()) {
            const discoverOptions = {
                stepSize: parseInt(options.step),
                dwellTime: parseInt(options.dwell),
                minValue: parseInt(options.min),
                maxValue: parseInt(options.max),
                captureState: options.captureState || false,
                outputFile: options.output
            };
            
            if (options.channels) {
                discoverOptions.channels = options.channels.split(',').map(ch => {
                    const num = parseInt(ch.trim());
                    return { name: `channel_${num}`, channel: num };
                });
            }
            
            await app.discoverPatterns(discoverOptions);
        }
        await app.cleanup();
    });

program
    .command('control')
    .description('Launch interactive control panel')
    .option('--profile <profile>', 'Device profile ID or path to JSON file')
    .option('--port <port>', 'Serial port path')
    .option('--address <address>', 'DMX start address', '1')
    .action(async (options) => {
        const app = new DMXCLIApplication();
        if (await app.setupWizard({
            profile: options.profile,
            port: options.port,
            startAddress: options.address,
            nonInteractive: Boolean(options.profile || options.port)
        })) {
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
            const demo = spawn('node', ['examples/pattern-demo.js'], {
                stdio: 'inherit'
            });
            demo.on('close', (code) => {
                process.exit(code);
            });
        } else {
            // Launch the pattern editor UI
            console.log(chalk.cyan('Launching Pattern Editor...'));
            const { spawn } = await import('child_process');
            const editor = spawn('node', ['cli/pattern-editor-cli.js'], {
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
