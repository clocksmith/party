#!/usr/bin/env node
/**
 * Automated Device Profile Generator
 * Discovers and generates complete device profiles through interactive testing
 */

import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';

import { DMXSerialInterface, DMXController } from './dmx.js';
import { ProfileBuilder, DeviceProfileManager } from './dmx-device-control.js';
import { DMXLogger, LogLevel } from './dmx-logger.js';

const logger = new DMXLogger({
    moduleName: 'ProfileGenerator',
    minLevel: LogLevel.INFO,
    enableFile: true,
    logFilePath: './profile-generator.log'
});

/**
 * Interactive Profile Generator
 */
class ProfileGenerator {
    constructor() {
        this.serialInterface = null;
        this.dmxController = null;
        this.profileBuilder = new ProfileBuilder();
        this.discoveredPatterns = new Map();
        this.discoveredChannels = new Map();
        this.testResults = [];
        this.rl = null;
    }
    
    /**
     * Main generation workflow
     */
    async generate() {
        console.clear();
        console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════╗
║     DMX Device Profile Generator v2.0             ║
║   Automated Discovery & Profile Creation Tool     ║
╚═══════════════════════════════════════════════════╝
        `));
        
        try {
            // Step 1: Device Information
            await this.collectDeviceInfo();
            
            // Step 2: Connect to DMX Interface
            await this.connectToDMX();
            
            // Step 3: Channel Discovery
            await this.discoverChannels();
            
            // Step 4: Pattern Discovery
            await this.discoverPatterns();
            
            // Step 5: Color Channel Discovery
            await this.discoverColorChannels();
            
            // Step 6: Movement Discovery
            await this.discoverMovement();
            
            // Step 7: Effects Discovery
            await this.discoverEffects();
            
            // Step 8: Generate Presets
            await this.generatePresets();
            
            // Step 9: Validate Profile
            await this.validateProfile();
            
            // Step 10: Save Profile
            const savedPath = await this.saveProfile();
            
            console.log(chalk.green.bold(`\n✅ Profile generation complete!`));
            console.log(chalk.cyan(`Profile saved to: ${savedPath}`));
            
            // Display summary
            this.displaySummary();
            
        } catch (error) {
            console.error(chalk.red(`\n❌ Generation failed: ${error.message}`));
            logger.error('Generation failed', { error: error.message });
        } finally {
            await this.cleanup();
        }
    }
    
    /**
     * Step 1: Collect device information
     */
    async collectDeviceInfo() {
        console.log(chalk.yellow('\n📋 Step 1: Device Information'));
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (query) => new Promise(resolve => this.rl.question(query, resolve));
        
        const name = await question('Device name/model: ') || 'Unknown Device';
        const manufacturer = await question('Manufacturer: ') || 'Unknown';
        const channelCount = parseInt(await question('Number of DMX channels (default 32): ') || '32');
        
        this.profileBuilder.setBasicInfo(name, manufacturer, channelCount);
        
        console.log(chalk.green('✓ Device information recorded'));
    }
    
    /**
     * Step 2: Connect to DMX interface
     */
    async connectToDMX() {
        console.log(chalk.yellow('\n🔌 Step 2: Connecting to DMX Interface'));
        
        const spinner = ora('Detecting DMX interfaces...').start();
        
        try {
            const ports = await DMXSerialInterface.listPorts();
            spinner.stop();
            
            if (ports.length === 0) {
                throw new Error('No serial ports detected');
            }
            
            // Auto-select if only one port
            let selectedPort;
            if (ports.length === 1) {
                selectedPort = ports[0];
                console.log(chalk.green(`✓ Found DMX interface: ${selectedPort.path}`));
            } else {
                console.log('Multiple ports found:');
                ports.forEach((port, idx) => {
                    console.log(`  [${idx + 1}] ${port.path} ${port.manufacturer || ''}`);
                });
                
                const choice = await this.question('Select port number: ');
                selectedPort = ports[parseInt(choice) - 1];
            }
            
            // Initialize connection
            this.serialInterface = new DMXSerialInterface({
                portPath: selectedPort.path
            });
            
            this.dmxController = new DMXController({
                serialInterface: this.serialInterface
            });
            
            await this.dmxController.connect();
            await this.dmxController.blackout();
            
            console.log(chalk.green('✓ Connected to DMX interface'));
            
        } catch (error) {
            spinner.fail(`Connection failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Step 3: Discover channel purposes
     */
    async discoverChannels() {
        console.log(chalk.yellow('\n🔍 Step 3: Channel Discovery'));
        console.log('Testing each channel to identify its purpose...\n');
        
        const channelTypes = [
            { name: 'mode', test: [0, 50, 100, 200], identify: 'Device mode (off/auto/sound/dmx)' },
            { name: 'pattern', test: [0, 10, 20, 30, 40], identify: 'Pattern selection' },
            { name: 'size', test: [0, 64, 128, 192, 255], identify: 'Pattern size/zoom' },
            { name: 'rotation', test: [0, 64, 128, 192, 255], identify: 'Pattern rotation' },
            { name: 'xPosition', test: [0, 64, 128, 192, 255], identify: 'Horizontal position' },
            { name: 'yPosition', test: [0, 64, 128, 192, 255], identify: 'Vertical position' },
            { name: 'red', test: [0, 255, 0, 255], identify: 'Red color' },
            { name: 'green', test: [0, 0, 255, 255], identify: 'Green color' },
            { name: 'blue', test: [255, 0, 0, 255], identify: 'Blue color' },
            { name: 'strobe', test: [0, 128, 255], identify: 'Strobe effect' },
            { name: 'speed', test: [0, 128, 255], identify: 'Animation speed' }
        ];
        
        for (let channel = 1; channel <= Math.min(32, this.profileBuilder.profile.channelCount); channel++) {
            console.log(chalk.cyan(`\nTesting channel ${channel}:`));
            
            // Test channel with various values
            for (const value of [0, 64, 128, 192, 255]) {
                await this.dmxController.setChannel(channel, value);
                await this.delay(200);
            }
            
            // Reset channel
            await this.dmxController.setChannel(channel, 0);
            
            // Ask user what they observed
            console.log('What did you observe?');
            channelTypes.forEach((type, idx) => {
                console.log(`  [${idx + 1}] ${type.identify}`);
            });
            console.log('  [0] No visible effect / Skip');
            
            const choice = await this.question('Select function (0 to skip): ');
            const typeIndex = parseInt(choice) - 1;
            
            if (typeIndex >= 0 && typeIndex < channelTypes.length) {
                const type = channelTypes[typeIndex];
                const channelName = `${type.name}${channel === 1 ? '' : channel}`;
                
                this.profileBuilder.addChannel(channelName, channel, 'range', {
                    min: 0,
                    max: 255,
                    description: type.identify
                });
                
                this.discoveredChannels.set(channel, {
                    name: channelName,
                    type: type.name,
                    description: type.identify
                });
                
                console.log(chalk.green(`✓ Channel ${channel} identified as: ${type.identify}`));
            }
        }
    }
    
    /**
     * Step 4: Discover patterns
     */
    async discoverPatterns() {
        console.log(chalk.yellow('\n🎨 Step 4: Pattern Discovery'));
        
        // Find pattern channel
        let patternChannel = null;
        for (const [ch, info] of this.discoveredChannels) {
            if (info.type === 'pattern') {
                patternChannel = ch;
                break;
            }
        }
        
        if (!patternChannel) {
            console.log(chalk.yellow('No pattern channel identified. Skipping pattern discovery.'));
            return;
        }
        
        console.log(`Testing patterns on channel ${patternChannel}...`);
        console.log('Press ENTER to skip, or type a name for the pattern you see.\n');
        
        for (let value = 0; value <= 255; value += 5) {
            await this.dmxController.setChannel(patternChannel, value);
            
            process.stdout.write(`Value ${chalk.green(value.toString().padStart(3))}: `);
            const patternName = await this.question('');
            
            if (patternName) {
                this.profileBuilder.addPattern(patternName, value);
                this.discoveredPatterns.set(value, patternName);
                console.log(chalk.green(`  ✓ Pattern saved: ${patternName}`));
            }
            
            if (patternName === 'stop') break;
        }
        
        // Reset pattern channel
        await this.dmxController.setChannel(patternChannel, 0);
    }
    
    /**
     * Step 5: Discover color channels
     */
    async discoverColorChannels() {
        console.log(chalk.yellow('\n🌈 Step 5: Color Channel Mapping'));
        
        const colorTests = [
            { name: 'Red', r: 255, g: 0, b: 0 },
            { name: 'Green', r: 0, g: 255, b: 0 },
            { name: 'Blue', r: 0, g: 0, b: 255 },
            { name: 'White', r: 255, g: 255, b: 255 },
            { name: 'Yellow', r: 255, g: 255, b: 0 },
            { name: 'Cyan', r: 0, g: 255, b: 255 },
            { name: 'Magenta', r: 255, g: 0, b: 255 }
        ];
        
        // Find potential RGB channels
        const redChannels = [];
        const greenChannels = [];
        const blueChannels = [];
        
        for (const [ch, info] of this.discoveredChannels) {
            if (info.type === 'red') redChannels.push(ch);
            if (info.type === 'green') greenChannels.push(ch);
            if (info.type === 'blue') blueChannels.push(ch);
        }
        
        if (redChannels.length && greenChannels.length && blueChannels.length) {
            console.log('Testing color combinations...');
            
            for (const test of colorTests) {
                console.log(`\nShowing ${test.name}...`);
                
                for (const r of redChannels) {
                    await this.dmxController.setChannel(r, test.r);
                }
                for (const g of greenChannels) {
                    await this.dmxController.setChannel(g, test.g);
                }
                for (const b of blueChannels) {
                    await this.dmxController.setChannel(b, test.b);
                }
                
                await this.delay(1000);
            }
            
            // Reset colors
            for (const ch of [...redChannels, ...greenChannels, ...blueChannels]) {
                await this.dmxController.setChannel(ch, 0);
            }
            
            console.log(chalk.green('✓ Color channels verified'));
        } else {
            console.log(chalk.yellow('RGB channels not fully identified'));
        }
    }
    
    /**
     * Step 6: Discover movement capabilities
     */
    async discoverMovement() {
        console.log(chalk.yellow('\n🎯 Step 6: Movement Discovery'));
        
        const xChannels = [];
        const yChannels = [];
        
        for (const [ch, info] of this.discoveredChannels) {
            if (info.type === 'xPosition') xChannels.push(ch);
            if (info.type === 'yPosition') yChannels.push(ch);
        }
        
        if (xChannels.length || yChannels.length) {
            console.log('Testing movement patterns...');
            
            // Test corners
            const positions = [
                { name: 'Top-Left', x: 0, y: 0 },
                { name: 'Top-Right', x: 255, y: 0 },
                { name: 'Bottom-Right', x: 255, y: 255 },
                { name: 'Bottom-Left', x: 0, y: 255 },
                { name: 'Center', x: 128, y: 128 }
            ];
            
            for (const pos of positions) {
                console.log(`Moving to ${pos.name}...`);
                
                for (const ch of xChannels) {
                    await this.dmxController.setChannel(ch, pos.x);
                }
                for (const ch of yChannels) {
                    await this.dmxController.setChannel(ch, pos.y);
                }
                
                await this.delay(1000);
            }
            
            // Reset position
            for (const ch of [...xChannels, ...yChannels]) {
                await this.dmxController.setChannel(ch, 128);
            }
            
            console.log(chalk.green('✓ Movement channels verified'));
        }
    }
    
    /**
     * Step 7: Discover effects
     */
    async discoverEffects() {
        console.log(chalk.yellow('\n✨ Step 7: Effects Discovery'));
        
        const effectChannels = [];
        
        for (const [ch, info] of this.discoveredChannels) {
            if (info.type === 'strobe' || info.type === 'speed') {
                effectChannels.push({ channel: ch, type: info.type });
            }
        }
        
        for (const effect of effectChannels) {
            console.log(`\nTesting ${effect.type} on channel ${effect.channel}...`);
            
            for (const value of [0, 64, 128, 192, 255]) {
                console.log(`  Setting to ${value}...`);
                await this.dmxController.setChannel(effect.channel, value);
                await this.delay(2000);
            }
            
            await this.dmxController.setChannel(effect.channel, 0);
        }
        
        if (effectChannels.length) {
            console.log(chalk.green('✓ Effects verified'));
        }
    }
    
    /**
     * Step 8: Generate presets
     */
    async generatePresets() {
        console.log(chalk.yellow('\n🎭 Step 8: Generating Presets'));
        
        // Blackout preset
        const blackout = {};
        for (const [name, def] of Object.entries(this.profileBuilder.profile.channels)) {
            blackout[name] = def.min || 0;
        }
        this.profileBuilder.addPreset('blackout', 'All channels off', blackout);
        
        // Test preset
        const test = { ...blackout };
        
        // Set mode to DMX if available
        for (const [name, def] of Object.entries(this.profileBuilder.profile.channels)) {
            if (name.includes('mode')) {
                test[name] = 200; // DMX mode
            }
            if (name.includes('pattern') && this.discoveredPatterns.size > 0) {
                test[name] = this.discoveredPatterns.keys().next().value;
            }
            if (name.includes('Red')) test[name] = 255;
            if (name.includes('Green')) test[name] = 255;
            if (name.includes('Blue')) test[name] = 255;
        }
        this.profileBuilder.addPreset('test', 'Basic test pattern', test);
        
        // Party preset
        const party = { ...test };
        for (const [name, def] of Object.entries(this.profileBuilder.profile.channels)) {
            if (name.includes('strobe')) party[name] = 150;
            if (name.includes('speed')) party[name] = 200;
        }
        this.profileBuilder.addPreset('party', 'Party mode with effects', party);
        
        console.log(chalk.green('✓ Generated 3 presets'));
    }
    
    /**
     * Step 9: Validate profile
     */
    async validateProfile() {
        console.log(chalk.yellow('\n✔️  Step 9: Profile Validation'));
        
        const profile = this.profileBuilder.build();
        
        console.log('\nTesting presets...');
        for (const presetName of Object.keys(profile.presets)) {
            console.log(`  Testing preset: ${presetName}`);
            
            const preset = profile.presets[presetName];
            for (const [channelName, value] of Object.entries(preset.channels)) {
                const channelDef = profile.channels[channelName];
                if (channelDef) {
                    await this.dmxController.setChannel(channelDef.channel, value);
                }
            }
            
            await this.delay(2000);
        }
        
        // Blackout after test
        await this.dmxController.blackout();
        
        console.log(chalk.green('✓ Profile validated'));
    }
    
    /**
     * Step 10: Save profile
     */
    async saveProfile() {
        const profile = this.profileBuilder.build();
        const filename = `${profile.manufacturer.toLowerCase().replace(/\s+/g, '-')}-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        const filepath = path.join('./device-profiles', filename);
        
        // Ensure directory exists
        await fs.mkdir('./device-profiles', { recursive: true });
        
        // Save profile
        await fs.writeFile(filepath, JSON.stringify(profile, null, 2));
        
        logger.info('Profile saved', { path: filepath });
        return filepath;
    }
    
    /**
     * Display summary
     */
    displaySummary() {
        const profile = this.profileBuilder.profile;
        
        console.log(chalk.cyan.bold('\n📊 Profile Summary:'));
        
        const table = new Table({
            head: ['Property', 'Value'],
            style: { head: ['cyan'] }
        });
        
        table.push(
            ['Device Name', profile.name],
            ['Manufacturer', profile.manufacturer],
            ['Channels', profile.channelCount],
            ['Discovered Channels', Object.keys(profile.channels).length],
            ['Discovered Patterns', Object.keys(profile.patterns).length],
            ['Generated Presets', Object.keys(profile.presets).length]
        );
        
        console.log(table.toString());
        
        if (this.discoveredPatterns.size > 0) {
            console.log(chalk.cyan('\n🎨 Discovered Patterns:'));
            for (const [value, name] of this.discoveredPatterns) {
                console.log(`  ${name}: ${value}`);
            }
        }
    }
    
    /**
     * Helper methods
     */
    question(query) {
        return new Promise(resolve => this.rl.question(query, resolve));
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async cleanup() {
        if (this.dmxController) {
            await this.dmxController.blackout();
            await this.dmxController.disconnect();
        }
        if (this.rl) {
            this.rl.close();
        }
    }
}

// CLI Interface
program
    .name('dmx-profile-generator')
    .description('Automated DMX device profile generator')
    .version('2.0.0');

program
    .command('generate')
    .description('Start interactive profile generation')
    .action(async () => {
        const generator = new ProfileGenerator();
        await generator.generate();
    });

program
    .command('validate <profile>')
    .description('Validate an existing profile')
    .action(async (profilePath) => {
        try {
            const manager = new DeviceProfileManager();
            const profile = await manager.loadProfile(profilePath);
            console.log(chalk.green(`✅ Profile is valid: ${profile.name}`));
            
            // Display profile info
            console.log('\nProfile Details:');
            console.log(`  Channels: ${profile.channelCount}`);
            console.log(`  Patterns: ${Object.keys(profile.patterns || {}).length}`);
            console.log(`  Presets: ${Object.keys(profile.presets || {}).length}`);
            
        } catch (error) {
            console.error(chalk.red(`❌ Profile validation failed: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List available device profiles')
    .action(async () => {
        const manager = new DeviceProfileManager();
        const profiles = await manager.listAvailableProfiles();
        
        if (profiles.length === 0) {
            console.log(chalk.yellow('No profiles found in device-profiles/'));
            return;
        }
        
        const table = new Table({
            head: ['ID', 'Name', 'Manufacturer', 'Channels'],
            style: { head: ['cyan'] }
        });
        
        for (const profile of profiles) {
            table.push([
                profile.id,
                profile.name,
                profile.manufacturer,
                profile.channelCount
            ]);
        }
        
        console.log(table.toString());
    });

// Run CLI
program.parse();

// Export for testing
export { ProfileGenerator };