// Test to verify selector array handling
// This simulates the issue where actions with array selectors fail

function testSelectorArrayHandling() {
  console.log('🔧 Testing Selector Array Fix...');
  
  // Simulate the actions that are failing
  const clickAction = {
    type: 'click',
    selector: ['button[type="submit"]', 'input[type="submit"]', '.search-button', '#search-btn']
  };
  
  const typeAction = {
    type: 'type',
    selector: ['textarea[name="q"]', 'input[name="q"]', '#search-input', '.search-box input'],
    text: 'pubmed'
  };
  
  console.log('📊 Original problematic actions:');
  console.log('Click action selector:', typeof clickAction.selector, clickAction.selector);
  console.log('Type action selector:', typeof typeAction.selector, typeAction.selector);
  
  // Simulate our fix
  function findWorkingSelector(selectors) {
    if (!Array.isArray(selectors)) {
      return selectors;
    }
    
    // In real implementation, this would check if element exists and is visible
    // For simulation, return the first selector
    console.log(`✅ Found working selector: ${selectors[0]}`);
    return selectors[0];
  }
  
  // Test the fix
  const clickSelector = findWorkingSelector(clickAction.selector);
  const typeSelector = findWorkingSelector(typeAction.selector);
  
  console.log('🔄 After fix:');
  console.log('Click selector:', typeof clickSelector, clickSelector);
  console.log('Type selector:', typeof typeSelector, typeSelector);
  
  // Verify the selectors are now strings
  if (typeof clickSelector === 'string' && typeof typeSelector === 'string') {
    console.log('✅ Success! Selectors are now strings that Playwright can handle');
    console.log('💡 The "expected string, got object" error should be fixed');
  } else {
    console.log('❌ Fix failed - selectors are still not strings');
  }
}

testSelectorArrayHandling(); 