import { Page } from 'playwright';
import { log } from '../utils/logger';

/**
 * Selector suggestion result
 */
export interface SelectorSuggestion {
  selectors: string[];
  confidence: number;
  reason: string;
  elementInfo?: {
    tagName: string;
    text?: string;
    attributes?: Record<string, string>;
  };
}

/**
 * Dynamic selector suggester for failed actions
 */
export class SelectorSuggester {
  constructor(private page: Page) {}

  /**
   * Suggest alternative selectors based on action type and context
   */
  async suggestSelectors(
    actionType: string,
    _failedSelector: string | string[],
    context: string
  ): Promise<SelectorSuggestion> {
    try {
      log.info('[SELECTOR_SUGGEST] Analyzing page for alternative selectors');
      
      // Analyze the page structure
      const pageAnalysis = await this.analyzePage(actionType, context);
      
      // Generate selector candidates based on action type
      const candidates = await this.generateSelectorCandidates(
        actionType,
        context,
        pageAnalysis
      );
      
      // Validate and rank selectors
      const validatedSelectors = await this.validateSelectors(candidates);
      
      return {
        selectors: validatedSelectors.slice(0, 7), // Return top 7 selectors
        confidence: validatedSelectors.length > 0 ? 0.8 : 0.2,
        reason: `Found ${validatedSelectors.length} alternative selectors for ${actionType} action`,
        elementInfo: pageAnalysis.targetElement
      };
    } catch (error) {
      log.error('Failed to suggest selectors', error as Error);
      return {
        selectors: [],
        confidence: 0,
        reason: 'Failed to analyze page for selector suggestions'
      };
    }
  }

  /**
   * Analyze page structure for the given action
   */
  private async analyzePage(actionType: string, context: string): Promise<any> {
    const analysis = await this.page.evaluate(() => {
      // Helper to extract element info
      const getElementInfo = (element: Element) => ({
        tagName: element.tagName.toLowerCase(),
        text: element.textContent?.trim().slice(0, 100),
        attributes: Array.from(element.attributes).reduce((acc: Record<string, string>, attr: Attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {} as Record<string, string>)
      });

      // Find potential target elements based on action type
      const findTargets = () => {
        const elements: Element[] = [];
        
        switch (actionType) {
          case 'click':
          case 'button':
            // Find all clickable elements
            elements.push(...Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input[type="submit"], input[type="button"]')));
            break;
            
          case 'type':
          case 'search':
            // Find all input elements
            elements.push(...Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]')));
            break;
            
          case 'select':
            // Find all select elements
            elements.push(...Array.from(document.querySelectorAll('select, [role="listbox"], [role="combobox"]')));
            break;
        }
        
        // Filter visible elements
        return elements.filter(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && 
                 rect.height > 0 && 
                 style.display !== 'none' && 
                 style.visibility !== 'hidden';
        });
      };

      const targets = findTargets();
      
      // Find the most likely target based on context
      let bestMatch = null;
      let bestScore = 0;
      
      const contextLower = context.toLowerCase();
      
      for (const element of targets) {
        let score = 0;
        const elementText = element.textContent?.toLowerCase() || '';
        const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
        const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';
        const name = element.getAttribute('name')?.toLowerCase() || '';
        const id = element.getAttribute('id')?.toLowerCase() || '';
        
        // Score based on text content match
        if (elementText && contextLower.includes(elementText)) score += 3;
        if (ariaLabel && contextLower.includes(ariaLabel)) score += 3;
        if (placeholder && contextLower.includes(placeholder)) score += 2;
        if (name && contextLower.includes(name)) score += 2;
        if (id && contextLower.includes(id)) score += 2;
        
        // Bonus for exact matches
        if (elementText === contextLower) score += 5;
        if (ariaLabel === contextLower) score += 5;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = element;
        }
      }

      return {
        targetElement: bestMatch ? getElementInfo(bestMatch) : null,
        allTargets: targets.slice(0, 10).map(getElementInfo),
        pageInfo: {
          title: document.title,
          url: window.location.href,
          hasModals: document.querySelector('[role="dialog"], .modal, .popup') !== null,
          isLoading: document.querySelector('.loading, .spinner, [aria-busy="true"]') !== null
        }
      };
    });

    return analysis;
  }

  /**
   * Generate selector candidates based on element analysis
   */
  private async generateSelectorCandidates(
    actionType: string,
    _context: string,
    analysis: any
  ): Promise<string[]> {
    const candidates: string[] = [];
    
    // If we found a target element, generate selectors for it
    if (analysis.targetElement) {
      const elem = analysis.targetElement;
      
      // ID selector (highest priority)
      if (elem.attributes?.id) {
        candidates.push(`#${elem.attributes.id}`);
      }
      
      // Data test ID
      if (elem.attributes?.['data-testid']) {
        candidates.push(`[data-testid="${elem.attributes['data-testid']}"]`);
      }
      
      // Aria label
      if (elem.attributes?.['aria-label']) {
        candidates.push(`[aria-label="${elem.attributes['aria-label']}"]`);
      }
      
      // Role-based
      if (elem.attributes?.role) {
        candidates.push(`[role="${elem.attributes.role}"]`);
        if (elem.text) {
          candidates.push(`[role="${elem.attributes.role}"]:has-text("${elem.text.slice(0, 30)}")`);
        }
      }
      
      // Name attribute
      if (elem.attributes?.name) {
        candidates.push(`[name="${elem.attributes.name}"]`);
      }
      
      // Type-specific selectors
      if (elem.attributes?.type) {
        candidates.push(`${elem.tagName}[type="${elem.attributes.type}"]`);
      }
      
      // Text-based
      if (elem.text && elem.text.length < 50) {
        candidates.push(`${elem.tagName}:has-text("${elem.text}")`);
        candidates.push(`text="${elem.text}"`);
      }
      
      // Placeholder
      if (elem.attributes?.placeholder) {
        candidates.push(`[placeholder="${elem.attributes.placeholder}"]`);
      }
      
      // Class-based (lower priority)
      if (elem.attributes?.class) {
        const primaryClass = elem.attributes.class.split(' ')[0];
        if (primaryClass) {
          candidates.push(`.${primaryClass}`);
        }
      }
    }
    
    // Add generic fallback selectors based on action type
    switch (actionType) {
      case 'click':
        candidates.push(
          'button:visible',
          '[type="submit"]:visible',
          'a:visible',
          '[role="button"]:visible'
        );
        break;
        
      case 'type':
        candidates.push(
          'input:visible:not([type="hidden"])',
          'textarea:visible',
          '[role="textbox"]:visible',
          '[contenteditable="true"]:visible'
        );
        break;
    }
    
    // Remove duplicates
    return [...new Set(candidates)];
  }

  /**
   * Validate selectors by checking if they exist and are visible
   */
  private async validateSelectors(candidates: string[]): Promise<string[]> {
    const validSelectors: string[] = [];
    
    for (const selector of candidates) {
      try {
        const element = this.page.locator(selector).first();
        const count = await element.count();
        
        if (count > 0) {
          const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            validSelectors.push(selector);
            log.debug(`[SELECTOR_SUGGEST] Valid selector found: ${selector}`);
          }
        }
      } catch (error) {
        // Selector is invalid, skip it
        log.debug(`[SELECTOR_SUGGEST] Invalid selector: ${selector}`);
      }
    }
    
    return validSelectors;
  }

  /**
   * Suggest recovery strategies based on page state
   */
  async suggestRecoveryStrategy(_failureReason: string): Promise<{
    strategy: string;
    actions: Array<{ type: string; details: string }>;
  }> {
    const pageState = await this.page.evaluate(() => {
      return {
        hasModals: document.querySelector('[role="dialog"], .modal, .popup') !== null,
        hasOverlays: document.querySelector('.overlay, .backdrop') !== null,
        isLoading: document.querySelector('.loading, .spinner, [aria-busy="true"]') !== null,
        hasCookieBanner: document.querySelector('[class*="cookie"], [id*="cookie"], [aria-label*="cookie"]') !== null,
        hasAlerts: document.querySelector('[role="alert"], .alert, .error, .warning') !== null
      };
    });

    const actions: Array<{ type: string; details: string }> = [];
    let strategy = 'retry with alternative selectors';

    if (pageState.hasModals || pageState.hasOverlays) {
      strategy = 'close modal/overlay and retry';
      actions.push(
        { type: 'click', details: 'Close modal button: [aria-label="Close"], .close, button:has-text("×")' },
        { type: 'press', details: 'Press Escape key' }
      );
    }

    if (pageState.isLoading) {
      strategy = 'wait for page to finish loading';
      actions.push(
        { type: 'wait', details: 'Wait for loading indicators to disappear' },
        { type: 'wait', details: 'Add explicit wait for 3-5 seconds' }
      );
    }

    if (pageState.hasCookieBanner) {
      strategy = 'handle cookie banner';
      actions.push(
        { type: 'click', details: 'Accept cookies: button:has-text("Accept"), [id*="accept"]' }
      );
    }

    if (pageState.hasAlerts) {
      strategy = 'handle alert/error messages';
      actions.push(
        { type: 'screenshot', details: 'Capture error state' },
        { type: 'analyze', details: 'Read and handle error message' }
      );
    }

    return { strategy, actions };
  }
} 