/**
 * Pattern Animation Demo
 * 
 * Demonstrates pattern animation using the DMX Orchestrator
 */

import { createDMXOrchestrator } from '../dmx-orchestrator.js';

async function main() {
    console.log('🎨 DMX Pattern Animation Demo\n');
    
    // Create API instance
    const dmx = await createDMXOrchestrator({
        mock: true,
        profilePath: '../device-profiles/generic-laser.json',
        frameRate: 30,
        autoLoadPatterns: true,
        logging: {
            level: 'info'
        }
    });
    
    console.log('✅ API initialized with built-in patterns\n');
    
    // Connect
    await dmx.connect();
    console.log('✅ Connected to DMX\n');
    
    // List available patterns
    const patterns = dmx.getAvailablePatterns();
    console.log(`📋 Available patterns: ${patterns.join(', ')}\n`);
    
    // Demo each pattern
    for (const patternName of patterns) {
        console.log(`\n🎭 Pattern: ${patternName.toUpperCase()}`);
        console.log('─'.repeat(30));
        
        // Set and start pattern
        dmx.setActivePattern(patternName, {
            speed: 1.0,
            size: 0.3,
            color: {
                r: Math.floor(Math.random() * 256),
                g: Math.floor(Math.random() * 256),
                b: Math.floor(Math.random() * 256)
            }
        });
        
        dmx.startAnimation();
        console.log('▶️  Animation started');
        
        // Run for 3 seconds
        await sleep(3000);
        
        // Update pattern state mid-animation
        console.log('🔄 Updating pattern state...');
        dmx.updatePatternState({
            speed: 2.0,
            size: 0.5,
            color: {
                r: 255,
                g: 0,
                b: 128
            }
        });
        
        // Run for another 2 seconds
        await sleep(2000);
        
        // Stop animation
        dmx.stopAnimation();
        console.log('⏹️  Animation stopped');
        
        await sleep(500);
    }
    
    // Demo pattern transitions
    console.log('\n\n🔄 Pattern Transitions Demo');
    console.log('─'.repeat(30));
    
    dmx.setActivePattern('circle');
    dmx.startAnimation();
    console.log('Starting with circle pattern...');
    await sleep(2000);
    
    console.log('Transitioning to spiral...');
    await dmx.transitionToPattern('spiral', {
        duration: 3000,
        easing: 'easeInOut',
        state: {
            speed: 1.5,
            turns: 3,
            expansion: 0.2
        }
    });
    
    await sleep(3000);
    
    console.log('Transitioning to star...');
    await dmx.transitionToPattern('star', {
        duration: 2000,
        easing: 'easeOut',
        state: {
            points: 5,
            innerRadius: 0.2,
            outerRadius: 0.4
        }
    });
    
    await sleep(3000);
    
    dmx.stopAnimation();
    
    // Save a pattern configuration
    console.log('\n💾 Saving pattern configuration...');
    const savedPatternPath = './saved-pattern-demo.json';
    await dmx.savePatternToFile('star', savedPatternPath);
    console.log(`Pattern saved to: ${savedPatternPath}`);
    
    // Final state
    const state = dmx.getState();
    console.log('\n📊 Final State:', JSON.stringify(state, null, 2));
    
    // Cleanup
    dmx.emergencyStop();
    await dmx.disconnect();
    console.log('\n✅ Demo complete!');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
main().catch(console.error);