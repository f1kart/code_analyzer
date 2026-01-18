// Collaborative editing service implementation

export interface CollaborativeSession {
  id: string;
  name: string;
  description: string;
  hostId: string;
  participants: Participant[];
  documents: SharedDocument[];
  settings: SessionSettings;
  status: 'active' | 'paused' | 'ended';
  createdAt: number;
  lastActivity: number;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: ParticipantRole;
  permissions: Permission[];
  cursor: CursorPosition | null;
  selection: TextSelection | null;
  isOnline: boolean;
  lastSeen: number;
  color: string;
}

export type ParticipantRole = 'host' | 'editor' | 'viewer' | 'guest';

export interface Permission {
  type: 'read' | 'write' | 'comment' | 'share' | 'admin';
  scope: 'all' | 'document' | 'selection';
  resourceId?: string;
}

export interface SharedDocument {
  id: string;
  filePath: string;
  content: string;
  version: number;
  operations: Operation[];
  cursors: Map<string, CursorPosition>;
  selections: Map<string, TextSelection>;
  comments: Comment[];
  changeHistory: DocumentChange[];
  lockStatus: LockStatus;
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'replace' | 'format';
  authorId: string;
  timestamp: number;
  position: Position;
  content?: string;
  length?: number;
  attributes?: TextAttributes;
  transformed: boolean;
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface CursorPosition extends Position {
  participantId: string;
  visible: boolean;
}

export interface TextSelection {
  start: Position;
  end: Position;
  participantId: string;
  visible: boolean;
}

export interface TextAttributes {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  position: Position;
  range?: TextSelection;
  replies: CommentReply[];
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CommentReply {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
}

export interface DocumentChange {
  id: string;
  operation: Operation;
  beforeContent: string;
  afterContent: string;
  timestamp: number;
}

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: number;
  lockType: 'read' | 'write' | 'exclusive';
  lockRange?: TextSelection;
}

export interface SessionSettings {
  maxParticipants: number;
  allowGuests: boolean;
  requireApproval: boolean;
  autoSave: boolean;
  saveInterval: number;
  conflictResolution: 'last-write-wins' | 'operational-transform' | 'manual';
  showCursors: boolean;
  showSelections: boolean;
  enableComments: boolean;
  enableVoiceChat: boolean;
  enableVideoChat: boolean;
}

export interface ConflictResolution {
  id: string;
  documentId: string;
  conflictingOperations: Operation[];
  resolution: 'accept-local' | 'accept-remote' | 'merge' | 'manual';
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface SyncMessage {
  type: MessageType;
  sessionId: string;
  senderId: string;
  timestamp: number;
  data: any;
}

export type MessageType =
  | 'join-session'
  | 'leave-session'
  | 'operation'
  | 'cursor-update'
  | 'selection-update'
  | 'comment-add'
  | 'comment-resolve'
  | 'document-lock'
  | 'document-unlock'
  | 'sync-request'
  | 'sync-response'
  | 'conflict-detected'
  | 'conflict-resolved';

export class CollaborativeEditingService {
  private sessions = new Map<string, CollaborativeSession>();
  private activeSession: CollaborativeSession | null = null;
  private currentParticipant: Participant | null = null;
  private websocket: WebSocket | null = null;
  private operationQueue: Operation[] = [];
  private isConnected = false;
  private sessionCallbacks = new Set<(session: CollaborativeSession) => void>();
  private operationCallbacks = new Set<(operation: Operation) => void>();
  private participantCallbacks = new Set<
    (participant: Participant, event: 'joined' | 'left' | 'updated') => void
  >();
  private conflictCallbacks = new Set<(conflict: ConflictResolution) => void>();

  constructor() {
    this.loadSessions();
  }

  // Session Management
  async createSession(options: {
    name: string;
    description?: string;
    settings?: Partial<SessionSettings>;
  }): Promise<CollaborativeSession> {
    const session: CollaborativeSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: options.name,
      description: options.description || '',
      hostId: this.getCurrentUserId(),
      participants: [],
      documents: [],
      settings: { ...this.getDefaultSettings(), ...options.settings },
      status: 'active',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Add host as participant
    const host: Participant = {
      id: this.getCurrentUserId(),
      name: 'Host User',
      role: 'host',
      permissions: [
        { type: 'admin', scope: 'all' },
        { type: 'read', scope: 'all' },
        { type: 'write', scope: 'all' },
        { type: 'comment', scope: 'all' },
        { type: 'share', scope: 'all' },
      ],
      cursor: null,
      selection: null,
      isOnline: true,
      lastSeen: Date.now(),
      color: this.generateParticipantColor(),
    };

    session.participants.push(host);
    this.sessions.set(session.id, session);
    this.saveSessions();

    return session;
  }

  async joinSession(
    sessionId: string,
    participant: Omit<Participant, 'id' | 'isOnline' | 'lastSeen' | 'color'>,
  ): Promise<CollaborativeSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    if (session.participants.length >= session.settings.maxParticipants) {
      throw new Error('Session is full');
    }

    const newParticipant: Participant = {
      ...participant,
      id: `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isOnline: true,
      lastSeen: Date.now(),
      color: this.generateParticipantColor(),
    };

    session.participants.push(newParticipant);
    session.lastActivity = Date.now();
    this.currentParticipant = newParticipant;
    this.activeSession = session;

    // Connect to session
    await this.connectToSession(session);

    this.saveSessions();
    this.notifyParticipantCallbacks(newParticipant, 'joined');
    this.notifySessionCallbacks(session);

    return session;
  }

  async leaveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !this.currentParticipant) return;

    // Remove participant
    session.participants = session.participants.filter((p) => p.id !== this.currentParticipant!.id);
    session.lastActivity = Date.now();

    // Disconnect from session
    await this.disconnectFromSession();

    this.notifyParticipantCallbacks(this.currentParticipant, 'left');
    this.currentParticipant = null;
    this.activeSession = null;
    this.saveSessions();
  }

  // Document Management
  async addDocument(sessionId: string, filePath: string, content: string): Promise<SharedDocument> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const document: SharedDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      content,
      version: 1,
      operations: [],
      cursors: new Map(),
      selections: new Map(),
      comments: [],
      changeHistory: [],
      lockStatus: {
        isLocked: false,
        lockType: 'write',
      },
    };

    session.documents.push(document);
    session.lastActivity = Date.now();
    this.saveSessions();

    return document;
  }

  async removeDocument(sessionId: string, documentId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.documents = session.documents.filter((doc) => doc.id !== documentId);
    session.lastActivity = Date.now();
    this.saveSessions();
  }

  // Real-time Operations
  async applyOperation(
    documentId: string,
    operation: Omit<Operation, 'id' | 'timestamp' | 'transformed'>,
  ): Promise<void> {
    if (!this.activeSession || !this.currentParticipant) return;

    const document = this.activeSession.documents.find((doc) => doc.id === documentId);
    if (!document) return;

    const fullOperation: Operation = {
      ...operation,
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      transformed: false,
    };

    // Apply operation locally
    this.applyOperationToDocument(document, fullOperation);

    // Send to other participants
    if (this.isConnected) {
      this.sendMessage({
        type: 'operation',
        sessionId: this.activeSession.id,
        senderId: this.currentParticipant.id,
        timestamp: Date.now(),
        data: { documentId, operation: fullOperation },
      });
    } else {
      // Queue for later sending
      this.operationQueue.push(fullOperation);
    }

    this.notifyOperationCallbacks(fullOperation);
  }

  private applyOperationToDocument(document: SharedDocument, operation: Operation): void {
    const beforeContent = document.content;

    switch (operation.type) {
      case 'insert':
        if (operation.content) {
          const offset = this.positionToOffset(document.content, operation.position);
          document.content =
            document.content.slice(0, offset) + operation.content + document.content.slice(offset);
        }
        break;

      case 'delete':
        if (operation.length) {
          const offset = this.positionToOffset(document.content, operation.position);
          document.content =
            document.content.slice(0, offset) + document.content.slice(offset + operation.length);
        }
        break;

      case 'replace':
        if (operation.content && operation.length) {
          const offset = this.positionToOffset(document.content, operation.position);
          document.content =
            document.content.slice(0, offset) +
            operation.content +
            document.content.slice(offset + operation.length);
        }
        break;
    }

    // Update document metadata
    document.version++;
    document.operations.push(operation);

    // Record change
    const change: DocumentChange = {
      id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      beforeContent,
      afterContent: document.content,
      timestamp: Date.now(),
    };
    document.changeHistory.push(change);

    // Limit history size
    if (document.changeHistory.length > 1000) {
      document.changeHistory = document.changeHistory.slice(-500);
    }
  }

  // Operational Transform
  private transformOperation(operation: Operation, againstOperation: Operation): Operation {
    // Simplified operational transform implementation
    const transformed = { ...operation };

    if (operation.timestamp < againstOperation.timestamp) {
      // This operation happened before the other one
      return transformed;
    }

    // Transform based on operation types
    if (
      againstOperation.type === 'insert' &&
      operation.position.offset >= againstOperation.position.offset
    ) {
      const insertLength = againstOperation.content?.length || 0;
      transformed.position = {
        ...operation.position,
        offset: operation.position.offset + insertLength,
      };
    } else if (
      againstOperation.type === 'delete' &&
      operation.position.offset > againstOperation.position.offset
    ) {
      const deleteLength = againstOperation.length || 0;
      transformed.position = {
        ...operation.position,
        offset: Math.max(
          againstOperation.position.offset,
          operation.position.offset - deleteLength,
        ),
      };
    }

    transformed.transformed = true;
    return transformed;
  }

  // Cursor and Selection Management
  async updateCursor(documentId: string, position: Position): Promise<void> {
    if (!this.activeSession || !this.currentParticipant) return;

    const document = this.activeSession.documents.find((doc) => doc.id === documentId);
    if (!document) return;

    const cursor: CursorPosition = {
      ...position,
      participantId: this.currentParticipant.id,
      visible: true,
    };

    document.cursors.set(this.currentParticipant.id, cursor);
    this.currentParticipant.cursor = cursor;

    // Broadcast cursor update
    if (this.isConnected) {
      this.sendMessage({
        type: 'cursor-update',
        sessionId: this.activeSession.id,
        senderId: this.currentParticipant.id,
        timestamp: Date.now(),
        data: { documentId, cursor },
      });
    }
  }

  async updateSelection(documentId: string, selection: TextSelection): Promise<void> {
    if (!this.activeSession || !this.currentParticipant) return;

    const document = this.activeSession.documents.find((doc) => doc.id === documentId);
    if (!document) return;

    selection.participantId = this.currentParticipant.id;
    document.selections.set(this.currentParticipant.id, selection);
    this.currentParticipant.selection = selection;

    // Broadcast selection update
    if (this.isConnected) {
      this.sendMessage({
        type: 'selection-update',
        sessionId: this.activeSession.id,
        senderId: this.currentParticipant.id,
        timestamp: Date.now(),
        data: { documentId, selection },
      });
    }
  }

  // Comments
  async addComment(
    documentId: string,
    content: string,
    position: Position,
    range?: TextSelection,
  ): Promise<Comment> {
    if (!this.activeSession || !this.currentParticipant) {
      throw new Error('No active session');
    }

    const document = this.activeSession.documents.find((doc) => doc.id === documentId);
    if (!document) throw new Error('Document not found');

    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      authorId: this.currentParticipant.id,
      content,
      position,
      range,
      replies: [],
      resolved: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    document.comments.push(comment);

    // Broadcast comment
    if (this.isConnected) {
      this.sendMessage({
        type: 'comment-add',
        sessionId: this.activeSession.id,
        senderId: this.currentParticipant.id,
        timestamp: Date.now(),
        data: { documentId, comment },
      });
    }

    return comment;
  }

  async resolveComment(documentId: string, commentId: string): Promise<void> {
    if (!this.activeSession || !this.currentParticipant) return;

    const document = this.activeSession.documents.find((doc) => doc.id === documentId);
    if (!document) return;

    const comment = document.comments.find((c) => c.id === commentId);
    if (!comment) return;

    comment.resolved = true;
    comment.updatedAt = Date.now();

    // Broadcast resolution
    if (this.isConnected) {
      this.sendMessage({
        type: 'comment-resolve',
        sessionId: this.activeSession.id,
        senderId: this.currentParticipant.id,
        timestamp: Date.now(),
        data: { documentId, commentId },
      });
    }
  }

  // WebSocket Communication
  private async connectToSession(_session: CollaborativeSession): Promise<void> {
    try {
      // Mock WebSocket connection
      this.websocket = new WebSocket('ws://localhost:8080/collaborate');

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.sendQueuedOperations();
      };

      this.websocket.onmessage = (event) => {
        const message: SyncMessage = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
      };
    } catch (error) {
      console.warn('Failed to connect to collaboration server:', error);
      // Continue in offline mode
    }
  }

  private async disconnectFromSession(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
  }

  private sendMessage(message: SyncMessage): void {
    if (this.websocket && this.isConnected) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  private sendQueuedOperations(): void {
    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!;
      if (this.activeSession && this.currentParticipant) {
        this.sendMessage({
          type: 'operation',
          sessionId: this.activeSession.id,
          senderId: this.currentParticipant.id,
          timestamp: Date.now(),
          data: { operation },
        });
      }
    }
  }

  private handleMessage(message: SyncMessage): void {
    if (!this.activeSession) return;

    switch (message.type) {
      case 'operation':
        this.handleRemoteOperation(message.data);
        break;
      case 'cursor-update':
        this.handleRemoteCursor(message.data);
        break;
      case 'selection-update':
        this.handleRemoteSelection(message.data);
        break;
      case 'comment-add':
        this.handleRemoteComment(message.data);
        break;
      case 'join-session':
        this.handleParticipantJoin(message.data);
        break;
      case 'leave-session':
        this.handleParticipantLeave(message.data);
        break;
    }
  }

  private handleRemoteOperation(data: any): void {
    const { documentId, operation } = data;
    const document = this.activeSession?.documents.find((doc) => doc.id === documentId);

    if (document) {
      // Transform operation against local operations
      let transformedOperation = operation;
      for (const localOp of document.operations) {
        if (localOp.timestamp > operation.timestamp) {
          transformedOperation = this.transformOperation(transformedOperation, localOp);
        }
      }

      this.applyOperationToDocument(document, transformedOperation);
      this.notifyOperationCallbacks(transformedOperation);
    }
  }

  private handleRemoteCursor(data: any): void {
    const { documentId, cursor } = data;
    const document = this.activeSession?.documents.find((doc) => doc.id === documentId);

    if (document) {
      document.cursors.set(cursor.participantId, cursor);
    }
  }

  private handleRemoteSelection(data: any): void {
    const { documentId, selection } = data;
    const document = this.activeSession?.documents.find((doc) => doc.id === documentId);

    if (document) {
      document.selections.set(selection.participantId, selection);
    }
  }

  private handleRemoteComment(data: any): void {
    const { documentId, comment } = data;
    const document = this.activeSession?.documents.find((doc) => doc.id === documentId);

    if (document) {
      document.comments.push(comment);
    }
  }

  private handleParticipantJoin(data: any): void {
    const { participant } = data;
    if (this.activeSession) {
      this.activeSession.participants.push(participant);
      this.notifyParticipantCallbacks(participant, 'joined');
    }
  }

  private handleParticipantLeave(data: any): void {
    const { participantId } = data;
    if (this.activeSession) {
      const participant = this.activeSession.participants.find((p) => p.id === participantId);
      if (participant) {
        this.activeSession.participants = this.activeSession.participants.filter(
          (p) => p.id !== participantId,
        );
        this.notifyParticipantCallbacks(participant, 'left');
      }
    }
  }

  // Utility Methods
  private positionToOffset(content: string, position: Position): number {
    const lines = content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    return offset + Math.min(position.column, lines[position.line]?.length || 0);
  }

  private offsetToPosition(content: string, offset: number): Position {
    const lines = content.split('\n');
    let currentOffset = 0;

    for (let line = 0; line < lines.length; line++) {
      const lineLength = lines[line].length;

      if (currentOffset + lineLength >= offset) {
        return {
          line,
          column: offset - currentOffset,
          offset,
        };
      }

      currentOffset += lineLength + 1; // +1 for newline
    }

    return {
      line: lines.length - 1,
      column: lines[lines.length - 1]?.length || 0,
      offset,
    };
  }

  private getCurrentUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateParticipantColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E9',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private getDefaultSettings(): SessionSettings {
    return {
      maxParticipants: 10,
      allowGuests: true,
      requireApproval: false,
      autoSave: true,
      saveInterval: 30000,
      conflictResolution: 'operational-transform',
      showCursors: true,
      showSelections: true,
      enableComments: true,
      enableVoiceChat: false,
      enableVideoChat: false,
    };
  }

  // Persistence
  private loadSessions(): void {
    try {
      const saved = localStorage.getItem('collaborative_sessions');
      if (saved) {
        const data = JSON.parse(saved);
        this.sessions = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load collaborative sessions:', error);
    }
  }

  private saveSessions(): void {
    try {
      const data = Array.from(this.sessions.entries());
      localStorage.setItem('collaborative_sessions', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save collaborative sessions:', error);
    }
  }

  // Event Handling
  onSessionChanged(callback: (session: CollaborativeSession) => void): () => void {
    this.sessionCallbacks.add(callback);
    return () => this.sessionCallbacks.delete(callback);
  }

  onOperationApplied(callback: (operation: Operation) => void): () => void {
    this.operationCallbacks.add(callback);
    return () => this.operationCallbacks.delete(callback);
  }

  onParticipantChanged(
    callback: (participant: Participant, event: 'joined' | 'left' | 'updated') => void,
  ): () => void {
    this.participantCallbacks.add(callback);
    return () => this.participantCallbacks.delete(callback);
  }

  onConflictDetected(callback: (conflict: ConflictResolution) => void): () => void {
    this.conflictCallbacks.add(callback);
    return () => this.conflictCallbacks.delete(callback);
  }

  private notifySessionCallbacks(session: CollaborativeSession): void {
    this.sessionCallbacks.forEach((callback) => {
      try {
        callback(session);
      } catch (error) {
        console.warn('Session callback failed:', error);
      }
    });
  }

  private notifyOperationCallbacks(operation: Operation): void {
    this.operationCallbacks.forEach((callback) => {
      try {
        callback(operation);
      } catch (error) {
        console.warn('Operation callback failed:', error);
      }
    });
  }

  private notifyParticipantCallbacks(
    participant: Participant,
    event: 'joined' | 'left' | 'updated',
  ): void {
    this.participantCallbacks.forEach((callback) => {
      try {
        callback(participant, event);
      } catch (error) {
        console.warn('Participant callback failed:', error);
      }
    });
  }

  // Public API
  getSessions(): CollaborativeSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSession(): CollaborativeSession | null {
    return this.activeSession;
  }

  getCurrentParticipant(): Participant | null {
    return this.currentParticipant;
  }

  getSession(sessionId: string): CollaborativeSession | null {
    return this.sessions.get(sessionId) || null;
  }

  isSessionActive(): boolean {
    return this.activeSession !== null && this.isConnected;
  }
}

export const collaborativeEditingService = new CollaborativeEditingService();
