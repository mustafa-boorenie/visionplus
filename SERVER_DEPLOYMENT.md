# AI Playwright Automation Server Deployment Guide

This guide covers how to deploy and integrate the AI Playwright Automation server with a frontend application.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

**Development mode:**
```bash
npm run server:dev
```

**Production mode:**
```bash
npm run server:prod
```

## 📡 API Endpoints

### Workflow Management

#### Run Workflow
```
POST /api/workflows/run
```

**Request Body:**
```json
{
  "sequenceName": "login-workflow",  // OR use "prompt" instead
  "prompt": "Go to Google and search for AI news",
  "arguments": {
    "username": "user@example.com",
    "password": "secure123"
  },
  "csvData": [...],  // Optional: array of objects for batch processing
  "startUrl": "https://example.com",
  "options": {
    "headless": true,
    "timeout": 30000
  }
}
```

#### Check Workflow Status
```
GET /api/workflows/:id/status
```

#### List All Workflows
```
GET /api/workflows
```

### Sequence Management

#### List Sequences
```
GET /api/sequences
```

#### Get Sequence Details
```
GET /api/sequences/:name
```

#### Get Sequence Arguments
```
GET /api/sequences/:name/arguments
```

### File Upload

#### Upload CSV
```
POST /api/upload/csv
Content-Type: multipart/form-data
```

### Learning & Feedback

#### Get Learning Patterns
```
GET /api/feedback/patterns
```

#### Generate Training Data
```
POST /api/feedback/train
```

#### Get Rules
```
GET /api/rules
```

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Frontend App   │────▶│  Fastify API    │────▶│  Playwright     │
│  (React/Vue)    │     │    Server       │     │  Automation     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       ▼                        ▼
         │              ┌─────────────────┐     ┌─────────────────┐
         │              │                 │     │                 │
         └─────────────▶│  Feedback &     │     │   Browser       │
                        │  Rules Engine   │     │   Sessions      │
                        │                 │     │                 │
                        └─────────────────┘     └─────────────────┘
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://your-frontend.com

# OpenAI Configuration
OPENAI_API_KEY=your-api-key

# Deployment Configuration
DEPLOY_HOST=your-server.com
DEPLOY_REPO=git@github.com:your-org/your-repo.git

# PM2 Configuration
PM2_INSTANCES=4
```

## 🌐 Frontend Integration

### Example: React Integration

```jsx
import { useState } from 'react';

const AutomationDashboard = () => {
  const [workflowId, setWorkflowId] = useState(null);
  const [status, setStatus] = useState(null);
  
  const runWorkflow = async (prompt, args, csvFile) => {
    // Upload CSV if provided
    let csvData = null;
    if (csvFile) {
      const formData = new FormData();
      formData.append('file', csvFile);
      
      const uploadRes = await fetch('http://localhost:3000/api/upload/csv', {
        method: 'POST',
        body: formData
      });
      
      const uploadData = await uploadRes.json();
      csvData = uploadData.data;
    }
    
    // Run workflow
    const response = await fetch('http://localhost:3000/api/workflows/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        arguments: args,
        csvData,
        startUrl: 'https://example.com'
      })
    });
    
    const data = await response.json();
    setWorkflowId(data.workflowId);
    
    // Poll for status
    pollStatus(data.workflowId);
  };
  
  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      const res = await fetch(`http://localhost:3000/api/workflows/${id}/status`);
      const status = await res.json();
      
      setStatus(status);
      
      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(interval);
      }
    }, 2000);
  };
  
  return (
    <div>
      {/* Your UI here */}
    </div>
  );
};
```

### Example: Vue Integration

```vue
<template>
  <div>
    <form @submit.prevent="runWorkflow">
      <input v-model="prompt" placeholder="Enter automation prompt" />
      <input type="file" @change="handleFile" accept=".csv" />
      <button type="submit">Run Workflow</button>
    </form>
    
    <div v-if="status">
      <p>Status: {{ status.status }}</p>
      <progress :value="status.progress" max="100"></progress>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      prompt: '',
      csvFile: null,
      status: null,
      workflowId: null
    };
  },
  
  methods: {
    async runWorkflow() {
      const formData = new FormData();
      
      if (this.csvFile) {
        formData.append('file', this.csvFile);
        await fetch('http://localhost:3000/api/upload/csv', {
          method: 'POST',
          body: formData
        });
      }
      
      const response = await fetch('http://localhost:3000/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: this.prompt })
      });
      
      const data = await response.json();
      this.workflowId = data.workflowId;
      this.pollStatus();
    },
    
    async pollStatus() {
      // Implementation similar to React example
    }
  }
};
</script>
```

## 🚢 Production Deployment

### Using PM2

1. **Install PM2 globally:**
```bash
npm install -g pm2
```

2. **Build the project:**
```bash
npm run build
```

3. **Start with PM2:**
```bash
npm run pm2:start
```

4. **Monitor logs:**
```bash
npm run pm2:logs
```

5. **Save PM2 configuration:**
```bash
pm2 save
pm2 startup
```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
  wget \
  gnupg \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
```

Build and run:
```bash
docker build -t ai-playwright-api .
docker run -p 3000:3000 --env-file .env ai-playwright-api
```

### Using Systemd (Linux)

Create `/etc/systemd/system/ai-playwright-api.service`:

```ini
[Unit]
Description=AI Playwright API Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/ai-playwright-api
ExecStart=/usr/bin/node /var/www/ai-playwright-api/dist/server/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-playwright-api
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable ai-playwright-api
sudo systemctl start ai-playwright-api
```

## 🔒 Security Considerations

1. **API Authentication:**
   - Add JWT authentication for production
   - Implement rate limiting
   - Use HTTPS in production

2. **Input Validation:**
   - Validate all user inputs
   - Sanitize file uploads
   - Limit CSV file sizes

3. **Resource Limits:**
   - Set timeouts for workflows
   - Limit concurrent workflows
   - Monitor memory usage

## 📊 Monitoring

### Health Check

The server provides a health endpoint:
```
GET /health
```

### Metrics to Monitor

- Workflow success/failure rates
- Average execution time
- Memory usage
- API response times
- Browser session count

## 🎯 Best Practices

1. **Error Handling:**
   - Log all errors with context
   - Provide meaningful error messages
   - Implement retry logic for transient failures

2. **Performance:**
   - Use connection pooling for browsers
   - Cache frequently used sequences
   - Implement request queuing

3. **Maintenance:**
   - Regular cleanup of old screenshots
   - Archive completed workflows
   - Update rules based on patterns

## 🆘 Troubleshooting

### Common Issues

1. **Browser not launching:**
   - Ensure Chrome/Chromium is installed
   - Check display server (use xvfb for headless)
   - Verify user permissions

2. **High memory usage:**
   - Limit concurrent workflows
   - Close unused browser sessions
   - Implement memory monitoring

3. **Slow performance:**
   - Enable browser caching
   - Use connection pooling
   - Optimize selector strategies

## 📚 Advanced Features

### Webhooks

Configure webhooks for workflow events:

```javascript
// In your workflow request
{
  "webhook": {
    "url": "https://your-app.com/webhook",
    "events": ["completed", "failed"]
  }
}
```

### Batch Processing

Process multiple items with different arguments:

```javascript
{
  "sequenceName": "process-invoice",
  "csvData": [
    { "invoiceId": "001", "amount": "100" },
    { "invoiceId": "002", "amount": "200" }
  ]
}
```

### Custom Plugins

Extend the server with custom plugins:

```javascript
// plugins/custom-auth.js
export default async function (fastify, opts) {
  fastify.addHook('onRequest', async (request, reply) => {
    // Custom authentication logic
  });
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details 