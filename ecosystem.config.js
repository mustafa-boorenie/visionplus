module.exports = {
  apps: [{
    name: 'ai-playwright-api',
    script: './dist/server/index.js',
    instances: process.env.PM2_INSTANCES || 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    
    // Auto restart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Watch & reload
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'screenshots', 'feedback', 'rules'],
    
    // Advanced features
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: process.env.DEPLOY_HOST,
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO,
      path: '/var/www/ai-playwright-api',
      'pre-deploy-local': 'npm run build',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /var/www/ai-playwright-api'
    }
  }
}; 