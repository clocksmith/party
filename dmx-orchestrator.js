/**
 * DMX Orchestrator
 * 
 * High-level orchestration layer for unified DMX system control.
 * Coordinates Pattern Animation, Profile-Based Control, and direct DMX 
 * manipulation with intelligent conflict resolution and state management.
 * 
 * @module dmx-orchestrator
 */

import { EventEmitter } from 'events';
import { DMXController } from './dmx.js';
import { ProfileBasedDeviceControl } from './dmx-profile-based-control.js';
import { PatternAnimator } from './pattern-animator.js';
import { PatternFactory } from './patterns/geometric-patterns.js';
import { DeviceProfileManager } from './dmx-device-control.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Configuration error class
 */
class ConfigurationError extends Error {
    constructor(message, field, expected, received) {
        super(message);
        this.name = 'ConfigurationError';
        this.field = field;
        this.expected = expected;
        this.received = received;
    }
}

/**
 * Connection error class
 */
class ConnectionError extends Error {
    constructor(message, port, details) {
        super(message);
        this.name = 'ConnectionError';
        this.port = port;
        this.details = details;
    }
}

/**
 * DMX Orchestrator - Unified control interface
 * 
 * @class DMXOrchestrator
 * @extends EventEmitter
 */
export class DMXOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            portPath: options.portPath || null,
            deviceProfile: options.deviceProfile || null,
            profilePath: options.profilePath || null,
            startAddress: options.startAddress || 1,
            frameRate: options.frameRate || 30,
            conflictResolution: options.conflictResolution || 'priority',
            priority: {
                profile: options.priority?.profile || 100,
                pattern: options.priority?.pattern || 90
            },
            safety: {
                maxChangeRate: options.safety?.maxChangeRate || 20,
                minFrameTime: options.safety?.minFrameTime || 16,
                emergencyStopOnError: options.safety?.emergencyStopOnError !== false
            },
            mock: options.mock || false,
            autoConnect: options.autoConnect !== false,
            autoLoadPatterns: options.autoLoadPatterns !== false,
            logging: {
                enabled: options.logging?.enabled !== false,
                level: options.logging?.level || 'info',
                file: options.logging?.file || null
            }
        };

        this.isInitialized = false;
        this.isConnected = false;
        this.activeControlMode = null;
        this.dmxController = null;
        this.profileBasedControl = null;
        this.patternAnimator = null;
        this.deviceProfile = null;
        this.profileManager = new DeviceProfileManager();
        
        this.patterns = new Map();
        this.activePattern = null;
        this.patternState = {};
        
        this.channels = new Map();
        this.lastChannelValues = new Map();
        
        this.logger = this._createLogger();
    }

    /**
     * Initialize the API
     * @returns {Promise<void>}
     */
    async init() {
        try {
            this.logger.info('Initializing DMX Orchestrator...');
            
            // Load device profile
            if (this.options.profilePath) {
                this.deviceProfile = await this.profileManager.loadProfile(this.options.profilePath);
            } else if (this.options.deviceProfile) {
                this.deviceProfile = this.options.deviceProfile;
            } else {
                throw new ConfigurationError(
                    'No device profile specified',
                    'deviceProfile',
                    'Profile object or profilePath',
                    'null'
                );
            }
            
            // Validate profile
            const validation = this.profileManager.validateProfile(this.deviceProfile);
            if (!validation.valid) {
                throw new ConfigurationError(
                    `Invalid device profile: ${validation.errors.join(', ')}`,
                    'deviceProfile',
                    'Valid profile',
                    'Invalid profile'
                );
            }
            
            // Create DMX controller
            if (this.options.mock) {
                this.dmxController = this._createMockDMXController();
                this.logger.info('Using mock DMX controller');
            } else {
                this.dmxController = new DMXController({
                    portPath: this.options.portPath,
                    autoDetect: !this.options.portPath
                });
            }
            
            // Create profile-based control
            this.profileBasedControl = new ProfileBasedDeviceControl({
                dmxController: this.dmxController,
                profile: this.deviceProfile,
                startAddress: this.options.startAddress
            });
            
            // Create pattern animator
            this.patternAnimator = new PatternAnimator({
                dmxController: this.dmxController,
                deviceProfile: this.deviceProfile,
                frameRate: this.options.frameRate,
                priority: this.options.priority.pattern,
                safety: this.options.safety
            });
            
            // Set up event listeners
            this._setupEventListeners();
            
            // Auto-load built-in patterns
            if (this.options.autoLoadPatterns) {
                await this._loadBuiltInPatterns();
            }
            
            // Auto-connect if requested
            if (this.options.autoConnect) {
                await this.connect();
            }
            
            this.isInitialized = true;
            this.logger.info('DMX Orchestrator initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize DMX Orchestrator', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Connect to DMX hardware
     * @returns {Promise<void>}
     */
    async connect() {
        if (!this.isInitialized) {
            throw new Error('API not initialized. Call init() first.');
        }
        
        if (this.isConnected) {
            this.logger.warn('Already connected');
            return;
        }
        
        try {
            if (!this.options.mock) {
                await this.dmxController.connect();
            }
            
            this.isConnected = true;
            this.profileBasedControl.blackout();
            
            this.logger.info('Connected to DMX hardware');
            this.emit('connected');
            
        } catch (error) {
            const connError = new ConnectionError(
                'Failed to connect to DMX hardware',
                this.options.portPath,
                error.message
            );
            this.logger.error(connError.message, error);
            this.emit('error', connError);
            throw connError;
        }
    }

    /**
     * Disconnect from DMX hardware
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (!this.isConnected) {
            this.logger.warn('Not connected');
            return;
        }
        
        this.stopAnimation();
        this.profileBasedControl.blackout();
        
        if (!this.options.mock) {
            await this.dmxController.disconnect();
        }
        
        this.isConnected = false;
        this.logger.info('Disconnected from DMX hardware');
        this.emit('disconnected');
    }

    /**
     * Set control mode (profile or pattern)
     * @param {'profile'|'pattern'} mode - Control mode
     */
    setControlMode(mode) {
        if (!['profile', 'pattern'].includes(mode)) {
            throw new ConfigurationError(
                'Invalid control mode',
                'mode',
                'profile or pattern',
                mode
            );
        }
        
        if (this.activeControlMode === mode) {
            return;
        }
        
        // Handle conflict resolution
        if (this.options.conflictResolution === 'exclusive') {
            if (this.activeControlMode === 'pattern') {
                this.patternAnimator.stop();
            } else if (this.activeControlMode === 'profile') {
                this.profileBasedControl.blackout();
            }
        }
        
        this.activeControlMode = mode;
        this.logger.info(`Control mode set to: ${mode}`);
        this.emit('modeChanged', mode);
    }

    // Profile Control Methods

    /**
     * Set a channel value by name
     * @param {string} channelName - Channel name
     * @param {number|string} value - Channel value
     * @param {number} [intensity] - Optional intensity
     * @returns {boolean} Success
     */
    setChannel(channelName, value, intensity) {
        this.setControlMode('profile');
        const success = this.profileBasedControl.setChannel(channelName, value, intensity);
        
        if (success) {
            this.channels.set(channelName, value);
            this.emit('channelChanged', { channel: channelName, value });
        }
        
        return success;
    }

    /**
     * Set multiple channels
     * @param {Object} updates - Channel updates
     */
    setChannels(updates) {
        this.setControlMode('profile');
        this.profileBasedControl.setChannels(updates);
        
        for (const [channel, value] of Object.entries(updates)) {
            this.channels.set(channel, value);
        }
        
        this.emit('channelsChanged', updates);
    }

    /**
     * Apply a preset
     * @param {string} presetName - Preset name
     * @returns {boolean} Success
     */
    applyPreset(presetName) {
        this.setControlMode('profile');
        const success = this.profileBasedControl.applyPreset(presetName);
        
        if (success) {
            this.emit('presetApplied', presetName);
        }
        
        return success;
    }

    /**
     * Run a macro
     * @param {string} macroName - Macro name
     * @returns {Promise<boolean>} Success
     */
    async runMacro(macroName) {
        this.setControlMode('profile');
        const success = await this.profileBasedControl.runMacro(macroName);
        
        if (success) {
            this.emit('macroExecuted', macroName);
        }
        
        return success;
    }

    /**
     * Blackout all channels
     */
    blackout() {
        this.stopAnimation();
        this.profileBasedControl.blackout();
        this.channels.clear();
        this.emit('blackout');
    }

    // Pattern Animation Methods

    /**
     * Load a pattern
     * @param {string} name - Pattern name
     * @param {Object} [patternOrOptions] - Pattern instance or options
     */
    loadPattern(name, patternOrOptions) {
        let pattern;
        
        if (patternOrOptions && typeof patternOrOptions.generate === 'function') {
            // It's a pattern instance
            pattern = patternOrOptions;
        } else {
            // Create from factory
            pattern = PatternFactory.create(name, patternOrOptions || {});
        }
        
        this.patterns.set(name, pattern);
        this.patternAnimator.loadPattern(name, pattern);
        
        this.logger.info(`Pattern loaded: ${name}`);
        this.emit('patternLoaded', name);
    }

    /**
     * Load pattern from file
     * @param {string} filePath - Path to pattern file
     * @returns {Promise<string>} Pattern name
     */
    async loadPatternFromFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const config = JSON.parse(data);
            
            const pattern = PatternFactory.create(config.type, config.parameters);
            const name = config.metadata?.name || path.basename(filePath, '.json');
            
            this.loadPattern(name, pattern);
            
            if (config.state) {
                this.patternState[name] = config.state;
            }
            
            return name;
        } catch (error) {
            throw new Error(`Failed to load pattern from file: ${error.message}`);
        }
    }

    /**
     * Save pattern to file
     * @param {string} name - Pattern name
     * @param {string} filePath - Output file path
     * @returns {Promise<void>}
     */
    async savePatternToFile(name, filePath) {
        const pattern = this.patterns.get(name);
        if (!pattern) {
            throw new Error(`Pattern not found: ${name}`);
        }
        
        const config = {
            type: pattern.constructor.name.replace('Pattern', '').toLowerCase(),
            parameters: pattern.parameters,
            state: this.patternState[name] || {},
            metadata: {
                name,
                created: new Date().toISOString(),
                version: '3.0.0'
            }
        };
        
        await fs.writeFile(filePath, JSON.stringify(config, null, 2));
        this.logger.info(`Pattern saved to: ${filePath}`);
    }

    /**
     * Set active pattern
     * @param {string} name - Pattern name
     * @param {Object} [initialState] - Initial state
     * @returns {boolean} Success
     */
    setActivePattern(name, initialState = {}) {
        if (!this.patterns.has(name)) {
            this.logger.error(`Pattern not found: ${name}`);
            return false;
        }
        
        const success = this.patternAnimator.setActivePattern(name, initialState);
        
        if (success) {
            this.activePattern = name;
            this.patternState[name] = initialState;
            this.emit('patternActivated', name);
        }
        
        return success;
    }

    /**
     * Start pattern animation
     */
    startAnimation() {
        if (!this.activePattern) {
            this.logger.error('No active pattern set');
            return false;
        }
        
        this.setControlMode('pattern');
        this.patternAnimator.start();
        
        this.emit('animationStarted', this.activePattern);
        return true;
    }

    /**
     * Stop pattern animation
     */
    stopAnimation() {
        this.patternAnimator.stop();
        this.emit('animationStopped');
    }

    /**
     * Update pattern state
     * @param {Object} updates - State updates
     */
    updatePatternState(updates) {
        this.patternAnimator.updatePatternState(updates);
        
        if (this.activePattern) {
            this.patternState[this.activePattern] = {
                ...this.patternState[this.activePattern],
                ...updates
            };
        }
        
        this.emit('patternStateChanged', updates);
    }

    /**
     * Transition between patterns
     * @param {string} toPattern - Target pattern
     * @param {Object} options - Transition options
     * @returns {Promise<void>}
     */
    async transitionToPattern(toPattern, options = {}) {
        const {
            duration = 2000,
            easing = 'linear',
            state = {}
        } = options;
        
        if (!this.patterns.has(toPattern)) {
            throw new Error(`Pattern not found: ${toPattern}`);
        }
        
        const fromPattern = this.activePattern;
        const startTime = Date.now();
        
        const transition = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress >= 1) {
                clearInterval(transition);
                this.setActivePattern(toPattern, state);
                this.emit('transitionComplete', { from: fromPattern, to: toPattern });
            } else {
                // Apply easing
                const easedProgress = this._applyEasing(progress, easing);
                this.emit('transitionProgress', { 
                    from: fromPattern, 
                    to: toPattern, 
                    progress: easedProgress 
                });
            }
        }, 16);
    }

    // Utility Methods

    /**
     * Get available patterns
     * @returns {string[]} Pattern names
     */
    getAvailablePatterns() {
        return Array.from(this.patterns.keys());
    }

    /**
     * Get available presets
     * @returns {string[]} Preset names
     */
    getAvailablePresets() {
        return Object.keys(this.deviceProfile.presets || {});
    }

    /**
     * Get channel info
     * @param {string} channelName - Channel name
     * @returns {Object} Channel info
     */
    getChannelInfo(channelName) {
        return this.deviceProfile.channels[channelName];
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return {
            initialized: this.isInitialized,
            connected: this.isConnected,
            mode: this.activeControlMode,
            activePattern: this.activePattern,
            patternState: this.patternState[this.activePattern] || {},
            channels: Object.fromEntries(this.channels),
            isAnimating: this.patternAnimator?.isRunning || false
        };
    }

    /**
     * Emergency stop
     */
    emergencyStop() {
        this.stopAnimation();
        this.blackout();
        
        this.logger.warn('EMERGENCY STOP ACTIVATED');
        this.emit('emergencyStop');
    }

    // Private Methods

    /**
     * Create logger
     * @private
     */
    _createLogger() {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevel = levels.indexOf(this.options.logging.level);
        
        const logger = {};
        
        for (const [index, level] of levels.entries()) {
            logger[level] = (...args) => {
                if (index <= currentLevel && this.options.logging.enabled) {
                    const timestamp = new Date().toISOString();
                    const message = `[${timestamp}] [${level.toUpperCase()}] ${args[0]}`;
                    
                    console.log(message, ...args.slice(1));
                    
                    if (this.options.logging.file) {
                        // Append to log file (non-blocking)
                        fs.appendFile(
                            this.options.logging.file,
                            message + '\n'
                        ).catch(() => {});
                    }
                }
            };
        }
        
        return logger;
    }

    /**
     * Create mock DMX controller
     * @private
     */
    _createMockDMXController() {
        const mockChannels = new Array(512).fill(0);
        
        return {
            channels: mockChannels,
            
            setChannel: (channel, value) => {
                if (channel >= 1 && channel <= 512) {
                    mockChannels[channel - 1] = value;
                    this.logger.debug(`Mock DMX Ch${channel}: ${value}`);
                }
            },
            
            setChannels: (updates) => {
                for (const [channel, value] of Object.entries(updates)) {
                    this.setChannel(parseInt(channel), value);
                }
            },
            
            blackout: () => {
                mockChannels.fill(0);
                this.logger.info('Mock BLACKOUT');
            },
            
            connect: async () => {
                this.logger.info('Mock DMX connected');
            },
            
            disconnect: async () => {
                this.logger.info('Mock DMX disconnected');
            },
            
            isConnected: () => true
        };
    }

    /**
     * Load built-in patterns
     * @private
     */
    async _loadBuiltInPatterns() {
        const patterns = [
            'circle', 'square', 'spiral', 'star', 
            'wave', 'line', 'grid'
        ];
        
        for (const type of patterns) {
            try {
                const pattern = PatternFactory.create(type);
                this.loadPattern(type, pattern);
            } catch (error) {
                this.logger.warn(`Failed to load pattern: ${type}`, error);
            }
        }
        
        this.logger.info(`Loaded ${patterns.length} built-in patterns`);
    }

    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Pattern animator events
        this.patternAnimator.on('frame', (data) => {
            this.emit('frame', data);
        });
        
        this.patternAnimator.on('error', (error) => {
            this.logger.error('Pattern animator error', error);
            
            if (this.options.safety.emergencyStopOnError) {
                this.emergencyStop();
            }
            
            this.emit('error', error);
        });
        
        // DMX controller events (if not mock)
        if (!this.options.mock && this.dmxController) {
            this.dmxController.on('error', (error) => {
                this.logger.error('DMX controller error', error);
                this.emit('error', error);
            });
        }
    }

    /**
     * Apply easing function
     * @private
     */
    _applyEasing(t, easing) {
        switch (easing) {
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return t * (2 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'linear':
            default:
                return t;
        }
    }
}

// Factory function for quick setup
export async function createDMXOrchestrator(options = {}) {
    const orchestrator = new DMXOrchestrator(options);
    await orchestrator.init();
    return orchestrator;
}

// Backward compatibility alias
export const createDMXAPI = createDMXOrchestrator;

export default DMXOrchestrator;