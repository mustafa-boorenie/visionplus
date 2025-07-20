import chalk from 'chalk';
import { EventEmitter } from 'events';
import fs from 'fs-extra';

/**
 * Progress event data
 */
export interface ProgressEvent {
  type: 'step_start' | 'step_complete' | 'step_failed' | 'retry' | 'analysis' | 'cache_hit';
  stepIndex: number;
  totalSteps: number;
  description: string;
  details?: any;
  timestamp: Date;
}

/**
 * Progress tracker for intelligent automation
 */
export class ProgressTracker extends EventEmitter {
  private startTime: Date;
  private events: ProgressEvent[] = [];
  private currentStep: number = 0;
  private totalSteps: number = 0;
  private isVerbose: boolean;

  constructor(verbose: boolean = false) {
    super();
    this.startTime = new Date();
    this.isVerbose = verbose;
  }

  /**
   * Initialize with total steps
   */
  initialize(totalSteps: number): void {
    this.totalSteps = totalSteps;
    this.displayHeader();
  }

  /**
   * Record and display progress event
   */
  track(event: Omit<ProgressEvent, 'timestamp'>): void {
    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: new Date()
    };

    this.events.push(fullEvent);
    this.emit('progress', fullEvent);
    this.displayProgress(fullEvent);
  }

  /**
   * Display progress header
   */
  private displayHeader(): void {
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan('🤖 AI Playwright - Intelligent Automation'));
    console.log(chalk.cyan('═'.repeat(60) + '\n'));
  }

  /**
   * Display progress event
   */
  private displayProgress(event: ProgressEvent): void {
    const progress = `[${event.stepIndex}/${event.totalSteps}]`;
    const elapsed = this.getElapsedTime();

    switch (event.type) {
      case 'step_start':
        this.currentStep = event.stepIndex;
        console.log(
          chalk.blue(progress) +
          chalk.white(` Starting: ${event.description}`) +
          chalk.gray(` (${elapsed})`)
        );
        break;

      case 'step_complete':
        console.log(
          chalk.green(progress) +
          chalk.green(` ✓ Completed: ${event.description}`)
        );
        this.displayProgressBar();
        break;

      case 'step_failed':
        console.log(
          chalk.red(progress) +
          chalk.red(` ✗ Failed: ${event.description}`)
        );
        if (this.isVerbose && event.details) {
          console.log(chalk.gray(`  Details: ${JSON.stringify(event.details)}`));
        }
        break;

      case 'retry':
        console.log(
          chalk.yellow(progress) +
          chalk.yellow(` ↻ Retry ${event.details.attempt}/${event.details.maxAttempts}: ${event.description}`)
        );
        break;

      case 'analysis':
        console.log(
          chalk.magenta(progress) +
          chalk.magenta(` 🔍 Analyzing: ${event.description}`)
        );
        if (this.isVerbose && event.details) {
          console.log(chalk.gray(`  ${event.details}`));
        }
        break;

      case 'cache_hit':
        console.log(
          chalk.cyan('📦 Cache Hit: ') +
          chalk.white(event.description) +
          chalk.gray(` (${event.details.similarity}% match)`)
        );
        break;
    }
  }

  /**
   * Display progress bar
   */
  private displayProgressBar(): void {
    const percentage = Math.round((this.currentStep / this.totalSteps) * 100);
    const barLength = 30;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    const bar = 
      chalk.green('█'.repeat(filled)) +
      chalk.gray('░'.repeat(empty));

    console.log(
      chalk.gray('Progress: ') +
      bar +
      chalk.white(` ${percentage}%\n`)
    );
  }

  /**
   * Get elapsed time string
   */
  private getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Display final summary
   */
  displaySummary(success: boolean): void {
    const duration = this.getElapsedTime();
    const completedSteps = this.events.filter(e => e.type === 'step_complete').length;
    const failedSteps = this.events.filter(e => e.type === 'step_failed').length;
    const retries = this.events.filter(e => e.type === 'retry').length;

    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan('Summary'));
    console.log(chalk.cyan('═'.repeat(60)));

    console.log(chalk.white(`Status: `) + (success ? chalk.green('✓ Success') : chalk.red('✗ Failed')));
    console.log(chalk.white(`Duration: `) + chalk.yellow(duration));
    console.log(chalk.white(`Steps Completed: `) + chalk.green(`${completedSteps}/${this.totalSteps}`));
    
    if (failedSteps > 0) {
      console.log(chalk.white(`Steps Failed: `) + chalk.red(failedSteps.toString()));
    }
    
    if (retries > 0) {
      console.log(chalk.white(`Total Retries: `) + chalk.yellow(retries.toString()));
    }

    console.log(chalk.cyan('═'.repeat(60) + '\n'));
  }

  /**
   * Get all events
   */
  getEvents(): ProgressEvent[] {
    return this.events;
  }

  /**
   * Export progress log
   */
  async exportLog(filepath: string): Promise<void> {
    const log = {
      startTime: this.startTime,
      endTime: new Date(),
      totalSteps: this.totalSteps,
      events: this.events,
      summary: {
        completed: this.events.filter(e => e.type === 'step_complete').length,
        failed: this.events.filter(e => e.type === 'step_failed').length,
        retries: this.events.filter(e => e.type === 'retry').length
      }
    };

    await fs.writeJSON(filepath, log, { spaces: 2 });
  }
} 