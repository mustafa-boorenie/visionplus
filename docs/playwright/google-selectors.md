# Google Search Selectors

## Important Note
Google now uses a `<textarea>` element instead of an `<input>` element for the search box. This is a recent change that breaks many automation scripts.

## Working Selectors (as of 2025)

### Search Box
- `textarea[name="q"]` - Most reliable
- `#APjFqb` - Google's ID for the search box
- `textarea[aria-label="Search"]` - Accessibility selector
- `form textarea` - Generic but works

### Search Button
- `input[name="btnK"]` - Google Search button
- `input[aria-label="Google Search"]` - Alternative selector

### I'm Feeling Lucky Button
- `input[name="btnI"]` - I'm Feeling Lucky button
- `#gbqfbb` - Alternative ID

## Common Issues

### Cookie Consent Dialog
Google may show a consent dialog that blocks interaction. Check for:
- `div[role="dialog"]` that is visible
- May need to accept cookies first

### Anti-Automation Detection
Google actively detects and blocks automation. Tips:
- Use headed browser mode
- Add delays between actions
- Use realistic user agent strings
- Consider using cookies from a real session

## Example Usage

```typescript
// Navigate to Google
await page.goto('https://google.com');

// Wait for search box
await page.waitForSelector('textarea[name="q"]');

// Type search query
await page.fill('textarea[name="q"]', 'weather forecast');

// Press Enter (more reliable than clicking button)
await page.press('textarea[name="q"]', 'Enter');

// Wait for results
await page.waitForSelector('#search', { timeout: 5000 });
``` 