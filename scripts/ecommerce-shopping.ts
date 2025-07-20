import { AutomationScript } from '../src/types';
import { VisionAnalyzer } from '../src/vision/VisionAnalyzer';

/**
 * Cached script for e-commerce shopping flow
 * This script demonstrates product search, filtering, and cart operations
 */
export const ecommerceShoppingScript: AutomationScript = {
  name: 'ecommerce-shopping',
  description: 'Navigate an e-commerce site, search for products, and add to cart',
  url: 'https://www.amazon.com',
  actions: [
    // Wait for page load
    { type: 'wait', duration: 3000 },
    
    // Homepage screenshot
    { type: 'screenshot', name: 'homepage' },
    
    // Search for a product
    { type: 'click', selector: 'input#twotabsearchtextbox' },
    { type: 'type', selector: 'input#twotabsearchtextbox', text: 'laptop' },
    { type: 'click', selector: 'input#nav-search-submit-button' },
    { type: 'wait', duration: 3000 },
    
    // Search results
    { type: 'screenshot', name: 'search-results' },
    
    // Apply filters (example - adjust based on current UI)
    { type: 'scroll', direction: 'down', amount: 300 },
    { type: 'wait', duration: 1000 },
    
    // Take screenshot of filters
    { type: 'screenshot', name: 'filters-section' },
    
    // Scroll through results
    { type: 'scroll', direction: 'down', amount: 1000 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'more-results' },
    
    // View cart (navigate to cart page)
    { type: 'navigate', url: 'https://www.amazon.com/gp/cart/view.html' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'shopping-cart' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'List all the products visible in the search results with their prices',
      'What filters are available for refining the search?',
      'Identify the sorting options available',
      'Describe the layout and key features of the product listings',
      'What information is shown for each product in the results?'
    ]
  }
};

/**
 * Script for analyzing product details
 */
export const productDetailScript: AutomationScript = {
  name: 'product-detail-analysis',
  description: 'Analyze a product detail page',
  url: 'https://www.ebay.com',
  actions: [
    // Homepage
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'ebay-homepage' },
    
    // Search for electronics
    { type: 'click', selector: 'input[type="text"][placeholder*="Search"]' },
    { type: 'type', selector: 'input[type="text"][placeholder*="Search"]', text: 'smartphone' },
    { type: 'click', selector: 'input[type="submit"]' },
    { type: 'wait', duration: 3000 },
    
    // Results page
    { type: 'screenshot', name: 'search-results' },
    
    // Click on first product (example selector)
    { type: 'click', selector: '.s-item__link' },
    { type: 'wait', duration: 3000 },
    
    // Product detail page
    { type: 'screenshot', name: 'product-detail' },
    
    // Scroll to see more details
    { type: 'scroll', direction: 'down', amount: 500 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'product-specifications' },
    
    // Scroll to reviews if available
    { type: 'scroll', direction: 'down', amount: 1000 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'product-reviews' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      VisionAnalyzer.COMMON_PROMPTS.EXTRACT_TEXT,
      'What is the product name, price, and availability?',
      'List all the product specifications and features',
      'What shipping options are available?',
      'Summarize the customer reviews and ratings if visible',
      'Identify the seller information and return policy'
    ]
  }
};

/**
 * Script for checkout flow analysis (without actual purchase)
 */
export const checkoutFlowScript: AutomationScript = {
  name: 'checkout-flow-analysis',
  description: 'Analyze the checkout process without completing purchase',
  url: 'https://www.etsy.com',
  actions: [
    // Homepage
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'etsy-homepage' },
    
    // Search for items
    { type: 'click', selector: 'input[name="search_query"]' },
    { type: 'type', selector: 'input[name="search_query"]', text: 'handmade jewelry' },
    { type: 'click', selector: 'button[type="submit"]' },
    { type: 'wait', duration: 3000 },
    
    // Results
    { type: 'screenshot', name: 'search-results' },
    
    // Cart page
    { type: 'navigate', url: 'https://www.etsy.com/cart' },
    { type: 'wait', duration: 3000 },
    { type: 'screenshot', name: 'cart-page' },
    
    // Analyze checkout button and options
    { type: 'screenshot', name: 'checkout-options' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      'Describe the shopping cart interface and features',
      'What payment options are visible?',
      'Identify any promotional offers or discount code fields',
      'What information is required to proceed with checkout?',
      'List any trust badges or security indicators'
    ]
  }
}; 