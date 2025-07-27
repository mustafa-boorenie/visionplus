import { BrowserAction } from '../types';
import { log } from '../utils/logger';
import { LearningPattern } from './FeedbackManager';
import fs from 'fs-extra';
import path from 'path';

/**
 * Rule types for different automation scenarios
 */
export interface AutomationRule {
  id: string;
  type: 'selector' | 'timing' | 'recovery' | 'workflow';
  priority: number;
  conditions: {
    url?: string | RegExp;
    action?: string;
    error?: string | RegExp;
  };
  solution: {
    selectors?: string[];
    wait?: number;
    retryCount?: number;
    alternativeActions?: BrowserAction[];
  };
  confidence: number;
  lastUpdated: Date;
  successCount: number;
  failureCount: number;
}

/**
 * Rules engine for dynamic automation behavior updates
 */
export class RulesEngine {
  private rulesFile: string;
  private rules: Map<string, AutomationRule> = new Map();
  private maxRules: number = 500;

  constructor(rulesDir: string = './rules') {
    this.rulesFile = path.join(rulesDir, 'automation-rules.json');
    fs.ensureDirSync(rulesDir);
  }

  /**
   * Initialize rules engine
   */
  async initialize(): Promise<void> {
    await this.loadRules();
    log.info(`RulesEngine initialized with ${this.rules.size} rules`);
  }

  /**
   * Update rules based on learning patterns
   */
  async updateFromPatterns(patterns: LearningPattern[]): Promise<void> {
    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'selector_change':
          await this.createSelectorRule(pattern);
          break;
        case 'timing_issue':
          await this.createTimingRule(pattern);
          break;
        default:
          log.warn(`Unknown pattern type: ${pattern.type}`);
      }
    }
    
    await this.saveRules();
    await this.pruneOldRules();
  }

  /**
   * Create selector fallback rule
   */
  private async createSelectorRule(pattern: LearningPattern): Promise<void> {
    const ruleId = `selector_${pattern.affectedUrls[0]}_${Date.now()}`;
    
    const rule: AutomationRule = {
      id: ruleId,
      type: 'selector',
      priority: Math.round(pattern.confidence * 10),
      conditions: {
        url: pattern.affectedUrls[0],
        error: /selector|element not found/i
      },
      solution: {
        selectors: pattern.suggestedRule?.alternativeSelectors || []
      },
      confidence: pattern.confidence,
      lastUpdated: new Date(),
      successCount: 0,
      failureCount: 0
    };
    
    this.rules.set(ruleId, rule);
    log.info(`Created selector rule for ${pattern.affectedUrls[0]}`);
  }

  /**
   * Create timing adjustment rule
   */
  private async createTimingRule(pattern: LearningPattern): Promise<void> {
    const ruleId = `timing_${pattern.affectedUrls[0]}_${Date.now()}`;
    
    const rule: AutomationRule = {
      id: ruleId,
      type: 'timing',
      priority: Math.round(pattern.confidence * 10),
      conditions: {
        url: pattern.affectedUrls[0],
        error: /timeout|not ready/i
      },
      solution: {
        wait: pattern.suggestedRule?.suggestedWait || 3000,
        retryCount: 3
      },
      confidence: pattern.confidence,
      lastUpdated: new Date(),
      successCount: 0,
      failureCount: 0
    };
    
    this.rules.set(ruleId, rule);
    log.info(`Created timing rule for ${pattern.affectedUrls[0]}`);
  }

  /**
   * Get applicable rules for a given context
   */
  async getApplicableRules(context: {
    url: string;
    action: BrowserAction;
    error?: string;
  }): Promise<AutomationRule[]> {
    const applicable: AutomationRule[] = [];
    
    for (const rule of this.rules.values()) {
      if (this.matchesConditions(rule, context)) {
        applicable.push(rule);
      }
    }
    
    // Sort by priority (higher first)
    return applicable.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if rule conditions match context
   */
  private matchesConditions(rule: AutomationRule, context: any): boolean {
    // Check URL condition
    if (rule.conditions.url) {
      if (rule.conditions.url instanceof RegExp) {
        if (!rule.conditions.url.test(context.url)) return false;
      } else {
        if (!context.url.includes(rule.conditions.url)) return false;
      }
    }
    
    // Check action type
    if (rule.conditions.action && rule.conditions.action !== context.action.type) {
      return false;
    }
    
    // Check error pattern
    if (rule.conditions.error && context.error) {
      if (rule.conditions.error instanceof RegExp) {
        if (!rule.conditions.error.test(context.error)) return false;
      } else {
        if (!context.error.includes(rule.conditions.error)) return false;
      }
    }
    
    return true;
  }

  /**
   * Update rule success/failure metrics
   */
  async updateRuleMetrics(ruleId: string, success: boolean): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    
    if (success) {
      rule.successCount++;
      rule.confidence = Math.min(0.99, rule.confidence + 0.05);
    } else {
      rule.failureCount++;
      rule.confidence = Math.max(0.1, rule.confidence - 0.1);
    }
    
    rule.lastUpdated = new Date();
    
    // Recalculate priority based on confidence and usage
    const usage = rule.successCount + rule.failureCount;
    rule.priority = Math.round(rule.confidence * 10 + Math.min(usage / 10, 5));
    
    await this.saveRules();
  }

  /**
   * Get enhanced action with rule-based modifications
   */
  async enhanceAction(
    action: BrowserAction,
    url: string,
    previousError?: string
  ): Promise<BrowserAction> {
    const context = { url, action, error: previousError };
    const rules = await this.getApplicableRules(context);
    
    if (rules.length === 0) return action;
    
    const enhancedAction = { ...action };
    const topRule = rules[0];
    
    // Apply rule solution
    if (topRule.solution.selectors && 'selector' in enhancedAction) {
      enhancedAction.selector = topRule.solution.selectors;
    }
    
    if (topRule.solution.wait && enhancedAction.type === 'wait') {
      enhancedAction.duration = topRule.solution.wait;
    }
    
    log.info(`Applied rule ${topRule.id} to enhance action`);
    return enhancedAction;
  }

  /**
   * Export rules for review
   */
  async exportRules(): Promise<AutomationRule[]> {
    return Array.from(this.rules.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Manually add or update a rule
   */
  async addRule(rule: Omit<AutomationRule, 'id' | 'lastUpdated'>): Promise<void> {
    const ruleWithId: AutomationRule = {
      ...rule,
      id: `manual_${Date.now()}`,
      lastUpdated: new Date()
    };
    
    this.rules.set(ruleWithId.id, ruleWithId);
    await this.saveRules();
    log.info(`Added manual rule: ${ruleWithId.id}`);
  }

  /**
   * Remove rules with low confidence or old age
   */
  private async pruneOldRules(): Promise<void> {
    if (this.rules.size <= this.maxRules) return;
    
    const sortedRules = Array.from(this.rules.values())
      .sort((a, b) => {
        // Sort by confidence and recency
        const scoreA = a.confidence * 0.7 + (Date.now() - a.lastUpdated.getTime()) / (1000 * 60 * 60 * 24) * 0.3;
        const scoreB = b.confidence * 0.7 + (Date.now() - b.lastUpdated.getTime()) / (1000 * 60 * 60 * 24) * 0.3;
        return scoreB - scoreA;
      });
    
    // Keep top rules
    const rulesToKeep = sortedRules.slice(0, this.maxRules);
    this.rules.clear();
    
    for (const rule of rulesToKeep) {
      this.rules.set(rule.id, rule);
    }
    
    log.info(`Pruned rules from ${sortedRules.length} to ${this.rules.size}`);
  }

  /**
   * Load rules from disk
   */
  private async loadRules(): Promise<void> {
    if (await fs.pathExists(this.rulesFile)) {
      const data = await fs.readJSON(this.rulesFile);
      
      // Convert dates and regexes
      for (const [id, rule] of Object.entries(data) as [string, any][]) {
        rule.lastUpdated = new Date(rule.lastUpdated);
        
        // Convert regex strings back to RegExp
        if (rule.conditions.url && typeof rule.conditions.url === 'object' && rule.conditions.url.regex) {
          rule.conditions.url = new RegExp(rule.conditions.url.regex, rule.conditions.url.flags);
        }
        if (rule.conditions.error && typeof rule.conditions.error === 'object' && rule.conditions.error.regex) {
          rule.conditions.error = new RegExp(rule.conditions.error.regex, rule.conditions.error.flags);
        }
        
        this.rules.set(id, rule);
      }
    }
  }

  /**
   * Save rules to disk
   */
  private async saveRules(): Promise<void> {
    const data: any = {};
    
    for (const [id, rule] of this.rules.entries()) {
      const serializedRule = { ...rule };
      
      // Convert RegExp to serializable format
      if (serializedRule.conditions.url instanceof RegExp) {
        serializedRule.conditions.url = {
          regex: serializedRule.conditions.url.source,
          flags: serializedRule.conditions.url.flags
        } as any;
      }
      if (serializedRule.conditions.error instanceof RegExp) {
        serializedRule.conditions.error = {
          regex: serializedRule.conditions.error.source,
          flags: serializedRule.conditions.error.flags
        } as any;
      }
      
      data[id] = serializedRule;
    }
    
    await fs.writeJSON(this.rulesFile, data, { spaces: 2 });
  }
} 