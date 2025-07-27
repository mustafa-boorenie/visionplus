import { BrowserAction } from '../types';
import { log } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Feedback entry for tracking automation success/failure
 */
export interface FeedbackEntry {
  id: string;
  timestamp: Date;
  url: string;
  action: BrowserAction;
  success: boolean;
  error?: string;
  userFeedback?: string;
  pageContext: {
    html: string;
    screenshot?: string;
    selectors?: string[];
  };
  recovery?: {
    attempted: boolean;
    successful: boolean;
    method?: string;
    newAction?: BrowserAction;
  };
  expectScript?: string;
}

/**
 * Learning pattern detected from feedback
 */
export interface LearningPattern {
  type: 'selector_change' | 'timing_issue' | 'modal_interference' | 'new_workflow';
  confidence: number;
  pattern: string;
  suggestedRule?: any;
  affectedUrls: string[];
  occurrences: number;
}

/**
 * Manages feedback collection and learning from automation results
 */
export class FeedbackManager {
  private feedbackDir: string;
  private patternsFile: string;
  private patterns: Map<string, LearningPattern> = new Map();

  constructor(feedbackDir: string = './feedback') {
    this.feedbackDir = feedbackDir;
    this.patternsFile = path.join(feedbackDir, 'patterns.json');
  }

  /**
   * Initialize feedback manager
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.feedbackDir);
    await fs.ensureDir(path.join(this.feedbackDir, 'entries'));
    await fs.ensureDir(path.join(this.feedbackDir, 'training-data'));
    await this.loadPatterns();
    log.info('FeedbackManager initialized');
  }

  /**
   * Record feedback for an automation action
   */
  async recordFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp'>): Promise<FeedbackEntry> {
    const feedback: FeedbackEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      ...entry
    };

    // Save feedback entry
    const entryPath = path.join(
      this.feedbackDir, 
      'entries', 
      `${feedback.timestamp.toISOString().split('T')[0]}_${feedback.id}.json`
    );
    await fs.writeJSON(entryPath, feedback, { spaces: 2 });

    // Analyze for patterns
    await this.analyzeForPatterns(feedback);

    log.info(`Recorded feedback: ${feedback.success ? 'SUCCESS' : 'FAILURE'} for ${feedback.action.type}`);
    return feedback;
  }

  /**
   * Analyze feedback for learning patterns
   */
  private async analyzeForPatterns(feedback: FeedbackEntry): Promise<void> {
    if (!feedback.success && feedback.error) {
      // Selector change pattern
      if (feedback.error.includes('selector') || feedback.error.includes('element not found')) {
        const patternKey = `selector_${feedback.url}_${feedback.action.type}`;
        const existing = this.patterns.get(patternKey);
        
        if (existing) {
          existing.occurrences++;
          existing.confidence = Math.min(0.9, existing.confidence + 0.1);
        } else {
          this.patterns.set(patternKey, {
            type: 'selector_change',
            confidence: 0.5,
            pattern: `Selector failure on ${feedback.url}`,
            affectedUrls: [feedback.url],
            occurrences: 1,
            suggestedRule: {
              url: feedback.url,
              oldSelector: (feedback.action as any).selector,
              alternativeSelectors: feedback.pageContext.selectors
            }
          });
        }
      }

      // Timing issue pattern
      if (feedback.error.includes('timeout') || feedback.error.includes('not ready')) {
        const patternKey = `timing_${feedback.url}`;
        const existing = this.patterns.get(patternKey);
        
        if (existing) {
          existing.occurrences++;
        } else {
          this.patterns.set(patternKey, {
            type: 'timing_issue',
            confidence: 0.6,
            pattern: `Page loading slowly on ${feedback.url}`,
            affectedUrls: [feedback.url],
            occurrences: 1,
            suggestedRule: {
              url: feedback.url,
              suggestedWait: 3000
            }
          });
        }
      }
    }

    // Save patterns
    await this.savePatterns();
  }

  /**
   * Get learning patterns for rules engine
   */
  async getLearningPatterns(minConfidence: number = 0.7): Promise<LearningPattern[]> {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate training data for LLM fine-tuning
   */
  async generateTrainingData(): Promise<{
    conversations: Array<{
      messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>;
    }>;
  }> {
    const entries = await this.loadRecentFeedback(100);
    const conversations = [];

    for (const entry of entries) {
      if (entry.recovery?.successful && entry.recovery.newAction) {
        // Create training example from successful recovery
        conversations.push({
          messages: [
            {
              role: 'system' as const,
              content: 'You are an expert web automation assistant. When an action fails, suggest alternative approaches.'
            },
            {
              role: 'user' as const,
              content: `The following action failed on ${entry.url}:
Action: ${JSON.stringify(entry.action)}
Error: ${entry.error}
Page context: ${entry.pageContext.html.substring(0, 500)}...

What alternative action should I try?`
            },
            {
              role: 'assistant' as const,
              content: `Based on the error and page context, I suggest trying:
${JSON.stringify(entry.recovery.newAction)}

Reason: ${entry.recovery.method || 'Alternative selector strategy'}`
            }
          ]
        });
      }
    }

    // Save training data
    const trainingPath = path.join(
      this.feedbackDir, 
      'training-data', 
      `training_${Date.now()}.json`
    );
    await fs.writeJSON(trainingPath, { conversations }, { spaces: 2 });

    log.info(`Generated ${conversations.length} training examples`);
    return { conversations };
  }

  /**
   * Load recent feedback entries
   */
  private async loadRecentFeedback(limit: number): Promise<FeedbackEntry[]> {
    const entriesDir = path.join(this.feedbackDir, 'entries');
    const files = await fs.readdir(entriesDir);
    
    const entries: FeedbackEntry[] = [];
    const sortedFiles = files.sort().reverse().slice(0, limit);
    
    for (const file of sortedFiles) {
      if (file.endsWith('.json')) {
        const entry = await fs.readJSON(path.join(entriesDir, file));
        entries.push(entry);
      }
    }
    
    return entries;
  }

  /**
   * Generate expect script from successful action [[memory:4393012]]
   */
  async generateExpectScript(
    action: BrowserAction,
    pageStateBefore: any,
    pageStateAfter: any
  ): Promise<string> {
    const expectStatements: string[] = [];
    
    // Generate expect statements based on action type
    switch (action.type) {
      case 'click':
        // Check if new elements appeared
        if (pageStateAfter.url !== pageStateBefore.url) {
          expectStatements.push(`await expect(page).toHaveURL(/${pageStateAfter.url}/);`);
        }
        break;
        
      case 'type':
        // Check if input value changed
        const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
        if (selector && action.text) {
          expectStatements.push(`await expect(page.locator('${selector}')).toHaveValue('${action.text}');`);
        }
        break;
        
      case 'navigate':
        expectStatements.push(`await expect(page).toHaveURL('${action.url}');`);
        break;
    }
    
    // Add generic visibility checks for key elements
    if (pageStateAfter.visibleElements) {
      const importantElements = pageStateAfter.visibleElements
        .filter((el: any) => el.role === 'button' || el.role === 'link')
        .slice(0, 3);
        
      for (const element of importantElements) {
        if (element.selector) {
          expectStatements.push(`await expect(page.locator('${element.selector}')).toBeVisible();`);
        }
      }
    }
    
    return expectStatements.join('\n');
  }

  /**
   * Clean up old feedback entries
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    const entriesDir = path.join(this.feedbackDir, 'entries');
    const files = await fs.readdir(entriesDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let removedCount = 0;
    for (const file of files) {
      const filePath = path.join(entriesDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.remove(filePath);
        removedCount++;
      }
    }
    
    log.info(`Cleaned up ${removedCount} old feedback entries`);
  }

  /**
   * Load patterns from disk
   */
  private async loadPatterns(): Promise<void> {
    if (await fs.pathExists(this.patternsFile)) {
      const data = await fs.readJSON(this.patternsFile);
      this.patterns = new Map(Object.entries(data));
    }
  }

  /**
   * Save patterns to disk
   */
  private async savePatterns(): Promise<void> {
    const data = Object.fromEntries(this.patterns);
    await fs.writeJSON(this.patternsFile, data, { spaces: 2 });
  }
} 