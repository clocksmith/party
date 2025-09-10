/**
 * Choreographed Show Demo
 * 
 * Demonstrates a complete choreographed light show with timeline and music sync
 */

import { createDMXOrchestrator } from '../dmx-orchestrator.js';
import { EventEmitter } from 'events';

class ShowController extends EventEmitter {
    constructor(dmx) {
        super();
        this.dmx = dmx;
        this.timeline = [];
        this.startTime = null;
        this.running = false;
        this.currentIndex = 0;
    }
    
    addCue(time, action) {
        this.timeline.push({ time, action });
        this.timeline.sort((a, b) => a.time - b.time);
    }
    
    async start() {
        console.log('🎬 Show starting...\n');
        this.running = true;
        this.startTime = Date.now();
        this.currentIndex = 0;
        
        while (this.running && this.currentIndex < this.timeline.length) {
            const cue = this.timeline[this.currentIndex];
            const elapsed = Date.now() - this.startTime;
            
            if (elapsed >= cue.time) {
                await this.executeCue(cue);
                this.currentIndex++;
            } else {
                // Wait until next cue
                await this.sleep(10);
            }
        }
        
        if (this.running) {
            console.log('\n🎬 Show complete!');
            this.emit('complete');
        }
    }
    
    async executeCue(cue) {
        const timeStr = this.formatTime(cue.time);
        console.log(`[${timeStr}] ${cue.action.description || 'Executing cue'}`);
        
        try {
            await cue.action.execute(this.dmx);
        } catch (error) {
            console.error(`Error executing cue at ${timeStr}:`, error.message);
        }
    }
    
    stop() {
        this.running = false;
        console.log('🛑 Show stopped');
    }
    
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log('🎭 DMX Choreographed Show Demo');
    console.log('════════════════════════════════\n');
    
    // Initialize API
    const dmx = await createDMXOrchestrator({
        mock: true,
        profilePath: '../device-profiles/generic-laser.json',
        frameRate: 60,
        autoLoadPatterns: true,
        conflictResolution: 'priority',
        logging: {
            level: 'warn'  // Less verbose for show
        }
    });
    
    await dmx.connect();
    console.log('✅ System ready\n');
    
    // Create show controller
    const show = new ShowController(dmx);
    
    // Build the show timeline
    console.log('📝 Programming show...\n');
    
    // Introduction (0:00 - 0:10)
    show.addCue(0, {
        description: '🎵 Introduction - Fade in with slow circle',
        execute: async (dmx) => {
            dmx.setActivePattern('circle', {
                speed: 0.5,
                radius: 0.2,
                color: { r: 0, g: 0, b: 255 }
            });
            dmx.startAnimation();
        }
    });
    
    show.addCue(3000, {
        description: '  ↗️ Increase circle size',
        execute: async (dmx) => {
            dmx.updatePatternState({
                radius: 0.4,
                speed: 0.7
            });
        }
    });
    
    show.addCue(6000, {
        description: '  🎨 Color shift to purple',
        execute: async (dmx) => {
            dmx.updatePatternState({
                color: { r: 128, g: 0, b: 255 }
            });
        }
    });
    
    // Build-up (0:10 - 0:20)
    show.addCue(10000, {
        description: '🎵 Build-up - Switch to spiral',
        execute: async (dmx) => {
            await dmx.transitionToPattern('spiral', {
                duration: 2000,
                easing: 'easeInOut',
                state: {
                    speed: 1.0,
                    turns: 2,
                    expansion: 0.1,
                    color: { r: 255, g: 128, b: 0 }
                }
            });
        }
    });
    
    show.addCue(15000, {
        description: '  ⚡ Accelerate spiral',
        execute: async (dmx) => {
            dmx.updatePatternState({
                speed: 2.0,
                turns: 4,
                expansion: 0.2
            });
        }
    });
    
    show.addCue(18000, {
        description: '  🔥 Color to hot red',
        execute: async (dmx) => {
            dmx.updatePatternState({
                color: { r: 255, g: 0, b: 0 }
            });
        }
    });
    
    // Drop (0:20 - 0:30)
    show.addCue(20000, {
        description: '🎵 DROP! - Star pattern with strobe',
        execute: async (dmx) => {
            dmx.stopAnimation();
            dmx.setActivePattern('star', {
                points: 8,
                innerRadius: 0.1,
                outerRadius: 0.45,
                speed: 3.0,
                color: { r: 255, g: 255, b: 255 }
            });
            dmx.startAnimation();
        }
    });
    
    show.addCue(22000, {
        description: '  🌈 Rainbow colors',
        execute: async (dmx) => {
            const colors = [
                { r: 255, g: 0, b: 0 },
                { r: 255, g: 128, b: 0 },
                { r: 255, g: 255, b: 0 },
                { r: 0, g: 255, b: 0 },
                { r: 0, g: 255, b: 255 },
                { r: 0, g: 0, b: 255 },
                { r: 128, g: 0, b: 255 }
            ];
            
            for (const color of colors) {
                dmx.updatePatternState({ color });
                await new Promise(r => setTimeout(r, 250));
            }
        }
    });
    
    show.addCue(25000, {
        description: '  💫 Morph star points',
        execute: async (dmx) => {
            for (let points = 8; points >= 3; points--) {
                dmx.updatePatternState({ points });
                await new Promise(r => setTimeout(r, 500));
            }
        }
    });
    
    // Breakdown (0:30 - 0:40)
    show.addCue(30000, {
        description: '🎵 Breakdown - Gentle wave',
        execute: async (dmx) => {
            await dmx.transitionToPattern('wave', {
                duration: 3000,
                easing: 'easeOut',
                state: {
                    amplitude: 0.3,
                    frequency: 1.0,
                    speed: 0.8,
                    vertical: false,
                    color: { r: 0, g: 128, b: 255 }
                }
            });
        }
    });
    
    show.addCue(35000, {
        description: '  🌊 Increase wave complexity',
        execute: async (dmx) => {
            dmx.updatePatternState({
                amplitude: 0.4,
                frequency: 2.0,
                speed: 1.2
            });
        }
    });
    
    // Second Drop (0:40 - 0:50)
    show.addCue(40000, {
        description: '🎵 SECOND DROP! - Grid pattern',
        execute: async (dmx) => {
            dmx.setActivePattern('grid', {
                rows: 4,
                cols: 4,
                spacing: 0.2,
                speed: 2.0,
                color: { r: 255, g: 255, b: 0 }
            });
        }
    });
    
    show.addCue(43000, {
        description: '  🎯 Grid sequence',
        execute: async (dmx) => {
            for (let i = 2; i <= 6; i++) {
                dmx.updatePatternState({
                    rows: i,
                    cols: i,
                    color: {
                        r: Math.floor(Math.random() * 256),
                        g: Math.floor(Math.random() * 256),
                        b: Math.floor(Math.random() * 256)
                    }
                });
                await new Promise(r => setTimeout(r, 700));
            }
        }
    });
    
    // Finale (0:50 - 1:00)
    show.addCue(50000, {
        description: '🎵 Finale - All patterns mashup',
        execute: async (dmx) => {
            const finalPatterns = ['circle', 'square', 'spiral', 'star'];
            
            for (const pattern of finalPatterns) {
                dmx.setActivePattern(pattern, {
                    speed: 4.0,
                    color: { r: 255, g: 255, b: 255 }
                });
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    });
    
    show.addCue(58000, {
        description: '  🎆 Final burst',
        execute: async (dmx) => {
            dmx.updatePatternState({
                speed: 10.0,
                size: 0.5
            });
        }
    });
    
    // End
    show.addCue(60000, {
        description: '🏁 End - Fade to black',
        execute: async (dmx) => {
            dmx.stopAnimation();
            dmx.blackout();
        }
    });
    
    // Start the show
    console.log('─'.repeat(40));
    console.log('Show Timeline:');
    console.log('─'.repeat(40));
    show.timeline.forEach(cue => {
        const time = show.formatTime(cue.time);
        console.log(`${time} - ${cue.description || 'Cue'}`);
    });
    console.log('─'.repeat(40));
    console.log('\nPress Ctrl+C to stop the show\n');
    console.log('═'.repeat(40));
    
    // Handle interruption
    process.on('SIGINT', () => {
        console.log('\n\n⚠️  Show interrupted by user');
        show.stop();
        dmx.emergencyStop();
        dmx.disconnect().then(() => {
            process.exit(0);
        });
    });
    
    // Run the show
    await show.start();
    
    // Cleanup
    await dmx.disconnect();
    console.log('\n✅ Show demo complete!');
}

// Run the demo
main().catch(console.error);