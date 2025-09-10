/**
 * Multi-Device Control Demo
 * 
 * Demonstrates controlling multiple DMX devices simultaneously
 */

import { DMXOrchestrator } from '../dmx-orchestrator.js';

class MultiDeviceController {
    constructor() {
        this.devices = new Map();
    }
    
    async addDevice(id, options) {
        console.log(`📡 Adding device: ${id}`);
        
        const api = new DMXOrchestrator({
            ...options,
            mock: true,  // Using mock for demo
            autoLoadPatterns: true,
            logging: {
                enabled: false  // Reduce noise with multiple devices
            }
        });
        
        await api.init();
        await api.connect();
        
        this.devices.set(id, api);
        console.log(`✅ Device ${id} connected\n`);
        
        return api;
    }
    
    async removeDevice(id) {
        const device = this.devices.get(id);
        if (device) {
            await device.disconnect();
            this.devices.delete(id);
            console.log(`❌ Device ${id} removed`);
        }
    }
    
    // Control all devices
    blackoutAll() {
        console.log('🌑 Blackout all devices');
        for (const [id, device] of this.devices) {
            device.blackout();
        }
    }
    
    setAllPattern(pattern, state = {}) {
        console.log(`🎨 Setting all devices to pattern: ${pattern}`);
        for (const [id, device] of this.devices) {
            device.setActivePattern(pattern, state);
        }
    }
    
    startAll() {
        console.log('▶️  Starting all animations');
        for (const [id, device] of this.devices) {
            device.startAnimation();
        }
    }
    
    stopAll() {
        console.log('⏹️  Stopping all animations');
        for (const [id, device] of this.devices) {
            device.stopAnimation();
        }
    }
    
    // Individual device control
    controlDevice(id, callback) {
        const device = this.devices.get(id);
        if (device) {
            callback(device);
        }
    }
    
    // Synchronized control
    async synchronizedShow() {
        console.log('\n🎭 Starting synchronized show...\n');
        
        const devices = Array.from(this.devices.values());
        const patterns = ['circle', 'square', 'spiral', 'star'];
        
        // Phase 1: All devices same pattern, different colors
        console.log('Phase 1: Synchronized patterns, different colors');
        const colors = [
            { r: 255, g: 0, b: 0 },    // Red
            { r: 0, g: 255, b: 0 },    // Green
            { r: 0, g: 0, b: 255 },    // Blue
            { r: 255, g: 255, b: 0 }   // Yellow
        ];
        
        devices.forEach((device, index) => {
            device.setActivePattern('circle', {
                speed: 1.0,
                radius: 0.3,
                color: colors[index % colors.length]
            });
            device.startAnimation();
        });
        
        await this.sleep(5000);
        
        // Phase 2: Different patterns, same color
        console.log('Phase 2: Different patterns, synchronized color');
        devices.forEach((device, index) => {
            device.setActivePattern(patterns[index % patterns.length], {
                speed: 1.5,
                size: 0.3,
                color: { r: 255, g: 255, b: 255 }
            });
        });
        
        await this.sleep(5000);
        
        // Phase 3: Chase sequence
        console.log('Phase 3: Chase sequence');
        for (let i = 0; i < 10; i++) {
            devices.forEach((device, index) => {
                setTimeout(() => {
                    device.updatePatternState({
                        color: { r: 255, g: 0, b: 128 }
                    });
                    setTimeout(() => {
                        device.updatePatternState({
                            color: { r: 0, g: 128, b: 255 }
                        });
                    }, 200);
                }, index * 100);
            });
            await this.sleep(devices.size * 100 + 200);
        }
        
        // Phase 4: Mirror effect
        console.log('Phase 4: Mirror effect');
        const half = Math.floor(devices.length / 2);
        
        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];
            const mirrorIndex = i < half ? i : devices.length - 1 - i;
            
            device.setActivePattern('wave', {
                speed: 1.0 + mirrorIndex * 0.2,
                amplitude: 0.3,
                frequency: 2,
                vertical: i < half,
                color: { r: 0, g: 255, b: 255 }
            });
        }
        
        await this.sleep(5000);
        
        // Finale
        console.log('Finale: All devices synchronized burst');
        for (let i = 0; i < 5; i++) {
            this.blackoutAll();
            await this.sleep(100);
            
            devices.forEach(device => {
                device.setActivePattern('star', {
                    points: 8,
                    innerRadius: 0.1,
                    outerRadius: 0.45,
                    speed: 5.0,
                    color: { 
                        r: Math.floor(Math.random() * 256),
                        g: Math.floor(Math.random() * 256),
                        b: Math.floor(Math.random() * 256)
                    }
                });
                device.startAnimation();
            });
            
            await this.sleep(400);
        }
        
        this.stopAll();
        console.log('\n✅ Synchronized show complete!');
    }
    
    // Group control
    async groupDemo() {
        console.log('\n👥 Group Control Demo\n');
        
        const devices = Array.from(this.devices.entries());
        
        // Create groups
        const groupA = devices.filter((_, i) => i % 2 === 0).map(([id]) => id);
        const groupB = devices.filter((_, i) => i % 2 === 1).map(([id]) => id);
        
        console.log(`Group A: ${groupA.join(', ')}`);
        console.log(`Group B: ${groupB.join(', ')}\n`);
        
        // Alternate groups
        for (let i = 0; i < 6; i++) {
            const activeGroup = i % 2 === 0 ? groupA : groupB;
            const inactiveGroup = i % 2 === 0 ? groupB : groupA;
            
            console.log(`Activating Group ${i % 2 === 0 ? 'A' : 'B'}`);
            
            // Active group
            activeGroup.forEach(id => {
                this.controlDevice(id, device => {
                    device.setActivePattern('spiral', {
                        speed: 2.0,
                        turns: 3,
                        expansion: 0.2,
                        color: { r: 255, g: 128, b: 0 }
                    });
                    device.startAnimation();
                });
            });
            
            // Inactive group
            inactiveGroup.forEach(id => {
                this.controlDevice(id, device => {
                    device.blackout();
                });
            });
            
            await this.sleep(2000);
        }
        
        console.log('\n✅ Group control demo complete!');
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log('🎭 DMX Multi-Device Control Demo');
    console.log('═══════════════════════════════════\n');
    
    const controller = new MultiDeviceController();
    
    // Add multiple devices with different start addresses
    await controller.addDevice('laser1', {
        profilePath: '../device-profiles/generic-laser.json',
        startAddress: 1
    });
    
    await controller.addDevice('laser2', {
        profilePath: '../device-profiles/generic-laser.json',
        startAddress: 33
    });
    
    await controller.addDevice('laser3', {
        profilePath: '../device-profiles/generic-laser.json',
        startAddress: 65
    });
    
    await controller.addDevice('laser4', {
        profilePath: '../device-profiles/generic-laser.json',
        startAddress: 97
    });
    
    console.log(`📊 Total devices: ${controller.devices.size}\n`);
    console.log('─'.repeat(40));
    
    // Demo 1: Basic control
    console.log('\n📍 Demo 1: Basic Multi-Device Control\n');
    
    controller.setAllPattern('circle', {
        speed: 1.0,
        radius: 0.3,
        color: { r: 255, g: 255, b: 255 }
    });
    controller.startAll();
    
    await controller.sleep(3000);
    
    // Update all devices
    console.log('Updating all device parameters...');
    for (const [id, device] of controller.devices) {
        device.updatePatternState({
            speed: 2.0,
            color: { r: 0, g: 255, b: 128 }
        });
    }
    
    await controller.sleep(3000);
    controller.stopAll();
    
    console.log('─'.repeat(40));
    
    // Demo 2: Synchronized show
    await controller.synchronizedShow();
    
    console.log('─'.repeat(40));
    
    // Demo 3: Group control
    await controller.groupDemo();
    
    console.log('─'.repeat(40));
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    controller.blackoutAll();
    
    for (const id of controller.devices.keys()) {
        await controller.removeDevice(id);
    }
    
    console.log('\n✅ Multi-device demo complete!');
}

// Run the demo
main().catch(console.error);