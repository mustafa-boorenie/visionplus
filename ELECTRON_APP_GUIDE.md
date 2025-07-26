# AI Playwright Scripter - Electron App Guide

## Overview

The AI Playwright Scripter Electron app provides a visual drag-and-drop interface for creating, managing, and executing browser automation sequences.

## Features

### 1. Drag-and-Drop Sequence Builder
- **Visual Action Builder**: Drag actions from the templates panel to build your automation sequence
- **Action Types Available**:
  - Navigate - Go to a URL
  - Click - Click on elements
  - Type - Enter text into inputs
  - Wait - Pause execution
  - Screenshot - Capture screenshots
  - Scroll - Scroll the page
  - Select - Choose from dropdowns
  - Press - Keyboard actions
  - Browser Navigation - Back, Forward, Reload
  - Tab Management - New Tab, Switch Tab, Close Tab

### 2. Test Execution
- **Test Mode**: Run sequences with the browser visible to debug
- **Headless Mode**: Run sequences in the background
- **Live Progress**: See execution progress in real-time

### 3. Credentials Management
- **Secure Storage**: Credentials are encrypted and stored locally
- **Variable Substitution**: Use `{{CREDENTIAL_NAME}}` in your sequences
- **Easy Management**: Add, view, and delete credentials securely

### 4. CSV Data Support
- **Import CSV Files**: Load data for data-driven testing
- **Data Binding**: Reference CSV columns with `{{csv.columnName}}`
- **Batch Processing**: Run sequences for each row in your CSV

### 5. Interactive Recording Mode
- **Record Actions**: Start recording and perform actions in the CLI
- **Auto-capture**: Actions are automatically captured and added to your sequence
- **Edit & Refine**: Modify recorded actions as needed

### 6. Sequence Management
- **Save & Load**: Persist your automation sequences
- **Edit Actions**: Modify individual actions in your sequences
- **Execution History**: Track success rates and execution times

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run electron:dev
   ```

3. Build for production:
   ```bash
   # For macOS
   npm run electron:pack:mac
   
   # For Windows
   npm run electron:pack:win
   
   # For Linux
   npm run electron:pack:linux
   ```

## Usage Guide

### Creating a Sequence

1. **Start with the Sequence Builder tab**
2. **Drag actions from the left panel** into the main area
3. **Configure each action** by clicking "Edit"
4. **Reorder actions** by dragging them up or down
5. **Save your sequence** with a descriptive name

### Using Credentials

1. **Go to the Credentials tab**
2. **Add a new credential** with a key and value
3. **In your sequences**, use `{{KEY_NAME}}` where you want the value inserted
4. **Example**: Type action with text `{{PASSWORD}}` will use the stored password

### Data-Driven Testing with CSV

1. **Go to the CSV Data tab**
2. **Import your CSV file**
3. **In sequences, reference columns**: `{{csv.email}}`, `{{csv.username}}`, etc.
4. **The sequence will run once for each row** in your CSV

### Recording Mode

1. **Click "Start Recording"** in the sidebar
2. **Use the CLI tool** to perform actions: `npm run ai`
3. **Actions are captured automatically**
4. **Click "Stop Recording"** when done
5. **Recorded actions appear in the Sequence Builder**

### Running Sequences

1. **Build or load a sequence**
2. **Click "Run Sequence"** for headless execution
3. **Click "Test Mode"** to see the browser during execution
4. **Monitor progress** in the execution panel

## Best Practices

### Selectors
- Use ID selectors when available: `#submit-button`
- Prefer data attributes: `[data-testid="login-form"]`
- Use aria labels for accessibility: `[aria-label="Search"]`
- Avoid brittle class selectors when possible

### Wait Strategies
- Add wait actions after navigation
- Wait for specific elements before interacting
- Use appropriate wait times for page loads

### Error Handling
- Test sequences in Test Mode first
- Check execution history for failures
- Add wait actions if timing issues occur

### Security
- Never commit credential files
- Use meaningful credential names
- Rotate credentials regularly
- Export credentials before reinstalling

## Troubleshooting

### Common Issues

1. **Elements not found**
   - Check selectors in Test Mode
   - Add wait actions before interactions
   - Use multiple selector candidates

2. **Timing issues**
   - Increase wait durations
   - Wait for specific elements
   - Use network idle waits

3. **Credential substitution not working**
   - Verify credential key matches exactly
   - Check for typos in `{{KEY_NAME}}`
   - Ensure credential exists

### Debug Tips

- Use Test Mode to see what's happening
- Check browser console for errors
- Add screenshot actions for debugging
- Review execution logs in the terminal

## Keyboard Shortcuts

- `Cmd/Ctrl + S` - Save current sequence
- `Cmd/Ctrl + N` - New sequence
- `Delete` - Remove selected action
- `Cmd/Ctrl + D` - Duplicate selected action

## Support

For issues and feature requests, please check the project repository. 