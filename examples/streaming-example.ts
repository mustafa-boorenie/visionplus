#!/usr/bin/env tsx

import { StreamingServer } from '../src/streaming/StreamingServer';
import { WebSocketStreamingServer } from '../src/streaming/WebSocketServer';
import { ProgressTracker } from '../src/utils/ProgressTracker';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan('\n🚀 Starting Streaming Example...\n'));

  // Create servers
  const sseServer = new StreamingServer({ port: 3001 });
  const wsServer = new WebSocketStreamingServer({ port: 3002 });

  // Start servers
  await sseServer.start();
  await wsServer.start();

  // Create progress tracker with streaming enabled
  const tracker = new ProgressTracker(true);
  tracker.enableSSEStreaming(sseServer);
  tracker.enableWebSocketStreaming(wsServer);

  console.log(chalk.green('✓ Streaming servers started'));
  console.log(chalk.gray(`  SSE: http://localhost:3001/stream`));
  console.log(chalk.gray(`  WebSocket: ws://localhost:3002`));
  console.log(chalk.gray(`  Health: http://localhost:3001/health`));
  console.log(chalk.gray(`  Metrics: http://localhost:3001/metrics\n`));

  console.log(chalk.yellow('📡 Connect your client to see real-time updates:'));
  console.log(chalk.gray('  curl -N http://localhost:3001/stream\n'));

  // Simulate a task with progress
  const steps = [
    'Initializing browser',
    'Navigating to target page',
    'Finding search input',
    'Typing search query',
    'Submitting form',
    'Waiting for results',
    'Extracting data',
    'Saving results'
  ];

  tracker.initialize(steps.length);

  console.log(chalk.cyan('\n🎬 Starting simulated automation...\n'));

  for (let i = 0; i < steps.length; i++) {
    // Start step
    tracker.track({
      type: 'step_start',
      stepIndex: i + 1,
      totalSteps: steps.length,
      description: steps[i]
    });

    // Simulate work with random delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Occasionally add analysis events
    if (Math.random() > 0.6) {
      tracker.track({
        type: 'analysis',
        stepIndex: i + 1,
        totalSteps: steps.length,
        description: 'Using AI to analyze page',
        details: { confidence: Math.round(80 + Math.random() * 20) }
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Complete step
    tracker.track({
      type: 'step_complete',
      stepIndex: i + 1,
      totalSteps: steps.length,
      description: steps[i]
    });
  }

  tracker.displaySummary(true);

  // Show final metrics
  console.log(chalk.yellow('\n📊 Final Metrics:'));
  console.log(chalk.gray(`  SSE Clients: ${sseServer.getClientCount()}`));
  console.log(chalk.gray(`  WebSocket Clients: ${wsServer.getClientCount()}`));
  
  const sseMetrics = sseServer.getMetrics();
  const wsMetrics = wsServer.getMetrics();
  
  console.log(chalk.gray(`  Total Events Sent (SSE): ${sseMetrics.totalEvents}`));
  console.log(chalk.gray(`  Total Messages Sent (WS): ${wsMetrics.totalMessages}`));

  console.log(chalk.cyan('\n✨ Demo complete! Press Ctrl+C to exit.\n'));

  // Keep servers running
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Shutting down...'));
    await sseServer.stop();
    await wsServer.stop();
    process.exit(0);
  });
}

main().catch(console.error);