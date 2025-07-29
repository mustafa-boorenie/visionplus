import Docker from 'dockerode';
import axios from 'axios';
import { log } from '../utils/logger';
import { BrowserAction } from '../types';

export interface DockerBrowserSession {
  containerId: string;
  port: string;
  apiUrl: string;
}

export class DockerBrowserService {
  private docker: Docker;
  private imageName: string = 'ai-playwright-browser:latest';
  
  constructor() {
    this.docker = new Docker();
  }
  
  /**
   * Wait for Docker daemon to be available
   */
  private async waitForDaemon(maxRetries: number = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.docker.info();
        log.info('Docker daemon is available');
        return;
      } catch (error) {
        log.info(`Waiting for Docker daemon (attempt ${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('Docker daemon not available after waiting');
  }

  /**
   * Build the Docker image if it doesn't exist
   */
  async ensureImage(): Promise<void> {
    try {
      await this.docker.getImage(this.imageName).inspect();
      log.info('Docker image already exists');
    } catch (error) {
      log.info('Building Docker image...');
      // For now, assume the image was built manually
      // Building programmatically requires creating a tar stream which is complex
      throw new Error('Please build the Docker image manually first: docker build -t ai-playwright-browser:latest -f docker/playwright-browser/Dockerfile .');
    }
  }
  
  /**
   * Create and start a new browser container
   */
  async createBrowserSession(options: {
    startUrl?: string;
    headless?: boolean;
  }): Promise<DockerBrowserSession> {
    // Wait for Docker daemon before proceeding
    await this.waitForDaemon();

    await this.ensureImage();
    
    // Create container
    const container = await this.docker.createContainer({
      Image: this.imageName,
      ExposedPorts: { '3000/tcp': {} },
      HostConfig: {
        PortBindings: { 
          '3000/tcp': [{ HostPort: '0' }] // Let Docker assign a random port
        },
        AutoRemove: true,
        Memory: 512 * 1024 * 1024, // 512MB memory limit
        CpuShares: 512 // Half CPU share
      },
      Env: [
        `START_URL=${options.startUrl || ''}`,
        `HEADLESS=${options.headless ? 'true' : 'false'}`
      ]
    });
    
    // Start container
    await container.start();
    
    // Get assigned port
    const containerInfo = await container.inspect();
    const port = containerInfo.NetworkSettings.Ports['3000/tcp'][0].HostPort;
    const apiUrl = `http://localhost:${port}`;
    
    // Wait for container to be ready
    await this.waitForContainer(apiUrl);
    
    log.info(`Browser container started: ${container.id} on port ${port}`);
    
    return {
      containerId: container.id,
      port,
      apiUrl
    };
  }
  
  /**
   * Wait for container API to be ready
   */
  private async waitForContainer(apiUrl: string, maxRetries: number = 120): Promise<void> {
    log.info(`Waiting for container to be ready at ${apiUrl}...`);
    
    // First, wait for port to be accessible (container is starting)
    for (let i = 0; i < 30; i++) {
      try {
        // Just try to connect to the port
        await axios.get(apiUrl, { timeout: 1000 }).catch(() => {
          // We don't care about the response, just that the port is open
        });
        log.info(`Container port is accessible after ${i + 1} attempts`);
        break;
      } catch (error) {
        if (i % 10 === 9) {
          log.info(`Waiting for container port to open (attempt ${i + 1}/30)...`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Then wait for health endpoint to respond successfully
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`${apiUrl}/health`, { timeout: 2000 });
        if (response.data.status === 'ok') {
          log.info(`Container is ready after ${i + 1} attempts`);
          return;
        }
      } catch (error: any) {
        // Log every 10th attempt to avoid spam
        if (i % 10 === 9) {
          log.info(`Container health check pending (attempt ${i + 1}/${maxRetries}): ${error.message || 'Not ready yet'}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    log.error(`Container failed to become healthy within ${maxRetries} seconds`);
    throw new Error(`Container failed to start within timeout. The container is running but the browser initialization may have failed.`);
  }
  
  /**
   * Execute a browser action in a container
   */
  async executeAction(session: DockerBrowserSession, action: BrowserAction): Promise<any> {
    try {
      const response = await axios.post(
        `${session.apiUrl}/execute`,
        action,
        { timeout: 30000 }
      );
      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Browser action failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Get current URL from container
   */
  async getCurrentUrl(session: DockerBrowserSession): Promise<string> {
    try {
      const response = await axios.get(`${session.apiUrl}/url`);
      return response.data.url;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get URL: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Take a screenshot in container
   */
  async takeScreenshot(session: DockerBrowserSession, name?: string, options?: any): Promise<string> {
    try {
      const response = await axios.post(
        `${session.apiUrl}/screenshot`,
        { name, options },
        { timeout: 10000 }
      );
      return response.data.data; // Returns base64 screenshot
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Screenshot failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Check Docker container health status
   */
  async checkDockerHealth(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      const containerInfo = await container.inspect();
      
      // Check if container is running
      if (containerInfo.State.Status !== 'running') {
        return false;
      }
      
      // If container has health check configured, use that
      if (containerInfo.State.Health) {
        return containerInfo.State.Health.Status === 'healthy';
      }
      
      // Otherwise, just check if it's running
      return true;
    } catch (error) {
      log.error(`Failed to check container health for ${containerId}:`, error as Error);
      return false;
    }
  }
  
  /**
   * Stop and remove a browser container
   */
  async destroySession(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: 5 }); // 5 second timeout
      log.info(`Browser container stopped: ${containerId}`);
    } catch (error: any) {
      // Container might already be stopped or removed
      if (error.statusCode !== 404 && error.statusCode !== 304) {
        log.error(`Failed to stop container ${containerId}:`, error);
      }
    }
  }
  
  /**
   * Clean up all containers with our image
   */
  async cleanupAllSessions(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { ancestor: [this.imageName] }
      });
      
      for (const containerInfo of containers) {
        await this.destroySession(containerInfo.Id);
      }
      
      log.info(`Cleaned up ${containers.length} browser containers`);
    } catch (error) {
      log.error('Failed to cleanup containers:', error as Error);
    }
  }
} 