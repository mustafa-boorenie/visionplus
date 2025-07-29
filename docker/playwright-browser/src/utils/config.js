"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
var dotenv_1 = __importDefault(require("dotenv"));
var path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config();
/**
 * Application configuration
 */
var Config = /** @class */ (function () {
    function Config() {
    }
    /**
     * Validate configuration
     */
    Config.validate = function () {
        var errors = [];
        if (!this.OPENAI_API_KEY) {
            errors.push('OPENAI_API_KEY is required');
        }
        if (!['chromium', 'firefox', 'webkit'].includes(this.BROWSER_CONFIG.browserType)) {
            errors.push('BROWSER_TYPE must be one of: chromium, firefox, webkit');
        }
        if (this.SCREENSHOT_QUALITY < 0 || this.SCREENSHOT_QUALITY > 100) {
            errors.push('SCREENSHOT_QUALITY must be between 0 and 100');
        }
        if (errors.length > 0) {
            throw new Error("Configuration errors:\n".concat(errors.join('\n')));
        }
    };
    /**
     * Get configuration summary
     */
    Config.getSummary = function () {
        return "\nConfiguration Summary:\n- Browser: ".concat(this.BROWSER_CONFIG.browserType, " (").concat(this.BROWSER_CONFIG.headless ? 'headless' : 'headed', ")\n- Default Timeout: ").concat(this.BROWSER_CONFIG.timeout, "ms\n- Navigation Timeout: ").concat(this.BROWSER_CONFIG.navigationTimeout, "ms\n- Screenshot Path: ").concat(this.SCREENSHOT_PATH, "\n- Report Path: ").concat(this.REPORT_PATH, "\n- Log Level: ").concat(this.LOGGER_CONFIG.level, "\n- OpenAI API Key: ").concat(this.OPENAI_API_KEY ? '***' + this.OPENAI_API_KEY.slice(-4) : 'Not Set', "\n    ").trim();
    };
    // OpenAI Configuration
    Config.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    // Browser Configuration
    Config.BROWSER_CONFIG = {
        browserType: process.env.BROWSER_TYPE || 'chromium',
        headless: process.env.HEADLESS_MODE === 'true',
        timeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000'),
        navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '60000'),
        viewport: {
            width: 1280,
            height: 720
        }
    };
    // Screenshot Configuration
    Config.SCREENSHOT_PATH = path_1.default.resolve(process.env.SCREENSHOT_PATH || './screenshots');
    Config.SCREENSHOT_QUALITY = parseInt(process.env.SCREENSHOT_QUALITY || '80');
    // Report Configuration
    Config.REPORT_PATH = path_1.default.resolve(process.env.REPORT_PATH || './reports');
    // Logger Configuration
    Config.LOGGER_CONFIG = {
        level: process.env.LOG_LEVEL || 'info',
        format: 'simple'
    };
    return Config;
}());
exports.Config = Config;
