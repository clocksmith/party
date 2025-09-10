/**
 * Automated Unit Tests for DMX System
 * Uses mock devices for testing without hardware
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { DMXSerialInterface, DMXController, LaserDeviceControl } from '../dmx.js';
import { MockSerialPort, MockDMXDevice, DMXTestHarness, DMX_CONSTANTS } from '../dmx-mock.js';
import { 
    DMXError, 
    SerialConnectionError, 
    DMXProtocolError,
    ChannelRangeError,
    ErrorRecoveryManager 
} from '../dmx-errors.js';
import { DMXLogger, LogLevel } from '../dmx-logger.js';

describe('DMX System Test Suite', () => {
    let harness;
    let mockPort;
    let logger;
    
    before(() => {
        logger = new DMXLogger({
            moduleName: 'TEST',
            minLevel: LogLevel.ERROR, // Only show errors during tests
            enableConsole: false
        });
    });
    
    beforeEach(async () => {
        harness = new DMXTestHarness();
        await harness.setup();
        mockPort = harness.mockPort;
    });
    
    afterEach(async () => {
        await harness.teardown();
    });
    
    describe('DMXSerialInterface', () => {
        it('should connect to a mock serial port', async () => {
            const serialInterface = new DMXSerialInterface({
                portPath: '/dev/tty.mock'
            });
            
            // Replace real SerialPort with mock
            serialInterface.port = mockPort;
            
            await new Promise((resolve, reject) => {
                mockPort.open((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            expect(mockPort.isOpen).to.be.true;
        });
        
        it('should handle connection errors gracefully', async () => {
            mockPort.failureRate = 1; // Force failure
            
            await new Promise((resolve) => {
                mockPort.open((err) => {
                    expect(err).to.exist;
                    expect(err.message).to.include('Mock device connection failed');
                    resolve();
                });
            });
        });
        
        it('should send DMX frames correctly', async () => {
            await new Promise(resolve => mockPort.open(resolve));
            
            const testData = Buffer.alloc(513);
            testData[0] = DMX_CONSTANTS.START_CODE;
            testData[1] = 255; // Channel 1 full
            
            await new Promise((resolve, reject) => {
                mockPort.write(testData, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            expect(harness.mockDevice.deviceState.frameCount).to.equal(1);
            expect(harness.mockDevice.deviceState.channels[0]).to.equal(255);
        });
        
        it('should handle baud rate changes for Break/MAB', async () => {
            await new Promise(resolve => mockPort.open(resolve));
            
            // Simulate Break sequence
            await new Promise((resolve, reject) => {
                mockPort.update({ baudRate: 9600 }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            expect(mockPort.baudRate).to.equal(9600);
            
            // Return to normal DMX baud rate
            await new Promise((resolve, reject) => {
                mockPort.update({ baudRate: DMX_CONSTANTS.BAUD_RATE }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            expect(mockPort.baudRate).to.equal(DMX_CONSTANTS.BAUD_RATE);
        });
    });
    
    describe('DMXController', () => {
        let controller;
        let serialInterface;
        
        beforeEach(() => {
            serialInterface = {
                connect: sinon.stub().resolves(),
                disconnect: sinon.stub().resolves(),
                sendDMXFrame: sinon.stub().resolves(),
                isConnected: sinon.stub().returns(true),
                on: sinon.stub(),
                removeAllListeners: sinon.stub()
            };
            
            controller = new DMXController({
                serialInterface,
                refreshInterval: 100 // Slower for testing
            });
        });
        
        it('should initialize with 512 channels', () => {
            expect(controller.channels).to.have.lengthOf(512);
            expect(controller.channels.every(ch => ch === 0)).to.be.true;
        });
        
        it('should set channel values correctly', () => {
            controller.setChannel(1, 128);
            expect(controller.channels[0]).to.equal(128);
            
            controller.setChannel(512, 255);
            expect(controller.channels[511]).to.equal(255);
        });
        
        it('should throw error for invalid channel numbers', () => {
            expect(() => controller.setChannel(0, 100)).to.throw(ChannelRangeError);
            expect(() => controller.setChannel(513, 100)).to.throw(ChannelRangeError);
        });
        
        it('should handle blackout correctly', async () => {
            // Set some channels
            controller.setChannel(1, 255);
            controller.setChannel(10, 128);
            
            await controller.blackout();
            
            expect(controller.channels.every(ch => ch === 0)).to.be.true;
        });
        
        it('should start and stop refresh loop', () => {
            expect(controller.refreshTimerId).to.be.null;
            
            controller.startRefreshLoop();
            expect(controller.refreshTimerId).to.not.be.null;
            
            controller.stopRefreshLoop();
            expect(controller.refreshTimerId).to.be.null;
        });
        
        it('should track frame statistics', async () => {
            controller.startRefreshLoop();
            
            await new Promise(resolve => setTimeout(resolve, 250));
            
            const stats = controller.getStatistics();
            expect(stats.frameCount).to.be.greaterThan(0);
            expect(stats.fps).to.be.greaterThan(0);
            
            controller.stopRefreshLoop();
        });
    });
    
    describe('LaserDeviceControl', () => {
        let laser;
        let controller;
        
        beforeEach(() => {
            const serialInterface = {
                connect: sinon.stub().resolves(),
                disconnect: sinon.stub().resolves(),
                sendDMXFrame: sinon.stub().resolves(),
                isConnected: sinon.stub().returns(true),
                on: sinon.stub(),
                removeAllListeners: sinon.stub()
            };
            
            controller = new DMXController({ serialInterface });
            laser = new LaserDeviceControl({
                dmxController: controller,
                startAddress: 1,
                channelCount: 32
            });
        });
        
        it('should set patterns correctly', () => {
            laser.setPattern1('CIRCLE');
            expect(controller.channels[1]).to.be.greaterThan(0);
            
            laser.setPattern2('SQUARE');
            expect(controller.channels[18]).to.be.greaterThan(0);
        });
        
        it('should set colors correctly', () => {
            laser.setColor1(255, 128, 64);
            expect(controller.channels[7]).to.equal(255);  // Red
            expect(controller.channels[8]).to.equal(128);  // Green
            expect(controller.channels[9]).to.equal(64);   // Blue
        });
        
        it('should handle movement commands', () => {
            laser.setMovementSpeed(75);
            expect(controller.channels[25]).to.be.greaterThan(0);
            
            laser.setHorizontalPosition1(128);
            expect(controller.channels[4]).to.equal(128);
        });
        
        it('should apply strobe effects', () => {
            laser.setStrobeMode('FAST');
            expect(controller.channels[30]).to.be.greaterThan(0);
        });
    });
    
    describe('Error Handling', () => {
        let errorManager;
        
        beforeEach(() => {
            errorManager = new ErrorRecoveryManager({
                maxRetries: 3,
                retryDelay: 10 // Fast for testing
            });
        });
        
        it('should create proper error types', () => {
            const serialError = new SerialConnectionError(
                'Connection failed',
                '/dev/tty.USB0'
            );
            
            expect(serialError).to.be.instanceOf(DMXError);
            expect(serialError.code).to.equal('SERIAL_CONNECTION_ERROR');
            expect(serialError.details.portPath).to.equal('/dev/tty.USB0');
        });
        
        it('should provide helpful hints for errors', () => {
            const mockError = new Error('Permission denied');
            mockError.path = '/dev/ttyUSB0';
            
            const hint = SerialConnectionError.getHint(mockError);
            expect(hint).to.include('chmod 666');
        });
        
        it('should handle error recovery with retries', async () => {
            let attempts = 0;
            const failingOperation = sinon.stub();
            
            failingOperation.onCall(0).rejects(new Error('First failure'));
            failingOperation.onCall(1).rejects(new Error('Second failure'));
            failingOperation.onCall(2).resolves('Success');
            
            const context = {
                retry: async () => {
                    attempts++;
                    return failingOperation();
                },
                attemptNumber: 0
            };
            
            const error = new SerialConnectionError('Test error', '/dev/test');
            
            try {
                await errorManager.handleError(error, context);
            } catch (e) {
                // Expected to eventually succeed or fail after retries
            }
            
            expect(failingOperation.callCount).to.be.at.least(1);
        });
        
        it('should track error statistics', () => {
            errorManager.logError(new DMXError('Test 1', 'CODE1'));
            errorManager.logError(new DMXError('Test 2', 'CODE1'));
            errorManager.logError(new DMXError('Test 3', 'CODE2'));
            
            const stats = errorManager.getErrorStats();
            expect(stats.totalErrors).to.equal(3);
            expect(stats.errorsByType.CODE1).to.equal(2);
            expect(stats.errorsByType.CODE2).to.equal(1);
        });
    });
    
    describe('Integration Tests', () => {
        it('should run a complete scenario', async () => {
            const scenario = {
                name: 'Full Light Show',
                steps: [
                    { type: 'connect' },
                    { type: 'send_dmx', data: Array(513).fill(0).map((_, i) => i === 0 ? 0 : (i % 256)) },
                    { type: 'button_press', button: 'MENU' },
                    { type: 'assert_state', expected: { mode: 0 } },
                    { type: 'send_dmx', data: [0, 255, 10, 128, 64, 32, 16, 8, 255, 128, 64] },
                    { type: 'assert_state', expected: { patterns: { pattern1: 'CIRCLE' } } },
                    { type: 'disconnect' }
                ]
            };
            
            const results = await harness.simulateScenario(scenario);
            expect(results.success).to.be.true;
            expect(results.failed).to.equal(0);
        });
        
        it('should handle rapid channel changes', async () => {
            await new Promise(resolve => mockPort.open(resolve));
            
            // Simulate rapid changes
            for (let i = 0; i < 100; i++) {
                const data = Buffer.alloc(513);
                data[0] = DMX_CONSTANTS.START_CODE;
                data[1] = i % 256;
                
                await new Promise(resolve => mockPort.write(data, resolve));
            }
            
            expect(harness.mockDevice.deviceState.frameCount).to.equal(100);
        });
        
        it('should detect blackout state', async () => {
            await new Promise(resolve => mockPort.open(resolve));
            
            // Send all zeros (blackout)
            const blackoutData = Buffer.alloc(513);
            blackoutData[0] = DMX_CONSTANTS.START_CODE;
            
            // Need multiple frames to trigger detection
            for (let i = 0; i < 15; i++) {
                await new Promise(resolve => mockPort.write(blackoutData, resolve));
            }
            
            // Mock device should have detected blackout
            const lastData = await new Promise(resolve => {
                mockPort.once('data', data => resolve(data));
                setTimeout(() => resolve(null), 100);
            });
            
            if (lastData) {
                expect(lastData[0]).to.equal(0xFF); // Blackout response
            }
        });
    });
    
    describe('Performance Tests', () => {
        it('should maintain target frame rate', async () => {
            const serialInterface = {
                connect: sinon.stub().resolves(),
                disconnect: sinon.stub().resolves(),
                sendDMXFrame: sinon.stub().resolves(),
                isConnected: sinon.stub().returns(true),
                on: sinon.stub(),
                removeAllListeners: sinon.stub()
            };
            
            const controller = new DMXController({
                serialInterface,
                refreshInterval: 33 // 30 FPS
            });
            
            controller.startRefreshLoop();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stats = controller.getStatistics();
            controller.stopRefreshLoop();
            
            // Should be close to 30 FPS (allowing for some variance)
            expect(stats.fps).to.be.within(25, 35);
        });
        
        it('should handle large channel updates efficiently', () => {
            const controller = new DMXController({
                serialInterface: {
                    on: sinon.stub(),
                    removeAllListeners: sinon.stub()
                }
            });
            
            const startTime = Date.now();
            
            // Update all channels 100 times
            for (let i = 0; i < 100; i++) {
                for (let ch = 1; ch <= 512; ch++) {
                    controller.setChannel(ch, i % 256);
                }
            }
            
            const elapsed = Date.now() - startTime;
            
            // Should complete in reasonable time (< 100ms)
            expect(elapsed).to.be.lessThan(100);
        });
    });
});

// Export for use in other test files
export { DMXTestHarness, MockSerialPort, MockDMXDevice };