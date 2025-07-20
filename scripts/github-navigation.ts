import { AutomationScript } from '../src/types';
import { VisionAnalyzer } from '../src/vision/VisionAnalyzer';

/**
 * Cached script for GitHub navigation and repository exploration
 * This script demonstrates common GitHub interactions
 */
export const githubNavigationScript: AutomationScript = {
  name: 'github-navigation',
  description: 'Navigate GitHub and explore repository features',
  url: 'https://github.com',
  actions: [
    // Wait for page load
    { type: 'wait', duration: 3000 },
    
    // Take screenshot of homepage
    { type: 'screenshot', name: 'github-homepage' },
    
    // Search for a repository
    { 
      type: 'click', 
      selector: 'button[aria-label="Open global navigation menu"]',
      options: { delay: 500 }
    },
    { type: 'wait', duration: 1000 },
    
    // Click on search
    { type: 'click', selector: 'input[name="query-builder-test"]' },
    { type: 'type', selector: 'input[name="query-builder-test"]', text: 'playwright' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'search-results' },
    
    // Navigate to trending
    { type: 'navigate', url: 'https://github.com/trending' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'trending-repos' },
    
    // Scroll to see more repos
    { type: 'scroll', direction: 'down', amount: 1000 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'trending-scrolled' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'List the main navigation options available on this page',
      'What are the trending repositories shown? List their names and descriptions',
      'Identify the search functionality and describe how it works',
      'What programming languages are most popular in the trending section?'
    ]
  }
};

/**
 * Script for exploring a specific repository
 */
export const githubRepoExplorationScript: AutomationScript = {
  name: 'github-repo-exploration',
  description: 'Explore a GitHub repository in detail',
  url: 'https://github.com/microsoft/playwright',
  actions: [
    // Wait for page load
    { type: 'wait', duration: 3000 },
    
    // Repository overview
    { type: 'screenshot', name: 'repo-overview' },
    
    // Click on Code tab (usually already selected)
    { type: 'wait', duration: 1000 },
    
    // Explore README
    { type: 'scroll', direction: 'down', amount: 500 },
    { type: 'screenshot', name: 'readme-content' },
    
    // Click on Issues
    { type: 'click', selector: 'a[data-tab-item="issues-tab"]' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'issues-page' },
    
    // Click on Pull Requests
    { type: 'click', selector: 'a[data-tab-item="pull-requests-tab"]' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'pull-requests' },
    
    // Click on Actions
    { type: 'click', selector: 'a[data-tab-item="actions-tab"]' },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'github-actions' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      VisionAnalyzer.COMMON_PROMPTS.DESCRIBE_PAGE,
      'What is the main purpose of this repository based on the README?',
      'How many open issues and pull requests are there?',
      'What GitHub Actions workflows are configured?',
      'List the main contributors and statistics about the repository'
    ]
  }
}; 