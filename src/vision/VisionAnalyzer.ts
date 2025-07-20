import OpenAI from 'openai';
import fs from 'fs-extra';
import { VisionAnalysisRequest, VisionAnalysisResponse } from '../types';
import { Config } from '../utils/config';
import { log } from '../utils/logger';

/**
 * Vision analyzer using OpenAI's GPT-4 Vision API
 */
export class VisionAnalyzer {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || Config.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: key
    });
  }

  /**
   * Analyze a screenshot using GPT-4 Vision
   */
  async analyzeScreenshot(request: VisionAnalysisRequest): Promise<VisionAnalysisResponse> {
    const startTime = Date.now();
    
    try {
      log.vision('Starting analysis', {
        screenshot: request.screenshotPath,
        prompt: request.prompt.substring(0, 200) + '...'
      });

      // Read and encode the image
      const imageBuffer = await fs.readFile(request.screenshotPath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = request.screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Call OpenAI Vision API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: request.prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7
      });

      const content = response.choices[0]?.message?.content || 'No response from Vision API';
      const usage = response.usage;

      // Log the full response for debugging
      log.info('[VISION] Full API Response:');
      log.info(`[VISION] Content: ${content}`);
      log.info(`[VISION] Model: ${response.model}`);
      log.info(`[VISION] Finish Reason: ${response.choices[0]?.finish_reason}`);
      log.info(`[VISION] Tokens Used: ${usage?.total_tokens || 0}`);

      const analysisResponse: VisionAnalysisResponse = {
        content,
        timestamp: new Date(),
        screenshotPath: request.screenshotPath,
        prompt: request.prompt,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        } : undefined
      };

      const duration = Date.now() - startTime;
      log.performance('Vision analysis', duration);
      log.vision('Analysis completed', {
        tokensUsed: usage?.total_tokens || 0,
        responseLength: content.length
      });

      return analysisResponse;
    } catch (error) {
      log.error('Vision analysis failed', error as Error);
      throw error;
    }
  }

  /**
   * Analyze multiple screenshots in batch
   */
  async analyzeMultipleScreenshots(
    screenshots: string[],
    prompts: string[] | string
  ): Promise<VisionAnalysisResponse[]> {
    const results: VisionAnalysisResponse[] = [];
    const promptsArray = Array.isArray(prompts) ? prompts : new Array(screenshots.length).fill(prompts);

    for (let i = 0; i < screenshots.length; i++) {
      const request: VisionAnalysisRequest = {
        screenshotPath: screenshots[i],
        prompt: promptsArray[i] || promptsArray[0]
      };

      try {
        const result = await this.analyzeScreenshot(request);
        results.push(result);
      } catch (error) {
        log.error(`Failed to analyze screenshot ${screenshots[i]}`, error as Error);
        // Continue with other screenshots
      }
    }

    return results;
  }

  /**
   * Common analysis prompts
   */
  static readonly COMMON_PROMPTS = {
    DESCRIBE_PAGE: 'Describe the webpage layout, main elements, and content visible in this screenshot.',
    EXTRACT_TEXT: 'Extract all visible text from this screenshot and organize it hierarchically.',
    CHECK_ACCESSIBILITY: 'Analyze this webpage for accessibility issues. Check for proper headings, alt text, color contrast, and other accessibility concerns.',
    VERIFY_ELEMENTS: 'List all interactive elements (buttons, links, forms) visible in this screenshot with their labels.',
    ANALYZE_FORM: 'Describe all form fields visible in this screenshot, including their types, labels, and any validation messages.',
    CHECK_ERRORS: 'Check for any error messages, warnings, or issues displayed on this page.',
    NAVIGATION_ANALYSIS: 'Describe the navigation structure and menu items visible on this page.',
    CONTENT_SUMMARY: 'Provide a brief summary of the main content and purpose of this webpage.',
    UI_CONSISTENCY: 'Analyze the UI consistency, design patterns, and visual hierarchy of this page.',
    MOBILE_RESPONSIVENESS: 'Evaluate how well this page appears to be optimized for mobile devices based on the current view.'
  };

} 