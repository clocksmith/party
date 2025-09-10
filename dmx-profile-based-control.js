/**
 * Profile-Based Laser Device Control
 * Dynamically configures device control based on loaded profiles
 */

import { EventEmitter } from 'events';
import { DMXLogger, LogLevel } from './dmx-logger.js';
import { ChannelRangeError, ConfigurationError } from './dmx-errors.js';

/**
 * Profile-based device control that uses JSON profiles instead of hardcoded values
 */
export class ProfileBasedDeviceControl extends EventEmitter {
    constructor(options) {
        super();
        
        if (!options || !options.dmxController) {
            throw new ConfigurationError(
                'dmxController is required',
                'dmxController',
                'DMXController instance',
                undefined
            );
        }
        
        if (!options.profile) {
            throw new ConfigurationError(
                'Device profile is required',
                'profile',
                'device profile object',
                undefined
            );
        }
        
        this.dmxController = options.dmxController;
        this.profile = options.profile;
        this.startAddress = options.startAddress || this.profile.dmxStartAddress || 1;
        this.channelCount = this.profile.channelCount || 32;
        
        this.logger = new DMXLogger({
            moduleName: 'ProfileDevice',
            minLevel: options.logLevel || LogLevel.INFO
        });
        
        // Validate address range
        const maxAddr = this.startAddress + this.channelCount - 1;
        if (this.startAddress < 1 || maxAddr > 512) {
            throw new ChannelRangeError(maxAddr);
        }
        
        // Build channel map for quick lookup
        this.channelMap = new Map();
        this.buildChannelMap();
        
        // Forward events from controller
        this.dmxController.on('connect', () => this.emit('connect'));
        this.dmxController.on('disconnect', () => this.emit('disconnect'));
        this.dmxController.on('error', (err) => this.emit('error', err));
        this.dmxController.on('log', (msg, level) => this.emit('log', msg, level));
        
        this.logger.info(`Initialized ${this.profile.name}`, {
            startAddress: this.startAddress,
            channels: this.channelCount
        });
    }
    
    /**
     * Build channel map from profile
     */
    buildChannelMap() {
        if (!this.profile.channels) return;
        
        for (const [name, def] of Object.entries(this.profile.channels)) {
            this.channelMap.set(name, {
                ...def,
                name,
                absoluteChannel: this.startAddress + def.channel - 1
            });
        }
    }
    
    /**
     * Get absolute DMX channel from relative
     */
    getAbsoluteChannel(relativeChannel) {
        return this.startAddress + relativeChannel - 1;
    }
    
    /**
     * Set a channel by name with value or mode
     */
    setChannel(channelName, valueOrMode, intensity = 50) {
        const channelDef = this.channelMap.get(channelName);
        
        if (!channelDef) {
            this.logger.warn(`Unknown channel: ${channelName}`);
            return false;
        }
        
        let value;
        
        switch (channelDef.type) {
            case 'enum':
                value = this.resolveEnumValue(channelDef, valueOrMode, intensity);
                break;
                
            case 'range':
                if (typeof valueOrMode === 'number') {
                    value = this.clamp(valueOrMode, channelDef.min || 0, channelDef.max || 255);
                } else if (channelDef.patterns && channelDef.patterns[valueOrMode]) {
                    value = channelDef.patterns[valueOrMode];
                } else if (channelDef.special && channelDef.special[valueOrMode]) {
                    value = channelDef.special[valueOrMode];
                } else {
                    this.logger.warn(`Invalid value for range channel ${channelName}: ${valueOrMode}`);
                    return false;
                }
                break;
                
            case 'boolean':
                if (typeof valueOrMode === 'boolean') {
                    value = valueOrMode ? (channelDef.values?.enabled || 1) : (channelDef.values?.disabled || 0);
                } else if (typeof valueOrMode === 'string') {
                    value = valueOrMode.toLowerCase() === 'enabled' ? 
                        (channelDef.values?.enabled || 1) : 
                        (channelDef.values?.disabled || 0);
                } else {
                    value = valueOrMode ? 1 : 0;
                }
                break;
                
            default:
                value = this.clamp(valueOrMode, 0, 255);
        }
        
        this.dmxController.setChannel(channelDef.absoluteChannel, value);
        this.logger.debug(`Set ${channelName} (ch${channelDef.channel}) to ${value}`);
        
        return true;
    }
    
    /**
     * Resolve enum value with optional intensity
     */
    resolveEnumValue(channelDef, mode, intensity = 50) {
        if (!channelDef.values) return 0;
        
        // Direct numeric value
        if (typeof mode === 'number') {
            return this.clamp(mode, 0, 255);
        }
        
        // Look up mode in values
        const modeKey = typeof mode === 'string' ? mode.toLowerCase().replace(/\s+/g, '_') : mode;
        const valueSpec = channelDef.values[modeKey];
        
        if (valueSpec === undefined) {
            this.logger.warn(`Unknown mode '${mode}' for channel ${channelDef.name}`);
            return 0;
        }
        
        // Simple value
        if (typeof valueSpec === 'number') {
            return valueSpec;
        }
        
        // Range value with intensity
        if (typeof valueSpec === 'object' && 'min' in valueSpec && 'max' in valueSpec) {
            const clampedIntensity = this.clamp(intensity, 0, 100);
            return this.mapToRange(clampedIntensity, 0, 100, valueSpec.min, valueSpec.max);
        }
        
        return 0;
    }
    
    /**
     * Set multiple channels at once
     */
    setChannels(updates) {
        const dmxUpdates = {};
        
        for (const [channelName, value] of Object.entries(updates)) {
            const channelDef = this.channelMap.get(channelName);
            
            if (!channelDef) {
                this.logger.warn(`Unknown channel in batch update: ${channelName}`);
                continue;
            }
            
            // Handle different value formats
            let resolvedValue;
            if (typeof value === 'object' && 'value' in value) {
                // Extended format: { value: 50, mode: 'dynamic' }
                this.setChannel(channelName, value.mode || value.value, value.intensity);
                continue;
            } else {
                // Simple value
                this.setChannel(channelName, value);
                continue;
            }
        }
    }
    
    /**
     * Apply a preset
     */
    applyPreset(presetName) {
        if (!this.profile.presets || !this.profile.presets[presetName]) {
            this.logger.warn(`Unknown preset: ${presetName}`);
            return false;
        }
        
        const preset = this.profile.presets[presetName];
        this.logger.info(`Applying preset: ${presetName}`, { description: preset.description });
        
        if (preset.channels) {
            this.setChannels(preset.channels);
        }
        
        return true;
    }
    
    /**
     * Run a macro (animated sequence)
     */
    async runMacro(macroName) {
        if (!this.profile.macros || !this.profile.macros[macroName]) {
            this.logger.warn(`Unknown macro: ${macroName}`);
            return false;
        }
        
        const macro = this.profile.macros[macroName];
        this.logger.info(`Running macro: ${macroName}`, { description: macro.description });
        
        for (const step of macro.steps) {
            if (step.channels) {
                this.setChannels(step.channels);
            }
            
            if (step.duration) {
                await this.delay(step.duration);
            }
        }
        
        return true;
    }
    
    /**
     * Press a button (if button emulation is defined)
     */
    async pressButton(buttonName) {
        if (!this.profile.buttonEmulation || !this.profile.buttonEmulation[buttonName]) {
            this.logger.warn(`No button emulation for: ${buttonName}`);
            return false;
        }
        
        const button = this.profile.buttonEmulation[buttonName];
        const absoluteChannel = this.getAbsoluteChannel(button.channel);
        
        this.logger.info(`Pressing button: ${buttonName}`);
        
        // Press
        this.dmxController.setChannel(absoluteChannel, button.value);
        
        // Hold
        await this.delay(button.duration || 150);
        
        // Release
        this.dmxController.setChannel(absoluteChannel, 0);
        
        return true;
    }
    
    /**
     * Blackout - turn everything off
     */
    blackout() {
        const updates = {};
        for (let i = 0; i < this.channelCount; i++) {
            updates[this.startAddress + i] = 0;
        }
        this.dmxController.setChannels(updates);
        this.logger.info('Blackout applied');
    }
    
    /**
     * Reset to default state
     */
    reset() {
        if (this.profile.presets && this.profile.presets.blackout) {
            this.applyPreset('blackout');
        } else {
            this.blackout();
        }
    }
    
    /**
     * Get current channel values
     */
    getChannelValues() {
        const values = {};
        
        for (const [name, def] of this.channelMap) {
            const dmxValue = this.dmxController.channels[def.absoluteChannel - 1] || 0;
            values[name] = {
                name,
                channel: def.channel,
                value: dmxValue,
                description: def.description
            };
        }
        
        return values;
    }
    
    /**
     * Connect to DMX
     */
    async connect() {
        this.logger.info(`Connecting device: ${this.profile.name}`);
        await this.dmxController.connect();
    }
    
    /**
     * Disconnect from DMX
     */
    async disconnect(sendBlackout = true) {
        this.logger.info(`Disconnecting device: ${this.profile.name}`);
        if (sendBlackout) {
            this.blackout();
        }
        await this.dmxController.disconnect();
    }
    
    /**
     * Check connection status
     */
    isConnected() {
        return this.dmxController.isConnected();
    }
    
    // Utility functions
    
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, Math.round(value)));
    }
    
    mapToRange(value, inMin, inMax, outMin, outMax) {
        if (inMin === inMax) return this.clamp(outMin, outMin, outMax);
        const result = ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
        return this.clamp(result, outMin, outMax);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get list of available channel names
     */
    getChannelNames() {
        return Array.from(this.channelMap.keys());
    }
    
    /**
     * Get list of available presets
     */
    getPresetNames() {
        return this.profile.presets ? Object.keys(this.profile.presets) : [];
    }
    
    /**
     * Get list of available macros
     */
    getMacroNames() {
        return this.profile.macros ? Object.keys(this.profile.macros) : [];
    }
    
    /**
     * Get channel definition
     */
    getChannelDefinition(channelName) {
        return this.channelMap.get(channelName);
    }
    
    /**
     * Validate a value for a channel
     */
    validateChannelValue(channelName, value) {
        const def = this.channelMap.get(channelName);
        if (!def) return { valid: false, error: 'Unknown channel' };
        
        switch (def.type) {
            case 'range':
                const min = def.min || 0;
                const max = def.max || 255;
                if (typeof value !== 'number') {
                    return { valid: false, error: 'Value must be a number' };
                }
                if (value < min || value > max) {
                    return { valid: false, error: `Value must be between ${min} and ${max}` };
                }
                return { valid: true };
                
            case 'enum':
                if (typeof value === 'number') {
                    if (value < 0 || value > 255) {
                        return { valid: false, error: 'Numeric value must be 0-255' };
                    }
                    return { valid: true };
                }
                if (typeof value === 'string') {
                    const key = value.toLowerCase().replace(/\s+/g, '_');
                    if (!def.values || !(key in def.values)) {
                        return { valid: false, error: `Unknown mode: ${value}` };
                    }
                    return { valid: true };
                }
                return { valid: false, error: 'Value must be string or number' };
                
            case 'boolean':
                return { valid: true }; // Booleans are coerced
                
            default:
                return { valid: true };
        }
    }
}

export default ProfileBasedDeviceControl;