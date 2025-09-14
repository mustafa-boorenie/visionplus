import { BrowserAction } from './browser.types';

/**
 * Automation script definition
 */
export interface AutomationScript {
  name: string;
  description?: string;
  url: string;
  actions: BrowserAction[];
  analysis?: {
    enabled: boolean;
    prompts: string[];
  };
}

/**
 * Execution result from an automation run
 */
export interface AutomationExecutionResult {
  success: boolean;
  script: AutomationScript;
  executionTime: number;
  screenshots: string[];
  errors?: string[];
  testFile?: string;
  stepResults?: Array<{
    step: string;
    success: boolean;
    error?: string;
    duration: number;
  }>;
}

/**
 * Automation sequence metadata
 */
export interface SequenceMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  tags?: string[];
  category?: string;
  successRate?: number;
}

/**
 * Automation sequence - combines prompt, script, and metadata for reuse
 */
export interface AutomationSequence {
  metadata: SequenceMetadata;
  originalPrompt: string;
  script: AutomationScript;
  executionHistory: Array<{
    timestamp: Date;
    success: boolean;
    executionTime: number;
    errors?: string[];
  }>;
}

/**
 * Search criteria for finding sequences
 */
export interface SequenceSearchCriteria {
  name?: string;
  category?: string;
  tags?: string[];
  url?: string;
  prompt?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  minSuccessRate?: number;
}

/**
 * Vision analysis request
 */
export interface VisionAnalysisRequest {
  screenshotPath: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Vision analysis response
 */
export interface VisionAnalysisResponse {
  content: string;
  timestamp: Date;
  screenshotPath: string;
  prompt: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Recovery options for failed steps
 */
export interface RecoveryOption {
  id: string;
  description: string;
  confidence: number;
  reason: string;
  actions: BrowserAction[];
}

/**
 * Recovery context for failure handling
 */
export interface RecoveryContext {
  step: string;
  action: BrowserAction;
  error: string;
  screenshot?: string;
  url?: string;
  html?: string;
}

/**
 * Task step for intelligent automation
 */
export interface TaskStep {
  description: string;
  action?: BrowserAction;
  completed: boolean;
  retryCount: number;
}

