/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  createdAt: Date;
  lastActive: Date;
  status: 'active' | 'idle' | 'closed';
  currentUrl?: string;
  containerId?: string;
}

/**
 * Create session request
 */
export interface CreateSessionRequest {
  url?: string;
  headless?: boolean;
  persistent?: boolean;
}

/**
 * Command request
 */
export interface CommandRequest {
  sessionId: string;
  command: string;
  action?: any;
}

/**
 * Command response
 */
export interface CommandResponse {
  sessionId: string;
  result?: any;
  screenshot?: string;
  error?: string;
}

/**
 * WebRTC session request
 */
export interface WebRTCSessionRequest {
  sessionId: string;
  sdp?: string;
}

/**
 * WebRTC control message
 */
export interface WebRTCControlMessage {
  type: 'mouse_move' | 'mouse_click' | 'key' | 'type';
  x?: number;
  y?: number;
  key?: string;
  text?: string;
}

/**
 * Media upload request
 */
export interface MediaUploadRequest {
  sessionId: string;
  filename: string;
  mimeType: string;
}

/**
 * Sequence execution request
 */
export interface SequenceExecutionRequest {
  sequenceId: string;
  variables?: Record<string, string>;
}

/**
 * Recovery mode request
 */
export interface RecoveryModeRequest {
  sessionId: string;
  context: any;
  options: any[];
}

