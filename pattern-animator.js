/**
 * Pattern Animator System
 * High-level pattern generation and animation layer for DMX lighting control
 * 
 * Architecture:
 * - Vector-based patterns for scalability
 * - Normalized coordinate system (0-1 range)
 * - Frame-based animation with configurable FPS
 * - Device-independent via profile integration
 */

import { EventEmitter } from 'events';
import { DMXLogger, LogLevel } from './dmx-logger.js';

/**
 * Core Pattern Animator class
 * Generates animated patterns and translates them to DMX values
 */
export class PatternAnimator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Core components
        this.dmxController = options.dmxController;
        this.deviceProfile = options.deviceProfile;
        this.frameRate = options.frameRate || 30;
        this.isRunning = false;
        this.animationId = null;
        
        // Pattern management
        this.patterns = new Map();
        this.activePattern = null;
        this.patternState = {};
        
        // Timeline
        this.timeline = new Timeline();
        this.currentTime = 0;
        this.startTime = null;
        
        // Channel mapping
        this.channelMapper = new ChannelMapper(this.deviceProfile);
        
        // Coordinate system (normalized 0-1)
        this.canvas = {
            width: 1.0,
            height: 1.0,
            center: { x: 0.5, y: 0.5 }
        };
        
        // Safety and limits
        this.safety = {
            maxChangeRate: options.maxChangeRate || 10, // Max DMX value change per frame
            minFrameTime: 1000 / 60, // Cap at 60fps for safety
            emergencyStop: false
        };
        
        // Conflict resolution
        this.priority = options.priority || 50; // Animation priority level
        this.exclusiveMode = options.exclusiveMode || false;
        
        // Logger
        this.logger = new DMXLogger({
            moduleName: 'PatternAnimator',
            minLevel: options.logLevel || LogLevel.INFO
        });
        
        this.logger.info('Pattern Animator initialized', {
            frameRate: this.frameRate,
            profile: this.deviceProfile?.name
        });
    }
    
    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) {
            this.logger.warn('Animation already running');
            return;
        }
        
        this.isRunning = true;
        this.startTime = Date.now();
        this.currentTime = 0;
        
        // Calculate frame interval
        const frameInterval = 1000 / this.frameRate;
        
        // Start animation loop
        this.animate(frameInterval);
        
        this.logger.info('Animation started', { fps: this.frameRate });
        this.emit('start');
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        
        if (this.animationId) {
            clearTimeout(this.animationId);
            this.animationId = null;
        }
        
        this.logger.info('Animation stopped');
        this.emit('stop');
    }
    
    /**
     * Main animation loop
     */
    animate(frameInterval) {
        if (!this.isRunning || this.safety.emergencyStop) {
            return;
        }
        
        const frameStart = Date.now();
        
        // Update timeline
        this.currentTime = frameStart - this.startTime;
        this.timeline.update(this.currentTime);
        
        // Generate frame
        try {
            const frame = this.generateFrame();
            
            // Map to DMX channels
            const dmxValues = this.channelMapper.map(frame);
            
            // Apply safety limits
            const safeDmxValues = this.applySafetyLimits(dmxValues);
            
            // Send to DMX controller
            this.outputToDMX(safeDmxValues);
            
            // Emit frame event for visualization
            this.emit('frame', {
                time: this.currentTime,
                pattern: frame,
                dmx: safeDmxValues
            });
            
        } catch (error) {
            this.logger.error('Animation frame error', { error: error.message });
            this.emit('error', error);
        }
        
        // Calculate next frame timing
        const frameEnd = Date.now();
        const frameTime = frameEnd - frameStart;
        const nextFrameDelay = Math.max(frameInterval - frameTime, this.safety.minFrameTime);
        
        // Schedule next frame
        this.animationId = setTimeout(() => this.animate(frameInterval), nextFrameDelay);
    }
    
    /**
     * Generate the current frame based on active pattern
     */
    generateFrame() {
        if (!this.activePattern) {
            return this.getDefaultFrame();
        }
        
        // Get pattern generator
        const pattern = this.patterns.get(this.activePattern);
        if (!pattern) {
            this.logger.warn(`Pattern ${this.activePattern} not found`);
            return this.getDefaultFrame();
        }
        
        // Generate pattern frame
        const frame = pattern.generate(this.currentTime, this.patternState);
        
        // Apply transformations
        if (this.patternState.transform) {
            frame.position = this.applyTransform(frame.position, this.patternState.transform);
        }
        
        // Apply effects
        if (this.patternState.effects) {
            frame.color = this.applyEffects(frame.color, this.patternState.effects);
        }
        
        return frame;
    }
    
    /**
     * Get default frame (blackout)
     */
    getDefaultFrame() {
        return {
            position: { x: 0.5, y: 0.5 },
            color: { r: 0, g: 0, b: 0 },
            intensity: 0,
            size: 0,
            pattern: null
        };
    }
    
    /**
     * Apply transformations to position
     */
    applyTransform(position, transform) {
        let { x, y } = position;
        
        // Scale
        if (transform.scale) {
            x = 0.5 + (x - 0.5) * transform.scale;
            y = 0.5 + (y - 0.5) * transform.scale;
        }
        
        // Rotate around center
        if (transform.rotation) {
            const cos = Math.cos(transform.rotation);
            const sin = Math.sin(transform.rotation);
            const cx = x - 0.5;
            const cy = y - 0.5;
            x = 0.5 + cx * cos - cy * sin;
            y = 0.5 + cx * sin + cy * cos;
        }
        
        // Translate
        if (transform.offset) {
            x += transform.offset.x || 0;
            y += transform.offset.y || 0;
        }
        
        // Clamp to bounds
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        
        return { x, y };
    }
    
    /**
     * Apply effects to color
     */
    applyEffects(color, effects) {
        let { r, g, b } = color;
        
        // Brightness
        if (effects.brightness !== undefined) {
            const factor = effects.brightness;
            r *= factor;
            g *= factor;
            b *= factor;
        }
        
        // Strobe
        if (effects.strobe && effects.strobeRate) {
            const strobePhase = (this.currentTime * effects.strobeRate / 1000) % 1;
            const strobeOn = strobePhase < (effects.strobeDutyCycle || 0.5);
            if (!strobeOn) {
                r = g = b = 0;
            }
        }
        
        // Fade
        if (effects.fade !== undefined) {
            r *= effects.fade;
            g *= effects.fade;
            b *= effects.fade;
        }
        
        // Ensure valid range
        r = Math.max(0, Math.min(255, Math.round(r)));
        g = Math.max(0, Math.min(255, Math.round(g)));
        b = Math.max(0, Math.min(255, Math.round(b)));
        
        return { r, g, b };
    }
    
    /**
     * Apply safety limits to DMX values
     */
    applySafetyLimits(dmxValues) {
        const limited = {};
        
        for (const [channel, value] of Object.entries(dmxValues)) {
            // Rate limiting
            if (this.lastDmxValues && this.lastDmxValues[channel] !== undefined) {
                const lastValue = this.lastDmxValues[channel];
                const change = value - lastValue;
                
                if (Math.abs(change) > this.safety.maxChangeRate) {
                    // Limit the rate of change
                    limited[channel] = lastValue + Math.sign(change) * this.safety.maxChangeRate;
                } else {
                    limited[channel] = value;
                }
            } else {
                limited[channel] = value;
            }
            
            // Ensure valid DMX range
            limited[channel] = Math.max(0, Math.min(255, Math.round(limited[channel])));
        }
        
        this.lastDmxValues = limited;
        return limited;
    }
    
    /**
     * Output frame to DMX controller
     */
    outputToDMX(dmxValues) {
        if (!this.dmxController) {
            this.logger.warn('No DMX controller connected');
            return;
        }
        
        // Check exclusive mode
        if (this.exclusiveMode) {
            // Take full control of specified channels
            this.dmxController.updateChannels(dmxValues);
        } else {
            // Merge with existing values based on priority
            for (const [channel, value] of Object.entries(dmxValues)) {
                this.dmxController.updateChannel(parseInt(channel), value);
            }
        }
    }
    
    /**
     * Load a pattern
     */
    loadPattern(name, pattern) {
        this.patterns.set(name, pattern);
        this.logger.info(`Pattern loaded: ${name}`);
        this.emit('patternLoaded', name);
    }
    
    /**
     * Set active pattern
     */
    setActivePattern(name, state = {}) {
        if (!this.patterns.has(name)) {
            this.logger.error(`Pattern not found: ${name}`);
            return false;
        }
        
        this.activePattern = name;
        this.patternState = state;
        
        this.logger.info(`Active pattern set: ${name}`);
        this.emit('patternChanged', name);
        
        return true;
    }
    
    /**
     * Update pattern state
     */
    updatePatternState(updates) {
        Object.assign(this.patternState, updates);
        this.emit('stateChanged', this.patternState);
    }
    
    /**
     * Emergency stop
     */
    emergencyStop() {
        this.safety.emergencyStop = true;
        this.stop();
        
        // Send blackout
        if (this.dmxController) {
            this.dmxController.blackout();
        }
        
        this.logger.warn('Emergency stop activated');
        this.emit('emergencyStop');
    }
    
    /**
     * Reset emergency stop
     */
    resetEmergencyStop() {
        this.safety.emergencyStop = false;
        this.logger.info('Emergency stop reset');
    }
}

/**
 * Timeline controller for synchronization
 */
export class Timeline extends EventEmitter {
    constructor() {
        super();
        this.tracks = new Map();
        this.cues = [];
        this.currentTime = 0;
        this.isPlaying = false;
    }
    
    update(time) {
        this.currentTime = time;
        
        // Check for cue points
        for (const cue of this.cues) {
            if (!cue.fired && time >= cue.time) {
                cue.fired = true;
                this.emit('cue', cue);
            }
        }
        
        // Update tracks
        for (const [name, track] of this.tracks) {
            track.update(time);
        }
    }
    
    addCue(time, data) {
        this.cues.push({ time, data, fired: false });
        this.cues.sort((a, b) => a.time - b.time);
    }
    
    reset() {
        this.currentTime = 0;
        this.cues.forEach(cue => cue.fired = false);
    }
}

/**
 * Channel mapper - converts pattern data to DMX channels
 */
export class ChannelMapper {
    constructor(deviceProfile) {
        this.profile = deviceProfile;
        this.channelMap = this.buildChannelMap();
    }
    
    buildChannelMap() {
        const map = {};
        
        if (!this.profile || !this.profile.channels) {
            return map;
        }
        
        // Map common pattern channels
        const mappings = {
            'horizontalPosition': ['x', 'xPosition', 'pan'],
            'verticalPosition': ['y', 'yPosition', 'tilt'],
            'colorRed': ['r', 'red'],
            'colorGreen': ['g', 'green'],
            'colorBlue': ['b', 'blue'],
            'intensity': ['brightness', 'dimmer'],
            'size': ['zoom', 'scale'],
            'rotation': ['rotate', 'angle'],
            'pattern': ['gobo', 'shape']
        };
        
        for (const [profileChannel, aliases] of Object.entries(mappings)) {
            for (const channelName of Object.keys(this.profile.channels)) {
                if (channelName === profileChannel || 
                    aliases.some(alias => channelName.toLowerCase().includes(alias))) {
                    map[profileChannel] = this.profile.channels[channelName];
                    break;
                }
            }
        }
        
        return map;
    }
    
    map(frame) {
        const dmxValues = {};
        
        // Map position (0-1 to 0-255)
        if (frame.position) {
            if (this.channelMap.horizontalPosition) {
                const ch = this.channelMap.horizontalPosition.channel;
                dmxValues[ch] = Math.round(frame.position.x * 255);
            }
            if (this.channelMap.verticalPosition) {
                const ch = this.channelMap.verticalPosition.channel;
                dmxValues[ch] = Math.round(frame.position.y * 255);
            }
        }
        
        // Map color
        if (frame.color) {
            if (this.channelMap.colorRed) {
                dmxValues[this.channelMap.colorRed.channel] = frame.color.r;
            }
            if (this.channelMap.colorGreen) {
                dmxValues[this.channelMap.colorGreen.channel] = frame.color.g;
            }
            if (this.channelMap.colorBlue) {
                dmxValues[this.channelMap.colorBlue.channel] = frame.color.b;
            }
        }
        
        // Map intensity
        if (frame.intensity !== undefined && this.channelMap.intensity) {
            dmxValues[this.channelMap.intensity.channel] = Math.round(frame.intensity * 255);
        }
        
        // Map size/zoom
        if (frame.size !== undefined && this.channelMap.size) {
            dmxValues[this.channelMap.size.channel] = Math.round(frame.size * 255);
        }
        
        // Map rotation
        if (frame.rotation !== undefined && this.channelMap.rotation) {
            // Convert radians to DMX value (0-2π to 0-255)
            const normalizedRotation = (frame.rotation % (2 * Math.PI)) / (2 * Math.PI);
            dmxValues[this.channelMap.rotation.channel] = Math.round(normalizedRotation * 255);
        }
        
        return dmxValues;
    }
}

export default PatternAnimator;