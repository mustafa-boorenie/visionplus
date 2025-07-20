# PubMed Search Selectors

## Search Input
The PubMed search input has several reliable selectors:

### Primary Selectors
- `input[name="term"]` - Most reliable, uses the name attribute
- `#id_term` - ID selector
- `.term-input` - Class selector
- `input[type="search"]` - Type selector

### Attributes
- Has `data-skip-ie-scroll-to-top=""` attribute
- Has `data-replace-term-with-exact=""` attribute
- Has `data-exact-query=""` attribute
- Has `required="required"` attribute
- Has `spellcheck="false"` attribute

### Aria/Accessibility
- `role="combobox"`
- `aria-autocomplete="list"`
- `aria-expanded` (dynamic, can be true/false)
- `aria-owns="id_term_listbox"`
- `aria-controls="id_term_listbox"`

## Best Practices for PubMed

1. **Wait for Page Load**: PubMed can be slow to load, especially with large result sets
2. **Handle Autocomplete**: The search input has autocomplete that may interfere with typing
3. **Use Fill Instead of Type**: For reliability, use `fill()` which clears and types in one action

## Example Selectors Array
```javascript
[
  "input[name='term']",           // Most reliable
  "#id_term",                     // ID selector
  "input.term-input",             // Class selector
  "input[type='search']",         // Type selector
  "[role='combobox']",            // ARIA role
  "input[placeholder='']",        // Empty placeholder
  "input[required]"               // Required attribute
]
```

## Common Issues

1. **Autocomplete Dropdown**: May cover other elements after typing
2. **Dynamic Loading**: Results load via AJAX, need to wait for them
3. **Session Timeouts**: Long searches may timeout 