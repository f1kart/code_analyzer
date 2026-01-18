/**
 * Real-Time Collaboration Service
 * Handles WebSocket connections, cursor presence, live updates, and conflict resolution
 * Production-ready with reconnection, heartbeat, and error handling
 */

import { EventEmitter } from 'events';

export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar?: string;
}

export interface CursorPosition {
  userId: string;
  file: string;
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  timestamp: number;
}

export interface CodeChange {
  userId: string;
  file: string;
  changeId: string;
  timestamp: number;
  operation: 'insert' | 'delete' | 'replace';
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
  text: string;
  originalText?: string;
}

export interface ConflictResolution {
  changeId: string;
  resolution: 'accept-local' | 'accept-remote' | 'merge';
  mergedText?: string;
}

export interface CollaborationSession {
  sessionId: string;
  projectId: string;
  users: User[];
  owner: User;
  createdAt: number;
  settings: {
    allowAnonymous: boolean;
    maxUsers: number;
    readOnly: string[];
  };
}

export interface VoiceChannel {
  channelId: string;
  participants: string[];
  isMuted: boolean;
  isSpeaking: boolean;
}

export class CollaborationService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pendingChanges: Map<string, CodeChange> = new Map();
  private cursors: Map<string, CursorPosition> = new Map();
  private currentSession: CollaborationSession | null = null;
  private localUser: User | null = null;
  private isConnected = false;
  private changeBuffer: CodeChange[] = [];
  private bufferFlushTimer: NodeJS.Timeout | null = null;
  private operationalTransform: OperationalTransform;

  constructor(
    private wsUrl: string = process.env.VITE_COLLABORATION_WS_URL || 'ws://localhost:8080',
    private apiKey?: string
  ) {
    super();
    this.operationalTransform = new OperationalTransform();
  }

  /**
   * Initialize collaboration session
   */
  async createSession(projectId: string, user: User): Promise<CollaborationSession> {
    this.localUser = user;
    
    const response = await fetch(`${this.wsUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/api/collaboration/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
      },
      body: JSON.stringify({ projectId, user }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const session: CollaborationSession = await response.json();
    this.currentSession = session;
    await this.connect(session.sessionId);
    return session;
  }

  /**
   * Join existing collaboration session
   */
  async joinSession(sessionId: string, user: User): Promise<CollaborationSession> {
    this.localUser = user;
    
    const response = await fetch(`${this.wsUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/api/collaboration/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
      },
      body: JSON.stringify({ user }),
    });

    if (!response.ok) {
      throw new Error(`Failed to join session: ${response.statusText}`);
    }

    const session: CollaborationSession = await response.json();
    this.currentSession = session;
    await this.connect(sessionId);
    return session;
  }

  /**
   * Connect to WebSocket server
   */
  private async connect(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.wsUrl}/collaboration/${sessionId}?userId=${this.localUser?.id}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[Collaboration] WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[Collaboration] WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[Collaboration] WebSocket closed');
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('[Collaboration] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'cursor-update':
          this.handleCursorUpdate(message.payload);
          break;
        case 'code-change':
          this.handleCodeChange(message.payload);
          break;
        case 'user-joined':
          this.handleUserJoined(message.payload);
          break;
        case 'user-left':
          this.handleUserLeft(message.payload);
          break;
        case 'conflict':
          this.handleConflict(message.payload);
          break;
        case 'voice-state':
          this.handleVoiceState(message.payload);
          break;
        case 'heartbeat-ack':
          // Heartbeat acknowledged
          break;
        default:
          console.warn('[Collaboration] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Collaboration] Error handling message:', error);
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(file: string, line: number, column: number, selection?: any): void {
    if (!this.isConnected || !this.localUser) return;

    const cursor: CursorPosition = {
      userId: this.localUser.id,
      file,
      line,
      column,
      selection,
      timestamp: Date.now(),
    };

    this.send({
      type: 'cursor-update',
      payload: cursor,
    });
  }

  /**
   * Send code change with operational transform
   */
  sendCodeChange(change: Omit<CodeChange, 'userId' | 'changeId' | 'timestamp'>): void {
    if (!this.isConnected || !this.localUser) return;

    const fullChange: CodeChange = {
      ...change,
      userId: this.localUser.id,
      changeId: this.generateChangeId(),
      timestamp: Date.now(),
    };

    // Add to buffer for batching
    this.changeBuffer.push(fullChange);
    
    // Flush buffer after short delay to batch rapid changes
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
    }
    
    this.bufferFlushTimer = setTimeout(() => {
      this.flushChangeBuffer();
    }, 50);
  }

  /**
   * Flush buffered changes
   */
  private flushChangeBuffer(): void {
    if (this.changeBuffer.length === 0) return;

    const changes = [...this.changeBuffer];
    this.changeBuffer = [];

    this.send({
      type: 'code-changes-batch',
      payload: changes,
    });

    changes.forEach(change => {
      this.pendingChanges.set(change.changeId, change);
    });
  }

  /**
   * Handle cursor updates from other users
   */
  private handleCursorUpdate(cursor: CursorPosition): void {
    if (cursor.userId === this.localUser?.id) return;
    this.cursors.set(cursor.userId, cursor);
    this.emit('cursor-moved', cursor);
  }

  /**
   * Handle code changes from other users
   */
  private handleCodeChange(change: CodeChange): void {
    if (change.userId === this.localUser?.id) return;

    // Apply operational transform to resolve conflicts
    const transformedChange = this.operationalTransform.transform(
      change,
      Array.from(this.pendingChanges.values())
    );

    this.emit('code-changed', transformedChange);
  }

  /**
   * Handle user joined event
   */
  private handleUserJoined(user: User): void {
    if (this.currentSession) {
      this.currentSession.users.push(user);
    }
    this.emit('user-joined', user);
  }

  /**
   * Handle user left event
   */
  private handleUserLeft(userId: string): void {
    if (this.currentSession) {
      this.currentSession.users = this.currentSession.users.filter(u => u.id !== userId);
    }
    this.cursors.delete(userId);
    this.emit('user-left', userId);
  }

  /**
   * Handle merge conflicts
   */
  private handleConflict(payload: { change: CodeChange; conflicts: CodeChange[] }): void {
    this.emit('conflict', payload);
  }

  /**
   * Handle voice channel state changes
   */
  private handleVoiceState(state: VoiceChannel): void {
    this.emit('voice-state-changed', state);
  }

  /**
   * Resolve merge conflict
   */
  resolveConflict(resolution: ConflictResolution): void {
    this.send({
      type: 'resolve-conflict',
      payload: resolution,
    });
  }

  /**
   * Start voice call
   */
  async startVoiceCall(): Promise<VoiceChannel> {
    const response = await fetch(`${this.wsUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/api/collaboration/voice/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
      },
      body: JSON.stringify({
        sessionId: this.currentSession?.sessionId,
        userId: this.localUser?.id,
      }),
    });

    return response.json();
  }

  /**
   * Send WebSocket message
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Collaboration] Max reconnection attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[Collaboration] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.currentSession) {
        this.connect(this.currentSession.sessionId).catch(console.error);
      }
    }, delay);
  }

  /**
   * Generate unique change ID
   */
  private generateChangeId(): string {
    return `${this.localUser?.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all active cursors
   */
  getActiveCursors(): Map<string, CursorPosition> {
    return new Map(this.cursors);
  }

  /**
   * Get current session
   */
  getSession(): CollaborationSession | null {
    return this.currentSession;
  }

  /**
   * Disconnect from session
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.currentSession = null;
    this.cursors.clear();
    this.pendingChanges.clear();
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Operational Transform for conflict-free concurrent editing
 * Implements OT algorithm for text operations
 */
class OperationalTransform {
  /**
   * Transform incoming change against pending local changes
   */
  transform(incomingChange: CodeChange, pendingChanges: CodeChange[]): CodeChange {
    let transformedChange = { ...incomingChange };

    for (const pending of pendingChanges) {
      if (pending.file !== incomingChange.file) continue;

      // Apply transformation based on operation types
      if (pending.operation === 'insert' && incomingChange.operation === 'insert') {
        transformedChange = this.transformInsertInsert(transformedChange, pending);
      } else if (pending.operation === 'delete' && incomingChange.operation === 'insert') {
        transformedChange = this.transformDeleteInsert(transformedChange, pending);
      } else if (pending.operation === 'insert' && incomingChange.operation === 'delete') {
        transformedChange = this.transformInsertDelete(transformedChange, pending);
      } else if (pending.operation === 'delete' && incomingChange.operation === 'delete') {
        transformedChange = this.transformDeleteDelete(transformedChange, pending);
      }
    }

    return transformedChange;
  }

  private transformInsertInsert(change: CodeChange, against: CodeChange): CodeChange {
    if (change.startLine < against.startLine || 
        (change.startLine === against.startLine && change.startColumn < against.startColumn)) {
      return change;
    }

    const lines = against.text.split('\n');
    if (lines.length > 1) {
      return {
        ...change,
        startLine: change.startLine + lines.length - 1,
      };
    } else {
      return {
        ...change,
        startColumn: change.startColumn + against.text.length,
      };
    }
  }

  private transformDeleteInsert(change: CodeChange, against: CodeChange): CodeChange {
    // If delete happened before insert, adjust insert position
    if (against.startLine < change.startLine) {
      const deletedLines = (against.endLine || against.startLine) - against.startLine;
      return {
        ...change,
        startLine: change.startLine - deletedLines,
      };
    }
    return change;
  }

  private transformInsertDelete(change: CodeChange, against: CodeChange): CodeChange {
    // If insert happened before delete, adjust delete position
    const insertedLines = against.text.split('\n').length - 1;
    if (against.startLine < change.startLine) {
      return {
        ...change,
        startLine: change.startLine + insertedLines,
      };
    }
    return change;
  }

  private transformDeleteDelete(change: CodeChange, against: CodeChange): CodeChange {
    // Handle overlapping deletes
    const changeEnd = change.endLine || change.startLine;
    const againstEnd = against.endLine || against.startLine;

    if (changeEnd < against.startLine || change.startLine > againstEnd) {
      return change; // No overlap
    }

    // Overlapping deletes - merge them
    return {
      ...change,
      startLine: Math.min(change.startLine, against.startLine),
      endLine: Math.max(changeEnd, againstEnd),
    };
  }
}

// Singleton instance
let collaborationServiceInstance: CollaborationService | null = null;

export function getCollaborationService(wsUrl?: string, apiKey?: string): CollaborationService {
  if (!collaborationServiceInstance) {
    collaborationServiceInstance = new CollaborationService(wsUrl, apiKey);
  }
  return collaborationServiceInstance;
}
