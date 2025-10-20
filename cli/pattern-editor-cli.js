#!/usr/bin/env node
/**
 * Pattern Editor CLI
 * Interactive parametric editor for pattern creation and animation
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { PatternAnimator } from '../laser/pattern-animator.js';
import { PatternFactory } from '../patterns/geometric-patterns.js';
import { DMXController } from '../laser/dmx.js';
import { DeviceProfileManager } from '../laser/dmx-device-control.js';
import { DMXLogger, LogLevel } from '../laser/dmx-logger.js';
import fs from 'fs/promises';
import path from 'path';

class PatternEditorCLI {
    constructor() {
        this.screen = null;
        this.grid = null;
        this.widgets = {};
        this.animator = null;
        this.currentPattern = null;
        this.currentPatternType = 'circle';
        this.parameters = {};
        this.isAnimating = false;
        
        this.logger = new DMXLogger({
            moduleName: 'PatternEditor',
            minLevel: LogLevel.INFO
        });
        
        // Pattern library
        this.patternLibrary = new Map();
        this.loadedProfile = null;
    }
    
    /**
     * Initialize the UI
     */
    async init() {
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'DMX Pattern Editor',
            fullUnicode: true
        });
        
        // Create grid layout
        this.grid = new contrib.grid({
            rows: 12,
            cols: 12,
            screen: this.screen
        });
        
        // Build UI components
        this.buildUI();
        
        // Setup key handlers
        this.setupKeyHandlers();
        
        // Load device profile
        await this.loadDeviceProfile();
        
        // Initialize pattern animator
        await this.initializeAnimator();
        
        // Load initial pattern
        this.loadPattern('circle');
        
        // Start render loop
        this.render();
    }
    
    /**
     * Build UI components
     */
    buildUI() {
        // Pattern Canvas (left side)
        this.widgets.canvas = this.grid.set(0, 0, 8, 6, contrib.canvas, {
            label: ' Pattern Preview ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' }
            }
        });
        
        // Pattern Selector (top right)
        this.widgets.patternList = this.grid.set(0, 6, 2, 3, blessed.list, {
            label: ' Patterns ',
            border: { type: 'line' },
            style: {
                border: { fg: 'green' },
                selected: { bg: 'green', fg: 'black' }
            },
            keys: true,
            mouse: true,
            items: PatternFactory.getAvailablePatterns()
        });
        
        // Parameter Controls (middle right)
        this.widgets.parameters = this.grid.set(2, 6, 4, 3, blessed.form, {
            label: ' Parameters ',
            border: { type: 'line' },
            style: {
                border: { fg: 'yellow' }
            }
        });
        
        // Create parameter sliders
        this.createParameterControls();
        
        // Pattern State Inspector (middle-bottom right)
        this.widgets.stateInspector = this.grid.set(6, 6, 1, 3, blessed.box, {
            label: ' State Inspector ',
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' }
            },
            content: 'Pattern: none\nPosition: (0.5, 0.5)\nColor: RGB(255,255,255)'
        });
        
        // Effects Panel (bottom right)
        this.widgets.effects = this.grid.set(7, 6, 1, 3, blessed.box, {
            label: ' Effects ',
            border: { type: 'line' },
            style: {
                border: { fg: 'magenta' }
            },
            content: 'Brightness: 100%\nStrobe: OFF'
        });
        
        // Timeline (bottom)
        this.widgets.timeline = this.grid.set(8, 0, 2, 9, contrib.line, {
            label: ' Timeline ',
            border: { type: 'line' },
            style: {
                line: 'yellow',
                text: 'green',
                baseline: 'white'
            },
            xLabelPadding: 3,
            xPadding: 5,
            showLegend: true,
            legend: { width: 12 }
        });
        
        // Status Bar (very bottom)
        this.widgets.status = this.grid.set(10, 0, 2, 9, blessed.box, {
            label: ' Status ',
            border: { type: 'line' },
            style: {
                border: { fg: 'white' }
            },
            content: 'Ready. Press SPACE to start/stop animation'
        });
        
        // Library Panel (far right)
        this.widgets.library = this.grid.set(0, 9, 8, 3, blessed.list, {
            label: ' Library ',
            border: { type: 'line' },
            style: {
                border: { fg: 'blue' },
                selected: { bg: 'blue', fg: 'white' }
            },
            keys: true,
            mouse: true,
            items: ['[New Pattern]', '-- Empty --']
        });
        
        // Control Help (bottom right)
        this.widgets.help = this.grid.set(8, 9, 4, 3, blessed.box, {
            label: ' Controls ',
            border: { type: 'line' },
            style: {
                border: { fg: 'gray' }
            },
            content: 
`SPACE: Start/Stop
S: Save Pattern
L: Load Pattern
P: Select Pattern
1-9: Parameters
R: Reset
B: Blackout
Q: Quit`
        });
    }
    
    /**
     * Create parameter control sliders
     */
    createParameterControls() {
        const params = this.widgets.parameters;
        
        // Speed slider
        this.widgets.speedSlider = blessed.progressbar({
            parent: params,
            top: 1,
            left: 1,
            width: '90%',
            height: 1,
            orientation: 'horizontal',
            style: {
                bar: { bg: 'green' },
                border: { fg: 'gray' }
            },
            filled: 50,
            label: 'Speed'
        });
        
        // Size slider
        this.widgets.sizeSlider = blessed.progressbar({
            parent: params,
            top: 3,
            left: 1,
            width: '90%',
            height: 1,
            orientation: 'horizontal',
            style: {
                bar: { bg: 'blue' },
                border: { fg: 'gray' }
            },
            filled: 30,
            label: 'Size'
        });
        
        // Color controls
        this.widgets.colorBox = blessed.box({
            parent: params,
            top: 5,
            left: 1,
            width: '90%',
            height: 3,
            content: 'R: 255  G: 255  B: 255'
        });
    }
    
    /**
     * Setup keyboard handlers
     */
    setupKeyHandlers() {
        // Quit
        this.screen.key(['q', 'C-c'], () => {
            this.cleanup();
            process.exit(0);
        });
        
        // Start/Stop animation
        this.screen.key('space', () => {
            this.toggleAnimation();
        });
        
        // Save pattern
        this.screen.key('s', () => {
            this.saveCurrentPattern();
        });
        
        // Load pattern
        this.screen.key('l', () => {
            this.showLoadDialog();
        });
        
        // Reset
        this.screen.key('r', () => {
            this.resetPattern();
        });
        
        // Blackout
        this.screen.key('b', () => {
            this.blackout();
        });
        
        // Pattern selection
        this.widgets.patternList.on('select', (item) => {
            const patternType = item.getText();
            this.loadPattern(patternType);
        });
        
        // Parameter adjustments
        this.screen.key(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (ch) => {
            this.adjustParameter(parseInt(ch));
        });
        
        // Arrow keys for fine control
        this.screen.key(['up', 'down', 'left', 'right'], (ch, key) => {
            this.adjustWithArrows(key.name);
        });
    }
    
    /**
     * Load device profile
     */
    async loadDeviceProfile() {
        try {
            const profileManager = new DeviceProfileManager({
                profilesDir: './device-profiles'
            });
            
            // Try to load generic profile
            this.loadedProfile = await profileManager.loadProfile('generic-laser.json');
            this.updateStatus(`Profile loaded: ${this.loadedProfile.name}`);
        } catch (error) {
            this.logger.warn('Could not load profile, using defaults');
            this.loadedProfile = {
                name: 'Default',
                channels: {}
            };
        }
    }
    
    /**
     * Initialize pattern animator
     */
    async initializeAnimator() {
        // For now, create a mock DMX controller
        // In production, this would connect to real hardware
        const dmxController = {
            setChannel: (ch, val) => {
                // Mock implementation
                this.logger.debug(`DMX Ch${ch}: ${val}`);
            },
            setChannels: (values) => {
                // Mock implementation
                this.logger.debug('DMX Update', values);
            },
            blackout: () => {
                this.logger.info('Blackout sent');
            }
        };
        
        this.animator = new PatternAnimator({
            dmxController,
            deviceProfile: this.loadedProfile,
            frameRate: 30
        });
        
        // Listen to frame events for visualization
        this.animator.on('frame', (data) => {
            this.visualizeFrame(data);
        });
    }
    
    /**
     * Load a pattern type
     */
    loadPattern(type) {
        try {
            this.currentPatternType = type;
            this.currentPattern = PatternFactory.create(type);
            
            // Load pattern into animator
            this.animator.loadPattern(type, this.currentPattern);
            this.animator.setActivePattern(type);
            
            // Update UI
            this.updateStatus(`Pattern loaded: ${type}`);
            this.updateParameterDisplay();
            
        } catch (error) {
            this.updateStatus(`Error loading pattern: ${error.message}`);
        }
    }
    
    /**
     * Toggle animation
     */
    toggleAnimation() {
        if (this.isAnimating) {
            this.animator.stop();
            this.isAnimating = false;
            this.updateStatus('Animation stopped');
        } else {
            this.animator.start();
            this.isAnimating = true;
            this.updateStatus('Animation running');
        }
    }
    
    /**
     * Visualize frame on canvas
     */
    visualizeFrame(frameData) {
        const ctx = this.widgets.canvas.context;
        const width = this.widgets.canvas.width;
        const height = this.widgets.canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw grid (0.1 increments)
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 10; i++) {
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(i * width / 10, 0);
            ctx.lineTo(i * width / 10, height);
            ctx.stroke();
            
            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(0, i * height / 10);
            ctx.lineTo(width, i * height / 10);
            ctx.stroke();
        }
        
        // Draw center crosshair
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        // Vertical center
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();
        // Horizontal center
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        // Draw border
        ctx.strokeStyle = '#888888';
        ctx.strokeRect(0, 0, width - 1, height - 1);
        
        // Draw pattern position
        if (frameData.pattern && frameData.pattern.position) {
            const x = frameData.pattern.position.x * width;
            const y = frameData.pattern.position.y * height;
            
            // Draw point
            ctx.fillStyle = this.rgbToHex(frameData.pattern.color || { r: 255, g: 255, b: 255 });
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw trail
            if (this.trail) {
                this.trail.push({ x, y });
                if (this.trail.length > 30) {
                    this.trail.shift();
                }
                
                ctx.strokeStyle = this.rgbToHex(frameData.pattern.color || { r: 255, g: 255, b: 255 });
                ctx.beginPath();
                this.trail.forEach((point, i) => {
                    if (i === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                });
                ctx.stroke();
            }
        }
        
        // Update timeline
        this.updateTimeline(frameData.time);
        
        // Update state inspector
        this.updateStateInspector(frameData);
    }
    
    /**
     * Update state inspector with current frame data
     */
    updateStateInspector(frameData) {
        if (!frameData || !frameData.pattern) {
            return;
        }
        
        const pattern = frameData.pattern;
        const state = this.animator.patternState || {};
        const dmx = frameData.dmx || {};
        
        // Build state display
        let content = [];
        
        // Pattern info
        content.push(`Pattern: ${this.currentPatternType || 'none'}`);
        content.push(`Time: ${(frameData.time / 1000).toFixed(2)}s`);
        
        // Position
        if (pattern.position) {
            content.push(`Position: (${pattern.position.x.toFixed(3)}, ${pattern.position.y.toFixed(3)})`);
        }
        
        // Color
        if (pattern.color) {
            const { r, g, b } = pattern.color;
            content.push(`Color: RGB(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
        }
        
        // Intensity
        if (pattern.intensity !== undefined) {
            content.push(`Intensity: ${(pattern.intensity * 100).toFixed(0)}%`);
        }
        
        // Size
        if (pattern.size !== undefined) {
            content.push(`Size: ${pattern.size.toFixed(3)}`);
        }
        
        // Transform state
        if (state.transform) {
            const t = state.transform;
            if (t.offset) {
                content.push(`Offset: (${t.offset.x.toFixed(2)}, ${t.offset.y.toFixed(2)})`);
            }
            if (t.rotation) {
                content.push(`Rotation: ${(t.rotation * 180 / Math.PI).toFixed(1)}°`);
            }
            if (t.scale) {
                content.push(`Scale: ${t.scale.toFixed(2)}x`);
            }
        }
        
        // Speed
        if (state.speed !== undefined) {
            content.push(`Speed: ${state.speed.toFixed(2)}x`);
        }
        
        // DMX channels (show first few)
        const dmxChannels = Object.entries(dmx).slice(0, 3);
        if (dmxChannels.length > 0) {
            content.push('---');
            content.push('DMX Output:');
            for (const [ch, val] of dmxChannels) {
                content.push(`  Ch${ch}: ${val}`);
            }
            if (Object.keys(dmx).length > 3) {
                content.push(`  ...${Object.keys(dmx).length - 3} more`);
            }
        }
        
        // Update widget
        this.widgets.stateInspector.setContent(content.join('\n'));
    }
    
    /**
     * Update timeline display
     */
    updateTimeline(time) {
        if (!this.timelineData) {
            this.timelineData = {
                title: 'Animation',
                x: [],
                y: []
            };
        }
        
        // Add new data point
        this.timelineData.x.push(time / 1000);
        this.timelineData.y.push(Math.sin(time / 1000) * 50 + 50);
        
        // Keep only last 100 points
        if (this.timelineData.x.length > 100) {
            this.timelineData.x.shift();
            this.timelineData.y.shift();
        }
        
        // Update line chart
        this.widgets.timeline.setData([this.timelineData]);
    }
    
    /**
     * Adjust parameter with number key
     */
    adjustParameter(num) {
        switch (num) {
            case 1: // Speed down
                this.adjustSpeed(-10);
                break;
            case 2: // Speed up
                this.adjustSpeed(10);
                break;
            case 3: // Size down
                this.adjustSize(-10);
                break;
            case 4: // Size up
                this.adjustSize(10);
                break;
            case 5: // Red
                this.setColor(255, 0, 0);
                break;
            case 6: // Green
                this.setColor(0, 255, 0);
                break;
            case 7: // Blue
                this.setColor(0, 0, 255);
                break;
            case 8: // White
                this.setColor(255, 255, 255);
                break;
            case 9: // Random color
                this.setColor(
                    Math.floor(Math.random() * 256),
                    Math.floor(Math.random() * 256),
                    Math.floor(Math.random() * 256)
                );
                break;
        }
    }
    
    /**
     * Adjust with arrow keys
     */
    adjustWithArrows(direction) {
        const state = this.animator.patternState || {};
        
        switch (direction) {
            case 'up':
                state.transform = state.transform || {};
                state.transform.offset = state.transform.offset || { x: 0, y: 0 };
                state.transform.offset.y -= 0.05;
                break;
            case 'down':
                state.transform = state.transform || {};
                state.transform.offset = state.transform.offset || { x: 0, y: 0 };
                state.transform.offset.y += 0.05;
                break;
            case 'left':
                state.transform = state.transform || {};
                state.transform.offset = state.transform.offset || { x: 0, y: 0 };
                state.transform.offset.x -= 0.05;
                break;
            case 'right':
                state.transform = state.transform || {};
                state.transform.offset = state.transform.offset || { x: 0, y: 0 };
                state.transform.offset.x += 0.05;
                break;
        }
        
        this.animator.updatePatternState(state);
        this.updateParameterDisplay();
    }
    
    /**
     * Adjust speed
     */
    adjustSpeed(delta) {
        const current = this.parameters.speed || 50;
        const newSpeed = Math.max(0, Math.min(100, current + delta));
        this.parameters.speed = newSpeed;
        
        this.widgets.speedSlider.setProgress(newSpeed);
        
        // Update animator
        const state = this.animator.patternState || {};
        state.speed = newSpeed / 50; // Normalize to 0-2 range
        this.animator.updatePatternState(state);
    }
    
    /**
     * Adjust size
     */
    adjustSize(delta) {
        const current = this.parameters.size || 30;
        const newSize = Math.max(0, Math.min(100, current + delta));
        this.parameters.size = newSize;
        
        this.widgets.sizeSlider.setProgress(newSize);
        
        // Update animator
        const state = this.animator.patternState || {};
        state.radius = newSize / 200; // Normalize to 0-0.5 range
        state.size = newSize / 200;
        this.animator.updatePatternState(state);
    }
    
    /**
     * Set color
     */
    setColor(r, g, b) {
        this.parameters.color = { r, g, b };
        
        this.widgets.colorBox.setContent(`R: ${r}  G: ${g}  B: ${b}`);
        
        // Update animator
        const state = this.animator.patternState || {};
        state.color = { r, g, b };
        this.animator.updatePatternState(state);
    }
    
    /**
     * Update parameter display
     */
    updateParameterDisplay() {
        // Update sliders and displays based on current state
        this.screen.render();
    }
    
    /**
     * Save current pattern
     */
    async saveCurrentPattern() {
        const name = `pattern_${Date.now()}.json`;
        const data = {
            type: this.currentPatternType,
            parameters: this.parameters,
            state: this.animator.patternState,
            timestamp: new Date().toISOString()
        };
        
        try {
            await fs.writeFile(
                path.join('./patterns/saved', name),
                JSON.stringify(data, null, 2)
            );
            
            this.updateStatus(`Pattern saved: ${name}`);
            this.updateLibrary();
        } catch (error) {
            this.updateStatus(`Save failed: ${error.message}`);
        }
    }
    
    /**
     * Show load dialog
     */
    async showLoadDialog() {
        try {
            // Get list of saved patterns
            const files = await fs.readdir('./patterns/saved').catch(() => []);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            if (jsonFiles.length === 0) {
                this.updateStatus('No saved patterns found');
                return;
            }
            
            // Create a selection dialog
            const dialog = blessed.list({
                parent: this.screen,
                label: ' Load Pattern ',
                border: { type: 'line' },
                style: {
                    border: { fg: 'cyan' },
                    selected: { bg: 'cyan', fg: 'black' }
                },
                width: '50%',
                height: '50%',
                top: 'center',
                left: 'center',
                keys: true,
                mouse: true,
                items: [...jsonFiles, '[Cancel]']
            });
            
            dialog.on('select', async (item) => {
                const filename = item.getText();
                dialog.destroy();
                this.screen.render();
                
                if (filename === '[Cancel]') {
                    this.updateStatus('Load cancelled');
                    return;
                }
                
                await this.loadPatternFile(filename);
            });
            
            // ESC to cancel
            dialog.key('escape', () => {
                dialog.destroy();
                this.screen.render();
                this.updateStatus('Load cancelled');
            });
            
            dialog.focus();
            this.screen.render();
            
        } catch (error) {
            this.updateStatus(`Load error: ${error.message}`);
        }
    }
    
    /**
     * Load a pattern from file
     */
    async loadPatternFile(filename) {
        try {
            const filepath = path.join('./patterns/saved', filename);
            const content = await fs.readFile(filepath, 'utf8');
            const data = JSON.parse(content);
            
            // Load the pattern type
            this.loadPattern(data.type);
            
            // Apply saved parameters
            if (data.parameters) {
                this.parameters = data.parameters;
                
                // Update UI controls
                if (data.parameters.speed !== undefined) {
                    this.widgets.speedSlider.setProgress(data.parameters.speed);
                }
                if (data.parameters.size !== undefined) {
                    this.widgets.sizeSlider.setProgress(data.parameters.size);
                }
                if (data.parameters.color) {
                    const { r, g, b } = data.parameters.color;
                    this.widgets.colorBox.setContent(`R: ${r}  G: ${g}  B: ${b}`);
                }
            }
            
            // Apply saved state
            if (data.state) {
                this.animator.updatePatternState(data.state);
            }
            
            this.updateStatus(`Loaded: ${filename}`);
            this.screen.render();
            
        } catch (error) {
            this.updateStatus(`Failed to load ${filename}: ${error.message}`);
        }
    }
    
    /**
     * Reset pattern
     */
    resetPattern() {
        this.parameters = {};
        this.animator.patternState = {};
        this.trail = [];
        
        this.adjustSpeed(0);
        this.adjustSize(0);
        this.setColor(255, 255, 255);
        
        this.updateStatus('Pattern reset');
    }
    
    /**
     * Blackout
     */
    blackout() {
        if (this.animator) {
            this.animator.emergencyStop();
        }
        this.updateStatus('BLACKOUT');
    }
    
    /**
     * Update status bar
     */
    updateStatus(message) {
        this.widgets.status.setContent(
            `${message} | FPS: ${this.animator?.frameRate || 0} | ` +
            `Pattern: ${this.currentPatternType} | ` +
            `${this.isAnimating ? 'RUNNING' : 'STOPPED'}`
        );
        this.screen.render();
    }
    
    /**
     * Update library list
     */
    async updateLibrary() {
        try {
            const files = await fs.readdir('./patterns/saved');
            const items = ['[New Pattern]', ...files.filter(f => f.endsWith('.json'))];
            this.widgets.library.setItems(items);
            this.screen.render();
        } catch (error) {
            // Directory might not exist yet
            this.logger.debug('Could not read saved patterns');
        }
    }
    
    /**
     * Convert RGB to hex
     */
    rgbToHex(color) {
        const r = Math.round(color.r).toString(16).padStart(2, '0');
        const g = Math.round(color.g).toString(16).padStart(2, '0');
        const b = Math.round(color.b).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    
    /**
     * Main render loop
     */
    render() {
        this.trail = [];
        this.screen.render();
        
        // Update loop
        setInterval(() => {
            if (this.isAnimating) {
                this.screen.render();
            }
        }, 33); // ~30fps
    }
    
    /**
     * Cleanup on exit
     */
    async cleanup() {
        if (this.animator) {
            this.animator.stop();
        }
        
        this.logger.info('Pattern Editor closing');
    }
}

// Launch the editor
const editor = new PatternEditorCLI();
editor.init().catch(error => {
    console.error('Failed to initialize Pattern Editor:', error);
    process.exit(1);
});