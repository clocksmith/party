/**
 * DMX Device Profile Validator
 * Validates device profile JSON files for correctness and completeness
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { DMXLogger, LogLevel } from './dmx-logger.js';

export class ProfileValidator {
    constructor(options = {}) {
        this.logger = new DMXLogger({
            moduleName: 'ProfileValidator',
            minLevel: options.logLevel || LogLevel.INFO
        });
        this.errors = [];
        this.warnings = [];
    }
    
    /**
     * Validate a profile object
     */
    validate(profile) {
        this.errors = [];
        this.warnings = [];
        
        // Required fields
        this.validateRequiredFields(profile);
        
        // Channel definitions
        this.validateChannels(profile);
        
        // Presets
        if (profile.presets) {
            this.validatePresets(profile);
        }
        
        // Macros
        if (profile.macros) {
            this.validateMacros(profile);
        }
        
        // Button emulation
        if (profile.buttonEmulation) {
            this.validateButtonEmulation(profile);
        }
        
        return {
            valid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }
    
    /**
     * Validate required fields
     */
    validateRequiredFields(profile) {
        const required = ['name', 'channelCount', 'channels'];
        
        for (const field of required) {
            if (!profile[field]) {
                this.errors.push(`Missing required field: ${field}`);
            }
        }
        
        // Validate channelCount
        if (profile.channelCount) {
            if (typeof profile.channelCount !== 'number') {
                this.errors.push('channelCount must be a number');
            } else if (profile.channelCount < 1 || profile.channelCount > 512) {
                this.errors.push(`channelCount must be between 1 and 512, got ${profile.channelCount}`);
            }
        }
        
        // Validate name
        if (profile.name && typeof profile.name !== 'string') {
            this.errors.push('name must be a string');
        }
    }
    
    /**
     * Validate channel definitions
     */
    validateChannels(profile) {
        if (!profile.channels || typeof profile.channels !== 'object') {
            this.errors.push('channels must be an object');
            return;
        }
        
        const usedChannels = new Set();
        
        for (const [name, def] of Object.entries(profile.channels)) {
            // Check channel number
            if (!def.channel || typeof def.channel !== 'number') {
                this.errors.push(`Channel ${name}: missing or invalid channel number`);
                continue;
            }
            
            if (def.channel < 1 || def.channel > 512) {
                this.errors.push(`Channel ${name}: channel number ${def.channel} out of range (1-512)`);
            }
            
            // Check for duplicate channel numbers
            if (usedChannels.has(def.channel)) {
                this.errors.push(`Channel ${name}: duplicate channel number ${def.channel}`);
            }
            usedChannels.add(def.channel);
            
            // Check channel exceeds device channel count
            if (profile.channelCount && def.channel > profile.channelCount) {
                this.warnings.push(`Channel ${name}: channel ${def.channel} exceeds device channelCount ${profile.channelCount}`);
            }
            
            // Validate channel type
            if (!def.type) {
                this.errors.push(`Channel ${name}: missing type`);
            } else if (!['enum', 'range', 'boolean'].includes(def.type)) {
                this.errors.push(`Channel ${name}: invalid type '${def.type}' (must be enum, range, or boolean)`);
            }
            
            // Type-specific validation
            this.validateChannelType(name, def);
        }
    }
    
    /**
     * Validate channel type-specific properties
     */
    validateChannelType(name, def) {
        switch (def.type) {
            case 'enum':
                if (!def.values || typeof def.values !== 'object') {
                    this.errors.push(`Channel ${name}: enum type requires 'values' object`);
                } else {
                    // Validate enum values
                    for (const [valueName, value] of Object.entries(def.values)) {
                        if (typeof value === 'number') {
                            if (value < 0 || value > 255) {
                                this.errors.push(`Channel ${name}: enum value '${valueName}' out of range (0-255)`);
                            }
                        } else if (typeof value === 'object') {
                            if (!('min' in value) || !('max' in value)) {
                                this.errors.push(`Channel ${name}: enum range '${valueName}' requires min and max`);
                            } else {
                                if (value.min < 0 || value.min > 255) {
                                    this.errors.push(`Channel ${name}: enum range '${valueName}' min out of range`);
                                }
                                if (value.max < 0 || value.max > 255) {
                                    this.errors.push(`Channel ${name}: enum range '${valueName}' max out of range`);
                                }
                                if (value.min > value.max) {
                                    this.errors.push(`Channel ${name}: enum range '${valueName}' min > max`);
                                }
                            }
                        } else {
                            this.errors.push(`Channel ${name}: invalid enum value type for '${valueName}'`);
                        }
                    }
                }
                break;
                
            case 'range':
                if ('min' in def && (def.min < 0 || def.min > 255)) {
                    this.errors.push(`Channel ${name}: range min ${def.min} out of bounds (0-255)`);
                }
                if ('max' in def && (def.max < 0 || def.max > 255)) {
                    this.errors.push(`Channel ${name}: range max ${def.max} out of bounds (0-255)`);
                }
                if ('min' in def && 'max' in def && def.min > def.max) {
                    this.errors.push(`Channel ${name}: range min ${def.min} > max ${def.max}`);
                }
                break;
                
            case 'boolean':
                if (def.values) {
                    if (!('disabled' in def.values) || !('enabled' in def.values)) {
                        this.warnings.push(`Channel ${name}: boolean should have 'disabled' and 'enabled' values`);
                    }
                }
                break;
        }
    }
    
    /**
     * Validate presets
     */
    validatePresets(profile) {
        for (const [presetName, preset] of Object.entries(profile.presets)) {
            if (!preset.channels || typeof preset.channels !== 'object') {
                this.errors.push(`Preset ${presetName}: missing or invalid channels object`);
                continue;
            }
            
            // Validate each channel in preset
            for (const [channelName, value] of Object.entries(preset.channels)) {
                if (!profile.channels[channelName]) {
                    this.errors.push(`Preset ${presetName}: references undefined channel '${channelName}'`);
                    continue;
                }
                
                const channelDef = profile.channels[channelName];
                
                // Validate value based on channel type
                if (typeof value === 'object' && 'value' in value) {
                    // Extended format with mode
                    this.validateChannelValue(channelName, channelDef, value.value, `Preset ${presetName}`);
                } else {
                    // Simple value
                    this.validateChannelValue(channelName, channelDef, value, `Preset ${presetName}`);
                }
            }
        }
    }
    
    /**
     * Validate a channel value
     */
    validateChannelValue(channelName, channelDef, value, context) {
        if (typeof value !== 'number') {
            this.errors.push(`${context}: channel '${channelName}' value must be a number`);
            return;
        }
        
        if (value < 0 || value > 255) {
            this.errors.push(`${context}: channel '${channelName}' value ${value} out of range (0-255)`);
        }
        
        // Type-specific validation
        if (channelDef.type === 'range') {
            const min = channelDef.min || 0;
            const max = channelDef.max || 255;
            if (value < min || value > max) {
                this.warnings.push(`${context}: channel '${channelName}' value ${value} outside defined range (${min}-${max})`);
            }
        }
    }
    
    /**
     * Validate macros
     */
    validateMacros(profile) {
        for (const [macroName, macro] of Object.entries(profile.macros)) {
            if (!macro.steps || !Array.isArray(macro.steps)) {
                this.errors.push(`Macro ${macroName}: missing or invalid steps array`);
                continue;
            }
            
            for (let i = 0; i < macro.steps.length; i++) {
                const step = macro.steps[i];
                
                if (!step.channels || typeof step.channels !== 'object') {
                    this.errors.push(`Macro ${macroName}, step ${i}: missing channels object`);
                    continue;
                }
                
                if (!step.duration || typeof step.duration !== 'number') {
                    this.warnings.push(`Macro ${macroName}, step ${i}: missing or invalid duration`);
                }
                
                // Validate channels in step
                for (const [channelName, value] of Object.entries(step.channels)) {
                    if (!profile.channels[channelName]) {
                        this.errors.push(`Macro ${macroName}, step ${i}: references undefined channel '${channelName}'`);
                        continue;
                    }
                    
                    this.validateChannelValue(
                        channelName, 
                        profile.channels[channelName], 
                        value, 
                        `Macro ${macroName}, step ${i}`
                    );
                }
            }
        }
    }
    
    /**
     * Validate button emulation
     */
    validateButtonEmulation(profile) {
        const buttons = ['menu', 'enter', 'up', 'down'];
        
        for (const button of buttons) {
            if (profile.buttonEmulation[button]) {
                const def = profile.buttonEmulation[button];
                
                if (!def.channel || typeof def.channel !== 'number') {
                    this.errors.push(`Button ${button}: missing or invalid channel`);
                } else if (def.channel < 1 || def.channel > 512) {
                    this.errors.push(`Button ${button}: channel ${def.channel} out of range (1-512)`);
                }
                
                if (!def.value || typeof def.value !== 'number') {
                    this.errors.push(`Button ${button}: missing or invalid value`);
                } else if (def.value < 0 || def.value > 255) {
                    this.errors.push(`Button ${button}: value ${def.value} out of range (0-255)`);
                }
                
                if (def.duration && typeof def.duration !== 'number') {
                    this.warnings.push(`Button ${button}: duration should be a number`);
                }
            }
        }
    }
    
    /**
     * Load and validate a profile file
     */
    async validateFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const profile = JSON.parse(content);
            
            const result = this.validate(profile);
            
            return {
                file: filePath,
                profile: profile.name || 'Unknown',
                ...result
            };
            
        } catch (error) {
            return {
                file: filePath,
                valid: false,
                errors: [`Failed to load file: ${error.message}`],
                warnings: []
            };
        }
    }
    
    /**
     * Validate all profiles in a directory
     */
    async validateDirectory(dirPath) {
        const results = [];
        
        try {
            const files = await fs.readdir(dirPath);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(dirPath, file);
                    const result = await this.validateFile(filePath);
                    results.push(result);
                }
            }
            
        } catch (error) {
            this.logger.error(`Failed to read directory: ${error.message}`);
        }
        
        return results;
    }
    
    /**
     * Print validation results
     */
    printResults(results) {
        console.log(chalk.cyan('\n=== Profile Validation Results ===\n'));
        
        let totalErrors = 0;
        let totalWarnings = 0;
        
        for (const result of results) {
            const fileName = path.basename(result.file);
            
            if (result.valid) {
                console.log(chalk.green(`✓ ${fileName}`), `(${result.profile})`);
                if (result.warnings.length > 0) {
                    console.log(chalk.yellow(`  Warnings: ${result.warnings.length}`));
                    for (const warning of result.warnings) {
                        console.log(chalk.yellow(`    - ${warning}`));
                    }
                }
            } else {
                console.log(chalk.red(`✗ ${fileName}`), `(${result.profile || 'Invalid'})`);
                console.log(chalk.red(`  Errors: ${result.errors.length}`));
                for (const error of result.errors) {
                    console.log(chalk.red(`    - ${error}`));
                }
                if (result.warnings.length > 0) {
                    console.log(chalk.yellow(`  Warnings: ${result.warnings.length}`));
                    for (const warning of result.warnings) {
                        console.log(chalk.yellow(`    - ${warning}`));
                    }
                }
            }
            
            totalErrors += result.errors.length;
            totalWarnings += result.warnings.length;
            console.log();
        }
        
        // Summary
        console.log(chalk.cyan('=== Summary ==='));
        const validCount = results.filter(r => r.valid).length;
        console.log(`Total profiles: ${results.length}`);
        console.log(chalk.green(`Valid: ${validCount}`));
        console.log(chalk.red(`Invalid: ${results.length - validCount}`));
        console.log(chalk.red(`Total errors: ${totalErrors}`));
        console.log(chalk.yellow(`Total warnings: ${totalWarnings}`));
    }
    
    /**
     * Generate a profile schema documentation
     */
    static generateSchema() {
        return {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "required": ["name", "channelCount", "channels"],
            "properties": {
                "id": { "type": "string", "description": "Unique identifier for the profile" },
                "name": { "type": "string", "description": "Display name of the device" },
                "manufacturer": { "type": "string", "description": "Device manufacturer" },
                "model": { "type": "string", "description": "Device model" },
                "channelCount": { 
                    "type": "integer", 
                    "minimum": 1, 
                    "maximum": 512,
                    "description": "Number of DMX channels used by device"
                },
                "dmxStartAddress": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 512,
                    "description": "Default DMX start address"
                },
                "channels": {
                    "type": "object",
                    "description": "Channel definitions",
                    "patternProperties": {
                        ".*": {
                            "type": "object",
                            "required": ["channel", "type"],
                            "properties": {
                                "channel": { "type": "integer", "minimum": 1, "maximum": 512 },
                                "type": { "enum": ["enum", "range", "boolean"] },
                                "description": { "type": "string" },
                                "min": { "type": "integer", "minimum": 0, "maximum": 255 },
                                "max": { "type": "integer", "minimum": 0, "maximum": 255 },
                                "center": { "type": "integer", "minimum": 0, "maximum": 255 },
                                "values": { "type": "object" },
                                "patterns": { "type": "object" },
                                "special": { "type": "object" }
                            }
                        }
                    }
                },
                "presets": {
                    "type": "object",
                    "description": "Predefined channel configurations"
                },
                "macros": {
                    "type": "object",
                    "description": "Animated sequences"
                },
                "buttonEmulation": {
                    "type": "object",
                    "description": "Button press emulation via DMX"
                },
                "metadata": {
                    "type": "object",
                    "description": "Additional profile information"
                }
            }
        };
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new ProfileValidator();
    
    const command = process.argv[2];
    const target = process.argv[3];
    
    if (!command) {
        console.log(chalk.cyan('DMX Profile Validator'));
        console.log('\nUsage:');
        console.log('  node dmx-profile-validator.js validate <file|directory>');
        console.log('  node dmx-profile-validator.js schema');
        process.exit(0);
    }
    
    switch (command) {
        case 'validate':
            if (!target) {
                console.error(chalk.red('Error: Please specify a file or directory to validate'));
                process.exit(1);
            }
            
            const stats = await fs.stat(target).catch(() => null);
            if (!stats) {
                console.error(chalk.red(`Error: ${target} not found`));
                process.exit(1);
            }
            
            let results;
            if (stats.isDirectory()) {
                results = await validator.validateDirectory(target);
            } else {
                results = [await validator.validateFile(target)];
            }
            
            validator.printResults(results);
            
            // Exit with error if any profiles are invalid
            const hasErrors = results.some(r => !r.valid);
            process.exit(hasErrors ? 1 : 0);
            break;
            
        case 'schema':
            console.log(JSON.stringify(ProfileValidator.generateSchema(), null, 2));
            break;
            
        default:
            console.error(chalk.red(`Unknown command: ${command}`));
            process.exit(1);
    }
}