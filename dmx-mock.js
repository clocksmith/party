/**
 * Mock DMX Device for Testing Without Hardware
 * Simulates a DMX512 laser device for development and testing
 */

import { EventEmitter } from 'events';
import { Buffer } from 'buffer';

// DMX Protocol Constants (centralized)
export const DMX_CONSTANTS = {
    BAUD_RATE: 250000,
    DATA_BITS: 8,
    STOP_BITS: 2,
    PARITY: 'none',
    START_CODE: 0x00,
    MAX_CHANNELS: 512,
    BREAK_DURATION_US: 176,  // Microseconds
    MAB_DURATION_US: 12,      // Mark After Break
    FRAME_RATE_HZ: 30,
    FRAME_INTERVAL_MS: 33     // 1000/30
};

// Device Response Patterns
const DEVICE_RESPONSES = {
    MENU_BUTTON: Buffer.from([0x0A]),
    ENTER_BUTTON: Buffer.from([0x14]),
    UP_BUTTON: Buffer.from([0x1E]),
    DOWN_BUTTON: Buffer.from([0x28]),
    ACK: Buffer.from([0x06]),
    NAK: Buffer.from([0x15])
};

/**
 * Mock Serial Port that simulates DMX hardware
 */
export class MockSerialPort extends EventEmitter {
    constructor(options = {}) {
        super();
        this.path = options.path || '/dev/tty.mock';
        this.baudRate = options.baudRate || DMX_CONSTANTS.BAUD_RATE;
        this.isOpen = false;
        this.writeBuffer = Buffer.alloc(DMX_CONSTANTS.MAX_CHANNELS + 1);
        this.simulateDevice = options.simulateDevice !== false;
        this.responseDelay = options.responseDelay || 10;
        this.failureRate = options.failureRate || 0; // 0-1 probability
        
        // Simulation state
        this.deviceState = {
            channels: new Uint8Array(DMX_CONSTANTS.MAX_CHANNELS),
            lastBreak: null,
            frameCount: 0,
            errors: 0
        };
        
        this._setupSimulation();
    }
    
    _setupSimulation() {
        if (!this.simulateDevice) return;
        
        // Simulate periodic device responses
        this.simulationInterval = setInterval(() => {
            if (!this.isOpen) return;
            
            // Randomly send button presses (for testing)
            if (Math.random() < 0.01) { // 1% chance per interval
                const buttons = Object.values(DEVICE_RESPONSES);
                const randomButton = buttons[Math.floor(Math.random() * buttons.length)];
                this.emit('data', randomButton);
            }
        }, 100);
    }
    
    open(callback) {
        setTimeout(() => {
            if (Math.random() < this.failureRate) {
                const error = new Error('Mock device connection failed');
                error.code = 'ENOENT';
                callback(error);
            } else {
                this.isOpen = true;
                callback(null);
                this.emit('open');
            }
        }, this.responseDelay);
    }
    
    close(callback) {
        setTimeout(() => {
            this.isOpen = false;
            if (this.simulationInterval) {
                clearInterval(this.simulationInterval);
                this.simulationInterval = null;
            }
            callback(null);
            this.emit('close');
        }, this.responseDelay);
    }
    
    write(data, callback) {
        if (!this.isOpen) {
            callback(new Error('Port is not open'));
            return;
        }
        
        setTimeout(() => {
            if (Math.random() < this.failureRate) {
                callback(new Error('Mock write failed'));
                this.deviceState.errors++;
            } else {
                // Detect DMX break (low baud rate)
                if (this.baudRate < 50000) {
                    this.deviceState.lastBreak = Date.now();
                } else {
                    // Normal DMX data
                    this._processDMXFrame(data);
                }
                callback(null);
            }
        }, this.responseDelay);
    }
    
    drain(callback) {
        setTimeout(() => callback(null), this.responseDelay);
    }
    
    update(options, callback) {
        // Simulate baud rate change
        if (options.baudRate !== undefined) {
            this.baudRate = options.baudRate;
        }
        setTimeout(() => callback(null), this.responseDelay);
    }
    
    _processDMXFrame(data) {
        if (data[0] === DMX_CONSTANTS.START_CODE) {
            // Valid DMX frame
            this.deviceState.frameCount++;
            
            // Update channel values
            for (let i = 1; i < data.length && i <= DMX_CONSTANTS.MAX_CHANNELS; i++) {
                this.deviceState.channels[i - 1] = data[i];
            }
            
            // Simulate device reactions to specific patterns
            this._checkForPatterns();
        }
    }
    
    _checkForPatterns() {
        const channels = this.deviceState.channels;
        
        // Check for blackout (all channels at 0)
        const isBlackout = channels.every(ch => ch === 0);
        if (isBlackout && this.deviceState.frameCount > 10) {
            this.emit('data', Buffer.from([0xFF, 0x00])); // Custom blackout response
        }
        
        // Check for strobe (rapid channel 30 changes)
        if (channels[29] > 200) {
            this.emit('data', Buffer.from([0x53, 0x01])); // Strobe active (S=0x53)
        }
    }
    
    // Static method to match real SerialPort.list()
    static async list() {
        return [
            {
                path: '/dev/tty.mock',
                manufacturer: 'MockDMX',
                serialNumber: 'MOCK001',
                pnpId: 'usb-Mock_DMX_Device',
                vendorId: '0403',
                productId: '6001'
            },
            {
                path: '/dev/tty.usbserial-MOCK002',
                manufacturer: 'ENTTEC',
                serialNumber: 'MOCK002'
            }
        ];
    }
}

/**
 * Mock DMX Device Controller for Integration Testing
 */
export class MockDMXDevice {
    constructor(options = {}) {
        this.channels = new Uint8Array(DMX_CONSTANTS.MAX_CHANNELS);
        this.startAddress = options.startAddress || 1;
        this.channelCount = options.channelCount || 32;
        this.deviceType = options.deviceType || 'laser';
        this.responses = [];
        
        // Pattern recognition
        this.patterns = new Map();
        this.animations = [];
        
        this._initializeDevice();
    }
    
    _initializeDevice() {
        // Set default channel values based on device type
        if (this.deviceType === 'laser') {
            this.channels[0] = 0;   // Mode
            this.channels[1] = 0;   // Pattern 1
            this.channels[2] = 128; // Pattern size
            this.channels[7] = 0;   // Color 1 Red
            this.channels[8] = 0;   // Color 1 Green
            this.channels[9] = 255; // Color 1 Blue (default blue laser)
        }
    }
    
    updateChannels(dmxData) {
        for (let i = 0; i < this.channelCount; i++) {
            const dmxIndex = this.startAddress + i - 1;
            if (dmxIndex < dmxData.length) {
                this.channels[i] = dmxData[dmxIndex];
            }
        }
        
        this._analyzeState();
    }
    
    _analyzeState() {
        // Detect patterns based on channel values
        const pattern1 = this.channels[1];
        const pattern2 = this.channels[18];
        
        if (pattern1 > 0) {
            this.patterns.set('pattern1', this._getPatternName(pattern1));
        }
        if (pattern2 > 0) {
            this.patterns.set('pattern2', this._getPatternName(pattern2));
        }
        
        // Detect animation
        const movement = this.channels[25];
        if (movement > 0) {
            this.animations.push({
                type: 'movement',
                speed: movement,
                timestamp: Date.now()
            });
        }
    }
    
    _getPatternName(value) {
        // Simulate pattern recognition
        const patterns = {
            10: 'CIRCLE',
            20: 'SQUARE',
            30: 'TRIANGLE',
            40: 'STAR',
            50: 'TUNNEL',
            60: 'WAVE'
        };
        
        const nearest = Object.keys(patterns).reduce((prev, curr) => {
            return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
        });
        
        return patterns[nearest] || 'CUSTOM';
    }
    
    getState() {
        return {
            channels: Array.from(this.channels),
            patterns: Object.fromEntries(this.patterns),
            animations: this.animations.slice(-10), // Last 10 animations
            mode: this.channels[0],
            brightness: Math.max(this.channels[7], this.channels[8], this.channels[9])
        };
    }
    
    simulateButtonPress(button) {
        switch(button) {
            case 'MENU':
                return DEVICE_RESPONSES.MENU_BUTTON;
            case 'ENTER':
                return DEVICE_RESPONSES.ENTER_BUTTON;
            case 'UP':
                return DEVICE_RESPONSES.UP_BUTTON;
            case 'DOWN':
                return DEVICE_RESPONSES.DOWN_BUTTON;
            default:
                return Buffer.from([0x00]);
        }
    }
}

/**
 * Test Harness for DMX Applications
 */
export class DMXTestHarness {
    constructor() {
        this.mockPort = null;
        this.mockDevice = null;
        this.testLog = [];
        this.assertions = [];
    }
    
    async setup(options = {}) {
        this.mockPort = new MockSerialPort(options.port || {});
        this.mockDevice = new MockDMXDevice(options.device || {});
        
        // Connect mock device to mock port
        this.mockPort.on('data', (data) => {
            this.mockDevice.updateChannels(data);
        });
        
        this.log('Test harness initialized');
        return this;
    }
    
    async teardown() {
        if (this.mockPort && this.mockPort.isOpen) {
            await new Promise(resolve => this.mockPort.close(resolve));
        }
        this.log('Test harness torn down');
    }
    
    log(message, level = 'info') {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message
        };
        this.testLog.push(entry);
        console.log(`[TEST ${level.toUpperCase()}] ${message}`);
    }
    
    assert(condition, message) {
        const result = {
            passed: condition,
            message,
            timestamp: Date.now()
        };
        this.assertions.push(result);
        
        if (!condition) {
            this.log(`Assertion failed: ${message}`, 'error');
            throw new Error(`Assertion failed: ${message}`);
        } else {
            this.log(`✓ ${message}`, 'success');
        }
    }
    
    async simulateScenario(scenario) {
        this.log(`Running scenario: ${scenario.name}`);
        
        for (const step of scenario.steps) {
            await this.executeStep(step);
            await this.delay(step.delay || 100);
        }
        
        return this.getResults();
    }
    
    async executeStep(step) {
        switch(step.type) {
            case 'connect':
                await new Promise(resolve => this.mockPort.open(resolve));
                break;
            case 'disconnect':
                await new Promise(resolve => this.mockPort.close(resolve));
                break;
            case 'send_dmx':
                await new Promise(resolve => 
                    this.mockPort.write(Buffer.from(step.data), resolve)
                );
                break;
            case 'button_press':
                const response = this.mockDevice.simulateButtonPress(step.button);
                this.mockPort.emit('data', response);
                break;
            case 'assert_state':
                const state = this.mockDevice.getState();
                for (const [key, expected] of Object.entries(step.expected)) {
                    this.assert(
                        JSON.stringify(state[key]) === JSON.stringify(expected),
                        `State.${key} should be ${JSON.stringify(expected)}`
                    );
                }
                break;
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getResults() {
        const passed = this.assertions.filter(a => a.passed).length;
        const failed = this.assertions.filter(a => !a.passed).length;
        
        return {
            passed,
            failed,
            total: this.assertions.length,
            assertions: this.assertions,
            log: this.testLog,
            success: failed === 0
        };
    }
}

// Export for testing
export default {
    MockSerialPort,
    MockDMXDevice,
    DMXTestHarness,
    DMX_CONSTANTS,
    DEVICE_RESPONSES
};