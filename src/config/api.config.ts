import { env } from './environment';

/**
 * API server configuration
 */
export const apiConfig = {
  // Server settings
  port: env.PORT,
  host: '0.0.0.0',
  
  // CORS settings
  cors: {
    origin: env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  
  // File upload limits
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  },
  
  // Session configuration
  session: {
    timeout: 30 * 60 * 1000, // 30 minutes
    maxConcurrent: 10
  },
  
  // WebSocket configuration
  websocket: {
    pingInterval: 30000,
    pingTimeout: 5000
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
    jwtExpiry: '24h'
  }
};

/**
 * OpenAI API configuration
 */
export const openAIConfig = {
  apiKey: env.OPENAI_API_KEY,
  model: 'gpt-4-turbo-preview',
  visionModel: 'gpt-4-vision-preview',
  maxTokens: 4096,
  temperature: 0.3,
  
  // Rate limiting for API calls
  rateLimits: {
    requestsPerMinute: 50,
    tokensPerMinute: 40000
  }
};

/**
 * CAPTCHA service configuration
 */
export const captchaConfig = {
  antiCaptcha: {
    apiKey: env.ANTI_CAPTCHA_KEY,
    timeout: 180000, // 3 minutes
    checkInterval: 3000 // 3 seconds
  },
  
  // Add other CAPTCHA services here
  // capSolver: {
  //   apiKey: env.CAPSOLVER_KEY,
  //   timeout: 180000
  // }
};

/**
 * Docker configuration
 */
export const dockerConfig = {
  imageName: 'ai-playwright-browser:latest',
  defaultMemory: 512 * 1024 * 1024, // 512MB
  defaultCpuShares: 512,
  healthCheckInterval: 5000,
  maxRetries: 3
};

