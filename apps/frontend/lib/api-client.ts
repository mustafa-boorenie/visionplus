import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface ConsoleLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  data?: Record<string, unknown>;
  source?: 'system' | 'automation' | 'browser' | 'user';
  createdAt: Date;
  commandId?: string;
}

export interface Session {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  status: 'idle' | 'running' | 'error';
  currentUrl?: string;
  currentCommand?: string;
  historyCount: number;
  connectedClients: number;
  commands?: Array<{
    id: string;
    command: string;
    startedAt: Date;
    completedAt?: Date;
    success: boolean;
    executionTime?: number;
    errors?: string[];
    screenshots?: Array<{
      id: string;
      filename: string;
      capturedAt: Date;
    }>;
  }>;
  screenshots?: Array<{
    id: string;
    filename: string;
    capturedAt: Date;
    pageUrl?: string;
  }>;
  consoleLogs?: ConsoleLog[];
}

export interface CommandResult {
  sessionId: string;
  command: string;
  result: {
    success: boolean;
    executionTime: number;
    screenshots: string[];
    errors: string[];
    stepResults: Array<{
      step: string;
      success: boolean;
      error?: string;
      duration: number;
    }>;
  };
  executionTime: number;
}

export interface Sequence {
  metadata: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    usageCount?: number;
    tags?: string[];
    category?: string;
    successRate?: number;
    lastUsed?: string;
  };
  originalPrompt?: string;
  script: {
    name: string;
    description: string;
    url?: string;
    actions: Array<{
      type: string;
      selector?: string | string[];
      text?: string;
      url?: string;
      key?: string;
      title?: string;
      duration?: number;
    }>;
  };
  executionHistory?: Array<{
    timestamp: string;
    success: boolean;
    executionTime: number;
    errors: string[];
  }>;
}

class ApiClient {
  private axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Session Management
  async createSession(data: {
    startUrl?: string;
    headless?: boolean;
    credentials?: { username?: string; password?: string };
  }): Promise<{ sessionId: string; createdAt: Date; status: string }> {
    try {
      const response = await this.axiosInstance.post('/api/sessions', data);
      return response.data;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.axiosInstance.get(`/api/sessions/${sessionId}`);
    return response.data;
  }

  async listSessions(): Promise<{ sessions: Session[] }> {
    const response = await this.axiosInstance.get('/api/sessions');
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.axiosInstance.delete(`/api/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      // Handle 404 - session already deleted/doesn't exist
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.warn(`Session ${sessionId} not found on server (already deleted)`);
        return { success: true }; // Treat as success since goal is achieved
      }
      throw error; // Re-throw other errors
    }
  }

  async clearInactiveSessions(): Promise<{ cleared: number; success: boolean }> {
    try {
      const response = await this.axiosInstance.post('/api/sessions/clear-inactive');
      return response.data;
    } catch (error) {
      console.error('Failed to clear inactive sessions:', error);
      // Return a failed response instead of throwing
      return { cleared: 0, success: false };
    }
  }

  // Command Execution
  async executeCommand(
    sessionId: string,
    command: string,
    options?: { timeout?: number; generateTests?: boolean }
  ): Promise<CommandResult> {
    const response = await this.axiosInstance.post(
      `/api/sessions/${sessionId}/commands`,
      { command, options }
    );
    return response.data;
  }

  async getCommandHistory(sessionId: string): Promise<{
    sessionId: string;
    history: Array<{
      command: string;
      result: CommandResult['result'];
      timestamp: Date;
    }>;
  }> {
    const response = await this.axiosInstance.get(
      `/api/sessions/${sessionId}/commands`
    );
    return response.data;
  }

  // Server-Sent Events Connection
  createEventSource(sessionId: string): EventSource {
    return new EventSource(`${API_BASE_URL}/api/sessions/${sessionId}/stream`);
  }

  // Sequences
  async listSequences(): Promise<{ sequences: Sequence[] }> {
    const response = await this.axiosInstance.get('/api/sequences');
    return response.data;
  }

  async getSequence(name: string): Promise<Sequence> {
    const response = await this.axiosInstance.get(`/api/sequences/${name}`);
    return response.data;
  }

  async saveSequence(data: {
    name: string;
    originalPrompt?: string;
    executionResult?: {
      success: boolean;
      script: {
        name: string;
        description: string;
        url?: string;
        actions: Array<{
          type: string;
          selector?: string | string[];
          text?: string;
          url?: string;
          key?: string;
          duration?: number;
        }>;
      };
      executionTime: number;
      screenshots: string[];
      errors: string[];
      stepResults?: Array<{
        step: string;
        success: boolean;
        duration: number;
      }>;
    };
    description?: string;
    tags?: string[];
    category?: string;
  }): Promise<{ 
    success: boolean; 
    sequence: Sequence;
  }> {
    const response = await this.axiosInstance.post('/api/sequences', data);
    return response.data;
  }
  
  async updateSequence(name: string, sequence: Partial<Sequence>): Promise<{ 
    success: boolean; 
    sequence: Sequence;
  }> {
    const response = await this.axiosInstance.put(`/api/sequences/${name}`, sequence);
    return response.data;
  }

  async deleteSequence(name: string): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.delete(`/api/sequences/${name}`);
    return response.data;
  }
  
  // Execute sequence in existing session
  async executeSequence(sessionId: string, sequenceName: string): Promise<CommandResult> {
    // URL encode the sequence name to handle spaces and special characters
    const encodedSequenceName = encodeURIComponent(sequenceName);
    const response = await this.axiosInstance.post(
      `/api/sessions/${sessionId}/sequences/${encodedSequenceName}`,
      {}
    );
    return response.data;
  }
  
  // Execute sequence with new session
  async executeSequenceWithNewSession(
    sequenceName: string, 
    options?: {
      arguments?: Record<string, string>;
      startUrl?: string;
    }
  ): Promise<CommandResult> {
    // URL encode the sequence name to handle spaces and special characters
    const encodedSequenceName = encodeURIComponent(sequenceName);
    const response = await this.axiosInstance.post(
      `/api/sequences/${encodedSequenceName}/execute`,
      options || {}
    );
    return response.data;
  }

  // Console logs
  async getConsoleLogs(sessionId: string, limit?: number, commandId?: string): Promise<{
    sessionId: string;
    logs: ConsoleLog[];
  }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (commandId) params.append('commandId', commandId);
    
    const response = await this.axiosInstance.get(
      `/api/sessions/${sessionId}/console?${params.toString()}`
    );
    return response.data;
  }

  // Get console logs stream SSE endpoint URL
  getConsoleStreamUrl(sessionId: string): string {
    return `${API_BASE_URL}/api/sessions/${sessionId}/console/stream`;
  }

  // Screenshot URL helper
  getScreenshotUrl(sessionId: string, filename: string): string {
    // Add cache busting parameter to ensure fresh screenshots
    const timestamp = Date.now();
    return `${API_BASE_URL}/api/sessions/${sessionId}/screenshots/${filename}?t=${timestamp}`;
  }
}

export const apiClient = new ApiClient(); 