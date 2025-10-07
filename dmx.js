import { SerialPort } from 'serialport';
import { Buffer } from 'buffer';
import { StringDecoder } from 'string_decoder';
import { EventEmitter } from 'events';
import fs from 'fs/promises'; // For file logging

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//\\//\\// Lowest Level API - Serial Communication \\//\\//\\

// Lowest level DMX timing & protocol constants.
const DMX_BAUD_RATE = 250000;
const DMX_DATA_BITS = 8;
const DMX_STOP_BITS = 2;
const DMX_PARITY = 'none';
const DMX_START_CODE = 0x00;
const DMX_MAX_CHANNELS = 512;

const BREAK_BAUD_RATE = 9600;
const BREAK_SETUP_DELAY_MS = 2;
const POST_BREAK_DELAY_MS = 2;
const MAB_DELAY_MS = 2;

/**
 * @class DMXSerialInterface
 * @extends EventEmitter
 * @classdesc Handles the low-level serial communication for the DMX512 protocol,
 * including connection management, baud rate switching for Break/MAB, and frame transmission.
 * Emits 'data', 'connect', 'disconnect', 'error', and 'log' events.
 */
class DMXSerialInterface extends EventEmitter {
    /**
     * @param {object} options
     * @param {string} options.portPath
     * @param {number} [options.dmxBaudRate=250000]
     * @param {number} [options.breakBaudRate=9600]
     * @param {number} [options.breakSetupDelayMs=2]
     * @param {number} [options.postBreakDelayMs=2]
     * @param {number} [options.mabDelayMs=2]
     */
    constructor(options) {
        super();
        if (!options || !options.portPath) {
            throw new Error("DMXSerialInterface Error: portPath option is required.");
        }
        this.portPath = options.portPath;
        this.dmxBaudRate = options.dmxBaudRate ?? DMX_BAUD_RATE;
        this.breakBaudRate = options.breakBaudRate ?? BREAK_BAUD_RATE;
        this.breakSetupDelayMs = options.breakSetupDelayMs ?? BREAK_SETUP_DELAY_MS;
        this.postBreakDelayMs = options.postBreakDelayMs ?? POST_BREAK_DELAY_MS;
        this.mabDelayMs = options.mabDelayMs ?? MAB_DELAY_MS;

        this.port = null;
        this._isConnected = false;
        this._isSending = false;
        this._boundDataHandler = (data) => this.emit('data', data);
        this._boundErrorHandler = (err) => {
            this._log(`Serial Port Error: ${err.message}`, 'error');
            this._isConnected = false;
            this.emit('error', err);
            this._cleanupPort();
        };
        this._boundCloseHandler = () => {
            this._log(`Serial Port closed.`, 'info');
            const previouslyConnected = this._isConnected;
            this._isConnected = false;
            this._cleanupPort();
            if (previouslyConnected) {
                this.emit('disconnect');
            }
        };
    }

    /** @private */
    _log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMsg = `${timestamp} [DMXSerialInterface] ${level.toUpperCase()}: ${message}`;
        this.emit('log', logMsg, level);
        console[level === 'error' ? 'error' : 'log'](logMsg);
    }

    /** Lists available serial ports. */
    static async listPorts() {
        try {
            const ports = await SerialPort.list();
            return ports;
        } catch (err) {
            console.error("[DMXSerialInterface] Error listing ports:", err.message);
            throw new Error(`Failed listing serial ports. ${err.message}`);
        }
    }

    /** @returns {boolean} Current connection state. */
    isConnected() {
        return this._isConnected && this.port && this.port.isOpen;
    }

    /** Connects to the serial port. */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.isConnected()) {
                this._log('Already connected.', 'warn');
                return resolve();
            }
            if (this.port) {
                 this._log('Port instance exists but not connected, attempting to reuse/reopen...', 'warn');
            }

            this._log(`Attempting connection to ${this.portPath}...`, 'info');

            try {
                this.port = this.port || new SerialPort({
                    path: this.portPath,
                    baudRate: this.dmxBaudRate,
                    dataBits: DMX_DATA_BITS,
                    stopBits: DMX_STOP_BITS,
                    parity: DMX_PARITY,
                    autoOpen: false,
                });

                // Ensure listeners are attached (or re-attached if reusing)
                this.port.removeListener('error', this._boundErrorHandler);
                this.port.removeListener('close', this._boundCloseHandler);
                this.port.removeListener('data', this._boundDataHandler);
                this.port.on('error', this._boundErrorHandler);
                this.port.on('close', this._boundCloseHandler);
                this.port.on('data', this._boundDataHandler);

            } catch (instantiationError) {
                 this._log(`Failed to instantiate SerialPort: ${instantiationError.message}`, 'error');
                 this.port = null;
                 return reject(new Error(`Failed to instantiate SerialPort. ${instantiationError.message}`));
            }

            this.port.open((err) => {
                if (err) {
                    this._log(`Failed to open port ${this.portPath}: ${err.message}`, 'error');
                    this._cleanupPort(false);
                    let hint = '';
                    if (err.message.includes('permission denied')) hint = ' Check port permissions.';
                    else if (err.message.includes('cannot find path') || err.message.includes('no such file')) hint = ' Verify path/device connection.';
                    else if (err.message.includes('port is already open')) hint = ' Another app might be using the port.';
                    return reject(new Error(`Failed to open port ${this.portPath}.${hint} (${err.message})`));
                }
                this._log(`Serial Port opened successfully.`, 'info');
                this._isConnected = true;
                this.emit('connect');
                resolve();
            });
        });
    }

    /** Disconnects from the serial port. */
    disconnect() {
        return new Promise((resolve) => {
            if (!this.port) {
                this._log('Already disconnected or never connected.', 'info');
                return resolve();
            }
            this._log('Disconnecting...', 'info');
            const wasConnected = this._isConnected;
            this._isConnected = false;

            const portInstance = this.port;
            portInstance.removeListener('error', this._boundErrorHandler);
            portInstance.removeListener('close', this._boundCloseHandler);
            portInstance.removeListener('data', this._boundDataHandler);
             this.port = null;

            if (portInstance.isOpen) {
                portInstance.close((err) => {
                    if (err) {
                        this._log(`Error closing port: ${err.message}`, 'error');
                    } else {
                        this._log(`Port closed gracefully.`, 'info');
                    }
                    if(wasConnected) this.emit('disconnect');
                    resolve();
                });
            } else {
                 this._log('Port was already closed.', 'info');
                 resolve();
            }
        });
    }

    /** @private Safely cleans up the port instance and listeners. */
    _cleanupPort(emitDisconnect = true) {
        const wasConnected = this._isConnected;
         this._isConnected = false;
         const portInstance = this.port;
         this.port = null;
         if (portInstance) {
             portInstance.removeListener('error', this._boundErrorHandler);
             portInstance.removeListener('close', this._boundCloseHandler);
             portInstance.removeListener('data', this._boundDataHandler);
             if (portInstance.isOpen) {
                 portInstance.close(err => {
                      if(err) this._log(`Error during cleanup close: ${err.message}`, 'warn');
                 });
             }
         }
         if (wasConnected && emitDisconnect) {
             this.emit('disconnect');
         }
    }

    /**
     * Sends a raw DMX frame (Break, MAB, Start Code + Data).
     * @param {Buffer} dmxDataBuffer - Buffer containing ONLY the channel data (1 to 512 bytes).
     */
    async sendRawDmxFrame(dmxDataBuffer) {
        if (!this.isConnected()) {
             this._log('Cannot send frame, port not connected.', 'warn');
             return;
        }
        if (this._isSending) {
            this._log('Skipping frame send, previous frame busy.', 'warn');
            return;
        }
        this._isSending = true;

        try {
            // Stage 1: Break
            await this._setBaudRate(this.breakBaudRate);
            await sleep(this.breakSetupDelayMs);
            await this._writeAndDrain(Buffer.from([0x00]));
            await sleep(this.postBreakDelayMs);

            // Stage 2: MAB
            await this._setBaudRate(this.dmxBaudRate);
            await sleep(this.mabDelayMs);

            // Stage 3: Data (Start Code + Payload)
            const frameBuffer = Buffer.concat([Buffer.from([DMX_START_CODE]), dmxDataBuffer]);
            await this._writeAndDrain(frameBuffer);

        } catch (error) {
            this._log(`Failed sending DMX frame: ${error.message}`, 'error');
            if (error.message.includes("Port is not open") || error.message.includes("closed")) {
                this._log("Port closed unexpectedly during send.", 'error');
                this._cleanupPort();
            }
            this.emit('error', new Error(`DMX Frame Send Failure: ${error.message}`));
        } finally {
            this._isSending = false;
        }
    }

    /** @private Helper to update baud rate. */
    _setBaudRate(baudRate) {
        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen) return reject(new Error("Port is not open for baud rate change"));
            this.port.update({ baudRate }, (err) => {
                if (err) return reject(new Error(`Failed to set baud rate to ${baudRate}: ${err.message}`));
                resolve();
            });
        });
    }

    /** @private Helper to write data and wait for drain. */
    _writeAndDrain(data) {
        return new Promise((resolve, reject) => {
             if (!this.port || !this.port.isOpen) return reject(new Error("Port is not open for writing"));
            this.port.write(data, (wErr) => {
                if (wErr) return reject(new Error(`Write failed: ${wErr.message}`));
                this.port.drain((dErr) => {
                    if (dErr) return reject(new Error(`Drain failed: ${dErr.message}`));
                    resolve();
                });
            });
        });
    }
}

//\\//\\// Mid-Level API - DMX Channel Management & IO \\//\\//\\

// Mid level constants.
const REFRESH_INTERVAL_MS = 33;

/**
 * @typedef {object} PatternIdentificationConfig
 * @property {string} hexString - The exact space-separated hex string (e.g., '0A' or '02 FF 03').
 * @property {string} name - The user-friendly name for this pattern (e.g., '[Button: MENU]').
 */

/**
 * @class DMXController
 * @extends EventEmitter
 * @classdesc Manages the DMX channel state, handles the refresh loop,
 * interacts with the DMXSerialInterface, parses incoming data, and identifies basic patterns.
 * Emits 'message', 'pattern', 'connect', 'disconnect', 'error', and 'log' events.
 */
class DMXController extends EventEmitter {
     /**
     * @param {object} options
     * @param {DMXSerialInterface} options.serialInterface - An instance of DMXSerialInterface.
     * @param {number} [options.refreshRateMs=33] - Target DMX refresh rate (~30Hz).
     * @param {number} [options.universeSize=512] - Max channel to manage.
     * @param {string} [options.logFilePath='./dmx_received_log.txt'] - Path for logging received data.
     * @param {Object.<string, string>} [options.patternIdentification] - Key-value pairs for pattern matching (Hex -> Name). Example: { '0A': '[Button: MENU]' }
     */
    constructor(options) {
        super();
        if (!options || !options.serialInterface) {
            throw new Error("DMXController Error: serialInterface option is required.");
        }
        this.serialInterface = options.serialInterface;
        this.refreshRateMs = options.refreshRateMs ?? REFRESH_INTERVAL_MS; // Use global if defined, else default
        this.universeSize = Math.min(options.universeSize ?? DMX_MAX_CHANNELS, DMX_MAX_CHANNELS);
        this.logFilePath = options.logFilePath ?? './dmx_received_log.txt';
        this.patternIdentification = options.patternIdentification ?? {}; // Use provided patterns

        this.dmxState = new Array(this.universeSize + 1).fill(0); // DMX is 1-based index
        this.refreshTimerId = null;
        this.isLoggingData = false;
        this.stringDecoder = new StringDecoder('utf8');

        // Forward events from serial interface
        this.serialInterface.on('connect', () => {
             this._log('Serial interface connected.', 'info');
             this.emit('connect');
             this.startRefreshLoop();
        });
        this.serialInterface.on('disconnect', () => {
            this._log('Serial interface disconnected.', 'info');
            this.stopRefreshLoop();
            this.isLoggingData = false;
            this.emit('disconnect');
        });
        this.serialInterface.on('error', (err) => {
            this._log(`Serial interface error: ${err.message}`, 'error');
            this.stopRefreshLoop();
             this.isLoggingData = false;
            this.emit('error', err);
        });
        this.serialInterface.on('data', (data) => this._handleDataReceived(data));
        this.serialInterface.on('log', (msg, level) => this.emit('log', msg, level)); // Forward logs
    }

    /** @private */
    _log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMsg = `${timestamp} [DMXController] ${level.toUpperCase()}: ${message}`;
        this.emit('log', logMsg, level);
        console[level === 'error' ? 'error' : 'log'](logMsg);
    }

    /** Connects the underlying serial interface. */
    async connect() {
        try {
             await this.serialInterface.connect();
        } catch(error){
            this._log(`Connection failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /** Disconnects the underlying serial interface and stops refresh. */
    async disconnect(sendBlackout = true) {
        this.stopRefreshLoop();
        if (sendBlackout && this.serialInterface.isConnected()) {
            this._log('Sending final blackout frame...', 'info');
            try {
                // Send one last frame with all zeros for the managed universe
                const blackoutData = Buffer.alloc(this.universeSize);
                await this.serialInterface.sendRawDmxFrame(blackoutData);
                await sleep(this.refreshRateMs);
            } catch (blackoutError) {
                this._log(`Error sending blackout frame: ${blackoutError.message}`, 'warn');
            }
        }
        await this.serialInterface.disconnect();
    }

    /** @returns {boolean} Current connection state. */
    isConnected() {
        return this.serialInterface.isConnected();
    }

    /** Starts the DMX refresh loop. */
    startRefreshLoop() {
        if (this.refreshTimerId) {
            this._log('Refresh loop already running.', 'warn');
            return;
        }
        if (!this.isConnected()){
             this._log('Cannot start refresh loop, not connected.', 'warn');
             return;
        }
        this._log(`Starting DMX refresh loop (Interval: ${this.refreshRateMs}ms)`, 'info');
        this.refreshTimerId = setInterval(async () => {
            if (this.isConnected()) {
                const dataToSend = Buffer.from(this.dmxState.slice(1, this.universeSize + 1));
                try {
                    await this.serialInterface.sendRawDmxFrame(dataToSend);
                } catch (sendError){
                    this._log(`Error during scheduled frame send: ${sendError.message}`, 'error');
                }
            } else {
                this._log('Detected disconnect during refresh loop, stopping.', 'warn');
                this.stopRefreshLoop();
            }
        }, this.refreshRateMs);
    }

    /** Stops the DMX refresh loop. */
    stopRefreshLoop() {
        if (this.refreshTimerId) {
            this._log("Stopping DMX refresh loop.", 'info');
            clearInterval(this.refreshTimerId);
            this.refreshTimerId = null;
        }
    }

    /**
     * Updates a single DMX channel value (1-based index).
     * @param {number} channel - DMX channel number (1 to universeSize).
     * @param {number} value - DMX value (0-255).
     */
    updateChannel(channel, value) {
        if (channel >= 1 && channel <= this.universeSize) {
            const clampedValue = Math.max(0, Math.min(255, Math.round(value)));
            if (this.dmxState[channel] !== clampedValue) {
                this.dmxState[channel] = clampedValue;
            }
        } else {
            this._log(`Invalid channel ${channel}. Must be 1-${this.universeSize}.`, 'warn');
        }
    }

    /**
     * Updates multiple DMX channels at once.
     * @param {object} updates - Object { channel: value, ... } (1-based channels).
     */
    updateChannels(updates) {
        for (const channelStr in updates) {
            if (Object.prototype.hasOwnProperty.call(updates, channelStr)) {
                const channel = parseInt(channelStr, 10);
                if (!isNaN(channel)) {
                    this.updateChannel(channel, updates[channelStr]);
                } else {
                     this._log(`Invalid channel key '${channelStr}' in updateChannels.`, 'warn');
                }
            }
        }
    }

    /** Resets all managed DMX channels (1 to universeSize) to 0. */
    resetChannels() {
        let changed = false;
        for (let ch = 1; ch <= this.universeSize; ch++) {
            if (this.dmxState[ch] !== 0) {
                 this.dmxState[ch] = 0;
                 changed = true;
            }
        }
        if(changed) this._log(`Reset channels 1-${this.universeSize} to 0.`, 'info');
    }
    
    /**
     * Promise-aware wrapper for setChannel (maps to updateChannel)
     * @param {number} channel - DMX channel (1-based)
     * @param {number} value - DMX value (0-255)
     * @returns {Promise<void>}
     */
    async setChannel(channel, value) {
        return new Promise((resolve) => {
            this.updateChannel(channel, value);
            resolve();
        });
    }
    
    /**
     * Promise-aware wrapper for setChannels (maps to updateChannels)
     * @param {object} updates - Object { channel: value, ... } (1-based channels)
     * @returns {Promise<void>}
     */
    async setChannels(updates) {
        return new Promise((resolve) => {
            this.updateChannels(updates);
            resolve();
        });
    }
    
    /**
     * Batch update channels with priority support
     * @param {Array} channelUpdates - Array of {channel, value, priority}
     * @returns {Promise<void>}
     */
    async batchUpdateChannels(channelUpdates) {
        return new Promise((resolve) => {
            const prioritizedUpdates = channelUpdates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            
            for (const update of prioritizedUpdates) {
                this.updateChannel(update.channel, update.value);
            }
            
            resolve();
        });
    }
    
    /**
     * Update channel with callback
     * @param {number} channel - DMX channel (1-based)
     * @param {number} value - DMX value (0-255)
     * @param {Function} callback - Callback function
     */
    updateChannelWithCallback(channel, value, callback) {
        try {
            this.updateChannel(channel, value);
            if (callback) callback(null);
        } catch (error) {
            if (callback) callback(error);
        }
    }

     /**
     * Temporarily sets a channel to a value, then resets it to 0.
     * Useful for emulating momentary button presses on devices.
     * @param {number} channel - The DMX channel (1-based).
     * @param {number} value - The DMX value (0-255) for the "pressed" state.
     * @param {number} durationMs - How long to hold the value before resetting to 0.
     */
     async simulateButtonPress(channel, value, durationMs) {
        if (channel < 1 || channel > this.universeSize) {
            this._log(`Invalid channel ${channel} for button press.`, 'error');
            return;
        }
        const originalValue = this.dmxState[channel]; // Store original value? Or assume it should be 0? Let's assume 0 after.
        this._log(`Simulating press: CH ${channel} = ${value} for ${durationMs}ms`, 'debug');
        this.updateChannel(channel, value);

        // Need to ensure this value gets sent at least once.
        await sleep(durationMs);
        this.updateChannel(channel, 0);
        this._log(`Simulating release: CH ${channel} = 0`, 'debug');
        await sleep(200);
    }

    /** Starts logging incoming serial data. */
    startLogging() {
        if (!this.isConnected()) {
            this._log("Cannot start logging, port not connected.", 'warn');
            return;
        }
        if (this.isLoggingData) {
            this._log("Data logging is already active.", 'info');
            return;
        }
        this._log("Starting incoming data logging...", 'info');
        this.isLoggingData = true;
    }

    /** Stops logging incoming serial data. */
    stopLogging() {
        if (!this.isLoggingData) {
            this._log("Data logging is already inactive.", 'info');
            return;
        }
        this._log("Stopping incoming data logging.", 'info');
        this.isLoggingData = false;
    }

    /** @private Handles raw data from serial port, parses, logs, identifies patterns. */
    async _handleDataReceived(data) {
        if (!this.isLoggingData || !data || data.length === 0) {
            return;
        }

        const timestamp = new Date().toISOString();
        const hexString = data.toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') || '';
        let decodedString = '';
        try {
            decodedString = this.stringDecoder.write(data);
        } catch (decodeError) {
            decodedString = `[Decode Error: ${decodeError.message}]`;
        }
        const cleanedDecodedString = decodedString.replace(/[\x00-\x1F\x7F-\x9F]/g, '.');
        const loggableString = cleanedDecodedString.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

        // Pattern Identification
        const identifiedPatternName = this.patternIdentification[hexString];
        const patternLabel = identifiedPatternName ? identifiedPatternName : "[Unknown Data]";

        const logMsg = `${timestamp} [DMXController] RX <-- ${patternLabel} | HEX: ${hexString} | STR: "${loggableString}"`;
        this.emit('log', logMsg, 'info');

        // Emit specific events
        this.emit('message', { timestamp, hex: hexString, string: loggableString, raw: data });
        if (identifiedPatternName) {
            this.emit('pattern', { timestamp, name: identifiedPatternName, hex: hexString });
        }

        // Append to file
        try {
            await fs.appendFile(this.logFilePath, logMsg + '\n');
        } catch (fileError) {
            this._log(`Failed to write to log file "${this.logFilePath}": ${fileError.message}`, 'error');
        }
    }
}


//\\//\\// High-Level API - Device-Specific Control \\//\\//\\

// Device specific constants - DEPRECATED
// These hardcoded values are kept for backward compatibility with LaserDeviceControl
// New code should use device profiles instead (see device-profiles/ directory)
const BUTTON_CHANNEL_MENU = 512;
const BUTTON_VALUE_MENU = 10;
const BUTTON_CHANNEL_ENTER = 512;
const BUTTON_VALUE_ENTER = 20;
const BUTTON_CHANNEL_UP = 512;
const BUTTON_VALUE_UP = 30;
const BUTTON_CHANNEL_DOWN = 512;
const BUTTON_VALUE_DOWN = 40;
const BUTTON_PRESS_DURATION_MS = 150;

const LAMP_MODE = { OFF: 0, DMX_MANUAL_MIN: 1, DMX_MANUAL_MAX: 99, DMX_DYNAMIC_SOUND_MIN: 100, DMX_DYNAMIC_SOUND_MAX: 199, TUNE_PROGRAM_LIBRARY_MIN: 200, TUNE_PROGRAM_LIBRARY_MAX: 219, SOUND_CONTROL_PROGRAM_LIBRARY_MIN: 220, SOUND_CONTROL_PROGRAM_LIBRARY_MAX: 249 };
const PATTERN_SIZE_MODE = { PARTS_BLANK_MIN: 0, PARTS_BLANK_MAX: 49, PATTERN_RETURNS_MIN: 50, PATTERN_RETURNS_MAX: 99, PATTERN_FOLDS_MIN: 100, PATTERN_FOLDS_MAX: 149, CROSSING_MIN: 150, CROSSING_MAX: 199, BLANKING_MIN: 200, BLANKING_MAX: 255 };
const GALLERY = { BEAM: 0, ANIMATION: 240 };
const ZOOM_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_ZOOM_IN_MIN: 128, DYNAMIC_ZOOM_IN_MAX: 159, DYNAMIC_ZOOM_OUT_MIN: 160, DYNAMIC_ZOOM_OUT_MAX: 191, DYNAMIC_FLIP_ZOOMING_MIN: 192, DYNAMIC_FLIP_ZOOMING_MAX: 255 };
const ROTATION_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_INVERSION_A_MIN: 128, DYNAMIC_INVERSION_A_MAX: 192, DYNAMIC_INVERSION_B_MIN: 193, DYNAMIC_INVERSION_B_MAX: 255 };
const HORIZONTAL_MOVEMENT_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_PUSH_UP_WAVE_MIN: 128, DYNAMIC_PUSH_UP_WAVE_MAX: 159, DYNAMIC_PUSH_DOWN_WAVE_MIN: 160, DYNAMIC_PUSH_DOWN_WAVE_MAX: 191, DYNAMIC_LEFT_SHIFT_MIN: 192, DYNAMIC_LEFT_SHIFT_MAX: 223, DYNAMIC_RIGHT_SHIFT_MIN: 224, DYNAMIC_RIGHT_SHIFT_MAX: 255 };
const VERTICAL_MOVEMENT_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_RIGHT_PUSH_WAVE_MIN: 128, DYNAMIC_RIGHT_PUSH_WAVE_MAX: 159, DYNAMIC_LEFT_PUSH_WAVE_MIN: 160, DYNAMIC_LEFT_PUSH_WAVE_MAX: 191, DYNAMIC_MOVE_UP_MIN: 192, DYNAMIC_MOVE_UP_MAX: 223, DYNAMIC_MOVE_DOWN_MIN: 224, DYNAMIC_MOVE_DOWN_MAX: 255 };
const HORIZONTAL_ZOOMING1_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_PUSH_UP_DISTORTION_MIN: 128, DYNAMIC_PUSH_UP_DISTORTION_MAX: 159, DYNAMIC_PUSH_DOWN_DISTORTION_MIN: 160, DYNAMIC_PUSH_DOWN_DISTORTION_MAX: 191, DYNAMIC_ZOOMING_MIN: 192, DYNAMIC_ZOOMING_MAX: 223, DYNAMIC_FLIP_ZOOMING_MIN: 224, DYNAMIC_FLIP_ZOOMING_MAX: 255 };
const VERTICAL_ZOOMING1_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_RIGHT_PUSH_DISTORTION_MIN: 128, DYNAMIC_RIGHT_PUSH_DISTORTION_MAX: 159, DYNAMIC_LEFT_PUSH_DISTORTION_MIN: 160, DYNAMIC_LEFT_PUSH_DISTORTION_MAX: 191, DYNAMIC_ZOOM_MIN: 192, DYNAMIC_ZOOM_MAX: 223, DYNAMIC_FLIP_ZOOMING_MIN: 224, DYNAMIC_FLIP_ZOOMING_MAX: 255 };
const STROBE_MODE = { OFF_MIN: 0, OFF_MAX: 15, STROBE_SLOW_FAST_MIN: 16, STROBE_SLOW_FAST_MAX: 131, RANDOM_FLASH_SLOW_MIN: 132, RANDOM_FLASH_SLOW_MAX: 147, SOUND_STROBE_SLOW_FAST_MIN: 148, SOUND_STROBE_SLOW_FAST_MAX: 199, SOUND_RANDOM_FLASH_MIN: 200, SOUND_RANDOM_FLASH_MAX: 215, ON_MIN: 216, ON_MAX: 255 };
const NODE_HIGHLIGHTING_MODE = { NODES_BRIGHTER_MIN: 0, NODES_BRIGHTER_MAX: 63, BROKEN_LINES_MIN: 64, BROKEN_LINES_MAX: 127, SCANNING_LINE_MIN: 128, SCANNING_LINE_MAX: 255, RESERVED_MIN: 160, RESERVED_MAX: 255 };
const GRADUAL_DRAW_MODE = { FORWARD_MANUAL_EXPANSION_MIN: 0, FORWARD_MANUAL_EXPANSION_MAX: 63, REVERSE_MANUAL_EXPANSION_MIN: 64, REVERSE_MANUAL_EXPANSION_MAX: 127, DYNAMIC_A_MIN: 128, DYNAMIC_A_MAX: 159, DYNAMIC_B_MIN: 160, DYNAMIC_B_MAX: 191, DYNAMIC_C_MIN: 192, DYNAMIC_C_MAX: 223, DYNAMIC_D_MIN: 224, DYNAMIC_D_MAX: 255 };
const HORIZONTAL_FLIP_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_PUSH_UP_DISTORTION_MIN: 128, DYNAMIC_PUSH_UP_DISTORTION_MAX: 159, DYNAMIC_PUSH_DOWN_DISTORTION_MIN: 160, DYNAMIC_PUSH_DOWN_DISTORTION_MAX: 191, DYNAMIC_FLIP_MIN: 192, DYNAMIC_FLIP_MAX: 223 };
const VERTICAL_FLIP_MODE = { STATIC_MIN: 0, STATIC_MAX: 127, DYNAMIC_RIGHT_PUSH_DISTORTION_MIN: 128, DYNAMIC_RIGHT_PUSH_DISTORTION_MAX: 159, DYNAMIC_LEFT_PUSH_DISTORTION_MIN: 160, DYNAMIC_LEFT_PUSH_DISTORTION_MAX: 191, DYNAMIC_FLIP_MIN: 192, DYNAMIC_FLIP_MAX: 255 };
const COLOR_CHANGE_MODE = { PRIMARY_MIN: 0, PRIMARY_MAX: 7, WHITE_MIN: 8, WHITE_MAX: 15, RED_MIN: 16, RED_MAX: 23, YELLOW_MIN: 24, YELLOW_MAX: 31, GREEN_MIN: 32, GREEN_MAX: 39, INDIGO_MIN: 40, INDIGO_MAX: 47, BLUE_MIN: 48, BLUE_MAX: 55, PURPLE_MIN: 56, PURPLE_MAX: 63, RGB_CYCLE_MIN: 64, RGB_CYCLE_MAX: 95, YIP_CYCLE_MIN: 96, YIP_CYCLE_MAX: 127, FULL_COLOR_CYCLE_MIN: 128, FULL_COLOR_CYCLE_MAX: 159, COLORFUL_CHANGE_MIN: 160, COLORFUL_CHANGE_MAX: 191, FORWARD_COLOR_MOVEMENT_MIN: 192, FORWARD_COLOR_MOVEMENT_MAX: 223, REVERSE_COLOR_MOVEMENT_MIN: 224, REVERSE_COLOR_MOVEMENT_MAX: 255 };

/** Clamps value between min and max. */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
}

/** Maps value from one range to another, clamped. */
function mapToRange(value, inMin, inMax, outMin, outMax) {
    if (inMin === inMax) return clamp(outMin, outMin, outMax);
    const result = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    return clamp(result, outMin, outMax);
}

/**
 * @class LaserDeviceControl
 * @extends EventEmitter
 * @deprecated Since v2.0.0 - Use ProfileBasedDeviceControl from dmx-profile-based-control.js instead.
 * This class uses hardcoded channel mappings and will be removed in v3.0.0.
 * 
 * @classdesc Provides a high-level API for controlling a specific laser device
 * by translating commands into DMX channel updates via a DMXController.
 * Assumes a specific DMX channel mapping (start address, number of channels, function definitions).
 * Emits 'connect', 'disconnect', 'error', and 'log' events forwarded from the controller.
 */
class LaserDeviceControl extends EventEmitter {
     /**
     * @param {object} options
     * @param {DMXController} options.dmxController - An instance of DMXController.
     * @param {number} [options.startAddress=1] - The 1-based DMX start address of the laser device.
     * @param {number} [options.numberOfChannels=32] - The number of channels this device uses.
     * @param {object} [options.buttonConfig] - Optional overrides for button emulation channels/values.
     * @param {number} [options.buttonConfig.menuChannel]
     * @param {number} [options.buttonConfig.menuValue]
     * @param {number} [options.buttonConfig.enterChannel]
     * @param {number} [options.buttonConfig.enterValue]
     * @param {number} [options.buttonConfig.upChannel]
     * @param {number} [options.buttonConfig.upValue]
     * @param {number} [options.buttonConfig.downChannel]
     * @param {number} [options.buttonConfig.downValue]
     * @param {number} [options.buttonConfig.pressDurationMs]
     */
    constructor(options) {
        super();
        
        // Deprecation warning
        console.warn('\x1b[33m%s\x1b[0m', 
            '⚠️  DEPRECATION WARNING: LaserDeviceControl is deprecated since v2.0.0.\n' +
            '   Please use ProfileBasedDeviceControl from dmx-profile-based-control.js instead.\n' +
            '   This class will be removed in v3.0.0.'
        );
        
        if (!options || !options.dmxController) {
            throw new Error("LaserDeviceControl Error: dmxController option is required.");
        }
        this.dmxController = options.dmxController;
        this.startAddress = options.startAddress ?? 1;
        this.numberOfChannels = options.numberOfChannels ?? 32;

        const maxAddr = this.startAddress + this.numberOfChannels - 1;
        if (this.startAddress < 1 || maxAddr > DMX_MAX_CHANNELS) {
             throw new Error(`LaserDeviceControl Error: Invalid DMX address range ${this.startAddress}-${maxAddr}.`);
        }

        const btnCfg = options.buttonConfig ?? {};
        this.button = {
            menu: { ch: btnCfg.menuChannel ?? BUTTON_CHANNEL_MENU, val: btnCfg.menuValue ?? BUTTON_VALUE_MENU },
            enter: { ch: btnCfg.enterChannel ?? BUTTON_CHANNEL_ENTER, val: btnCfg.enterValue ?? BUTTON_VALUE_ENTER },
            up: { ch: btnCfg.upChannel ?? BUTTON_CHANNEL_UP, val: btnCfg.upValue ?? BUTTON_VALUE_UP },
            down: { ch: btnCfg.downChannel ?? BUTTON_CHANNEL_DOWN, val: btnCfg.downValue ?? BUTTON_VALUE_DOWN },
            duration: btnCfg.pressDurationMs ?? BUTTON_PRESS_DURATION_MS
        };

        // Forward essential events from the controller
        this.dmxController.on('connect', () => this.emit('connect'));
        this.dmxController.on('disconnect', () => this.emit('disconnect'));
        this.dmxController.on('error', (err) => this.emit('error', err));
        this.dmxController.on('log', (msg, level) => this.emit('log', msg, level)); // Forward logs
        // TODO: Consider fwding 'message' or 'pattern' if needed.
    }

    /** @private */
    _log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMsg = `${timestamp} [LaserDeviceControl] ${level.toUpperCase()}: ${message}`;
        this.emit('log', logMsg, level); // Emit primarily for external capture via demo.js
        console[level === 'error' ? 'error' : 'log'](logMsg);
    }

    /** @private Gets the absolute DMX channel number. */
    _resolveChannel(relativeChannel) {
        return this.startAddress + relativeChannel - 1;
    }

    /** Connects the underlying DMX controller. */
    async connect() {
        this._log(`Connecting device (Start Addr: ${this.startAddress}, Channels: ${this.numberOfChannels})`, 'info');
        await this.dmxController.connect();
    }

    /** Disconnects the underlying DMX controller. */
    async disconnect(sendBlackout = true) {
         this._log(`Disconnecting device (Start Addr: ${this.startAddress})`, 'info');
         await this.dmxController.disconnect(sendBlackout);
    }

    /** @returns {boolean} Current connection state. */
    isConnected() {
        return this.dmxController.isConnected();
    }

     /** Resets all channels assigned to this device profile to 0. */
     resetAllChannels() {
        const updates = {};
        const endAddress = this.startAddress + this.numberOfChannels;
        for (let absCh = this.startAddress; absCh < endAddress; absCh++) {
             updates[absCh] = 0;
        }
        this.dmxController.updateChannels(updates);
        this._log(`Sent reset (0) to device channels ${this.startAddress}-${endAddress - 1}`, 'info');
    }

    /** Updates a single relative channel for this device. */
    updateDeviceChannel(relativeChannel, value) {
        if (relativeChannel < 1 || relativeChannel > this.numberOfChannels) {
            this._log(`Invalid relative channel ${relativeChannel}. Must be 1-${this.numberOfChannels}`, 'warn');
            return;
        }
        const absoluteChannel = this._resolveChannel(relativeChannel);
        this.dmxController.updateChannel(absoluteChannel, value);
    }

    /** Updates multiple relative channels for this device. */
    updateDeviceChannels(relativeUpdates) {
         const absoluteUpdates = {};
         for (const relChStr in relativeUpdates) {
             const relCh = parseInt(relChStr, 10);
             if (isNaN(relCh) || relCh < 1 || relCh > this.numberOfChannels) {
                  this._log(`Invalid relative channel key '${relChStr}' in updateDeviceChannels.`, 'warn');
                 continue;
             }
             absoluteUpdates[this._resolveChannel(relCh)] = relativeUpdates[relChStr];
         }
         if (Object.keys(absoluteUpdates).length > 0) {
            this.dmxController.updateChannels(absoluteUpdates);
         }
    }

    /** Sets lamp mode (Channel 1). */
    setLampMode(mode, intensity = 50, options = {}) {
        const ch = 1;
        let value = LAMP_MODE.OFF;
        const updates = {};
        const clampedIntensity = clamp(intensity, 0, 100);

        switch (mode.toUpperCase()) {
            case 'OFF': value = LAMP_MODE.OFF; break;
            case 'DMX_MANUAL': value = mapToRange(clampedIntensity, 0, 100, LAMP_MODE.DMX_MANUAL_MIN, LAMP_MODE.DMX_MANUAL_MAX); break;
            case 'DMX_DYNAMIC_SOUND': value = mapToRange(clampedIntensity, 0, 100, LAMP_MODE.DMX_DYNAMIC_SOUND_MIN, LAMP_MODE.DMX_DYNAMIC_SOUND_MAX); break;
            case 'TUNE_PROGRAM': value = mapToRange(clampedIntensity, 0, 100, LAMP_MODE.TUNE_PROGRAM_LIBRARY_MIN, LAMP_MODE.TUNE_PROGRAM_LIBRARY_MAX); this._handleProgramModeChannels(options, updates); break;
            case 'SOUND_PROGRAM': value = mapToRange(clampedIntensity, 0, 100, LAMP_MODE.SOUND_CONTROL_PROGRAM_LIBRARY_MIN, LAMP_MODE.SOUND_CONTROL_PROGRAM_LIBRARY_MAX); this._handleProgramModeChannels(options, updates); break;
            default: this._log(`Invalid lamp mode: ${mode}. Setting OFF.`, 'warn'); value = LAMP_MODE.OFF;
        }
        updates[ch] = value; // Use relative channel as key
        this.updateDeviceChannels(updates);
    }

    /** @private Helper for program mode channel side effects. */
    _handleProgramModeChannels(options, updates) {
        const relCh4 = 4; // Relative CH4
        const relCh21 = 21; // Relative CH21
        const ch21Value = options.selectDynamicPictureSeparately ? 1 : 0; // CH21 seems to be 0/1
        updates[relCh21] = ch21Value;

        // Need current state of CH4 to handle playAllPatterns logic correctly
        // This requires reading from dmxController's state, mapped back to relative
        const absCh4 = this._resolveChannel(relCh4);
        const currentCh4Value = this.dmxController.dmxState[absCh4] ?? 0; // Read state

        if (options.playAllPatterns === true) {
            updates[relCh4] = 0;
        } else if (options.playAllPatterns === false) {
            // If explicitly set to false, ensure CH4 is not 0 (use 1 as default if it was 0)
            updates[relCh4] = (currentCh4Value === 0) ? 1 : currentCh4Value;
            if (currentCh4Value === 0) this._log("Lamp mode set to single pattern, CH4 was 0, defaulting to 1.", 'debug');
        } else {
            // Default: if playAllPatterns omitted, play all
             updates[relCh4] = 0;
             this._log("playAllPatterns option omitted, defaulting CH4=0 (play all).", 'debug');
        }
    }

    /** Sets pattern size/effect for Pattern 1 (Channel 2). */
    setPatternSize1(mode, intensity = 0) {
        const ch = 2;
        const invInt = 100 - clamp(intensity, 0, 100); // Intensity means smaller pattern, so invert
        let v = PATTERN_SIZE_MODE.PARTS_BLANK_MIN;
        switch(mode.toUpperCase()){
            case 'PARTS_BLANK': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.PARTS_BLANK_MIN,PATTERN_SIZE_MODE.PARTS_BLANK_MAX); break;
            case 'PATTERN_RETURNS': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.PATTERN_RETURNS_MIN,PATTERN_SIZE_MODE.PATTERN_RETURNS_MAX); break;
            case 'PATTERN_FOLDS': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.PATTERN_FOLDS_MIN,PATTERN_SIZE_MODE.PATTERN_FOLDS_MAX); break;
            case 'CROSSING': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.CROSSING_MIN,PATTERN_SIZE_MODE.CROSSING_MAX); break;
            case 'BLANKING': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.BLANKING_MIN,PATTERN_SIZE_MODE.BLANKING_MAX); break;
            default: this._log(`Invalid pattern size mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch, v);
    }

    /** Selects main gallery (Channel 3). */
    selectGallery(galleryType) {
        const ch = 3;
        let v = GALLERY.BEAM;
        switch(galleryType.toUpperCase()){
             case 'BEAM': v = GALLERY.BEAM; break;
             case 'ANIMATION': v = GALLERY.ANIMATION; break;
             default: this._log(`Invalid gallery type: ${galleryType}`, 'warn');
         }
        this.updateDeviceChannel(ch, v);
     }

     /** Selects pattern for Pattern 1 (Channel 4). */
    selectPattern1(patternIndex) {
        const ch = 4;
        this.updateDeviceChannel(ch, clamp(patternIndex, 0, 255));
    }

    /** Sets zoom effect for Pattern 1 (Channel 5). */
    setZoom1(mode, intensity=0) {
        const ch = 5;
        const i = clamp(intensity, 0, 100);
        let v = ZOOM_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v = ZOOM_MODE.STATIC_MIN; break;
            case 'DYNAMIC_ZOOM_IN': v=mapToRange(i,0,100,ZOOM_MODE.DYNAMIC_ZOOM_IN_MIN, ZOOM_MODE.DYNAMIC_ZOOM_IN_MAX); break;
            case 'DYNAMIC_ZOOM_OUT': v=mapToRange(i,0,100,ZOOM_MODE.DYNAMIC_ZOOM_OUT_MIN, ZOOM_MODE.DYNAMIC_ZOOM_OUT_MAX); break;
            case 'DYNAMIC_FLIP_ZOOMING': v=mapToRange(i,0,100,ZOOM_MODE.DYNAMIC_FLIP_ZOOMING_MIN, ZOOM_MODE.DYNAMIC_FLIP_ZOOMING_MAX); break;
            default: this._log(`Invalid zoom mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch, v);
    }

    /** Sets rotation effect for Pattern 1 (Channel 6). */
    setRotation1(mode, intensity=0) {
        const ch = 6;
        const i = clamp(intensity, 0, 100);
        let v = ROTATION_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v = ROTATION_MODE.STATIC_MIN; break;
            case 'DYNAMIC_INVERSION_A': v=mapToRange(i,0,100,ROTATION_MODE.DYNAMIC_INVERSION_A_MIN, ROTATION_MODE.DYNAMIC_INVERSION_A_MAX); break;
            case 'DYNAMIC_INVERSION_B': v=mapToRange(i,0,100,ROTATION_MODE.DYNAMIC_INVERSION_B_MIN, ROTATION_MODE.DYNAMIC_INVERSION_B_MAX); break;
            default: this._log(`Invalid rotation mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch, v);
    }

     /** Sets horizontal movement for Pattern 1 (Channel 7). */
    setHorizontalMovement1(mode, intensity=0) {
        const ch = 7;
        const i = clamp(intensity,0,100);
        let v = HORIZONTAL_MOVEMENT_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC':v=HORIZONTAL_MOVEMENT_MODE.STATIC_MIN; break;
            case 'PUSH_UP_WAVE': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_UP_WAVE_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_UP_WAVE_MAX); break;
            case 'PUSH_DOWN_WAVE': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_DOWN_WAVE_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_DOWN_WAVE_MAX); break;
            case 'LEFT_SHIFT': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_LEFT_SHIFT_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_LEFT_SHIFT_MAX); break;
            case 'RIGHT_SHIFT': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_RIGHT_SHIFT_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_RIGHT_SHIFT_MAX); break;
            default: this._log(`Invalid horizontal movement mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets vertical movement for Pattern 1 (Channel 8). */
    setVerticalMovement1(mode, intensity=0) {
        const ch = 8;
        const i = clamp(intensity,0,100);
        let v = VERTICAL_MOVEMENT_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v=VERTICAL_MOVEMENT_MODE.STATIC_MIN; break;
            case 'RIGHT_PUSH_WAVE': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_RIGHT_PUSH_WAVE_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_RIGHT_PUSH_WAVE_MAX); break;
            case 'LEFT_PUSH_WAVE': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_LEFT_PUSH_WAVE_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_LEFT_PUSH_WAVE_MAX); break;
            case 'MOVE_UP': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_UP_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_UP_MAX); break;
            case 'MOVE_DOWN': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_DOWN_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_DOWN_MAX); break;
            default: this._log(`Invalid vertical movement mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets horizontal zooming/distortion for Pattern 1 (Channel 9). */
    setHorizontalZooming1(mode, intensity=0) {
        const ch = 9;
        const i = clamp(intensity,0,100);
        let v = HORIZONTAL_ZOOMING1_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v=HORIZONTAL_ZOOMING1_MODE.STATIC_MIN; break;
            case 'PUSH_UP_DISTORTION': v=mapToRange(i,0,100,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_PUSH_UP_DISTORTION_MIN,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_PUSH_UP_DISTORTION_MAX); break;
            case 'PUSH_DOWN_DISTORTION': v=mapToRange(i,0,100,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_PUSH_DOWN_DISTORTION_MIN,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_PUSH_DOWN_DISTORTION_MAX); break;
            case 'ZOOMING': v=mapToRange(i,0,100,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_ZOOMING_MIN,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_ZOOMING_MAX); break;
            case 'FLIP_ZOOMING': v=mapToRange(i,0,100,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_FLIP_ZOOMING_MIN,HORIZONTAL_ZOOMING1_MODE.DYNAMIC_FLIP_ZOOMING_MAX); break;
            default: this._log(`Invalid horizontal zooming 1 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets vertical zooming/distortion for Pattern 1 (Channel 10). */
    setVerticalZooming1(mode, intensity=0) {
        const ch = 10;
        const i = clamp(intensity,0,100);
        let v = VERTICAL_ZOOMING1_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v=VERTICAL_ZOOMING1_MODE.STATIC_MIN; break;
            case 'RIGHT_PUSH_DISTORTION': v=mapToRange(i,0,100,VERTICAL_ZOOMING1_MODE.DYNAMIC_RIGHT_PUSH_DISTORTION_MIN,VERTICAL_ZOOMING1_MODE.DYNAMIC_RIGHT_PUSH_DISTORTION_MAX); break;
            case 'LEFT_PUSH_DISTORTION': v=mapToRange(i,0,100,VERTICAL_ZOOMING1_MODE.DYNAMIC_LEFT_PUSH_DISTORTION_MIN,VERTICAL_ZOOMING1_MODE.DYNAMIC_LEFT_PUSH_DISTORTION_MAX); break;
            case 'ZOOM': v=mapToRange(i,0,100,VERTICAL_ZOOMING1_MODE.DYNAMIC_ZOOM_MIN,VERTICAL_ZOOMING1_MODE.DYNAMIC_ZOOM_MAX); break;
            case 'FLIP_ZOOMING': v=mapToRange(i,0,100,VERTICAL_ZOOMING1_MODE.DYNAMIC_FLIP_ZOOMING_MIN,VERTICAL_ZOOMING1_MODE.DYNAMIC_FLIP_ZOOMING_MAX); break;
            default: this._log(`Invalid vertical zooming 1 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets forced color mode for Pattern 1 (Channel 11). */
    setForcedColor1(mode, points=1) {
        const ch = 11;
        let v = 0;
        switch(mode.toUpperCase()){
            case 'PRIMARY': v=0; break;
            case 'CHANGE_PER_POINT': v=clamp(points,1,255); break;
            default: this._log(`Invalid forced color 1 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets strobe effect (Channel 12). */
    setStrobe(mode, speed=0) {
        const ch = 12;
        const s = clamp(speed,0,100);
        let v = STROBE_MODE.OFF_MIN;
        switch(mode.toUpperCase()){
            case 'OFF': v=mapToRange(s, 0, 100, STROBE_MODE.OFF_MIN, STROBE_MODE.OFF_MAX); break;
            case 'STROBE': v=mapToRange(s,0,100,STROBE_MODE.STROBE_SLOW_FAST_MIN,STROBE_MODE.STROBE_SLOW_FAST_MAX); break;
            case 'RANDOM_FLASH': v=mapToRange(s,0,100,STROBE_MODE.RANDOM_FLASH_SLOW_MIN,STROBE_MODE.RANDOM_FLASH_SLOW_MAX); break;
            case 'SOUND_STROBE': v=mapToRange(s,0,100,STROBE_MODE.SOUND_STROBE_SLOW_FAST_MIN,STROBE_MODE.SOUND_STROBE_SLOW_FAST_MAX); break;
            case 'SOUND_RANDOM_FLASH': v=mapToRange(s,0,100,STROBE_MODE.SOUND_RANDOM_FLASH_MIN,STROBE_MODE.SOUND_RANDOM_FLASH_MAX); break;
            case 'ON': v=mapToRange(s,0,100,STROBE_MODE.ON_MIN,STROBE_MODE.ON_MAX); break;
            default: this._log(`Invalid strobe mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets node highlighting for Pattern 1 (Channel 13). */
    setNodeHighlighting1(mode, intensity=0) {
        const ch = 13;
        const i = clamp(intensity,0,100);
        let v = NODE_HIGHLIGHTING_MODE.NODES_BRIGHTER_MIN;
        switch(mode.toUpperCase()){
            case 'NODES_BRIGHTER': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.NODES_BRIGHTER_MIN,NODE_HIGHLIGHTING_MODE.NODES_BRIGHTER_MAX); break;
            case 'BROKEN_LINES': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.BROKEN_LINES_MIN,NODE_HIGHLIGHTING_MODE.BROKEN_LINES_MAX); break;
            case 'SCANNING_LINE': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.SCANNING_LINE_MIN,159); break; // CH13 specific range end
            case 'RESERVED': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.RESERVED_MIN,NODE_HIGHLIGHTING_MODE.RESERVED_MAX); break;
            default: this._log(`Invalid node highlighting 1 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets node expansion value for Pattern 1 (Channel 14). */
    setNodeExpansion1(value) {
        const ch = 14;
        this.updateDeviceChannel(ch, clamp(value,0,255));
    }

    /** Sets gradual draw effect for Pattern 1 (Channel 15). */
    setGradualDraw1(mode, intensity=0) {
        const ch = 15;
        const i = clamp(intensity,0,100);
        let v = GRADUAL_DRAW_MODE.FORWARD_MANUAL_EXPANSION_MIN;
        switch(mode.toUpperCase()){
            case 'FORWARD_MANUAL': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.FORWARD_MANUAL_EXPANSION_MIN,GRADUAL_DRAW_MODE.FORWARD_MANUAL_EXPANSION_MAX); break;
            case 'REVERSE_MANUAL': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.REVERSE_MANUAL_EXPANSION_MIN,GRADUAL_DRAW_MODE.REVERSE_MANUAL_EXPANSION_MAX); break;
            case 'DYNAMIC_A': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_A_MIN,GRADUAL_DRAW_MODE.DYNAMIC_A_MAX); break;
            case 'DYNAMIC_B': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_B_MIN,GRADUAL_DRAW_MODE.DYNAMIC_B_MAX); break;
            case 'DYNAMIC_C': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_C_MIN,GRADUAL_DRAW_MODE.DYNAMIC_C_MAX); break;
            case 'DYNAMIC_D': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_D_MIN,GRADUAL_DRAW_MODE.DYNAMIC_D_MAX); break;
            default: this._log(`Invalid gradual draw 1 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets distortion degree for Pattern 1 (Channel 16). */
    setDistortion1(degree) {
        const ch = 16;
        this.updateDeviceChannel(ch, clamp(degree,0,255));
    }

    /** Sets distortion degree for Pattern 2 (Channel 17). */
    setDistortion2(degree) {
        const ch = 17;
        this.updateDeviceChannel(ch, clamp(degree,0,255));
    }

    /** Enables/disables second pattern (Channel 18). */
    setSecondPatternEnabled(enabled) {
        const ch = 18;
        this.updateDeviceChannel(ch, enabled ? 1 : 0); // Assuming 0=off, 1=on based on context
    }

    /** Sets pattern size/effect for Pattern 2 (Channel 19). */
    setPatternSize2(mode, intensity = 0) {
        const ch = 19;
        const invInt = 100 - clamp(intensity, 0, 100);
        let v=PATTERN_SIZE_MODE.PARTS_BLANK_MIN;
        switch(mode.toUpperCase()){
            case 'PARTS_BLANK': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.PARTS_BLANK_MIN,PATTERN_SIZE_MODE.PARTS_BLANK_MAX); break;
            case 'PATTERN_RETURNS': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.PATTERN_RETURNS_MIN,PATTERN_SIZE_MODE.PATTERN_RETURNS_MAX); break;
            case 'PATTERN_FOLDS': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.PATTERN_FOLDS_MIN,PATTERN_SIZE_MODE.PATTERN_FOLDS_MAX); break;
            case 'CROSSING': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.CROSSING_MIN,PATTERN_SIZE_MODE.CROSSING_MAX); break;
            case 'BLANKING': v=mapToRange(invInt,0,100,PATTERN_SIZE_MODE.BLANKING_MIN,PATTERN_SIZE_MODE.BLANKING_MAX); break;
            default: this._log(`Invalid pattern size 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets Pattern Library Selection for Pattern 2 (Channel 20). */
    setPatternLibrarySelection2(value) {
       const ch = 20;
       this._log("Setting CH20 (Pattern Library Selection 2). May have no effect.", 'debug');
       this.updateDeviceChannel(ch, clamp(value,0,255));
    }

    /** Selects pattern for Pattern 2 (Channel 21). */
    selectPattern2(patternIndex) {
        const ch = 21;
        this.updateDeviceChannel(ch, clamp(patternIndex, 0, 255));
    }

    /** Sets zoom effect for Pattern 2 (Channel 22). */
    setZoom2(mode, intensity=0) {
        const ch = 22;
        const i = clamp(intensity,0,100);
        let v = ZOOM_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v=ZOOM_MODE.STATIC_MIN; break;
            case 'DYNAMIC_ZOOM_IN': v=mapToRange(i,0,100,ZOOM_MODE.DYNAMIC_ZOOM_IN_MIN, ZOOM_MODE.DYNAMIC_ZOOM_IN_MAX); break;
            case 'DYNAMIC_ZOOM_OUT': v=mapToRange(i,0,100,ZOOM_MODE.DYNAMIC_ZOOM_OUT_MIN, ZOOM_MODE.DYNAMIC_ZOOM_OUT_MAX); break;
            case 'DYNAMIC_FLIP_ZOOMING': v=mapToRange(i,0,100,ZOOM_MODE.DYNAMIC_FLIP_ZOOMING_MIN, ZOOM_MODE.DYNAMIC_FLIP_ZOOMING_MAX); break;
            default: this._log(`Invalid zoom 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch, v);
    }

    /** Sets rotation effect for Pattern 2 (Channel 23). */
    setRotation2(mode, intensity=0) {
        const ch = 23;
        const i = clamp(intensity,0,100);
        let v = ROTATION_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v=ROTATION_MODE.STATIC_MIN; break;
            case 'DYNAMIC_INVERSION_A': v=mapToRange(i,0,100,ROTATION_MODE.DYNAMIC_INVERSION_A_MIN, ROTATION_MODE.DYNAMIC_INVERSION_A_MAX); break;
            case 'DYNAMIC_INVERSION_B': v=mapToRange(i,0,100,ROTATION_MODE.DYNAMIC_INVERSION_B_MIN, ROTATION_MODE.DYNAMIC_INVERSION_B_MAX); break;
            default: this._log(`Invalid rotation 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch, v);
    }

    /** Sets horizontal movement for Pattern 2 (Channel 24). */
    setHorizontalMovement2(mode, intensity=0) {
        const ch = 24;
        const i = clamp(intensity,0,100);
        let v = HORIZONTAL_MOVEMENT_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC':v=HORIZONTAL_MOVEMENT_MODE.STATIC_MIN; break;
            // CH24 uses different names but same ranges as CH7 push wave according to CSV
            case 'UPWARD_PUSH_WAVE': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_UP_WAVE_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_UP_WAVE_MAX); break;
            case 'DOWNWARD_PUSH_WAVE': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_DOWN_WAVE_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_PUSH_DOWN_WAVE_MAX); break;
            case 'LEFT_SHIFT': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_LEFT_SHIFT_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_LEFT_SHIFT_MAX); break;
            case 'RIGHT_SHIFT': v=mapToRange(i,0,100,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_RIGHT_SHIFT_MIN,HORIZONTAL_MOVEMENT_MODE.DYNAMIC_RIGHT_SHIFT_MAX); break;
            default: this._log(`Invalid horizontal movement 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets vertical movement for Pattern 2 (Channel 25). */
    setVerticalMovement2(mode, intensity=0) {
        const ch = 25;
        const i = clamp(intensity,0,100);
        let v = VERTICAL_MOVEMENT_MODE.STATIC_MIN;
        switch(mode.toUpperCase()){
            case 'STATIC': v=VERTICAL_MOVEMENT_MODE.STATIC_MIN; break;
            case 'RIGHT_PUSH_WAVE': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_RIGHT_PUSH_WAVE_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_RIGHT_PUSH_WAVE_MAX); break;
            case 'LEFT_PUSH_WAVE': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_LEFT_PUSH_WAVE_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_LEFT_PUSH_WAVE_MAX); break;
            case 'MOVE_UP': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_UP_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_UP_MAX); break;
            case 'MOVE_DOWN': v=mapToRange(i,0,100,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_DOWN_MIN,VERTICAL_MOVEMENT_MODE.DYNAMIC_MOVE_DOWN_MAX); break;
            default: this._log(`Invalid vertical movement 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

     /** Sets horizontal flip/distortion for Pattern 2 (Channel 26). */
    setHorizontalFlip(mode, intensity=0) {
      const ch = 26;
      const i = clamp(intensity,0,100);
      let v = HORIZONTAL_FLIP_MODE.STATIC_MIN;
      switch(mode.toUpperCase()){
          case 'STATIC': v=HORIZONTAL_FLIP_MODE.STATIC_MIN; break;
          case 'PUSH_UP_DISTORTION': v=mapToRange(i,0,100,HORIZONTAL_FLIP_MODE.DYNAMIC_PUSH_UP_DISTORTION_MIN,HORIZONTAL_FLIP_MODE.DYNAMIC_PUSH_UP_DISTORTION_MAX); break;
          case 'PUSH_DOWN_DISTORTION': v=mapToRange(i,0,100,HORIZONTAL_FLIP_MODE.DYNAMIC_PUSH_DOWN_DISTORTION_MIN,HORIZONTAL_FLIP_MODE.DYNAMIC_PUSH_DOWN_DISTORTION_MAX); break;
          case 'FLIP': v=mapToRange(i,0,100,HORIZONTAL_FLIP_MODE.DYNAMIC_FLIP_MIN,HORIZONTAL_FLIP_MODE.DYNAMIC_FLIP_MAX); break;
          default: this._log(`Invalid horizontal flip mode: ${mode}`, 'warn');
      }
      this.updateDeviceChannel(ch,v);
    }

    /** Sets vertical flip/distortion for Pattern 2 (Channel 27). */
    setVerticalFlip(mode, intensity=0) {
      const ch = 27;
      const i = clamp(intensity,0,100);
      let v = VERTICAL_FLIP_MODE.STATIC_MIN;
      switch(mode.toUpperCase()){
          case 'STATIC': v=VERTICAL_FLIP_MODE.STATIC_MIN; break;
          case 'RIGHT_PUSH_DISTORTION': v=mapToRange(i,0,100,VERTICAL_FLIP_MODE.DYNAMIC_RIGHT_PUSH_DISTORTION_MIN,VERTICAL_FLIP_MODE.DYNAMIC_RIGHT_PUSH_DISTORTION_MAX); break;
          case 'LEFT_PUSH_DISTORTION': v=mapToRange(i,0,100,VERTICAL_FLIP_MODE.DYNAMIC_LEFT_PUSH_DISTORTION_MIN,VERTICAL_FLIP_MODE.DYNAMIC_LEFT_PUSH_DISTORTION_MAX); break;
          case 'FLIP': v=mapToRange(i,0,100,VERTICAL_FLIP_MODE.DYNAMIC_FLIP_MIN,VERTICAL_FLIP_MODE.DYNAMIC_FLIP_MAX); break;
          default: this._log(`Invalid vertical flip mode: ${mode}`, 'warn');
      }
      this.updateDeviceChannel(ch,v);
    }

    /** Sets forced color mode for Pattern 2 (Channel 28). */
    setForcedColor2(mode, dots=1) {
        const ch = 28;
        let v = 0;
        switch(mode.toUpperCase()){
            case 'PRIMARY': v=0; break;
            case 'CHANGE_PER_DOT': v=clamp(dots,1,255); break; // CSV says Dot
            default: this._log(`Invalid forced color 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets overall color change effect (Channel 29). */
    setColorChange(mode, intensity=0) {
        const ch = 29;
        const i = clamp(intensity,0,100);
        const mapFn = (min,max) => mapToRange(i,0,100,min,max);
        let v = mapFn(COLOR_CHANGE_MODE.PRIMARY_MIN,COLOR_CHANGE_MODE.PRIMARY_MAX);
        switch(mode.toUpperCase()){
            case 'PRIMARY': v=mapFn(COLOR_CHANGE_MODE.PRIMARY_MIN,COLOR_CHANGE_MODE.PRIMARY_MAX); break;
            case 'WHITE': v=mapFn(COLOR_CHANGE_MODE.WHITE_MIN,COLOR_CHANGE_MODE.WHITE_MAX); break;
            case 'RED': v=mapFn(COLOR_CHANGE_MODE.RED_MIN,COLOR_CHANGE_MODE.RED_MAX); break;
            case 'YELLOW': v=mapFn(COLOR_CHANGE_MODE.YELLOW_MIN,COLOR_CHANGE_MODE.YELLOW_MAX); break;
            case 'GREEN': v=mapFn(COLOR_CHANGE_MODE.GREEN_MIN,COLOR_CHANGE_MODE.GREEN_MAX); break;
            case 'INDIGO': v=mapFn(COLOR_CHANGE_MODE.INDIGO_MIN,COLOR_CHANGE_MODE.INDIGO_MAX); break;
            case 'BLUE': v=mapFn(COLOR_CHANGE_MODE.BLUE_MIN,COLOR_CHANGE_MODE.BLUE_MAX); break;
            case 'PURPLE': v=mapFn(COLOR_CHANGE_MODE.PURPLE_MIN,COLOR_CHANGE_MODE.PURPLE_MAX); break;
            case 'RGB_CYCLE': v=mapFn(COLOR_CHANGE_MODE.RGB_CYCLE_MIN,COLOR_CHANGE_MODE.RGB_CYCLE_MAX); break;
            case 'YIP_CYCLE': v=mapFn(COLOR_CHANGE_MODE.YIP_CYCLE_MIN,COLOR_CHANGE_MODE.YIP_CYCLE_MAX); break;
            case 'FULL_COLOR_CYCLE': v=mapFn(COLOR_CHANGE_MODE.FULL_COLOR_CYCLE_MIN,COLOR_CHANGE_MODE.FULL_COLOR_CYCLE_MAX); break;
            case 'COLORFUL_CHANGE': v=mapFn(COLOR_CHANGE_MODE.COLORFUL_CHANGE_MIN,COLOR_CHANGE_MODE.COLORFUL_CHANGE_MAX); break;
            case 'FORWARD_MOVEMENT': v=mapFn(COLOR_CHANGE_MODE.FORWARD_COLOR_MOVEMENT_MIN,COLOR_CHANGE_MODE.FORWARD_COLOR_MOVEMENT_MAX); break;
            case 'REVERSE_MOVEMENT': v=mapFn(COLOR_CHANGE_MODE.REVERSE_COLOR_MOVEMENT_MIN,COLOR_CHANGE_MODE.REVERSE_COLOR_MOVEMENT_MAX); break;
            default: this._log(`Invalid color change mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

     /** Sets node highlighting for Pattern 2 (Channel 30). */
    setNodeHighlighting2(mode, intensity=0) {
        const ch = 30;
        const i = clamp(intensity,0,100);
        let v = NODE_HIGHLIGHTING_MODE.NODES_BRIGHTER_MIN;
        switch(mode.toUpperCase()){
            case 'NODES_BRIGHTER': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.NODES_BRIGHTER_MIN,NODE_HIGHLIGHTING_MODE.NODES_BRIGHTER_MAX); break;
            case 'BROKEN_LINES': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.BROKEN_LINES_MIN,NODE_HIGHLIGHTING_MODE.BROKEN_LINES_MAX); break;
            case 'SCANNING_LINE': v=mapToRange(i,0,100,NODE_HIGHLIGHTING_MODE.SCANNING_LINE_MIN,NODE_HIGHLIGHTING_MODE.SCANNING_LINE_MAX); break; // CH30 range covers full
            default: this._log(`Invalid node highlighting 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Sets node expansion value for Pattern 2 (Channel 31). */
    setNodeExpansion2(value) {
        const ch = 31;
        this.updateDeviceChannel(ch, clamp(value,0,255));
    }

    /** Sets gradual draw effect for Pattern 2 (Channel 32). */
    setGradualDraw2(mode, intensity=0) {
        const ch = 32;
        const i = clamp(intensity,0,100);
        let v = GRADUAL_DRAW_MODE.FORWARD_MANUAL_EXPANSION_MIN;
        switch(mode.toUpperCase()){
            case 'FORWARD_MANUAL': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.FORWARD_MANUAL_EXPANSION_MIN,GRADUAL_DRAW_MODE.FORWARD_MANUAL_EXPANSION_MAX); break;
            case 'REVERSE_MANUAL': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.REVERSE_MANUAL_EXPANSION_MIN,GRADUAL_DRAW_MODE.REVERSE_MANUAL_EXPANSION_MAX); break;
            case 'DYNAMIC_A': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_A_MIN,GRADUAL_DRAW_MODE.DYNAMIC_A_MAX); break;
            case 'DYNAMIC_B': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_B_MIN,GRADUAL_DRAW_MODE.DYNAMIC_B_MAX); break;
            case 'DYNAMIC_C': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_C_MIN,GRADUAL_DRAW_MODE.DYNAMIC_C_MAX); break;
            case 'DYNAMIC_D': v=mapToRange(i,0,100,GRADUAL_DRAW_MODE.DYNAMIC_D_MIN,GRADUAL_DRAW_MODE.DYNAMIC_D_MAX); break;
            default: this._log(`Invalid gradual draw 2 mode: ${mode}`, 'warn');
        }
        this.updateDeviceChannel(ch,v);
    }

    /** Simulates pressing the 'Menu' button. */
    async pressMenu() {
        this._log("Simulating MENU press...", 'info');
        await this.dmxController.simulateButtonPress(this.button.menu.ch, this.button.menu.val, this.button.duration);
    }

    /** Simulates pressing the 'Enter' button. */
    async pressEnter() {
        this._log("Simulating ENTER press...", 'info');
        await this.dmxController.simulateButtonPress(this.button.enter.ch, this.button.enter.val, this.button.duration);
    }

    /** Simulates pressing the 'Up' button. */
    async pressUp() {
        this._log("Simulating UP press...", 'info');
        await this.dmxController.simulateButtonPress(this.button.up.ch, this.button.up.val, this.button.duration);
    }

    /** Simulates pressing the 'Down' button. */
    async pressDown() {
        this._log("Simulating DOWN press...", 'info');
        await this.dmxController.simulateButtonPress(this.button.down.ch, this.button.down.val, this.button.duration);
    }
}

// Export the classes
export {
    DMXSerialInterface,
    DMXController,
    LaserDeviceControl,
    DMX_MAX_CHANNELS
};