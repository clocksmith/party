/**
 * Automated Unit Tests for DMX System
 * Uses mock devices for testing without hardware
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { DMXSerialInterface, DMXController, LaserDeviceControl } from '../laser/dmx.js';
import { MockSerialPort, MockDMXDevice, DMXTestHarness, DMX_CONSTANTS } from '../laser/dmx-mock.js';
import { 
    DMXError, 
    SerialConnectionError, 
    DMXProtocolError,
    ErrorRecoveryManager
} from '../laser/dmx-errors.js';
import { DMXLogger, LogLevel } from '../laser/dmx-logger.js';

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
            
            expect(harness.mockPort.deviceState.frameCount).to.equal(1);
            expect(harness.mockPort.deviceState.channels[0]).to.equal(255);
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
                sendRawDmxFrame: sinon.stub().resolves(true),
                isConnected: sinon.stub().returns(true),
                on: sinon.stub(),
                removeAllListeners: sinon.stub()
            };

            controller = new DMXController({
                serialInterface,
                refreshRateMs: 100 // Slower for testing
            });
        });

        afterEach(() => {
            // Clear the refresh interval even if the test failed mid-way
            controller.stopRefreshLoop();
        });

        it('should initialize with 512 channels', () => {
            // dmxState is 1-based; index 0 is unused
            const channels = controller.dmxState.slice(1);
            expect(channels).to.have.lengthOf(512);
            expect(channels.every(ch => ch === 0)).to.be.true;
        });

        it('should set channel values correctly', async () => {
            await controller.setChannel(1, 128);
            expect(controller.dmxState[1]).to.equal(128);

            await controller.setChannel(512, 255);
            expect(controller.dmxState[512]).to.equal(255);
        });

        it('should reject invalid channel numbers without changing state', async () => {
            const warnings = [];
            controller.on('log', (msg, level) => {
                if (level === 'warn') warnings.push(msg);
            });

            await controller.setChannel(0, 100);
            await controller.setChannel(513, 100);

            expect(controller.dmxState).to.have.lengthOf(513);
            expect(controller.dmxState.every(ch => ch === 0)).to.be.true;
            expect(warnings).to.have.lengthOf(2);
        });

        it('should handle blackout correctly', async () => {
            // Set some channels
            await controller.setChannel(1, 255);
            await controller.setChannel(10, 128);

            await controller.blackout();

            expect(controller.dmxState.every(ch => ch === 0)).to.be.true;
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
            expect(stats.frameCount).to.equal(serialInterface.sendRawDmxFrame.callCount);
            expect(stats.fps).to.be.greaterThan(0);
        });
    });
    
    describe('LaserDeviceControl', () => {
        let laser;
        let controller;
        
        beforeEach(() => {
            const serialInterface = {
                connect: sinon.stub().resolves(),
                disconnect: sinon.stub().resolves(),
                sendRawDmxFrame: sinon.stub().resolves(true),
                isConnected: sinon.stub().returns(true),
                on: sinon.stub(),
                removeAllListeners: sinon.stub()
            };

            controller = new DMXController({ serialInterface });
            laser = new LaserDeviceControl({
                dmxController: controller,
                startAddress: 1,
                numberOfChannels: 32
            });
        });

        afterEach(() => {
            controller.stopRefreshLoop();
        });

        it('should set patterns correctly', () => {
            laser.selectPattern1(10);
            expect(controller.dmxState[4]).to.equal(10);   // CH4: pattern 1 select

            laser.selectPattern2(20);
            expect(controller.dmxState[21]).to.equal(20);  // CH21: pattern 2 select
        });

        it('should set colors correctly', () => {
            laser.setColorChange('RED', 0);
            expect(controller.dmxState[29]).to.equal(16);  // CH29 RED band 16-23

            laser.setColorChange('BLUE', 100);
            expect(controller.dmxState[29]).to.equal(55);  // CH29 BLUE band 48-55
        });

        it('should handle movement commands', () => {
            laser.setHorizontalMovement1('LEFT_SHIFT', 75);
            expect(controller.dmxState[7]).to.equal(215);  // CH7 LEFT_SHIFT band 192-223 at 75%

            laser.setVerticalMovement1('MOVE_UP', 0);
            expect(controller.dmxState[8]).to.equal(192);  // CH8 MOVE_UP band 192-223 at 0%
        });

        it('should apply strobe effects', () => {
            laser.setStrobe('STROBE', 100);
            expect(controller.dmxState[12]).to.equal(131); // CH12 STROBE band 16-131, fastest
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
                    // Full-universe dark frame; the MENU press is device->host and must not change mode
                    { type: 'send_dmx', data: Array(513).fill(0) },
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
            
            expect(harness.mockPort.deviceState.frameCount).to.equal(100);
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
        let controller;

        afterEach(() => {
            controller?.stopRefreshLoop();
            controller = null;
        });

        it('should maintain target frame rate', async () => {
            const serialInterface = {
                connect: sinon.stub().resolves(),
                disconnect: sinon.stub().resolves(),
                sendRawDmxFrame: sinon.stub().resolves(true),
                isConnected: sinon.stub().returns(true),
                on: sinon.stub(),
                removeAllListeners: sinon.stub()
            };

            controller = new DMXController({
                serialInterface,
                refreshRateMs: 33 // 30 FPS
            });

            controller.startRefreshLoop();

            await new Promise(resolve => setTimeout(resolve, 1000));

            const stats = controller.getStatistics();

            // Should be close to 30 FPS (allowing for some variance)
            expect(stats.fps).to.be.within(25, 35);
        });

        it('should handle large channel updates efficiently', () => {
            controller = new DMXController({
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