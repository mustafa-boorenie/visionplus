# Amazon Selector Guide

## Search Functionality

### Search Box
- **ID Selector**: `input#twotabsearchtextbox`
- **Alternative**: `input[placeholder="Search Amazon"]`
- **Role**: `page.getByRole('searchbox')`

### Search Button
- **ID Selector**: `input#nav-search-submit-button`
- **Alternative**: `input[value="Go"]`
- **Better approach**: Press Enter in search box instead

## Product Listings

### Product Cards
- **Class**: `.s-result-item`
- **Data attribute**: `[data-component-type="s-search-result"]`

### Product Title
- **Within card**: `h2.s-size-mini-headline a`
- **Role**: `page.getByRole('link', { name: /product name/i })`

### Product Price
- **Class**: `.a-price-whole`
- **Within card**: `[data-cy="price-recipe"] .a-price`

## Shopping Cart

### Add to Cart Button
- **ID**: `#add-to-cart-button`
- **Alternative**: `input[name="submit.add-to-cart"]`
- **Role**: `page.getByRole('button', { name: 'Add to Cart' })`

### Cart Icon
- **ID**: `#nav-cart`
- **Count**: `#nav-cart-count`

## Best Practices for Amazon

1. **Wait for dynamic content**: Amazon loads content dynamically
   ```javascript
   await page.waitForSelector('.s-result-item', { state: 'visible' });
   ```

2. **Handle popups**: Amazon may show location or cookie popups
   ```javascript
   const popup = page.locator('[data-action="a-popover-close"]');
   if (await popup.isVisible()) {
     await popup.click();
   }
   ```

3. **Deal with variations**: Amazon changes layouts for different regions
   - Always have fallback selectors
   - Use text content when possible
   - Prefer data attributes over classes 