import fs from 'fs-extra';
import path from 'path';
import { ReportData, VisionAnalysisResponse } from '../types';
import { Config } from './config';
import { log } from './logger';

/**
 * Results handler for managing analysis reports
 */
export class ResultsHandler {
  private reportData: ReportData;
  
  constructor(scriptName: string) {
    this.reportData = {
      scriptName,
      startTime: new Date(),
      endTime: new Date(),
      screenshots: [],
      errors: [],
      success: true
    };
  }

  /**
   * Add screenshot to report
   */
  addScreenshot(name: string, path: string, analysis?: VisionAnalysisResponse): void {
    this.reportData.screenshots.push({
      name,
      path,
      timestamp: new Date(),
      analysis
    });
  }

  /**
   * Add error to report
   */
  addError(error: Error): void {
    this.reportData.errors = this.reportData.errors || [];
    this.reportData.errors.push(error);
    this.reportData.success = false;
  }

  /**
   * Mark completion
   */
  complete(success: boolean = true): void {
    this.reportData.endTime = new Date();
    this.reportData.success = success && (!this.reportData.errors || this.reportData.errors.length === 0);
  }

  /**
   * Save report to JSON file
   */
  async saveReport(): Promise<string> {
    try {
      // Ensure report directory exists
      await fs.ensureDir(Config.REPORT_PATH);

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.reportData.scriptName}_${timestamp}.json`;
      const filepath = path.join(Config.REPORT_PATH, filename);

      // Save report
      await fs.writeJSON(filepath, this.reportData, { spaces: 2 });
      
      log.info(`Report saved: ${filepath}`);
      return filepath;
    } catch (error) {
      log.error('Failed to save report', error as Error);
      throw error;
    }
  }

  /**
   * Save report as HTML
   */
  async saveHtmlReport(): Promise<string> {
    try {
      // Ensure report directory exists
      await fs.ensureDir(Config.REPORT_PATH);

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.reportData.scriptName}_${timestamp}.html`;
      const filepath = path.join(Config.REPORT_PATH, filename);

      // Generate HTML
      const html = this.generateHtmlReport();

      // Save report
      await fs.writeFile(filepath, html);
      
      log.info(`HTML report saved: ${filepath}`);
      return filepath;
    } catch (error) {
      log.error('Failed to save HTML report', error as Error);
      throw error;
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(): string {
    const duration = this.reportData.endTime.getTime() - this.reportData.startTime.getTime();
    const durationSeconds = (duration / 1000).toFixed(2);

    const screenshotsHtml = this.reportData.screenshots.map((screenshot, index) => {
      const analysisHtml = screenshot.analysis ? `
        <div class="analysis">
          <h4>Analysis</h4>
          <p class="prompt"><strong>Prompt:</strong> ${this.escapeHtml(screenshot.analysis.prompt)}</p>
          <div class="content">${this.escapeHtml(screenshot.analysis.content).replace(/\n/g, '<br>')}</div>
          ${screenshot.analysis.usage ? `
            <p class="usage">
              <small>Tokens used: ${screenshot.analysis.usage.totalTokens} 
              (Prompt: ${screenshot.analysis.usage.promptTokens}, 
              Completion: ${screenshot.analysis.usage.completionTokens})</small>
            </p>
          ` : ''}
        </div>
      ` : '';

      return `
        <div class="screenshot-item">
          <h3>Screenshot ${index + 1}: ${this.escapeHtml(screenshot.name)}</h3>
          <p class="timestamp">Captured at: ${screenshot.timestamp.toLocaleString()}</p>
          <div class="screenshot-container">
            <img src="../${path.relative(Config.REPORT_PATH, screenshot.path)}" alt="${this.escapeHtml(screenshot.name)}">
          </div>
          ${analysisHtml}
        </div>
      `;
    }).join('\n');

    const errorsHtml = this.reportData.errors && this.reportData.errors.length > 0 ? `
      <div class="errors">
        <h2>Errors</h2>
        <ul>
          ${this.reportData.errors.map(error => 
            `<li>${this.escapeHtml(error.message)}</li>`
          ).join('\n')}
        </ul>
      </div>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analysis Report: ${this.escapeHtml(this.reportData.scriptName)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background-color: #fff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    h1 {
      color: #2c3e50;
      margin: 0 0 10px 0;
    }
    .status {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      color: white;
    }
    .status.success {
      background-color: #27ae60;
    }
    .status.failure {
      background-color: #e74c3c;
    }
    .info {
      margin: 20px 0;
      color: #666;
    }
    .screenshot-item {
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .screenshot-container {
      margin: 20px 0;
      text-align: center;
    }
    .screenshot-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .analysis {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
    }
    .analysis h4 {
      margin-top: 0;
      color: #2c3e50;
    }
    .prompt {
      color: #666;
      margin-bottom: 10px;
    }
    .content {
      background-color: #fff;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #e1e4e8;
    }
    .usage {
      margin-top: 10px;
      color: #999;
    }
    .errors {
      background-color: #fee;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .errors h2 {
      color: #c00;
      margin-top: 0;
    }
    .errors ul {
      margin: 0;
      padding-left: 20px;
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Analysis Report: ${this.escapeHtml(this.reportData.scriptName)}</h1>
    <span class="status ${this.reportData.success ? 'success' : 'failure'}">
      ${this.reportData.success ? 'SUCCESS' : 'FAILURE'}
    </span>
    <div class="info">
      <p><strong>Start Time:</strong> ${this.reportData.startTime.toLocaleString()}</p>
      <p><strong>End Time:</strong> ${this.reportData.endTime.toLocaleString()}</p>
      <p><strong>Duration:</strong> ${durationSeconds} seconds</p>
      <p><strong>Screenshots Captured:</strong> ${this.reportData.screenshots.length}</p>
    </div>
  </div>
  
  ${screenshotsHtml}
  ${errorsHtml}
</body>
</html>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Get report data
   */
  getReportData(): ReportData {
    return this.reportData;
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const duration = this.reportData.endTime.getTime() - this.reportData.startTime.getTime();
    const durationSeconds = (duration / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`ANALYSIS REPORT: ${this.reportData.scriptName}`);
    console.log('='.repeat(60));
    console.log(`Status: ${this.reportData.success ? '✅ SUCCESS' : '❌ FAILURE'}`);
    console.log(`Duration: ${durationSeconds} seconds`);
    console.log(`Screenshots: ${this.reportData.screenshots.length}`);
    
    if (this.reportData.errors && this.reportData.errors.length > 0) {
      console.log(`\nErrors (${this.reportData.errors.length}):`);
      this.reportData.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
      });
    }

    console.log('\nScreenshots captured:');
    this.reportData.screenshots.forEach((screenshot, index) => {
      console.log(`  ${index + 1}. ${screenshot.name} - ${screenshot.timestamp.toLocaleTimeString()}`);
      if (screenshot.analysis) {
        console.log(`     Analysis: ${screenshot.analysis.content.slice(0, 100)}...`);
      }
    });
    
    console.log('='.repeat(60) + '\n');
  }
} 