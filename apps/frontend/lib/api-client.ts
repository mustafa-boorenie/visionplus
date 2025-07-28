import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

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
    const response = await this.axiosInstance.delete(`/api/sessions/${sessionId}`);
    return response.data;
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

  async saveSequence(sequence: Partial<Sequence>): Promise<{ 
    success: boolean; 
    sequence: Sequence;
  }> {
    const response = await this.axiosInstance.post('/api/sequences', sequence);
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
    const response = await this.axiosInstance.post(
      `/api/sessions/${sessionId}/sequences/${sequenceName}`,
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
    const response = await this.axiosInstance.post(
      `/api/sequences/${sequenceName}/execute`,
      options || {}
    );
    return response.data;
  }

  // Screenshot URL helper
  getScreenshotUrl(sessionId: string, filename: string): string {
    // Add cache busting parameter to ensure fresh screenshots
    const timestamp = Date.now();
    return `${API_BASE_URL}/api/sessions/${sessionId}/screenshots/${filename}?t=${timestamp}`;
  }
}

export const apiClient = new ApiClient(); 