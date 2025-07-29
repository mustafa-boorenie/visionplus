"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAutomation = void 0;
var playwright_1 = require("playwright");
var path_1 = __importDefault(require("path"));
var fs_extra_1 = __importDefault(require("fs-extra"));
var config_1 = require("../utils/config");
var logger_1 = require("../utils/logger");
/**
 * Browser automation class using Playwright
 */
var BrowserAutomation = /** @class */ (function () {
    function BrowserAutomation(config) {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.screenshotCount = 0;
        this.config = __assign(__assign({}, config_1.Config.BROWSER_CONFIG), config);
    }
    Object.defineProperty(BrowserAutomation.prototype, "currentPage", {
        /**
         * Get the current page instance
         */
        get: function () {
            return this.page;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Initialize browser
     */
    BrowserAutomation.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var browserType, _a, _b, _c, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 5, , 6]);
                        logger_1.log.info('Initializing browser...');
                        browserType = this.getBrowserType();
                        _a = this;
                        return [4 /*yield*/, browserType.launch({
                                headless: this.config.headless,
                                args: __spreadArray(__spreadArray([], (this.config.args || []), true), [
                                    '--disable-blink-features=AutomationControlled'
                                ], false)
                            })];
                    case 1:
                        _a.browser = _d.sent();
                        // Create context with viewport and anti-detection settings
                        _b = this;
                        return [4 /*yield*/, this.browser.newContext({
                                viewport: this.config.viewport,
                                ignoreHTTPSErrors: true,
                                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            })];
                    case 2:
                        // Create context with viewport and anti-detection settings
                        _b.context = _d.sent();
                        // Set default timeouts
                        this.context.setDefaultTimeout(this.config.timeout);
                        this.context.setDefaultNavigationTimeout(this.config.navigationTimeout);
                        // Create new page
                        _c = this;
                        return [4 /*yield*/, this.context.newPage()];
                    case 3:
                        // Create new page
                        _c.page = _d.sent();
                        // Inject anti-detection scripts
                        return [4 /*yield*/, this.injectAntiDetection()];
                    case 4:
                        // Inject anti-detection scripts
                        _d.sent();
                        logger_1.log.info("Browser initialized: ".concat(this.config.browserType));
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _d.sent();
                        logger_1.log.error('Failed to initialize browser', error_1);
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Inject anti-detection scripts to avoid bot detection
     */
    BrowserAutomation.prototype.injectAntiDetection = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.context)
                            return [2 /*return*/];
                        // Override navigator.webdriver to prevent detection
                        return [4 /*yield*/, this.context.addInitScript("\n      // Override navigator.webdriver\n      Object.defineProperty(navigator, 'webdriver', {\n        get: () => undefined\n      });\n    ")];
                    case 1:
                        // Override navigator.webdriver to prevent detection
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get browser type instance
     */
    BrowserAutomation.prototype.getBrowserType = function () {
        switch (this.config.browserType) {
            case 'firefox':
                return playwright_1.firefox;
            case 'webkit':
                return playwright_1.webkit;
            default:
                return playwright_1.chromium;
        }
    };
    /**
     * Smart locator that tries multiple selector candidates
     */
    BrowserAutomation.prototype.smartLocator = function (selectors, elementType) {
        return __awaiter(this, void 0, void 0, function () {
            var candidates, _i, candidates_1, selector, locator, isVisible, error_2, fallbackLocator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page) {
                            throw new Error('Page not initialized');
                        }
                        candidates = Array.isArray(selectors) ? selectors : [selectors];
                        logger_1.log.info("[SMART_LOCATOR] Trying ".concat(candidates.length, " selector candidates"));
                        _i = 0, candidates_1 = candidates;
                        _a.label = 1;
                    case 1:
                        if (!(_i < candidates_1.length)) return [3 /*break*/, 8];
                        selector = candidates_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 6, , 7]);
                        logger_1.log.info("[SMART_LOCATOR] Trying: ".concat(selector));
                        locator = this.page.locator(selector).first();
                        return [4 /*yield*/, locator.count()];
                    case 3:
                        if (!((_a.sent()) > 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, locator.isVisible({ timeout: 1000 }).catch(function () { return false; })];
                    case 4:
                        isVisible = _a.sent();
                        if (isVisible) {
                            logger_1.log.info("[SMART_LOCATOR] Found visible element with: ".concat(selector));
                            return [2 /*return*/, locator];
                        }
                        else {
                            logger_1.log.info("[SMART_LOCATOR] Element found but not visible: ".concat(selector));
                        }
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        logger_1.log.info("[SMART_LOCATOR] Selector failed: ".concat(selector));
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 1];
                    case 8:
                        if (!elementType) return [3 /*break*/, 10];
                        logger_1.log.info("[SMART_LOCATOR] Trying fallback heuristics for ".concat(elementType));
                        return [4 /*yield*/, this.tryFallbackHeuristics(elementType)];
                    case 9:
                        fallbackLocator = _a.sent();
                        if (fallbackLocator) {
                            return [2 /*return*/, fallbackLocator];
                        }
                        _a.label = 10;
                    case 10: throw new Error("None of the selectors matched: ".concat(candidates.join(', ')));
                }
            });
        });
    };
    /**
     * Try fallback heuristics for common element types
     */
    BrowserAutomation.prototype.tryFallbackHeuristics = function (elementType) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, searchPatterns, _i, searchPatterns_1, pattern, _b, buttonPatterns, _c, buttonPatterns_1, pattern, _d, error_3;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!this.page)
                            return [2 /*return*/, null];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 17, , 18]);
                        _a = elementType;
                        switch (_a) {
                            case 'search': return [3 /*break*/, 2];
                            case 'submit': return [3 /*break*/, 9];
                            case 'button': return [3 /*break*/, 9];
                        }
                        return [3 /*break*/, 16];
                    case 2:
                        searchPatterns = [
                            this.page.locator('textarea[name="q"]:visible').first(), // Google uses textarea - check first
                            this.page.getByRole('searchbox').first(),
                            this.page.getByRole('textbox', { name: /search|find|query|keyword/i }).first(),
                            this.page.locator('input[type="search"]:visible').first(),
                            this.page.locator('input[placeholder*="search" i]:visible').first(),
                            this.page.locator('input[placeholder*="find" i]:visible').first(),
                            this.page.locator('input[name="q"]:visible').first(),
                            this.page.locator('input[name="search"]:visible').first(),
                            this.page.locator('input[name="term"]:visible').first(),
                            this.page.locator('#search:visible').first(),
                            this.page.locator('.search-input:visible').first(),
                            this.page.locator('.search-box:visible').first(),
                            // Note: Avoid input[aria-label*="search"] as it may match submit buttons
                        ];
                        _i = 0, searchPatterns_1 = searchPatterns;
                        _e.label = 3;
                    case 3:
                        if (!(_i < searchPatterns_1.length)) return [3 /*break*/, 8];
                        pattern = searchPatterns_1[_i];
                        return [4 /*yield*/, pattern.count()];
                    case 4:
                        _b = (_e.sent()) > 0;
                        if (!_b) return [3 /*break*/, 6];
                        return [4 /*yield*/, pattern.isVisible({ timeout: 1000 }).catch(function () { return false; })];
                    case 5:
                        _b = (_e.sent());
                        _e.label = 6;
                    case 6:
                        if (_b) {
                            logger_1.log.info('[SMART_LOCATOR] Found search element with fallback heuristic');
                            return [2 /*return*/, pattern];
                        }
                        _e.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8: return [3 /*break*/, 16];
                    case 9:
                        buttonPatterns = [
                            this.page.getByRole('button', { name: /search|submit|go|find|next|continue/i }).first(),
                            this.page.locator('button[type="submit"]:visible').first(),
                            this.page.locator('input[type="submit"]:visible').first(),
                            this.page.locator('button:has-text("Search"):visible').first(),
                            this.page.locator('button:has-text("Submit"):visible').first(),
                            this.page.locator('.search-button:visible').first(),
                            this.page.locator('[aria-label*="search" i][role="button"]:visible').first()
                        ];
                        _c = 0, buttonPatterns_1 = buttonPatterns;
                        _e.label = 10;
                    case 10:
                        if (!(_c < buttonPatterns_1.length)) return [3 /*break*/, 15];
                        pattern = buttonPatterns_1[_c];
                        return [4 /*yield*/, pattern.count()];
                    case 11:
                        _d = (_e.sent()) > 0;
                        if (!_d) return [3 /*break*/, 13];
                        return [4 /*yield*/, pattern.isVisible({ timeout: 1000 }).catch(function () { return false; })];
                    case 12:
                        _d = (_e.sent());
                        _e.label = 13;
                    case 13:
                        if (_d) {
                            logger_1.log.info('[SMART_LOCATOR] Found button element with fallback heuristic');
                            return [2 /*return*/, pattern];
                        }
                        _e.label = 14;
                    case 14:
                        _c++;
                        return [3 /*break*/, 10];
                    case 15: return [3 /*break*/, 16];
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        error_3 = _e.sent();
                        logger_1.log.error('[SMART_LOCATOR] Fallback heuristics failed', error_3);
                        return [3 /*break*/, 18];
                    case 18: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Execute single action
     */
    BrowserAutomation.prototype.executeAction = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, _a, pageUrl, duration, error_4, duration, pageUrl;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        // Log the action being performed (similar to MCP mode)
                        logger_1.log.info("[ACTION] ".concat(action.type, ": ").concat(JSON.stringify(action)));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 34, , 36]);
                        // Ensure page is active before any action
                        return [4 /*yield*/, this.ensurePageActive()];
                    case 2:
                        // Ensure page is active before any action
                        _b.sent();
                        result = void 0;
                        _a = action.type;
                        switch (_a) {
                            case 'navigate': return [3 /*break*/, 3];
                            case 'click': return [3 /*break*/, 5];
                            case 'type': return [3 /*break*/, 7];
                            case 'wait': return [3 /*break*/, 9];
                            case 'scroll': return [3 /*break*/, 11];
                            case 'select': return [3 /*break*/, 13];
                            case 'screenshot': return [3 /*break*/, 15];
                            case 'press': return [3 /*break*/, 17];
                            case 'goBack': return [3 /*break*/, 19];
                            case 'goForward': return [3 /*break*/, 21];
                            case 'reload': return [3 /*break*/, 23];
                            case 'newTab': return [3 /*break*/, 25];
                            case 'switchTab': return [3 /*break*/, 27];
                            case 'closeTab': return [3 /*break*/, 29];
                        }
                        return [3 /*break*/, 31];
                    case 3: return [4 /*yield*/, this.navigate(action)];
                    case 4:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 5: return [4 /*yield*/, this.click(action)];
                    case 6:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 7: return [4 /*yield*/, this.type(action)];
                    case 8:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 9: return [4 /*yield*/, this.wait(action)];
                    case 10:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 11: return [4 /*yield*/, this.scroll(action)];
                    case 12:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 13: return [4 /*yield*/, this.select(action)];
                    case 14:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 15: return [4 /*yield*/, this.screenshot(action)];
                    case 16:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 17: return [4 /*yield*/, this.press(action)];
                    case 18:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 19: return [4 /*yield*/, this.goBack(action)];
                    case 20:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 21: return [4 /*yield*/, this.goForward(action)];
                    case 22:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 23: return [4 /*yield*/, this.reload(action)];
                    case 24:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 25: return [4 /*yield*/, this.newTab(action)];
                    case 26:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 27: return [4 /*yield*/, this.switchTab(action)];
                    case 28:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 29: return [4 /*yield*/, this.closeTab(action)];
                    case 30:
                        result = _b.sent();
                        return [3 /*break*/, 32];
                    case 31: throw new Error("Unknown action type: ".concat(action.type));
                    case 32: return [4 /*yield*/, this.getCurrentUrl()];
                    case 33:
                        pageUrl = _b.sent();
                        duration = Date.now() - startTime;
                        logger_1.log.info("[PERFORMANCE] Action ".concat(action.type, " completed in ").concat(duration, "ms"));
                        // Return enriched result with timing and status
                        return [2 /*return*/, __assign(__assign({ action: action }, result), { duration: duration, pageUrl: pageUrl, elementFound: true, success: true })];
                    case 34:
                        error_4 = _b.sent();
                        duration = Date.now() - startTime;
                        return [4 /*yield*/, this.getCurrentUrl()];
                    case 35:
                        pageUrl = _b.sent();
                        logger_1.log.error("Action ".concat(action.type, " failed after ").concat(duration, "ms"), error_4);
                        // Return error result with timing
                        return [2 /*return*/, {
                                action: action,
                                duration: duration,
                                pageUrl: pageUrl,
                                elementFound: false,
                                success: false,
                                error: error_4.message
                            }];
                    case 36: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute multiple actions in sequence
     */
    BrowserAutomation.prototype.executeActions = function (actions) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, actions_1, action;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, actions_1 = actions;
                        _a.label = 1;
                    case 1:
                        if (!(_i < actions_1.length)) return [3 /*break*/, 4];
                        action = actions_1[_i];
                        return [4 /*yield*/, this.executeAction(action)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Navigate to URL
     */
    BrowserAutomation.prototype.navigate = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.action("Navigating to ".concat(action.url));
                        return [4 /*yield*/, this.page.goto(action.url, {
                                waitUntil: action.waitUntil || 'load'
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Click element
     */
    BrowserAutomation.prototype.click = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var elementType, locator;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        logger_1.log.action("Clicking ".concat(Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector), action.options);
                        elementType = ((_a = action.options) === null || _a === void 0 ? void 0 : _a.button) === 'left' || !((_b = action.options) === null || _b === void 0 ? void 0 : _b.button) ? 'button' : undefined;
                        return [4 /*yield*/, this.smartLocator(action.selector, elementType)];
                    case 1:
                        locator = _c.sent();
                        return [4 /*yield*/, locator.click(action.options)];
                    case 2:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Type text
     */
    BrowserAutomation.prototype.type = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.action("Typing in ".concat(Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector), { textLength: action.text.length });
                        return [4 /*yield*/, this.smartLocator(action.selector, 'search')];
                    case 1:
                        locator = _a.sent();
                        // Clear existing text and type new text
                        return [4 /*yield*/, locator.fill(action.text)];
                    case 2:
                        // Clear existing text and type new text
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Press keyboard key
     */
    BrowserAutomation.prototype.press = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!action.selector) return [3 /*break*/, 3];
                        logger_1.log.action("Pressing ".concat(action.key, " in ").concat(Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector));
                        return [4 /*yield*/, this.smartLocator(action.selector)];
                    case 1:
                        locator = _a.sent();
                        return [4 /*yield*/, locator.press(action.key)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        logger_1.log.action("Pressing ".concat(action.key));
                        return [4 /*yield*/, this.page.keyboard.press(action.key)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Wait
     */
    BrowserAutomation.prototype.wait = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var selectorStr, candidates, validCandidates, found, _i, validCandidates_1, selector, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!action.duration) return [3 /*break*/, 2];
                        logger_1.log.action("Waiting ".concat(action.duration, "ms"));
                        return [4 /*yield*/, this.page.waitForTimeout(action.duration)];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 13];
                    case 2:
                        if (!(action.selector && action.selector !== undefined)) return [3 /*break*/, 11];
                        selectorStr = Array.isArray(action.selector) ? action.selector[0] : action.selector;
                        logger_1.log.action("Waiting for ".concat(selectorStr), { state: action.state });
                        candidates = Array.isArray(action.selector) ? action.selector : [action.selector];
                        validCandidates = candidates.filter(function (s) { return s && typeof s === 'string'; });
                        if (!(validCandidates.length === 0)) return [3 /*break*/, 4];
                        // No valid selectors, fall back to a default timeout
                        logger_1.log.action('No valid selectors provided, falling back to 2000ms timeout');
                        return [4 /*yield*/, this.page.waitForTimeout(2000)];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                    case 4:
                        found = false;
                        _i = 0, validCandidates_1 = validCandidates;
                        _b.label = 5;
                    case 5:
                        if (!(_i < validCandidates_1.length)) return [3 /*break*/, 10];
                        selector = validCandidates_1[_i];
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.page.waitForSelector(selector, {
                                state: action.state || 'visible',
                                timeout: 5000
                            })];
                    case 7:
                        _b.sent();
                        found = true;
                        return [3 /*break*/, 10];
                    case 8:
                        _a = _b.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10:
                        if (!found) {
                            throw new Error("None of the selectors became ".concat(action.state || 'visible', ": ").concat(validCandidates.join(', ')));
                        }
                        return [3 /*break*/, 13];
                    case 11:
                        // No duration or selector specified, use default timeout
                        logger_1.log.action('No duration or selector specified, using default 2000ms timeout');
                        return [4 /*yield*/, this.page.waitForTimeout(2000)];
                    case 12:
                        _b.sent();
                        _b.label = 13;
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Scroll
     */
    BrowserAutomation.prototype.scroll = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var selectorStr, locator, amount, direction, scrollMap, delta;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!action.selector) return [3 /*break*/, 3];
                        selectorStr = Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector;
                        logger_1.log.action("Scrolling element ".concat(selectorStr));
                        return [4 /*yield*/, this.smartLocator(action.selector)];
                    case 1:
                        locator = _a.sent();
                        return [4 /*yield*/, locator.scrollIntoViewIfNeeded()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        amount = action.amount || 500;
                        direction = action.direction || 'down';
                        logger_1.log.action("Scrolling ".concat(direction, " by ").concat(amount, "px"));
                        scrollMap = {
                            up: { x: 0, y: -amount },
                            down: { x: 0, y: amount },
                            left: { x: -amount, y: 0 },
                            right: { x: amount, y: 0 }
                        };
                        delta = scrollMap[direction];
                        return [4 /*yield*/, this.page.mouse.wheel(delta.x, delta.y)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Select option
     */
    BrowserAutomation.prototype.select = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var selectorStr, locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        selectorStr = Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector;
                        logger_1.log.action("Selecting ".concat(action.value, " in ").concat(selectorStr));
                        return [4 /*yield*/, this.smartLocator(action.selector)];
                    case 1:
                        locator = _a.sent();
                        return [4 /*yield*/, locator.selectOption(action.value)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Take screenshot
     */
    BrowserAutomation.prototype.screenshot = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.takeScreenshot(action.name, action.options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Go back in browser history
     */
    BrowserAutomation.prototype.goBack = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.action('Going back in browser history');
                        return [4 /*yield*/, this.page.goBack({
                                waitUntil: action.waitUntil || 'load',
                                timeout: 30000
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Go forward in browser history
     */
    BrowserAutomation.prototype.goForward = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.action('Going forward in browser history');
                        return [4 /*yield*/, this.page.goForward({
                                waitUntil: action.waitUntil || 'load',
                                timeout: 30000
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reload the current page
     */
    BrowserAutomation.prototype.reload = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.action('Reloading page');
                        return [4 /*yield*/, this.page.reload({
                                waitUntil: action.waitUntil || 'load',
                                timeout: 30000
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Open a new tab
     */
    BrowserAutomation.prototype.newTab = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var newPage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.action("Opening new tab".concat(action.url ? " with URL: ".concat(action.url) : ''));
                        return [4 /*yield*/, this.context.newPage()];
                    case 1:
                        newPage = _a.sent();
                        if (!action.url) return [3 /*break*/, 3];
                        return [4 /*yield*/, newPage.goto(action.url, {
                                waitUntil: 'load',
                                timeout: 30000
                            })];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        // Switch to the new tab
                        this.page = newPage;
                        return [4 /*yield*/, this.ensurePageActive()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Switch between tabs
     */
    BrowserAutomation.prototype.switchTab = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var pages, matchingPage, _i, pages_1, page, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pages = this.context.pages();
                        if (!(action.index !== undefined)) return [3 /*break*/, 4];
                        logger_1.log.action("Switching to tab at index ".concat(action.index));
                        if (!(action.index >= 0 && action.index < pages.length)) return [3 /*break*/, 2];
                        this.page = pages[action.index];
                        return [4 /*yield*/, this.page.bringToFront()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2: throw new Error("Tab index ".concat(action.index, " out of range (0-").concat(pages.length - 1, ")"));
                    case 3: return [3 /*break*/, 15];
                    case 4:
                        if (!action.url) return [3 /*break*/, 8];
                        logger_1.log.action("Switching to tab with URL containing: ".concat(action.url));
                        matchingPage = pages.find(function (page) { return page.url().includes(action.url); });
                        if (!matchingPage) return [3 /*break*/, 6];
                        this.page = matchingPage;
                        return [4 /*yield*/, this.page.bringToFront()];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6: throw new Error("No tab found with URL containing: ".concat(action.url));
                    case 7: return [3 /*break*/, 15];
                    case 8:
                        if (!action.title) return [3 /*break*/, 14];
                        logger_1.log.action("Switching to tab with title containing: ".concat(action.title));
                        _i = 0, pages_1 = pages;
                        _a.label = 9;
                    case 9:
                        if (!(_i < pages_1.length)) return [3 /*break*/, 13];
                        page = pages_1[_i];
                        return [4 /*yield*/, page.title()];
                    case 10:
                        title = _a.sent();
                        if (!title.includes(action.title)) return [3 /*break*/, 12];
                        this.page = page;
                        return [4 /*yield*/, this.page.bringToFront()];
                    case 11:
                        _a.sent();
                        return [2 /*return*/];
                    case 12:
                        _i++;
                        return [3 /*break*/, 9];
                    case 13: throw new Error("No tab found with title containing: ".concat(action.title));
                    case 14: throw new Error('SwitchTab action requires either index, url, or title');
                    case 15: return [4 /*yield*/, this.ensurePageActive()];
                    case 16:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Close a tab
     */
    BrowserAutomation.prototype.closeTab = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var pages, pageToClose, isCurrentPage, remainingPages, currentPage, currentIndex, newIndex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pages = this.context.pages();
                        if (pages.length === 1) {
                            throw new Error('Cannot close the last tab');
                        }
                        if (!(action.index !== undefined)) return [3 /*break*/, 6];
                        logger_1.log.action("Closing tab at index ".concat(action.index));
                        if (!(action.index >= 0 && action.index < pages.length)) return [3 /*break*/, 4];
                        pageToClose = pages[action.index];
                        isCurrentPage = pageToClose === this.page;
                        return [4 /*yield*/, pageToClose.close()];
                    case 1:
                        _a.sent();
                        if (!isCurrentPage) return [3 /*break*/, 3];
                        remainingPages = this.context.pages();
                        this.page = remainingPages[remainingPages.length - 1];
                        return [4 /*yield*/, this.ensurePageActive()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4: throw new Error("Tab index ".concat(action.index, " out of range (0-").concat(pages.length - 1, ")"));
                    case 5: return [3 /*break*/, 9];
                    case 6:
                        logger_1.log.action('Closing current tab');
                        currentPage = this.page;
                        currentIndex = pages.indexOf(currentPage);
                        newIndex = currentIndex > 0 ? currentIndex - 1 : 1;
                        this.page = pages[newIndex];
                        return [4 /*yield*/, this.ensurePageActive()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, currentPage.close()];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Take screenshot with specified options
     */
    BrowserAutomation.prototype.takeScreenshot = function (name, options) {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, filename, filepath;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: 
                    // Ensure page is active before taking screenshot
                    return [4 /*yield*/, this.ensurePageActive()];
                    case 1:
                        // Ensure page is active before taking screenshot
                        _b.sent();
                        if (!this.page) {
                            throw new Error('Browser not initialized');
                        }
                        // Ensure screenshot directory exists
                        return [4 /*yield*/, fs_extra_1.default.ensureDir(config_1.Config.SCREENSHOT_PATH)];
                    case 2:
                        // Ensure screenshot directory exists
                        _b.sent();
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        filename = "".concat(name, "_").concat(timestamp, ".").concat((options === null || options === void 0 ? void 0 : options.type) || 'png');
                        filepath = path_1.default.join(config_1.Config.SCREENSHOT_PATH, filename);
                        logger_1.log.action("Taking screenshot: ".concat(filename));
                        // Take screenshot
                        return [4 /*yield*/, this.page.screenshot({
                                path: filepath,
                                fullPage: (_a = options === null || options === void 0 ? void 0 : options.fullPage) !== null && _a !== void 0 ? _a : true,
                                quality: (options === null || options === void 0 ? void 0 : options.type) === 'jpeg' ? (options.quality || config_1.Config.SCREENSHOT_QUALITY) : undefined,
                                type: (options === null || options === void 0 ? void 0 : options.type) || 'png'
                            })];
                    case 3:
                        // Take screenshot
                        _b.sent();
                        this.screenshotCount++;
                        logger_1.log.info("Screenshot saved: ".concat(filepath));
                        return [2 /*return*/, filepath];
                }
            });
        });
    };
    /**
     * Evaluate JavaScript in page context
     */
    BrowserAutomation.prototype.evaluate = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.ensurePageActive()];
                    case 1:
                        _a.sent();
                        if (!this.page) {
                            throw new Error('Browser not initialized');
                        }
                        return [4 /*yield*/, this.page.evaluate(fn)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get current page URL
     */
    BrowserAutomation.prototype.getCurrentUrl = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.page)
                            return [2 /*return*/, ''];
                        return [4 /*yield*/, this.page.url()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_5 = _a.sent();
                        logger_1.log.debug('Failed to get current URL: ' + error_5.message);
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Close browser
     */
    BrowserAutomation.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.info('Closing browser...');
                        if (!this.page) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.page.close()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!this.context) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.context.close()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        if (!this.browser) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.browser.close()];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        logger_1.log.info("Browser closed. Screenshots taken: ".concat(this.screenshotCount));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if browser is running
     */
    BrowserAutomation.prototype.isConnected = function () {
        return !!this.browser && this.browser.isConnected();
    };
    /**
     * Debug: analyze modal overlays on current page
     */
    BrowserAutomation.prototype.debugModalOverlays = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page) {
                            throw new Error('Browser not initialized');
                        }
                        return [4 /*yield*/, this.page.evaluate(function () {
                                var _a, _b;
                                // Find potential modal elements
                                var modalSelectors = [
                                    '[role="dialog"]',
                                    '[role="alert"]',
                                    '[role="alertdialog"]',
                                    '.modal',
                                    '.dialog',
                                    '.popup',
                                    '[class*="modal"]',
                                    '[class*="dialog"]',
                                    '[class*="overlay"]',
                                    'div[style*="z-index"][style*="position: fixed"]',
                                    'div[style*="z-index"][style*="position: absolute"]'
                                ];
                                var modals = modalSelectors.flatMap(function (selector) {
                                    return Array.from(document.querySelectorAll(selector));
                                });
                                var modalInfo = modals.map(function (modal) {
                                    var style = window.getComputedStyle(modal);
                                    var rect = modal.getBoundingClientRect();
                                    var isVisible = style.display !== 'none' &&
                                        style.visibility !== 'hidden' &&
                                        parseFloat(style.opacity) > 0 &&
                                        rect.width > 0 &&
                                        rect.height > 0;
                                    return {
                                        element: modal.tagName.toLowerCase() +
                                            (modal.id ? "#".concat(modal.id) : '') +
                                            (modal.className ? ".".concat(modal.className.split(' ').filter(function (c) { return c; }).join('.')) : ''),
                                        visible: isVisible,
                                        display: style.display,
                                        visibility: style.visibility,
                                        opacity: style.opacity,
                                        position: style.position,
                                        zIndex: style.zIndex,
                                        width: rect.width,
                                        height: rect.height,
                                        top: rect.top,
                                        left: rect.left,
                                        innerHTML: modal.innerHTML.substring(0, 100) + '...'
                                    };
                                });
                                // Also check for inputs and their state
                                var inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input:not([type])'));
                                var inputInfo = inputs.map(function (input) {
                                    var inputEl = input;
                                    var style = window.getComputedStyle(inputEl);
                                    var rect = inputEl.getBoundingClientRect();
                                    var isInteractable = style.display !== 'none' &&
                                        style.visibility !== 'hidden' &&
                                        !inputEl.disabled &&
                                        rect.width > 0 &&
                                        rect.height > 0;
                                    return {
                                        selector: inputEl.tagName.toLowerCase() +
                                            (inputEl.id ? "#".concat(inputEl.id) : '') +
                                            (inputEl.name ? "[name=\"".concat(inputEl.name, "\"]") : '') +
                                            (inputEl.type ? "[type=\"".concat(inputEl.type, "\"]") : ''),
                                        interactable: isInteractable,
                                        disabled: inputEl.disabled,
                                        readOnly: inputEl.readOnly,
                                        display: style.display,
                                        visibility: style.visibility,
                                        zIndex: style.zIndex,
                                        position: style.position,
                                        placeholder: inputEl.placeholder,
                                        value: inputEl.value
                                    };
                                });
                                return {
                                    modals: modalInfo,
                                    visibleModalCount: modalInfo.filter(function (m) { return m.visible; }).length,
                                    inputs: inputInfo,
                                    interactableInputCount: inputInfo.filter(function (i) { return i.interactable; }).length,
                                    documentReadyState: document.readyState,
                                    activeElement: ((_a = document.activeElement) === null || _a === void 0 ? void 0 : _a.tagName) +
                                        (((_b = document.activeElement) === null || _b === void 0 ? void 0 : _b.id) ? "#".concat(document.activeElement.id) : '')
                                };
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BrowserAutomation.prototype.captureSessionState = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, cookies, storageData, url, title, viewport, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.page) {
                            throw new Error('Page not initialized');
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.all([
                                this.context.cookies(),
                                this.page.evaluate(function () { return ({
                                    localStorage: __assign({}, window.localStorage),
                                    sessionStorage: __assign({}, window.sessionStorage)
                                }); }),
                                this.page.url(),
                                this.page.title(),
                                this.page.viewportSize()
                            ])];
                    case 2:
                        _a = _b.sent(), cookies = _a[0], storageData = _a[1], url = _a[2], title = _a[3], viewport = _a[4];
                        return [2 /*return*/, {
                                cookies: cookies,
                                localStorage: storageData.localStorage,
                                sessionStorage: storageData.sessionStorage,
                                url: url,
                                title: title,
                                viewport: viewport
                            }];
                    case 3:
                        error_6 = _b.sent();
                        logger_1.log.error('Failed to capture session state', error_6);
                        throw error_6;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Restore browser session state
     */
    BrowserAutomation.prototype.restoreSessionState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            var error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page || !this.context) {
                            throw new Error('Browser not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 11]);
                        if (!state.cookies) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.context.addCookies(state.cookies)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        if (!state.viewport) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.page.setViewportSize(state.viewport)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        if (!state.url) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.page.goto(state.url)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        if (!(state.localStorage || state.sessionStorage)) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.page.evaluate(function (storage) {
                                if (storage.localStorage) {
                                    Object.entries(storage.localStorage).forEach(function (_a) {
                                        var key = _a[0], value = _a[1];
                                        window.localStorage.setItem(key, value);
                                    });
                                }
                                if (storage.sessionStorage) {
                                    Object.entries(storage.sessionStorage).forEach(function (_a) {
                                        var key = _a[0], value = _a[1];
                                        window.sessionStorage.setItem(key, value);
                                    });
                                }
                            }, { localStorage: state.localStorage, sessionStorage: state.sessionStorage })];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        logger_1.log.info('Session state restored successfully');
                        return [3 /*break*/, 11];
                    case 10:
                        error_7 = _a.sent();
                        logger_1.log.error('Failed to restore session state', error_7);
                        throw error_7;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save session state to file
     */
    BrowserAutomation.prototype.saveSessionStateToFile = function (filepath) {
        return __awaiter(this, void 0, void 0, function () {
            var state;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.captureSessionState()];
                    case 1:
                        state = _a.sent();
                        return [4 /*yield*/, fs_extra_1.default.ensureDir(path_1.default.dirname(filepath))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, fs_extra_1.default.writeJson(filepath, state, { spaces: 2 })];
                    case 3:
                        _a.sent();
                        logger_1.log.info("Session state saved to: ".concat(filepath));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load session state from file
     */
    BrowserAutomation.prototype.loadSessionStateFromFile = function (filepath) {
        return __awaiter(this, void 0, void 0, function () {
            var state;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_extra_1.default.readJson(filepath)];
                    case 1:
                        state = _a.sent();
                        return [4 /*yield*/, this.restoreSessionState(state)];
                    case 2:
                        _a.sent();
                        logger_1.log.info("Session state loaded from: ".concat(filepath));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if page is still active and reopen if needed
     */
    BrowserAutomation.prototype.ensurePageActive = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, lastUrl, error_8;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        if (!(!this.page || this.page.isClosed())) return [3 /*break*/, 4];
                        logger_1.log.warn('[BROWSER] Page was closed, reopening...');
                        if (!(this.context && !this.context.pages().length)) return [3 /*break*/, 4];
                        _a = this;
                        return [4 /*yield*/, this.context.newPage()];
                    case 1:
                        _a.page = _b.sent();
                        return [4 /*yield*/, this.getCurrentUrlSafe()];
                    case 2:
                        lastUrl = _b.sent();
                        if (!(lastUrl && lastUrl !== 'about:blank')) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.page.goto(lastUrl)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_8 = _b.sent();
                        logger_1.log.error('[BROWSER] Failed to ensure page is active', error_8);
                        throw new Error('Browser page is not available');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current URL safely without throwing
     */
    BrowserAutomation.prototype.getCurrentUrlSafe = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    if (this.page && !this.page.isClosed()) {
                        return [2 /*return*/, this.page.url()];
                    }
                }
                catch (_b) {
                    // Ignore errors
                }
                return [2 /*return*/, null];
            });
        });
    };
    /**
     * Get current page HTML content
     */
    BrowserAutomation.prototype.getPageHTML = function () {
        return __awaiter(this, void 0, void 0, function () {
            var html, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page) {
                            throw new Error('Page not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.page.content()];
                    case 2:
                        html = _a.sent();
                        return [2 /*return*/, html];
                    case 3:
                        error_9 = _a.sent();
                        logger_1.log.error('Failed to get page HTML', error_9);
                        return [2 /*return*/, ''];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Take a high-quality screenshot with error context
     */
    BrowserAutomation.prototype.takeHighQualityScreenshot = function (name_1) {
        return __awaiter(this, arguments, void 0, function (name, includeFullPage) {
            var timestamp, filename, filepath, error_10;
            if (includeFullPage === void 0) { includeFullPage = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page) {
                            throw new Error('Page not initialized');
                        }
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        filename = "".concat(name, "_").concat(timestamp, ".png");
                        filepath = path_1.default.join(this.config.screenshotPath || './screenshots', filename);
                        return [4 /*yield*/, fs_extra_1.default.ensureDir(path_1.default.dirname(filepath))];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.page.screenshot({
                                path: filepath,
                                fullPage: includeFullPage,
                                type: 'png' // PNG for highest quality, no compression
                            })];
                    case 3:
                        _a.sent();
                        logger_1.log.info("High-quality screenshot saved: ".concat(filepath));
                        return [2 /*return*/, filepath];
                    case 4:
                        error_10 = _a.sent();
                        logger_1.log.error('Failed to take high-quality screenshot', error_10);
                        throw error_10;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Capture failure context (HTML + Screenshot)
     */
    BrowserAutomation.prototype.captureFailureContext = function (stepDescription) {
        return __awaiter(this, void 0, void 0, function () {
            var html, timestamp, htmlFilename, htmlPath, htmlPreview, screenshotPath, pageInfo, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.info("[FAILURE_CONTEXT] Capturing context for failed step: ".concat(stepDescription));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        return [4 /*yield*/, this.getPageHTML()];
                    case 2:
                        html = _a.sent();
                        // Log HTML details
                        logger_1.log.info("[FAILURE_CONTEXT] Captured HTML length: ".concat(html.length, " characters"));
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        htmlFilename = "failure_".concat(stepDescription.replace(/\s+/g, '_'), "_").concat(timestamp, ".html");
                        htmlPath = path_1.default.join('./logs', htmlFilename);
                        return [4 /*yield*/, fs_extra_1.default.ensureDir(path_1.default.dirname(htmlPath))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, fs_extra_1.default.writeFile(htmlPath, html)];
                    case 4:
                        _a.sent();
                        logger_1.log.info("[FAILURE_CONTEXT] HTML saved to: ".concat(htmlPath));
                        htmlPreview = html.slice(0, 2000);
                        logger_1.log.debug("[FAILURE_CONTEXT] HTML preview:\n".concat(htmlPreview, "\n... (truncated)"));
                        return [4 /*yield*/, this.takeHighQualityScreenshot("failure_".concat(stepDescription.replace(/\s+/g, '_')))];
                    case 5:
                        screenshotPath = _a.sent();
                        return [4 /*yield*/, this.page.evaluate(function () {
                                // Check for actually visible modals
                                var modalSelectors = '[role="dialog"], .modal, .popup, .overlay, [class*="modal"], [id*="modal"]';
                                var modals = Array.from(document.querySelectorAll(modalSelectors));
                                // Filter for actually visible modals
                                var visibleModals = modals.filter(function (modal) {
                                    var style = window.getComputedStyle(modal);
                                    var rect = modal.getBoundingClientRect();
                                    var isVisible = style.display !== 'none' &&
                                        style.visibility !== 'hidden' &&
                                        style.opacity !== '0' &&
                                        rect.width > 0 &&
                                        rect.height > 0;
                                    return isVisible;
                                });
                                // Collect modal debug info
                                var modalDebugInfo = visibleModals.map(function (modal) { return ({
                                    selector: modal.tagName.toLowerCase() +
                                        (modal.id ? "#".concat(modal.id) : '') +
                                        (modal.className ? ".".concat(modal.className.split(' ').join('.')) : ''),
                                    display: window.getComputedStyle(modal).display,
                                    visibility: window.getComputedStyle(modal).visibility,
                                    opacity: window.getComputedStyle(modal).opacity,
                                    zIndex: window.getComputedStyle(modal).zIndex,
                                    position: window.getComputedStyle(modal).position,
                                    dimensions: "".concat(modal.getBoundingClientRect().width, "x").concat(modal.getBoundingClientRect().height)
                                }); });
                                return {
                                    title: document.title,
                                    url: window.location.href,
                                    readyState: document.readyState,
                                    hasCaptcha: !!document.querySelector('[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'),
                                    hasModal: visibleModals.length > 0,
                                    modalCount: visibleModals.length,
                                    modalDebugInfo: modalDebugInfo,
                                    formCount: document.querySelectorAll('form').length,
                                    inputCount: document.querySelectorAll('input, textarea, select').length,
                                    buttonCount: document.querySelectorAll('button, input[type="submit"], input[type="button"]').length
                                };
                            })];
                    case 6:
                        pageInfo = _a.sent();
                        logger_1.log.info("[FAILURE_CONTEXT] Page info: ".concat(JSON.stringify(pageInfo, null, 2)));
                        return [2 /*return*/, { html: html, screenshotPath: screenshotPath }];
                    case 7:
                        error_11 = _a.sent();
                        logger_1.log.error('Failed to capture failure context', error_11);
                        return [2 /*return*/, { html: '', screenshotPath: '' }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Enhanced execute action with failure context capture
     */
    BrowserAutomation.prototype.executeActionWithContext = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var error_12, context;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 4]);
                        return [4 /*yield*/, this.executeAction(action)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, { success: true }];
                    case 2:
                        error_12 = _a.sent();
                        return [4 /*yield*/, this.captureFailureContext("".concat(action.type, " action"))];
                    case 3:
                        context = _a.sent();
                        return [2 /*return*/, { success: false, context: context }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Debug method to check for blocking elements on the page
     */
    BrowserAutomation.prototype.debugPageBlockers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.evaluate(function () {
                            var modalSelectors = '[role="dialog"], .modal, .popup, .overlay, [class*="modal"], [id*="modal"]';
                            var allModals = Array.from(document.querySelectorAll(modalSelectors));
                            var modalInfo = allModals.map(function (modal) {
                                var style = window.getComputedStyle(modal);
                                var rect = modal.getBoundingClientRect();
                                var isVisible = style.display !== 'none' &&
                                    style.visibility !== 'hidden' &&
                                    style.opacity !== '0' &&
                                    rect.width > 0 &&
                                    rect.height > 0;
                                return {
                                    element: modal.tagName.toLowerCase() +
                                        (modal.id ? "#".concat(modal.id) : ''),
                                    visible: isVisible
                                };
                            });
                            return {
                                modals: modalInfo,
                                count: modalInfo.length,
                                visibleCount: modalInfo.filter(function (m) { return m.visible; }).length
                            };
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return BrowserAutomation;
}());
exports.BrowserAutomation = BrowserAutomation;
