import Docker from 'dockerode';
import axios from 'axios';
import { log } from '../../utils/logger';
import { BrowserAction } from '../../types';
import { env } from '../../config/environment';
import { dockerConfig } from '../../config/api.config';

export interface DockerBrowserSession {
  containerId: string;
  port: string;
  apiUrl: string;
}

/**
 * Service for managing Docker-based browser instances
 */
export class DockerService {
  private docker: Docker;
  private imageName: string;
  
  constructor() {
    this.docker = new Docker();
    this.imageName = dockerConfig.imageName;
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
      throw new Error('Please build the Docker image manually first: docker build -t ai-playwright-browser:latest -f docker/playwright-browser/Dockerfile .');
    }
  }

  /**
   * Create a new browser container
   */
  async createBrowserContainer(sessionId: string): Promise<DockerBrowserSession> {
    try {
      // Wait for Docker daemon
      await this.waitForDaemon();
      
      // Ensure image exists
      await this.ensureImage();
      
      // Find available port
      const port = await this.findAvailablePort();
      
      // Create container
      const container = await this.docker.createContainer({
        Image: this.imageName,
        name: `playwright-browser-${sessionId}`,
        ExposedPorts: {
          '3000/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '3000/tcp': [{ HostPort: port }]
          },
          AutoRemove: true,
          Memory: dockerConfig.defaultMemory,
          CpuShares: dockerConfig.defaultCpuShares
        },
        Env: [
          `SESSION_ID=${sessionId}`,
          `PORT=3000`,
          `HEADLESS_MODE=${env.HEADLESS_MODE}`,
          `STEALTH_MODE=${env.STEALTH_MODE}`,
          `HUMANIZE_INPUTS=${env.HUMANIZE_INPUTS}`
        ]
      });
      
      // Start container
      await container.start();
      
      const apiUrl = `http://localhost:${port}`;
      
      // Wait for container to be ready
      await this.waitForContainerReady(apiUrl);
      
      const session: DockerBrowserSession = {
        containerId: container.id,
        port,
        apiUrl
      };
      
      log.info(`Docker browser created for session ${sessionId} on port ${port}`);
      
      return session;
      
    } catch (error) {
      log.error('Failed to create Docker browser', error as Error);
      throw error;
    }
  }

  /**
   * Find an available port
   */
  private async findAvailablePort(): Promise<string> {
    const basePort = 3100;
    for (let i = 0; i < 100; i++) {
      const port = (basePort + i).toString();
      const isUsed = await this.isPortInUse(port);
      if (!isUsed) {
        return port;
      }
    }
    throw new Error('No available ports found');
  }

  /**
   * Check if a port is in use
   */
  private async isPortInUse(port: string): Promise<boolean> {
    try {
      const containers = await this.docker.listContainers();
      for (const containerInfo of containers) {
        if (containerInfo.Ports) {
          for (const portInfo of containerInfo.Ports) {
            if (portInfo.PublicPort?.toString() === port) {
              return true;
            }
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Wait for container to be ready
   */
  private async waitForContainerReady(apiUrl: string, maxRetries: number = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`${apiUrl}/health`, { timeout: 5000 });
        if (response.status === 200) {
          log.info('Docker container is ready');
          return;
        }
      } catch (error) {
        log.debug(`Waiting for container to be ready (attempt ${i + 1}/${maxRetries})...`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Container failed to become ready');
  }

  /**
   * Execute browser action in container
   */
  async executeAction(session: DockerBrowserSession, action: BrowserAction): Promise<any> {
    try {
      const response = await axios.post(
        `${session.apiUrl}/execute`,
        action,
        { timeout: action.type === 'navigate' ? 60000 : 30000 }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Action failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Take screenshot from container
   */
  async takeScreenshot(session: DockerBrowserSession, name: string): Promise<Buffer> {
    try {
      const response = await axios.get(
        `${session.apiUrl}/screenshot`,
        { 
          params: { name },
          responseType: 'arraybuffer',
          timeout: 10000 
        }
      );
      
      return Buffer.from(response.data);
    } catch (error) {
      log.error('Failed to take screenshot', error as Error);
      throw error;
    }
  }

  /**
   * Get current URL from container
   */
  async getCurrentUrl(session: DockerBrowserSession): Promise<string> {
    try {
      const response = await axios.get(`${session.apiUrl}/url`, { timeout: 5000 });
      return response.data.url || '';
    } catch (error) {
      log.error('Failed to get current URL', error as Error);
      return '';
    }
  }

  /**
   * Stop and remove container
   */
  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      try {
        await container.stop({ t: 5 });
      } catch (error) {
        // Container might already be stopped
        log.debug('Container stop error (might already be stopped)');
      }
      
      try {
        await container.remove({ force: true });
      } catch (error) {
        // Container might already be removed (auto-remove)
        log.debug('Container remove error (might already be removed)');
      }
      
      log.info(`Docker container ${containerId} stopped`);
    } catch (error) {
      log.error('Failed to stop container', error as Error);
    }
  }

  /**
   * Get container health
   */
  async getContainerHealth(session: DockerBrowserSession): Promise<boolean> {
    try {
      const response = await axios.get(`${session.apiUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * List all browser containers
   */
  async listBrowserContainers(): Promise<Docker.ContainerInfo[]> {
    const containers = await this.docker.listContainers({
      filters: {
        ancestor: [this.imageName]
      }
    });
    
    return containers;
  }

  /**
   * Clean up orphaned containers
   */
  async cleanupOrphanedContainers(): Promise<number> {
    const containers = await this.listBrowserContainers();
    let cleaned = 0;
    
    for (const containerInfo of containers) {
      const container = this.docker.getContainer(containerInfo.Id);
      try {
        await container.remove({ force: true });
        cleaned++;
        log.info(`Cleaned up orphaned container: ${containerInfo.Names[0]}`);
      } catch (error) {
        log.error(`Failed to clean up container ${containerInfo.Id}`, error as Error);
      }
    }
    
    return cleaned;
  }
}