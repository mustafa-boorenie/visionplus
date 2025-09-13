#!/usr/bin/env tsx

import chalk from 'chalk';
import { StreamingServer } from '../src/streaming/StreamingServer';
import { WebSocketStreamingServer } from '../src/streaming/WebSocketServer';
import { ProgressTracker } from '../src/utils/ProgressTracker';
import { IntelligentAutomation } from '../src/automation/IntelligentAutomation';
import * as readline from 'readline';

/**
 * Demo client showcasing real-time streaming capabilities
 */
class StreamingDemo {
  private sseServer: StreamingServer;
  private wsServer: WebSocketStreamingServer;
  private progressTracker: ProgressTracker;
  private rl: readline.Interface;

  constructor() {
    this.sseServer = new StreamingServer({ 
      port: 3001,
      heartbeatInterval: 30000,
      cors: true 
    });
    
    this.wsServer = new WebSocketStreamingServer({ 
      port: 3002,
      heartbeatInterval: 30000 
    });
    
    this.progressTracker = new ProgressTracker(true);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log(chalk.cyan('\n🚀 Starting Streaming Demo...\n'));

    // Start servers
    await this.sseServer.start();
    await this.wsServer.start();

    // Enable streaming in progress tracker
    this.progressTracker.enableSSEStreaming(this.sseServer);
    this.progressTracker.enableWebSocketStreaming(this.wsServer);

    console.log(chalk.green('✓ Streaming servers started'));
    console.log(chalk.gray(`  SSE: http://localhost:3001/stream`));
    console.log(chalk.gray(`  WebSocket: ws://localhost:3002`));
    console.log(chalk.gray(`  Health: http://localhost:3001/health`));
    console.log(chalk.gray(`  Metrics: http://localhost:3001/metrics\n`));

    this.displayClientExamples();
    this.setupDemoMenu();
  }

  private displayClientExamples() {
    console.log(chalk.yellow('📱 Connect your clients:\n'));
    
    console.log(chalk.white('JavaScript (SSE):'));
    console.log(chalk.gray(`
const eventSource = new EventSource('http://localhost:3001/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
`));

    console.log(chalk.white('JavaScript (WebSocket):'));
    console.log(chalk.gray(`
const ws = new WebSocket('ws://localhost:3002');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
`));

    console.log(chalk.white('curl (SSE):'));
    console.log(chalk.gray(`curl -N http://localhost:3001/stream\n`));
  }

  private setupDemoMenu() {
    console.log(chalk.cyan('📋 Demo Options:'));
    console.log(chalk.white('  1. Simulate automation progress'));
    console.log(chalk.white('  2. Send custom broadcast'));
    console.log(chalk.white('  3. Run real automation with streaming'));
    console.log(chalk.white('  4. Show server metrics'));
    console.log(chalk.white('  5. Stress test (rapid events)'));
    console.log(chalk.white('  6. Exit\n'));

    this.promptUser();
  }

  private promptUser() {
    this.rl.question(chalk.cyan('Select option (1-6): '), async (answer) => {
      console.log();

      switch (answer) {
        case '1':
          await this.simulateProgress();
          break;
        case '2':
          await this.sendCustomBroadcast();
          break;
        case '3':
          await this.runRealAutomation();
          break;
        case '4':
          this.showMetrics();
          break;
        case '5':
          await this.stressTest();
          break;
        case '6':
          await this.cleanup();
          return;
        default:
          console.log(chalk.red('Invalid option'));
      }

      console.log();
      this.promptUser();
    });
  }

  private async simulateProgress() {
    console.log(chalk.yellow('🎬 Simulating automation progress...\n'));

    const steps = [
      'Navigating to website',
      'Finding search input',
      'Typing search query',
      'Clicking search button',
      'Waiting for results',
      'Analyzing page content',
      'Taking screenshot',
      'Processing results'
    ];

    this.progressTracker.initialize(steps.length);

    for (let i = 0; i < steps.length; i++) {
      // Start step
      this.progressTracker.track({
        type: 'step_start',
        stepIndex: i + 1,
        totalSteps: steps.length,
        description: steps[i]
      });

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Random events
      if (Math.random() > 0.7) {
        this.progressTracker.track({
          type: 'analysis',
          stepIndex: i + 1,
          totalSteps: steps.length,
          description: 'Analyzing page structure',
          details: 'Using AI vision to understand layout'
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Complete step (with occasional failure)
      if (Math.random() > 0.9) {
        this.progressTracker.track({
          type: 'step_failed',
          stepIndex: i + 1,
          totalSteps: steps.length,
          description: steps[i],
          details: { error: 'Element not found' }
        });

        // Retry
        this.progressTracker.track({
          type: 'retry',
          stepIndex: i + 1,
          totalSteps: steps.length,
          description: steps[i],
          details: { attempt: 1, maxAttempts: 3 }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.progressTracker.track({
        type: 'step_complete',
        stepIndex: i + 1,
        totalSteps: steps.length,
        description: steps[i]
      });
    }

    this.progressTracker.displaySummary(true);
  }

  private async sendCustomBroadcast() {
    this.rl.question('Enter event type: ', (eventType) => {
      this.rl.question('Enter message: ', (message) => {
        const data = {
          message,
          timestamp: new Date().toISOString(),
          source: 'manual'
        };

        this.sseServer.broadcast(eventType, data);
        this.wsServer.broadcast(eventType, data);

        console.log(chalk.green(`✓ Broadcast sent: ${eventType}`));
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      });
    });
  }

  private async runRealAutomation() {
    console.log(chalk.yellow('🤖 Running real automation with streaming...\n'));

    const automation = new IntelligentAutomation(
      'Search for TypeScript tutorials',
      this.progressTracker
    );

    try {
      await automation.execute('https://www.google.com');
      console.log(chalk.green('\n✓ Automation completed successfully'));
    } catch (error) {
      console.log(chalk.red(`\n✗ Automation failed: ${error}`));
    }
  }

  private showMetrics() {
    console.log(chalk.yellow('📊 Server Metrics:\n'));

    const sseMetrics = this.sseServer.getMetrics();
    const wsMetrics = this.wsServer.getMetrics();

    console.log(chalk.white('SSE Server:'));
    console.log(chalk.gray(`  Active connections: ${sseMetrics.activeConnections}`));
    console.log(chalk.gray(`  Total connections: ${sseMetrics.totalConnections}`));
    console.log(chalk.gray(`  Total events sent: ${sseMetrics.totalEvents}`));
    console.log(chalk.gray(`  Reconnections: ${sseMetrics.reconnections}`));
    console.log(chalk.gray(`  Errors: ${sseMetrics.errors}`));

    console.log(chalk.white('\nWebSocket Server:'));
    console.log(chalk.gray(`  Active connections: ${wsMetrics.activeConnections}`));
    console.log(chalk.gray(`  Total connections: ${wsMetrics.totalConnections}`));
    console.log(chalk.gray(`  Messages sent: ${wsMetrics.totalMessages}`));
    console.log(chalk.gray(`  Messages received: ${wsMetrics.messagesReceived}`));
    console.log(chalk.gray(`  Reconnections: ${wsMetrics.reconnections}`));
    console.log(chalk.gray(`  Errors: ${wsMetrics.errors}`));
  }

  private async stressTest() {
    console.log(chalk.yellow('⚡ Running stress test...\n'));

    const eventCount = 100;
    const startTime = Date.now();

    for (let i = 0; i < eventCount; i++) {
      const eventData = {
        index: i,
        timestamp: Date.now(),
        random: Math.random(),
        data: `Event ${i} of ${eventCount}`
      };

      this.sseServer.broadcast('stress-test', eventData);
      this.wsServer.broadcast('stress-test', eventData);

      if (i % 10 === 0) {
        process.stdout.write(chalk.gray('.'));
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const duration = Date.now() - startTime;
    const eventsPerSecond = Math.round(eventCount / (duration / 1000));

    console.log(chalk.green(`\n\n✓ Sent ${eventCount} events in ${duration}ms`));
    console.log(chalk.gray(`  Rate: ${eventsPerSecond} events/second`));
  }

  private async cleanup() {
    console.log(chalk.yellow('\n👋 Shutting down...\n'));

    await this.sseServer.stop();
    await this.wsServer.stop();
    this.rl.close();

    console.log(chalk.green('✓ Servers stopped'));
    process.exit(0);
  }
}

// HTML Client Example
const htmlClient = `
<!DOCTYPE html>
<html>
<head>
    <title>Streaming Demo Client</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .connection { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .event { margin: 5px 0; padding: 5px; background: #f8f9fa; border-left: 3px solid #007bff; }
        .progress { background: #cfe2ff; border-color: #084298; }
        .error { background: #f8d7da; border-color: #dc3545; }
        #events { max-height: 400px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>Streaming Demo Client</h1>
    
    <div id="sse-status" class="connection disconnected">SSE: Disconnected</div>
    <div id="ws-status" class="connection disconnected">WebSocket: Disconnected</div>
    
    <h2>Events</h2>
    <button onclick="clearEvents()">Clear</button>
    <div id="events"></div>

    <script>
        // SSE Connection
        const eventSource = new EventSource('http://localhost:3001/stream');
        const sseStatus = document.getElementById('sse-status');
        
        eventSource.onopen = () => {
            sseStatus.textContent = 'SSE: Connected';
            sseStatus.className = 'connection connected';
        };
        
        eventSource.onerror = () => {
            sseStatus.textContent = 'SSE: Disconnected';
            sseStatus.className = 'connection disconnected';
        };
        
        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            addEvent('SSE Progress', data, 'progress');
        });
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            addEvent('SSE', data);
        };

        // WebSocket Connection
        const ws = new WebSocket('ws://localhost:3002');
        const wsStatus = document.getElementById('ws-status');
        
        ws.onopen = () => {
            wsStatus.textContent = 'WebSocket: Connected';
            wsStatus.className = 'connection connected';
        };
        
        ws.onclose = () => {
            wsStatus.textContent = 'WebSocket: Disconnected';
            wsStatus.className = 'connection disconnected';
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                addEvent('WS Progress', data.data, 'progress');
            } else {
                addEvent('WebSocket', data);
            }
        };

        // Display events
        function addEvent(source, data, className = '') {
            const events = document.getElementById('events');
            const event = document.createElement('div');
            event.className = 'event ' + className;
            event.innerHTML = \`
                <strong>\${source}</strong> - \${new Date().toLocaleTimeString()}<br>
                <pre>\${JSON.stringify(data, null, 2)}</pre>
            \`;
            events.insertBefore(event, events.firstChild);
            
            // Keep only last 50 events
            while (events.children.length > 50) {
                events.removeChild(events.lastChild);
            }
        }
        
        function clearEvents() {
            document.getElementById('events').innerHTML = '';
        }
    </script>
</body>
</html>
`;

// Main execution
async function main() {
  const demo = new StreamingDemo();
  
  // Save HTML client
  console.log(chalk.gray('\n💾 Saving HTML client to: examples/streaming-client.html'));
  await require('fs-extra').writeFile('examples/streaming-client.html', htmlClient);
  
  await demo.start();
}

if (require.main === module) {
  main().catch(console.error);
}