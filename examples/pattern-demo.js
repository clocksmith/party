#!/usr/bin/env node
/**
 * Pattern Animator Demo
 * Demonstrates the Pattern Animator system with various patterns
 */

import { PatternAnimator } from '../laser/pattern-animator.js';
import { PatternFactory } from '../laser/patterns/geometric-patterns.js';
import { DMXSerialInterface, DMXController } from '../laser/dmx.js';
import { ProfileBasedDeviceControl } from '../laser/dmx-profile-based-control.js';
import { DeviceProfileManager } from '../laser/dmx-device-control.js';
import { DMXLogger, LogLevel } from '../laser/dmx-logger.js';
import readline from 'readline';
import chalk from 'chalk';

class PatternAnimatorDemo {
    constructor() {
        this.logger = new DMXLogger({
            moduleName: 'PatternDemo',
            minLevel: LogLevel.INFO
        });
        
        this.animator = null;
        this.dmxController = null;
        this.deviceControl = null;
        this.isRunning = false;
    }
    
    /**
     * Initialize the demo
     */
    async init() {
        console.log(chalk.cyan.bold('\n🎨 DMX Pattern Animator Demo\n'));
        
        // Setup DMX controller (mock or real)
        await this.setupDMX();
        
        // Load device profile
        const profile = await this.loadProfile();
        
        // Initialize Pattern Animator
        this.animator = new PatternAnimator({
            dmxController: this.dmxController,
            deviceProfile: profile,
            frameRate: 30,
            priority: 100 // High priority for patterns
        });
        
        // Load all available patterns
        this.loadPatterns();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Show menu
        this.showMenu();
    }
    
    /**
     * Setup DMX controller
     */
    async setupDMX() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (q) => new Promise(resolve => rl.question(q, resolve));
        
        console.log(chalk.yellow('Select DMX mode:'));
        console.log('1. Mock (no hardware required)');
        console.log('2. Real DMX interface');
        
        const choice = await question('Choice (1-2): ');
        rl.close();
        
        if (choice === '2') {
            // Real DMX
            try {
                const ports = await DMXSerialInterface.listPorts();
                if (ports.length === 0) {
                    throw new Error('No serial ports found');
                }
                
                console.log(chalk.green('\nAvailable ports:'));
                ports.forEach((port, i) => {
                    console.log(`${i + 1}. ${port.path}`);
                });
                
                const portChoice = await question('Select port: ');
                const selectedPort = ports[parseInt(portChoice) - 1];
                
                const serialInterface = new DMXSerialInterface({
                    portPath: selectedPort.path
                });
                
                this.dmxController = new DMXController({
                    serialInterface
                });
                
                await this.dmxController.connect();
                console.log(chalk.green('✓ Connected to DMX interface'));
                
            } catch (error) {
                console.log(chalk.red('Failed to connect to DMX:', error.message));
                console.log(chalk.yellow('Falling back to mock mode'));
                this.setupMockDMX();
            }
        } else {
            // Mock DMX
            this.setupMockDMX();
        }
    }
    
    /**
     * Setup mock DMX controller
     */
    setupMockDMX() {
        this.dmxController = {
            channels: new Array(512).fill(0),
            
            setChannel(channel, value) {
                if (channel >= 1 && channel <= 512) {
                    this.channels[channel - 1] = value;
                    // console.log(chalk.gray(`DMX Ch${channel}: ${value}`));
                }
            },
            
            setChannels(updates) {
                for (const [ch, val] of Object.entries(updates)) {
                    this.setChannel(parseInt(ch), val);
                }
            },
            
            blackout() {
                this.channels.fill(0);
                console.log(chalk.red('BLACKOUT'));
            },
            
            connect() {
                console.log(chalk.green('✓ Mock DMX connected'));
                return Promise.resolve();
            },
            
            disconnect() {
                console.log(chalk.yellow('Mock DMX disconnected'));
                return Promise.resolve();
            }
        };
        
        console.log(chalk.cyan('Using mock DMX controller (no hardware)'));
    }
    
    /**
     * Load device profile
     */
    async loadProfile() {
        try {
            const profileManager = new DeviceProfileManager({
                profilesDir: './device-profiles'
            });
            
            const profile = await profileManager.loadProfile('generic-laser.json');
            console.log(chalk.green(`✓ Loaded profile: ${profile.name}`));
            return profile;
            
        } catch (error) {
            console.log(chalk.yellow('Using default profile'));
            return {
                name: 'Default',
                channelCount: 32,
                channels: {
                    horizontalPosition1: { channel: 5, type: 'range' },
                    verticalPosition1: { channel: 6, type: 'range' },
                    colorRed1: { channel: 11, type: 'range' },
                    colorGreen1: { channel: 12, type: 'range' },
                    colorBlue1: { channel: 13, type: 'range' }
                }
            };
        }
    }
    
    /**
     * Load all patterns
     */
    loadPatterns() {
        const patterns = PatternFactory.getAvailablePatterns();
        
        console.log(chalk.cyan('\nLoading patterns:'));
        
        for (const patternType of patterns) {
            const pattern = PatternFactory.create(patternType);
            this.animator.loadPattern(patternType, pattern);
            console.log(chalk.green(`  ✓ ${patternType}`));
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.animator.on('frame', (data) => {
            // Could display frame info here
            if (this.showFrameData) {
                this.displayFrame(data);
            }
        });
        
        this.animator.on('error', (error) => {
            console.log(chalk.red(`Animation error: ${error.message}`));
        });
    }
    
    /**
     * Show interactive menu
     */
    showMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log(chalk.cyan('\n=== Pattern Animator Menu ===\n'));
        console.log('1. Circle Pattern');
        console.log('2. Square Pattern');
        console.log('3. Spiral Pattern');
        console.log('4. Star Pattern');
        console.log('5. Wave Pattern');
        console.log('6. Line Scanner');
        console.log('7. Grid Pattern');
        console.log('8. Demo Sequence (all patterns)');
        console.log('');
        console.log('SPACE: Start/Stop');
        console.log('C: Change color');
        console.log('S: Change speed');
        console.log('B: Blackout');
        console.log('F: Toggle frame display');
        console.log('Q: Quit');
        console.log('');
        
        // Handle keypress
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', async (key) => {
            switch (key) {
                case '1':
                    this.selectPattern('circle');
                    break;
                case '2':
                    this.selectPattern('square');
                    break;
                case '3':
                    this.selectPattern('spiral');
                    break;
                case '4':
                    this.selectPattern('star');
                    break;
                case '5':
                    this.selectPattern('wave');
                    break;
                case '6':
                    this.selectPattern('line');
                    break;
                case '7':
                    this.selectPattern('grid');
                    break;
                case '8':
                    this.runDemoSequence();
                    break;
                case ' ':
                    this.toggleAnimation();
                    break;
                case 'c':
                case 'C':
                    this.changeColor();
                    break;
                case 's':
                case 'S':
                    this.changeSpeed();
                    break;
                case 'b':
                case 'B':
                    this.blackout();
                    break;
                case 'f':
                case 'F':
                    this.toggleFrameDisplay();
                    break;
                case 'q':
                case 'Q':
                case '\u0003': // Ctrl+C
                    await this.cleanup();
                    process.exit(0);
                    break;
            }
        });
    }
    
    /**
     * Select a pattern
     */
    selectPattern(type) {
        console.log(chalk.yellow(`\nSelected pattern: ${type}`));
        
        this.animator.setActivePattern(type, {
            speed: 1.0,
            color: { r: 255, g: 255, b: 255 }
        });
        
        if (!this.isRunning) {
            console.log(chalk.gray('Press SPACE to start animation'));
        }
    }
    
    /**
     * Toggle animation on/off
     */
    toggleAnimation() {
        if (this.isRunning) {
            this.animator.stop();
            this.isRunning = false;
            console.log(chalk.yellow('\n⏸ Animation paused'));
        } else {
            this.animator.start();
            this.isRunning = true;
            console.log(chalk.green('\n▶ Animation running'));
        }
    }
    
    /**
     * Change pattern color
     */
    changeColor() {
        const colors = [
            { r: 255, g: 0, b: 0 },    // Red
            { r: 0, g: 255, b: 0 },    // Green
            { r: 0, g: 0, b: 255 },    // Blue
            { r: 255, g: 255, b: 0 },  // Yellow
            { r: 255, g: 0, b: 255 },  // Magenta
            { r: 0, g: 255, b: 255 },  // Cyan
            { r: 255, g: 255, b: 255 } // White
        ];
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        this.animator.updatePatternState({ color });
        
        console.log(chalk.rgb(color.r, color.g, color.b)(
            `\nColor changed to RGB(${color.r}, ${color.g}, ${color.b})`
        ));
    }
    
    /**
     * Change animation speed
     */
    changeSpeed() {
        const speeds = [0.5, 1.0, 1.5, 2.0, 3.0];
        const speed = speeds[Math.floor(Math.random() * speeds.length)];
        
        this.animator.updatePatternState({ speed });
        
        console.log(chalk.cyan(`\nSpeed changed to ${speed}x`));
    }
    
    /**
     * Emergency blackout
     */
    blackout() {
        this.animator.emergencyStop();
        this.isRunning = false;
        console.log(chalk.red('\n🚨 BLACKOUT'));
    }
    
    /**
     * Toggle frame data display
     */
    toggleFrameDisplay() {
        this.showFrameData = !this.showFrameData;
        console.log(chalk.gray(`\nFrame display: ${this.showFrameData ? 'ON' : 'OFF'}`));
    }
    
    /**
     * Display frame data
     */
    displayFrame(data) {
        if (data.pattern && data.pattern.position) {
            const { x, y } = data.pattern.position;
            const { r, g, b } = data.pattern.color || { r: 255, g: 255, b: 255 };
            
            process.stdout.write(
                `\rPos: (${x.toFixed(2)}, ${y.toFixed(2)}) | ` +
                `Color: RGB(${r}, ${g}, ${b}) | ` +
                `Time: ${(data.time / 1000).toFixed(1)}s`
            );
        }
    }
    
    /**
     * Run demo sequence
     */
    async runDemoSequence() {
        console.log(chalk.cyan('\n🎭 Running demo sequence...\n'));
        
        const patterns = ['circle', 'square', 'spiral', 'star', 'wave', 'line', 'grid'];
        const colors = [
            { r: 255, g: 0, b: 0 },
            { r: 0, g: 255, b: 0 },
            { r: 0, g: 0, b: 255 },
            { r: 255, g: 255, b: 0 },
            { r: 255, g: 0, b: 255 },
            { r: 0, g: 255, b: 255 },
            { r: 255, g: 255, b: 255 }
        ];
        
        // Start animation if not running
        if (!this.isRunning) {
            this.animator.start();
            this.isRunning = true;
        }
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const color = colors[i];
            
            console.log(chalk.yellow(`Pattern: ${pattern}`));
            
            this.animator.setActivePattern(pattern, {
                speed: 1.0 + i * 0.2,
                color
            });
            
            // Run for 3 seconds
            await this.delay(3000);
        }
        
        console.log(chalk.green('\nDemo sequence complete!'));
    }
    
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Cleanup on exit
     */
    async cleanup() {
        console.log(chalk.yellow('\nShutting down...'));
        
        if (this.animator) {
            this.animator.stop();
        }
        
        if (this.dmxController && this.dmxController.disconnect) {
            await this.dmxController.disconnect();
        }
        
        console.log(chalk.green('Goodbye! 👋'));
    }
}

// Launch the demo
console.clear();
const demo = new PatternAnimatorDemo();
demo.init().catch(error => {
    console.error(chalk.red('Demo failed:', error.message));
    process.exit(1);
});