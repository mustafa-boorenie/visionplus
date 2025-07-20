import { AutomationScript } from '../src/types';
import { VisionAnalyzer } from '../src/vision/VisionAnalyzer';

/**
 * Cached script for analyzing social media platforms
 * This script demonstrates navigation and content analysis on social platforms
 */
export const linkedinAnalysisScript: AutomationScript = {
  name: 'linkedin-analysis',
  description: 'Analyze LinkedIn public pages and job listings',
  url: 'https://www.linkedin.com',
  actions: [
    // Wait for page load
    { type: 'wait', duration: 3000 },
    
    // Homepage screenshot
    { type: 'screenshot', name: 'linkedin-homepage' },
    
    // Navigate to jobs section
    { type: 'navigate', url: 'https://www.linkedin.com/jobs' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'jobs-page' },
    
    // Search for jobs
    { type: 'click', selector: 'input[aria-label*="job"]' },
    { type: 'type', selector: 'input[aria-label*="job"]', text: 'software engineer' },
    { type: 'wait', duration: 1000 },
    
    // Location input
    { type: 'click', selector: 'input[aria-label*="location"]' },
    { type: 'type', selector: 'input[aria-label*="location"]', text: 'San Francisco' },
    { type: 'wait', duration: 1000 },
    
    // Search
    { type: 'click', selector: 'button[type="submit"]' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'job-search-results' },
    
    // Scroll through results
    { type: 'scroll', direction: 'down', amount: 1000 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'more-job-results' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'List the job titles and companies visible in the search results',
      'What filters are available for job search?',
      'Identify any featured or promoted job listings',
      'What information is displayed for each job listing?',
      'Are there any insights about job market trends visible?'
    ]
  }
};

/**
 * Script for Twitter/X analysis
 */
export const twitterAnalysisScript: AutomationScript = {
  name: 'twitter-analysis',
  description: 'Analyze Twitter/X public content and trends',
  url: 'https://twitter.com/explore',
  actions: [
    // Wait for page load
    { type: 'wait', duration: 3000 },
    
    // Explore page
    { type: 'screenshot', name: 'twitter-explore' },
    
    // Trending section
    { type: 'scroll', direction: 'down', amount: 500 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'trending-topics' },
    
    // Navigate to a specific topic page
    { type: 'navigate', url: 'https://twitter.com/search?q=technology' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'technology-tweets' },
    
    // Scroll through tweets
    { type: 'scroll', direction: 'down', amount: 1000 },
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'more-tweets' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'What are the current trending topics?',
      'Describe the types of content visible in the feed',
      'Identify any promoted or sponsored content',
      'What engagement metrics are shown for tweets?',
      VisionAnalyzer.COMMON_PROMPTS.CONTENT_SUMMARY
    ]
  }
};

/**
 * Script for analyzing news and content websites
 */
export const newsWebsiteScript: AutomationScript = {
  name: 'news-website-analysis',
  description: 'Analyze news website layout and content organization',
  url: 'https://www.bbc.com',
  actions: [
    // Homepage
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'homepage-top' },
    
    // Scroll to see more sections
    { type: 'scroll', direction: 'down', amount: 1000 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'homepage-middle' },
    
    // Navigate to technology section
    { type: 'navigate', url: 'https://www.bbc.com/news/technology' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'technology-section' },
    
    // Scroll through articles
    { type: 'scroll', direction: 'down', amount: 1500 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'more-articles' },
    
    // Go back to homepage
    { type: 'navigate', url: 'https://www.bbc.com' },
    { type: 'wait', duration: 3000 },
    
    // Check footer
    { type: 'scroll', direction: 'down', amount: 5000 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'footer-links' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'What are the main news headlines visible?',
      'How is the content organized into different sections?',
      'Identify the navigation structure and main categories',
      'What multimedia content (videos, images) is featured?',
      'Describe the layout and visual hierarchy of the page',
      VisionAnalyzer.COMMON_PROMPTS.CHECK_ACCESSIBILITY
    ]
  }
}; 