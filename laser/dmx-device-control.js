/**
 * Refactored Device Control with Dynamic Profile Support
 * Data-driven approach for flexible device management
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { DMXLogger, LogLevel } from './dmx-logger.js';
import { ConfigurationError, ChannelRangeError } from './dmx-errors.js';

/**
 * Device Profile Manager
 * Loads, validates, and manages device profiles
 */
export class DeviceProfileManager {
    constructor(options = {}) {
        this.profilesDir = options.profilesDir || './device-profiles';
        this.logger = new DMXLogger({
            moduleName: 'ProfileManager',
            minLevel: options.logLevel || LogLevel.INFO
        });
        this.profiles = new Map();
        this.currentProfile = null;
    }
    
    /**
     * Load a device profile from JSON file
     */
    async loadProfile(profilePath) {
        try {
            const fullPath = path.isAbsolute(profilePath) 
                ? profilePath 
                : path.join(this.profilesDir, profilePath);
                
            const content = await fs.readFile(fullPath, 'utf8');
            const profile = JSON.parse(content);
            
            // Validate profile structure
            this.validateProfile(profile);
            
            // Store profile
            const profileId = profile.id || path.basename(fullPath, '.json');
            this.profiles.set(profileId, profile);
            
            this.logger.info(`Loaded profile: ${profile.name}`, { id: profileId });
            return profile;
            
        } catch (error) {
            this.logger.error(`Failed to load profile: ${profilePath}`, { error: error.message });
            throw new ConfigurationError(
                `Cannot load device profile: ${error.message}`,
                'profilePath',
                'valid JSON file',
                profilePath
            );
        }
    }
    
    /**
     * Validate profile structure
     */
    validateProfile(profile) {
        const required = ['name', 'channelCount', 'channels'];
        
        for (const field of required) {
            if (!profile[field]) {
                throw new ConfigurationError(
                    `Profile missing required field: ${field}`,
                    field,
                    'defined',
                    undefined
                );
            }
        }
        
        // Validate channels
        for (const [name, def] of Object.entries(profile.channels)) {
            if (!def.channel || typeof def.channel !== 'number') {
                throw new ConfigurationError(
                    `Invalid channel definition for ${name}`,
                    `channels.${name}.channel`,
                    'number',
                    def.channel
                );
            }
            
            if (def.channel < 1 || def.channel > 512) {
                throw new ChannelRangeError(def.channel);
            }
            
            // Validate type-specific properties
            if (def.type === 'enum' && !def.values) {
                throw new ConfigurationError(
                    `Enum channel ${name} missing values`,
                    `channels.${name}.values`,
                    'object',
                    undefined
                );
            }
            
            if (def.type === 'range') {
                if (def.min === undefined) def.min = 0;
                if (def.max === undefined) def.max = 255;
            }
        }
        
        this.logger.debug('Profile validation passed', { name: profile.name });
    }
    
    /**
     * Get profile by ID
     */
    getProfile(profileId) {
        return this.profiles.get(profileId);
    }
    
    /**
     * Load all profiles from the profiles directory
     */
    async loadAllProfiles() {
        try {
            const files = await fs.readdir(this.profilesDir);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        await this.loadProfile(file);
                    } catch (e) {
                        this.logger.warn(`Skipping invalid profile: ${file}`);
                    }
                }
            }
            
            this.logger.info(`Loaded ${this.profiles.size} profiles`);
            return this.profiles;
        } catch (error) {
            this.logger.error('Failed to load profiles', { error: error.message });
            return this.profiles;
        }
    }
    
    /**
     * List available profiles
     */
    async listAvailableProfiles() {
        try {
            const files = await fs.readdir(this.profilesDir);
            const profiles = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const profile = await this.loadProfile(file);
                        profiles.push({
                            id: path.basename(file, '.json'),
                            name: profile.name,
                            manufacturer: profile.manufacturer,
                            channelCount: profile.channelCount
                        });
                    } catch (e) {
                        this.logger.warn(`Skipping invalid profile: ${file}`);
                    }
                }
            }
            
            return profiles;
        } catch (error) {
            this.logger.error('Failed to list profiles', { error: error.message });
            return [];
        }
    }
    
    /**
     * Create a profile from discovered patterns
     */
    createProfileFromDiscovery(discoveryData) {
        const profile = {
            id: `custom-${Date.now()}`,
            name: discoveryData.deviceName || 'Custom Device',
            manufacturer: discoveryData.manufacturer || 'Unknown',
            channelCount: discoveryData.channelCount || 32,
            discoveredAt: new Date().toISOString(),
            channels: {},
            patterns: {},
            presets: {}
        };
        
        // Build channel definitions from discovery
        if (discoveryData.channels) {
            for (const [name, info] of Object.entries(discoveryData.channels)) {
                profile.channels[name] = {
                    channel: info.channel,
                    type: info.type || 'range',
                    min: info.min || 0,
                    max: info.max || 255,
                    description: info.description
                };
            }
        }
        
        // Add discovered patterns
        if (discoveryData.patterns) {
            for (const [value, name] of Object.entries(discoveryData.patterns)) {
                profile.patterns[name] = {
                    value: parseInt(value),
                    category: 'discovered',
                    discoveredBy: discoveryData.discoveredBy || 'user'
                };
            }
        }
        
        // Generate basic presets
        profile.presets = {
            blackout: {
                description: 'All off',
                channels: {}
            },
            test: {
                description: 'Basic test pattern',
                channels: {}
            }
        };
        
        // Set blackout values
        for (const [name, def] of Object.entries(profile.channels)) {
            if (def.type === 'range' || !def.type) {
                profile.presets.blackout.channels[name] = def.min || 0;
            }
        }
        
        this.profiles.set(profile.id, profile);
        return profile;
    }
    
    /**
     * Save profile to file
     */
    async saveProfile(profileId, filename = null) {
        const profile = this.profiles.get(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }
        
        const file = filename || `${profileId}.json`;
        const fullPath = path.join(this.profilesDir, file);
        
        await fs.mkdir(this.profilesDir, { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(profile, null, 2));
        
        this.logger.info(`Saved profile to: ${fullPath}`);
        return fullPath;
    }
}

/**
 * Dynamic Device Control
 * Uses profiles for flexible device management
 */
export class DynamicDeviceControl extends EventEmitter {
    constructor(options) {
        super();
        
        if (!options.dmxController) {
            throw new Error('DynamicDeviceControl requires dmxController');
        }
        
        this.dmxController = options.dmxController;
        this.profileManager = options.profileManager || new DeviceProfileManager();
        this.profile = null;
        this.startAddress = options.startAddress || 1;
        this.channelValues = new Map();
        
        this.logger = new DMXLogger({
            moduleName: 'DeviceControl',
            minLevel: options.logLevel || LogLevel.INFO
        });
        
        // Forward controller events
        this.dmxController.on('connect', () => this.emit('connect'));
        this.dmxController.on('disconnect', () => this.emit('disconnect'));
        this.dmxController.on('error', (err) => this.emit('error', err));
    }
    
    /**
     * Load and activate a device profile
     */
    async loadProfile(profileId) {
        try {
            // Try to get from manager first
            let profile = this.profileManager.getProfile(profileId);
            
            // If not loaded, try to load it
            if (!profile) {
                profile = await this.profileManager.loadProfile(profileId);
            }
            
            this.profile = profile;
            this.logger.info(`Activated profile: ${profile.name}`);
            
            // Initialize channel values
            this.initializeChannels();
            
            return profile;
            
        } catch (error) {
            this.logger.error(`Failed to load profile: ${profileId}`, { error: error.message });
            throw error;
        }
    }
    
    /**
     * Initialize channel values from profile
     */
    initializeChannels() {
        if (!this.profile) return;
        
        this.channelValues.clear();
        
        for (const [name, def] of Object.entries(this.profile.channels)) {
            const defaultValue = def.default || def.min || 0;
            this.channelValues.set(name, defaultValue);
        }
    }
    
    /**
     * Set a named channel value
     */
    setChannelByName(channelName, value) {
        if (!this.profile) {
            throw new Error('No profile loaded');
        }

        const channelDef = this.profile.channels[channelName];
        if (!channelDef) {
            throw new ConfigurationError(
                `Channel not found in profile: ${channelName}`,
                'channelName',
                'valid channel name',
                channelName
            );
        }

        // Validate value based on type
        const validatedValue = this.validateChannelValue(channelDef, value);

        // Calculate actual DMX channel
        const dmxChannel = this.startAddress + channelDef.channel - 1;

        // Set in controller
        this.dmxController.setChannel(dmxChannel, validatedValue);

        this.logger.info(`Sending to ${channelName}: value=${validatedValue}, dmx_channel=${dmxChannel}`);

        // Store in local map
        this.channelValues.set(channelName, validatedValue);

        this.logger.debug(`Set ${channelName} to ${validatedValue}`, {
            dmxChannel,
            definition: channelDef
        });

        return validatedValue;
    }

    /**
     * Set multiple channels at once
     */
    async setChannels(channels) {
        if (!this.profile) {
            throw new Error('No profile loaded');
        }

        const results = {};
        for (const [channelName, value] of Object.entries(channels)) {
            try {
                results[channelName] = this.setChannelByName(channelName, value);
            } catch (error) {
                this.logger.warn(`Failed to set ${channelName}`, { error: error.message });
                results[channelName] = null;
            }
        }

        return results;
    }
    
    /**
     * Validate channel value based on definition
     */
    validateChannelValue(channelDef, value) {
        if (channelDef.type === 'enum') {
            // For enums, accept both key names and direct values
            if (typeof value === 'string' && channelDef.values[value] !== undefined) {
                const enumEntry = channelDef.values[value];
                return typeof enumEntry === 'object' ? enumEntry.min : enumEntry;
            }
            
            // Check if the numeric value is valid
            for (const key in channelDef.values) {
                const enumEntry = channelDef.values[key];
                if (typeof enumEntry === 'object') {
                    if (value >= enumEntry.min && value <= enumEntry.max) {
                        return value; // Value is within a valid range
                    }
                } else if (value === enumEntry) {
                    return value; // Value is a direct match
                }
            }

            this.logger.warn(`Invalid enum value: ${value}`, {
                valid: Object.keys(channelDef.values)
            });
            const firstKey = Object.keys(channelDef.values)[0];
            const fallback = channelDef.values[firstKey];
            return typeof fallback === 'object' ? fallback.min : fallback;
            
        } else if (channelDef.type === 'range' || !channelDef.type) {
            // Clamp to range
            const min = channelDef.min || 0;
            const max = channelDef.max || 255;
            
            if (value < min) return min;
            if (value > max) return max;
            return Math.round(value);
            
        } else if (channelDef.type === 'boolean') {
            return value ? (channelDef.onValue || 255) : (channelDef.offValue || 0);
        }
        
        return value;
    }
    
    /**
     * Get current value of a named channel
     */
    getChannelByName(channelName) {
        return this.channelValues.get(channelName);
    }
    
    /**
     * Apply a preset
     */
    async applyPreset(presetName) {
        if (!this.profile) {
            throw new Error('No profile loaded');
        }
        
        const preset = this.profile.presets?.[presetName];
        if (!preset) {
            throw new ConfigurationError(
                `Preset not found: ${presetName}`,
                'presetName',
                'valid preset',
                presetName
            );
        }
        
        this.logger.info(`Applying preset: ${presetName}`, {
            description: preset.description
        });
        
        // Apply all channel values from preset
        for (const [channelName, value] of Object.entries(preset.channels)) {
            try {
                this.setChannelByName(channelName, value);
            } catch (error) {
                this.logger.warn(`Failed to set ${channelName} in preset`, {
                    error: error.message
                });
            }
        }
        
        this.emit('presetApplied', presetName);
    }
    
    /**
     * Set pattern by name
     */
    setPattern(patternName, patternChannel = 'pattern1') {
        if (!this.profile) {
            throw new Error('No profile loaded');
        }
        
        const pattern = this.profile.patterns?.[patternName];
        if (!pattern) {
            this.logger.warn(`Pattern not found: ${patternName}`);
            return false;
        }
        
        return this.setChannelByName(patternChannel, pattern.value);
    }
    
    /**
     * Convenience methods for common operations
     */
    async blackout() {
        if (this.profile?.presets?.blackout) {
            await this.applyPreset('blackout');
        } else {
            // Fallback: set all channels to minimum
            for (const [name, def] of Object.entries(this.profile?.channels || {})) {
                this.setChannelByName(name, def.min || 0);
            }
        }
    }
    
    setColor(r, g, b, prefix = 'color') {
        this.setChannelByName(`${prefix}Red`, r);
        this.setChannelByName(`${prefix}Green`, g);
        this.setChannelByName(`${prefix}Blue`, b);
    }
    
    setPosition(x, y, prefix = '') {
        this.setChannelByName(`${prefix}horizontalMove`, x);
        this.setChannelByName(`${prefix}verticalMove`, y);
    }
    
    /**
     * Get device state summary
     */
    getState() {
        const state = {
            profile: this.profile?.name,
            startAddress: this.startAddress,
            channels: Object.fromEntries(this.channelValues),
            activePattern: null,
            activePreset: null
        };
        
        // Try to determine active pattern
        if (this.profile?.patterns) {
            const patternValue = this.channelValues.get('pattern1');
            for (const [name, def] of Object.entries(this.profile.patterns)) {
                if (def.value === patternValue) {
                    state.activePattern = name;
                    break;
                }
            }
        }
        
        return state;
    }
    
    /**
     * Connect to DMX controller
     */
    async connect() {
        await this.dmxController.connect();
        
        // Apply blackout on connect for safety
        if (this.profile) {
            await this.blackout();
        }
    }
    
    /**
     * Disconnect from DMX controller
     */
    async disconnect() {
        // Blackout before disconnect
        if (this.profile) {
            await this.blackout();
        }
        
        await this.dmxController.disconnect();
    }
}

/**
 * Profile Builder for Discovery Mode
 */
export class ProfileBuilder {
    constructor() {
        this.profile = {
            id: null,
            name: 'Discovered Device',
            manufacturer: 'Unknown',
            channelCount: 32,
            channels: {},
            patterns: {},
            presets: {},
            metadata: {
                createdAt: new Date().toISOString(),
                createdBy: 'DMX Discovery Tool',
                version: '1.0.0'
            }
        };
        
        this.logger = new DMXLogger({
            moduleName: 'ProfileBuilder',
            minLevel: LogLevel.INFO
        });
    }
    
    setBasicInfo(name, manufacturer, channelCount) {
        this.profile.name = name;
        this.profile.manufacturer = manufacturer;
        this.profile.channelCount = channelCount;
    }
    
    addChannel(name, channel, type = 'range', options = {}) {
        this.profile.channels[name] = {
            channel,
            type,
            ...options
        };
        
        this.logger.debug(`Added channel: ${name}`, { channel, type });
    }
    
    addPattern(name, value, category = 'discovered') {
        this.profile.patterns[name] = {
            value,
            category,
            discoveredAt: new Date().toISOString()
        };
        
        this.logger.debug(`Added pattern: ${name}`, { value, category });
    }
    
    addPreset(name, description, channels) {
        this.profile.presets[name] = {
            description,
            channels
        };
        
        this.logger.debug(`Added preset: ${name}`);
    }
    
    generateStandardChannels() {
        // Add common channel definitions
        const standardChannels = [
            { name: 'mode', channel: 1, type: 'enum', values: { off: 0, auto: 50, sound: 100, dmx: 200 } },
            { name: 'pattern1', channel: 2, type: 'range', min: 0, max: 255 },
            { name: 'patternSize1', channel: 3, type: 'range', min: 0, max: 255 },
            { name: 'patternRotation1', channel: 4, type: 'range', min: 0, max: 255 },
            { name: 'horizontalMove1', channel: 5, type: 'range', min: 0, max: 255, center: 128 },
            { name: 'verticalMove1', channel: 6, type: 'range', min: 0, max: 255, center: 128 },
            { name: 'zoom1', channel: 7, type: 'range', min: 0, max: 255 },
            { name: 'colorRed1', channel: 8, type: 'range', min: 0, max: 255 },
            { name: 'colorGreen1', channel: 9, type: 'range', min: 0, max: 255 },
            { name: 'colorBlue1', channel: 10, type: 'range', min: 0, max: 255 }
        ];
        
        for (const ch of standardChannels) {
            this.addChannel(ch.name, ch.channel, ch.type, ch);
        }
    }
    
    build() {
        this.profile.id = `${this.profile.manufacturer.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        return this.profile;
    }
    
    async save(filename) {
        const profileManager = new DeviceProfileManager();
        const profile = this.build();
        profileManager.profiles.set(profile.id, profile);
        return await profileManager.saveProfile(profile.id, filename);
    }
}

// Export everything
export default {
    DeviceProfileManager,
    DynamicDeviceControl,
    ProfileBuilder
};