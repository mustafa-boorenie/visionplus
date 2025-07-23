import { AutomationScript } from '../src/types';

/**
 * Example script demonstrating browser navigation capabilities
 * Shows how to use goBack, goForward, reload, newTab, switchTab, and closeTab actions
 */
export const browserNavigationScript: AutomationScript = {
  name: 'browser-navigation',
  description: 'Demonstrates browser navigation features including history navigation and tab management',
  url: 'https://example.com',
  actions: [
    // Start at example.com
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'initial-page' },
    
    // Navigate to another page
    { type: 'navigate', url: 'https://example.org' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'second-page' },
    
    // Go back to previous page
    { type: 'goBack', waitUntil: 'load' },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'back-to-first' },
    
    // Go forward again
    { type: 'goForward', waitUntil: 'load' },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'forward-to-second' },
    
    // Reload the current page
    { type: 'reload', waitUntil: 'networkidle' },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'after-reload' },
    
    // Open a new tab with a URL
    { type: 'newTab', url: 'https://www.wikipedia.org' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'new-tab-wikipedia' },
    
    // Open another new tab without URL
    { type: 'newTab' },
    { type: 'navigate', url: 'https://github.com' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'new-tab-github' },
    
    // Switch back to first tab (index 0)
    { type: 'switchTab', index: 0 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'back-to-first-tab' },
    
    // Switch to tab containing 'wikipedia' in URL
    { type: 'switchTab', url: 'wikipedia' },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'wikipedia-tab' },
    
    // Close the current tab (Wikipedia)
    { type: 'closeTab' },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'after-closing-wikipedia' },
    
    // Switch to tab by title containing 'GitHub'
    { type: 'switchTab', title: 'GitHub' },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'github-tab-by-title' },
    
    // Close tab at specific index (0)
    { type: 'closeTab', index: 0 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'final-state' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'What is the current page URL and title?',
      'How many browser tabs are currently open?',
      'Describe the navigation history of this browsing session'
    ]
  }
};

// Export for use with the script runner
export default browserNavigationScript; 