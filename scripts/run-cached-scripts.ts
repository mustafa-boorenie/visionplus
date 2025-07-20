import { ScriptRunner, validateEnvironment } from '../src';
import { 
  githubNavigationScript, 
  githubRepoExplorationScript 
} from './github-navigation';
import { 
  ecommerceShoppingScript, 
  productDetailScript, 
  checkoutFlowScript 
} from './ecommerce-shopping';
import { 
  linkedinAnalysisScript, 
  twitterAnalysisScript, 
  newsWebsiteScript 
} from './social-media-analysis';

/**
 * Run cached scripts based on command line arguments
 */
async function main() {
  // Validate environment first
  validateEnvironment();

  // Get script name from command line
  const scriptName = process.argv[2];

  // Available scripts
  const scripts = {
    'github-nav': githubNavigationScript,
    'github-repo': githubRepoExplorationScript,
    'ecommerce': ecommerceShoppingScript,
    'product-detail': productDetailScript,
    'checkout': checkoutFlowScript,
    'linkedin': linkedinAnalysisScript,
    'twitter': twitterAnalysisScript,
    'news': newsWebsiteScript
  };

  if (!scriptName || !scripts[scriptName as keyof typeof scripts]) {
    console.log('Usage: npm run script <script-name>');
    console.log('\nAvailable scripts:');
    console.log('  github-nav     - Navigate GitHub and explore features');
    console.log('  github-repo    - Explore a specific GitHub repository');
    console.log('  ecommerce      - E-commerce shopping flow on Amazon');
    console.log('  product-detail - Product detail analysis on eBay');
    console.log('  checkout       - Checkout flow analysis on Etsy');
    console.log('  linkedin       - LinkedIn job search analysis');
    console.log('  twitter        - Twitter/X trending topics analysis');
    console.log('  news           - BBC News website analysis');
    console.log('\nExample: npm run script github-nav');
    process.exit(1);
  }

  // Run the selected script
  const selectedScript = scripts[scriptName as keyof typeof scripts];
  console.log(`\n🚀 Running script: ${selectedScript.name}`);
  console.log(`📝 Description: ${selectedScript.description}`);
  console.log(`🌐 URL: ${selectedScript.url}\n`);

  const runner = new ScriptRunner(selectedScript);
  await runner.run();

  console.log('\n✅ Script execution completed!');
  console.log('📊 Check the reports folder for detailed results.');
}

// Execute
main().catch(error => {
  console.error('❌ Script execution failed:', error);
  process.exit(1);
}); 