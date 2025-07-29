"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.logger = void 0;
var winston_1 = __importDefault(require("winston"));
var path_1 = __importDefault(require("path"));
var config_1 = require("./config");
var chalk_1 = __importDefault(require("chalk"));
var _a = winston_1.default.format, combine = _a.combine, timestamp = _a.timestamp, printf = _a.printf, colorize = _a.colorize, errors = _a.errors;
/**
 * Custom log format
 */
var logFormat = printf(function (_a) {
    var level = _a.level, message = _a.message, timestamp = _a.timestamp, stack = _a.stack;
    var log = "".concat(timestamp, " [").concat(level, "]: ").concat(message);
    return stack ? "".concat(log, "\n").concat(stack) : log;
});
/**
 * Create and configure Winston logger
 */
exports.logger = winston_1.default.createLogger({
    level: config_1.Config.LOGGER_CONFIG.level,
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        // Console transport
        new winston_1.default.transports.Console({
            format: combine(colorize(), logFormat)
        }),
        // File transport for errors
        new winston_1.default.transports.File({
            filename: path_1.default.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // File transport for all logs
        new winston_1.default.transports.File({
            filename: path_1.default.join('logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});
/**
 * Mask sensitive data in action objects for logging
 */
function maskSensitiveAction(action) {
    if (!action)
        return action;
    // Deep clone to avoid mutating original
    var maskedAction = JSON.parse(JSON.stringify(action));
    // Mask password fields in type actions
    if (maskedAction.type === 'type' && maskedAction.text) {
        // Check if selector indicates password field
        var isPasswordField = (typeof maskedAction.selector === 'string' && maskedAction.selector.includes('password')) ||
            (Array.isArray(maskedAction.selector) && maskedAction.selector.some(function (s) { return s.includes('password'); }));
        if (isPasswordField) {
            maskedAction.text = '[MASKED]';
        }
    }
    return maskedAction;
}
/**
 * Log detailed step execution
 */
function logStep(context) {
    var prefix = "[STEP ".concat(context.stepIndex, "/").concat(context.totalSteps, "]");
    // Mask sensitive data in action for logging
    var maskedAction = maskSensitiveAction(context.action);
    if (context.error) {
        console.error(chalk_1.default.red("".concat(prefix, " \u274C ").concat(context.stepDescription)), {
            action: maskedAction,
            error: context.error,
            retryCount: context.retryCount,
            pageUrl: context.pageUrl,
            screenshotPath: context.screenshotPath
        });
    }
    else {
        console.info(chalk_1.default.green("".concat(prefix, " \u2713 ").concat(context.stepDescription)), {
            action: maskedAction,
            duration: context.duration,
            pageUrl: context.pageUrl,
            elementFound: context.elementFound
        });
    }
}
/**
 * Log recovery attempt
 */
function logRecovery(message, details) {
    console.info(chalk_1.default.yellow("[RECOVERY] ".concat(message)), details);
}
/**
 * Log utilities
 */
exports.log = {
    error: function (message, error) {
        exports.logger.error(message, error);
    },
    warn: function (message) {
        exports.logger.warn(message);
    },
    info: function (message) {
        exports.logger.info(message);
    },
    debug: function (message) {
        exports.logger.debug(message);
    },
    /**
     * Log browser action
     */
    action: function (action, details) {
        exports.logger.info("[ACTION] ".concat(action), details ? { details: details } : undefined);
    },
    /**
     * Log vision analysis
     */
    vision: function (action, details) {
        exports.logger.info("[VISION] ".concat(action), details ? { details: details } : undefined);
    },
    /**
     * Log performance metrics
     */
    performance: function (operation, duration) {
        exports.logger.info("[PERFORMANCE] ".concat(operation, " completed in ").concat(duration, "ms"));
    },
    /**
     * Log detailed step execution
     */
    step: logStep,
    /**
     * Log recovery attempt
     */
    recovery: logRecovery
};
