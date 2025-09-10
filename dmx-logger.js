/**
 * Centralized Logging System for DMX
 * Provides consistent logging across all modules
 */

import fs from 'fs/promises';
import path from 'path';

export const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

export class DMXLogger {
    constructor(options = {}) {
        this.moduleName = options.moduleName || 'DMX';
        this.minLevel = options.minLevel || LogLevel.INFO;
        this.enableConsole = options.enableConsole !== false;
        this.enableFile = options.enableFile || false;
        this.logFilePath = options.logFilePath || './dmx.log';
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.dateFormat = options.dateFormat || 'ISO';
        
        // Color codes for console output
        this.colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[35m', // Magenta
            TRACE: '\x1b[90m', // Gray
            RESET: '\x1b[0m'
        };
        
        this.logBuffer = [];
        this.bufferSize = options.bufferSize || 100;
    }
    
    _formatTimestamp() {
        const now = new Date();
        if (this.dateFormat === 'ISO') {
            return now.toISOString();
        } else if (this.dateFormat === 'LOCAL') {
            return now.toLocaleString();
        } else if (this.dateFormat === 'UNIX') {
            return now.getTime().toString();
        }
        return now.toISOString();
    }
    
    _formatMessage(level, message, context = {}) {
        const levelName = this._getLevelName(level);
        const timestamp = this._formatTimestamp();
        const contextStr = Object.keys(context).length > 0 
            ? ` | ${JSON.stringify(context)}` 
            : '';
        
        return `${timestamp} [${this.moduleName}] ${levelName}: ${message}${contextStr}`;
    }
    
    _getLevelName(level) {
        const names = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
        return names[level] || 'UNKNOWN';
    }
    
    async _writeToFile(formattedMessage) {
        if (!this.enableFile) return;
        
        try {
            // Check file size
            try {
                const stats = await fs.stat(this.logFilePath);
                if (stats.size > this.maxFileSize) {
                    // Rotate log file
                    const backupPath = `${this.logFilePath}.${Date.now()}.bak`;
                    await fs.rename(this.logFilePath, backupPath);
                }
            } catch (e) {
                // File doesn't exist yet, that's OK
            }
            
            // Append to log file
            await fs.appendFile(this.logFilePath, formattedMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }
    
    _writeToConsole(level, message, formattedMessage) {
        if (!this.enableConsole) return;
        
        const levelName = this._getLevelName(level);
        const color = this.colors[levelName] || this.colors.RESET;
        
        const consoleMessage = `${color}${formattedMessage}${this.colors.RESET}`;
        
        if (level === LogLevel.ERROR) {
            console.error(consoleMessage);
        } else if (level === LogLevel.WARN) {
            console.warn(consoleMessage);
        } else {
            console.log(consoleMessage);
        }
    }
    
    _addToBuffer(level, message, context) {
        this.logBuffer.push({
            timestamp: Date.now(),
            level,
            message,
            context
        });
        
        // Keep buffer size limited
        if (this.logBuffer.length > this.bufferSize) {
            this.logBuffer.shift();
        }
    }
    
    log(level, message, context = {}) {
        if (level > this.minLevel) return;
        
        const formattedMessage = this._formatMessage(level, message, context);
        
        this._writeToConsole(level, message, formattedMessage);
        this._writeToFile(formattedMessage);
        this._addToBuffer(level, message, context);
    }
    
    // Convenience methods
    error(message, context = {}) {
        this.log(LogLevel.ERROR, message, context);
    }
    
    warn(message, context = {}) {
        this.log(LogLevel.WARN, message, context);
    }
    
    info(message, context = {}) {
        this.log(LogLevel.INFO, message, context);
    }
    
    debug(message, context = {}) {
        this.log(LogLevel.DEBUG, message, context);
    }
    
    trace(message, context = {}) {
        this.log(LogLevel.TRACE, message, context);
    }
    
    // Get recent logs from buffer
    getRecentLogs(count = 10, levelFilter = null) {
        let logs = [...this.logBuffer];
        
        if (levelFilter !== null) {
            logs = logs.filter(log => log.level === levelFilter);
        }
        
        return logs.slice(-count);
    }
    
    // Clear log buffer
    clearBuffer() {
        this.logBuffer = [];
    }
    
    // Create child logger with same settings but different module name
    createChild(moduleName) {
        return new DMXLogger({
            ...this,
            moduleName: `${this.moduleName}:${moduleName}`,
            logBuffer: this.logBuffer // Share buffer with parent
        });
    }
}

// Singleton instance for global logging
let globalLogger = null;

export function getGlobalLogger(options = {}) {
    if (!globalLogger) {
        globalLogger = new DMXLogger({
            moduleName: 'DMX-Global',
            minLevel: LogLevel.INFO,
            enableFile: true,
            ...options
        });
    }
    return globalLogger;
}

// Export for consistent usage
export default {
    DMXLogger,
    LogLevel,
    getGlobalLogger
};