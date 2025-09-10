/**
 * Basic Control Demo
 * 
 * Demonstrates simple device control using the DMX Orchestrator
 */

import { createDMXOrchestrator } from '../dmx-orchestrator.js';

async function main() {
    console.log('🎭 DMX Basic Control Demo\n');
    
    // Create API with mock mode for demonstration
    const dmx = await createDMXOrchestrator({
        mock: true,
        profilePath: '../device-profiles/generic-laser.json',
        logging: {
            level: 'info'
        }
    });
    
    console.log('✅ API initialized\n');
    
    // Connect to hardware (mock in this case)
    await dmx.connect();
    console.log('✅ Connected to DMX\n');
    
    // Demo 1: Set individual channels
    console.log('📍 Setting individual channels...');
    dmx.setChannel('mode', 'dmx');
    dmx.setChannel('colorRed1', 255);
    dmx.setChannel('colorGreen1', 128);
    dmx.setChannel('colorBlue1', 0);
    await sleep(2000);
    
    // Demo 2: Set multiple channels at once
    console.log('📍 Setting multiple channels...');
    dmx.setChannels({
        xPosition: 128,
        yPosition: 128,
        scanSpeed: 200
    });
    await sleep(2000);
    
    // Demo 3: Apply a preset
    console.log('📍 Applying preset...');
    const presets = dmx.getAvailablePresets();
    if (presets.length > 0) {
        console.log(`Available presets: ${presets.join(', ')}`);
        dmx.applyPreset(presets[0]);
        await sleep(2000);
    }
    
    // Demo 4: Run a macro (if available)
    console.log('📍 Running macro...');
    try {
        await dmx.runMacro('startup');
        await sleep(2000);
    } catch (error) {
        console.log('No startup macro available');
    }
    
    // Demo 5: Emergency stop
    console.log('📍 Emergency stop...');
    dmx.emergencyStop();
    await sleep(1000);
    
    // Get final state
    const state = dmx.getState();
    console.log('\n📊 Final State:', JSON.stringify(state, null, 2));
    
    // Disconnect
    await dmx.disconnect();
    console.log('\n✅ Demo complete!');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
main().catch(console.error);