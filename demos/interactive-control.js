/**
 * Interactive Control Demo
 * 
 * Real-time interactive control using keyboard input
 */

import { createDMXOrchestrator } from '../dmx-orchestrator.js';
import readline from 'readline';

class InteractiveController {
    constructor(dmx) {
        this.dmx = dmx;
        this.currentPattern = null;
        this.speed = 1.0;
        this.size = 0.3;
        this.color = { r: 255, g: 255, b: 255 };
        
        // Setup keyboard input
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Raw mode for single keypress
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        readline.emitKeypressEvents(process.stdin);
    }
    
    async start() {
        console.clear();
        this.printHeader();
        this.printControls();
        this.printStatus();
        
        // Handle keypress
        process.stdin.on('keypress', async (str, key) => {
            if (key.ctrl && key.name === 'c') {
                await this.quit();
                return;
            }
            
            await this.handleKey(key);
            this.printStatus();
        });
    }
    
    async handleKey(key) {
        const patterns = ['circle', 'square', 'spiral', 'star', 'wave', 'line', 'grid'];
        
        switch (key.name) {
            // Pattern selection (1-7)
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
                const patternIndex = parseInt(key.name) - 1;
                if (patternIndex < patterns.length) {
                    this.currentPattern = patterns[patternIndex];
                    this.dmx.setActivePattern(this.currentPattern, {
                        speed: this.speed,
                        size: this.size,
                        color: this.color
                    });
                    if (!this.dmx.getState().isAnimating) {
                        this.dmx.startAnimation();
                    }
                }
                break;
                
            // Speed control
            case 'q':  // Speed down
                this.speed = Math.max(0.1, this.speed - 0.2);
                this.dmx.updatePatternState({ speed: this.speed });
                break;
            case 'w':  // Speed up
                this.speed = Math.min(5.0, this.speed + 0.2);
                this.dmx.updatePatternState({ speed: this.speed });
                break;
                
            // Size control
            case 'a':  // Size down
                this.size = Math.max(0.1, this.size - 0.05);
                this.dmx.updatePatternState({ size: this.size });
                break;
            case 's':  // Size up
                this.size = Math.min(0.5, this.size + 0.05);
                this.dmx.updatePatternState({ size: this.size });
                break;
                
            // Color control
            case 'r':  // Red
                this.color = { r: 255, g: 0, b: 0 };
                this.dmx.updatePatternState({ color: this.color });
                break;
            case 'g':  // Green
                this.color = { r: 0, g: 255, b: 0 };
                this.dmx.updatePatternState({ color: this.color });
                break;
            case 'b':  // Blue
                this.color = { r: 0, g: 0, b: 255 };
                this.dmx.updatePatternState({ color: this.color });
                break;
            case 'y':  // Yellow
                this.color = { r: 255, g: 255, b: 0 };
                this.dmx.updatePatternState({ color: this.color });
                break;
            case 'p':  // Purple
                this.color = { r: 128, g: 0, b: 255 };
                this.dmx.updatePatternState({ color: this.color });
                break;
            case 'c':  // Cyan
                this.color = { r: 0, g: 255, b: 255 };
                this.dmx.updatePatternState({ color: this.color });
                break;
            case 'w':  // White
                this.color = { r: 255, g: 255, b: 255 };
                this.dmx.updatePatternState({ color: this.color });
                break;
                
            // Animation control
            case 'space':
                if (this.dmx.getState().isAnimating) {
                    this.dmx.stopAnimation();
                } else if (this.currentPattern) {
                    this.dmx.startAnimation();
                }
                break;
                
            // Blackout
            case 'x':
                this.dmx.blackout();
                this.currentPattern = null;
                break;
                
            // Random pattern
            case 'z':
                const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
                this.currentPattern = randomPattern;
                this.color = {
                    r: Math.floor(Math.random() * 256),
                    g: Math.floor(Math.random() * 256),
                    b: Math.floor(Math.random() * 256)
                };
                this.dmx.setActivePattern(this.currentPattern, {
                    speed: this.speed,
                    size: this.size,
                    color: this.color
                });
                if (!this.dmx.getState().isAnimating) {
                    this.dmx.startAnimation();
                }
                break;
                
            // Special effects
            case 'f':  // Fast strobe
                for (let i = 0; i < 10; i++) {
                    this.dmx.blackout();
                    await this.sleep(50);
                    if (this.currentPattern) {
                        this.dmx.startAnimation();
                    }
                    await this.sleep(50);
                }
                break;
                
            // Quit
            case 'escape':
                await this.quit();
                break;
        }
    }
    
    printHeader() {
        console.log('╔════════════════════════════════════════════╗');
        console.log('║     🎮 DMX INTERACTIVE CONTROL DEMO 🎮     ║');
        console.log('╚════════════════════════════════════════════╝');
        console.log();
    }
    
    printControls() {
        console.log('┌────────────────────────────────────────────┐');
        console.log('│ CONTROLS:                                  │');
        console.log('├────────────────────────────────────────────┤');
        console.log('│ Patterns:  1-7     Select pattern          │');
        console.log('│ Speed:     Q/W     Decrease/Increase       │');
        console.log('│ Size:      A/S     Smaller/Larger          │');
        console.log('│ Colors:    R G B Y P C W                   │');
        console.log('│ Animation: SPACE   Start/Stop               │');
        console.log('│ Blackout:  X       All lights off          │');
        console.log('│ Random:    Z       Random pattern & color  │');
        console.log('│ Strobe:    F       Fast strobe effect      │');
        console.log('│ Quit:      ESC     Exit program            │');
        console.log('└────────────────────────────────────────────┘');
        console.log();
    }
    
    printStatus() {
        const state = this.dmx.getState();
        const colorStr = `RGB(${this.color.r}, ${this.color.g}, ${this.color.b})`;
        
        // Move cursor to status area
        process.stdout.write('\x1B[20;0H');  // Move to line 20
        
        console.log('┌────────────────────────────────────────────┐');
        console.log(`│ STATUS:                                    │`);
        console.log('├────────────────────────────────────────────┤');
        console.log(`│ Pattern:   ${(this.currentPattern || 'None').padEnd(31)} │`);
        console.log(`│ Animation: ${(state.isAnimating ? '▶️ Running' : '⏸️ Stopped').padEnd(31)} │`);
        console.log(`│ Speed:     ${this.speed.toFixed(1).padEnd(31)} │`);
        console.log(`│ Size:      ${this.size.toFixed(2).padEnd(31)} │`);
        console.log(`│ Color:     ${colorStr.padEnd(31)} │`);
        console.log('└────────────────────────────────────────────┘');
        
        // Visual color indicator
        const colorBar = this.getColorBar();
        console.log('\n' + colorBar);
    }
    
    getColorBar() {
        const { r, g, b } = this.color;
        const ansiColor = `\x1b[38;2;${r};${g};${b}m`;
        const reset = '\x1b[0m';
        const bar = '█'.repeat(46);
        return ansiColor + bar + reset;
    }
    
    async quit() {
        console.clear();
        console.log('👋 Shutting down...');
        this.dmx.emergencyStop();
        await this.dmx.disconnect();
        this.rl.close();
        process.exit(0);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    // Initialize API
    const dmx = await createDMXOrchestrator({
        mock: true,
        profilePath: '../device-profiles/generic-laser.json',
        frameRate: 30,
        autoLoadPatterns: true,
        logging: {
            enabled: false  // Disable logging for clean UI
        }
    });
    
    await dmx.connect();
    
    // Create and start interactive controller
    const controller = new InteractiveController(dmx);
    await controller.start();
}

// Run the demo
main().catch(console.error);