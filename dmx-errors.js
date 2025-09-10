/**
 * Custom Error Types for DMX System
 * Provides specific error classes for better error handling
 */

/**
 * Base DMX Error class
 */
export class DMXError extends Error {
    constructor(message, code = 'DMX_ERROR', details = {}) {
        super(message);
        this.name = 'DMXError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Serial Port Connection Error
 */
export class SerialConnectionError extends DMXError {
    constructor(message, portPath, originalError = null) {
        const details = {
            portPath,
            originalError: originalError?.message,
            hint: SerialConnectionError.getHint(originalError)
        };
        super(message, 'SERIAL_CONNECTION_ERROR', details);
        this.name = 'SerialConnectionError';
    }
    
    static getHint(error) {
        if (!error) return 'Check device connection';
        
        const message = error.message.toLowerCase();
        if (message.includes('permission denied')) {
            return 'Check port permissions. Try: sudo chmod 666 ' + error.path;
        }
        if (message.includes('no such file') || message.includes('cannot find')) {
            return 'Device not found. Check if device is connected and powered on';
        }
        if (message.includes('already open') || message.includes('in use')) {
            return 'Port is in use by another application. Close other DMX software';
        }
        if (message.includes('access denied')) {
            return 'Access denied. On Windows, close Device Manager. On Mac/Linux, check user permissions';
        }
        return 'Unknown connection error. Check cables and device power';
    }
}

/**
 * DMX Protocol Error
 */
export class DMXProtocolError extends DMXError {
    constructor(message, details = {}) {
        super(message, 'DMX_PROTOCOL_ERROR', details);
        this.name = 'DMXProtocolError';
    }
}

/**
 * DMX Frame Transmission Error
 */
export class DMXFrameError extends DMXError {
    constructor(message, frameNumber, channelData = null) {
        const details = {
            frameNumber,
            channelCount: channelData?.length,
            timestamp: Date.now()
        };
        super(message, 'DMX_FRAME_ERROR', details);
        this.name = 'DMXFrameError';
    }
}

/**
 * Device Communication Error
 */
export class DeviceCommunicationError extends DMXError {
    constructor(message, deviceType, lastCommand = null) {
        const details = {
            deviceType,
            lastCommand,
            timestamp: Date.now()
        };
        super(message, 'DEVICE_COMM_ERROR', details);
        this.name = 'DeviceCommunicationError';
    }
}

/**
 * Configuration Error
 */
export class ConfigurationError extends DMXError {
    constructor(message, configKey, expectedType, receivedValue) {
        const details = {
            configKey,
            expectedType,
            receivedValue,
            receivedType: typeof receivedValue
        };
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigurationError';
    }
}

/**
 * Channel Range Error
 */
export class ChannelRangeError extends DMXError {
    constructor(channel, minChannel = 1, maxChannel = 512) {
        const message = `Channel ${channel} out of range (${minChannel}-${maxChannel})`;
        const details = {
            channel,
            minChannel,
            maxChannel
        };
        super(message, 'CHANNEL_RANGE_ERROR', details);
        this.name = 'ChannelRangeError';
    }
}

/**
 * Device Profile Error
 */
export class DeviceProfileError extends DMXError {
    constructor(message, profileName, availableProfiles = []) {
        const details = {
            requestedProfile: profileName,
            availableProfiles
        };
        super(message, 'DEVICE_PROFILE_ERROR', details);
        this.name = 'DeviceProfileError';
    }
}

/**
 * Error Recovery Manager
 */
export class ErrorRecoveryManager {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.errorLog = [];
        this.recoveryStrategies = new Map();
        
        this._registerDefaultStrategies();
    }
    
    _registerDefaultStrategies() {
        // Serial connection recovery
        this.registerStrategy('SERIAL_CONNECTION_ERROR', async (error, context) => {
            const { retry, attemptNumber } = context;
            
            if (attemptNumber >= this.maxRetries) {
                throw new Error(`Failed after ${this.maxRetries} attempts: ${error.message}`);
            }
            
            const delay = this.retryDelay * Math.pow(this.backoffMultiplier, attemptNumber);
            console.log(`Retrying connection in ${delay}ms... (attempt ${attemptNumber + 1}/${this.maxRetries})`);
            
            await this.delay(delay);
            return retry();
        });
        
        // Frame transmission recovery
        this.registerStrategy('DMX_FRAME_ERROR', async (error, context) => {
            const { retry, attemptNumber } = context;
            
            if (attemptNumber >= 2) {
                // After 2 frame errors, try resetting the connection
                console.log('Frame errors detected, resetting connection...');
                if (context.resetConnection) {
                    await context.resetConnection();
                }
            }
            
            return retry();
        });
        
        // Device communication recovery
        this.registerStrategy('DEVICE_COMM_ERROR', async (error, context) => {
            console.log('Device communication error, sending reset command...');
            if (context.sendReset) {
                await context.sendReset();
            }
            return context.retry();
        });
    }
    
    registerStrategy(errorCode, strategy) {
        this.recoveryStrategies.set(errorCode, strategy);
    }
    
    async handleError(error, context = {}) {
        this.logError(error);
        
        const strategy = this.recoveryStrategies.get(error.code);
        if (!strategy) {
            console.error(`No recovery strategy for error code: ${error.code}`);
            throw error;
        }
        
        try {
            return await strategy(error, {
                ...context,
                attemptNumber: context.attemptNumber || 0
            });
        } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError.message);
            throw error; // Throw original error if recovery fails
        }
    }
    
    logError(error) {
        const entry = {
            timestamp: Date.now(),
            error: error.toJSON ? error.toJSON() : {
                message: error.message,
                code: error.code || 'UNKNOWN',
                stack: error.stack
            }
        };
        
        this.errorLog.push(entry);
        
        // Keep only last 100 errors
        if (this.errorLog.length > 100) {
            this.errorLog.shift();
        }
    }
    
    getErrorStats() {
        const stats = {};
        
        for (const entry of this.errorLog) {
            const code = entry.error.code;
            stats[code] = (stats[code] || 0) + 1;
        }
        
        return {
            totalErrors: this.errorLog.length,
            errorsByType: stats,
            lastError: this.errorLog[this.errorLog.length - 1],
            oldestError: this.errorLog[0]
        };
    }
    
    clearErrorLog() {
        this.errorLog = [];
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export all error types and manager
export default {
    DMXError,
    SerialConnectionError,
    DMXProtocolError,
    DMXFrameError,
    DeviceCommunicationError,
    ConfigurationError,
    ChannelRangeError,
    DeviceProfileError,
    ErrorRecoveryManager
};