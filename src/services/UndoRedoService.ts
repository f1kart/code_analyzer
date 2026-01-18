// UndoRedoService.ts - Comprehensive undo/redo system for IDE operations
// Provides robust change tracking and rollback capabilities for all file operations

import { BrowserEventEmitter } from '../utils/BrowserEventEmitter';

export interface UndoRedoOperation {
  id: string;
  type: 'file' | 'setting' | 'project' | 'session';
  action: string;
  timestamp: Date;
  description: string;
  data: {
    before?: any;
    after?: any;
    filePath?: string;
    metadata?: Record<string, any>;
  };
  canUndo: boolean;
  canRedo: boolean;
}

export interface UndoRedoState {
  operations: UndoRedoOperation[];
  currentIndex: number;
  maxOperations: number;
  isUndoing: boolean;
  isRedoing: boolean;
}

export interface UndoRedoCallbacks {
  onFileChange?: (operation: UndoRedoOperation) => Promise<void>;
  onSettingChange?: (operation: UndoRedoOperation) => Promise<void>;
  onProjectChange?: (operation: UndoRedoOperation) => Promise<void>;
  onSessionChange?: (operation: UndoRedoOperation) => Promise<void>;
}

export class UndoRedoService extends BrowserEventEmitter {
  private state: UndoRedoState;
  private callbacks: UndoRedoCallbacks;
  private operationGroups: Map<string, UndoRedoOperation[]> = new Map();

  constructor(maxOperations: number = 100) {
    super();

    this.state = {
      operations: [],
      currentIndex: -1,
      maxOperations,
      isUndoing: false,
      isRedoing: false,
    };

    this.callbacks = {};
  }

  /**
   * Initialize the undo/redo service with callbacks
   */
  initialize(callbacks: UndoRedoCallbacks): void {
    this.callbacks = callbacks;
    this.emit('initialized', { success: true });
  }

  /**
   * Record a file operation for undo/redo
   */
  async recordFileOperation(
    action: string,
    filePath: string,
    before: any,
    after: any,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const operation: UndoRedoOperation = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'file',
      action,
      timestamp: new Date(),
      description: description || `${action} file: ${filePath}`,
      data: {
        before,
        after,
        filePath,
        metadata,
      },
      canUndo: true,
      canRedo: false,
    };

    return this.addOperation(operation);
  }

  /**
   * Record a setting change for undo/redo
   */
  async recordSettingChange(
    settingKey: string,
    before: any,
    after: any,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const operation: UndoRedoOperation = {
      id: `setting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'setting',
      action: 'change_setting',
      timestamp: new Date(),
      description: description || `Changed setting: ${settingKey}`,
      data: {
        before,
        after,
        metadata: { settingKey, ...metadata },
      },
      canUndo: true,
      canRedo: false,
    };

    return this.addOperation(operation);
  }

  /**
   * Record a project operation for undo/redo
   */
  async recordProjectOperation(
    action: string,
    projectPath: string,
    before: any,
    after: any,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const operation: UndoRedoOperation = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'project',
      action,
      timestamp: new Date(),
      description: description || `${action} project: ${projectPath}`,
      data: {
        before,
        after,
        filePath: projectPath,
        metadata,
      },
      canUndo: true,
      canRedo: false,
    };

    return this.addOperation(operation);
  }

  /**
   * Record a session operation for undo/redo
   */
  async recordSessionOperation(
    action: string,
    before: any,
    after: any,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const operation: UndoRedoOperation = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'session',
      action,
      timestamp: new Date(),
      description: description || `Session ${action}`,
      data: {
        before,
        after,
        metadata,
      },
      canUndo: true,
      canRedo: false,
    };

    return this.addOperation(operation);
  }

  /**
   * Add an operation to the history
   */
  private addOperation(operation: UndoRedoOperation): string {
    // Remove any operations after current index (when new operations are added after undo)
    if (this.state.currentIndex >= 0 && this.state.currentIndex < this.state.operations.length - 1) {
      this.state.operations = this.state.operations.slice(0, this.state.currentIndex + 1);
    }

    // Add new operation
    this.state.operations.push(operation);
    this.state.currentIndex = this.state.operations.length - 1;

    // Trim history if it exceeds max operations
    if (this.state.operations.length > this.state.maxOperations) {
      const removedOperations = this.state.operations.splice(0, this.state.operations.length - this.state.maxOperations);
      this.state.currentIndex -= removedOperations.length;

      // Emit cleanup event
      this.emit('operationsTrimmed', { removedCount: removedOperations.length });
    }

    this.emit('operationAdded', operation);
    this.emit('stateChanged', this.getState());

    return operation.id;
  }

  /**
   * Undo the last operation
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      console.warn('⚠️ No operations to undo');
      return false;
    }

    const operation = this.state.operations[this.state.currentIndex];
    if (!operation.canUndo) {
      console.warn('⚠️ Current operation cannot be undone');
      return false;
    }

    this.state.isUndoing = true;
    this.emit('undoStarted', operation);

    try {
      let success = false;

      switch (operation.type) {
        case 'file':
          success = await this.undoFileOperation(operation);
          break;
        case 'setting':
          success = await this.undoSettingOperation(operation);
          break;
        case 'project':
          success = await this.undoProjectOperation(operation);
          break;
        case 'session':
          success = await this.undoSessionOperation(operation);
          break;
        default:
          console.warn(`⚠️ Unknown operation type: ${operation.type}`);
          success = false;
      }

      if (success) {
        operation.canUndo = false;
        operation.canRedo = true;
        this.state.currentIndex--;
        this.emit('undoCompleted', operation);
        this.emit('stateChanged', this.getState());
      }

      return success;

    } catch (error) {
      console.error('❌ Undo operation failed:', error);
      this.emit('undoFailed', { operation, error });
      return false;

    } finally {
      this.state.isUndoing = false;
    }
  }

  /**
   * Redo the last undone operation
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      console.warn('⚠️ No operations to redo');
      return false;
    }

    const operation = this.state.operations[this.state.currentIndex + 1];
    if (!operation.canRedo) {
      console.warn('⚠️ Next operation cannot be redone');
      return false;
    }

    this.state.isRedoing = true;
    this.emit('redoStarted', operation);

    try {
      let success = false;

      switch (operation.type) {
        case 'file':
          success = await this.redoFileOperation(operation);
          break;
        case 'setting':
          success = await this.redoSettingOperation(operation);
          break;
        case 'project':
          success = await this.redoProjectOperation(operation);
          break;
        case 'session':
          success = await this.redoSessionOperation(operation);
          break;
        default:
          console.warn(`⚠️ Unknown operation type: ${operation.type}`);
          success = false;
      }

      if (success) {
        operation.canUndo = true;
        operation.canRedo = false;
        this.state.currentIndex++;
        this.emit('redoCompleted', operation);
        this.emit('stateChanged', this.getState());
      }

      return success;

    } catch (error) {
      console.error('❌ Redo operation failed:', error);
      this.emit('redoFailed', { operation, error });
      return false;

    } finally {
      this.state.isRedoing = false;
    }
  }

  /**
   * Undo a file operation
   */
  private async undoFileOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onFileChange) {
      console.warn('⚠️ No file change callback registered');
      return false;
    }

    try {
      await this.callbacks.onFileChange(operation);
      return true;
    } catch (error) {
      console.error('❌ File undo operation failed:', error);
      return false;
    }
  }

  /**
   * Undo a setting operation
   */
  private async undoSettingOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onSettingChange) {
      console.warn('⚠️ No setting change callback registered');
      return false;
    }

    try {
      await this.callbacks.onSettingChange(operation);
      return true;
    } catch (error) {
      console.error('❌ Setting undo operation failed:', error);
      return false;
    }
  }

  /**
   * Undo a project operation
   */
  private async undoProjectOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onProjectChange) {
      console.warn('⚠️ No project change callback registered');
      return false;
    }

    try {
      await this.callbacks.onProjectChange(operation);
      return true;
    } catch (error) {
      console.error('❌ Project undo operation failed:', error);
      return false;
    }
  }

  /**
   * Undo a session operation
   */
  private async undoSessionOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onSessionChange) {
      console.warn('⚠️ No session change callback registered');
      return false;
    }

    try {
      await this.callbacks.onSessionChange(operation);
      return true;
    } catch (error) {
      console.error('❌ Session undo operation failed:', error);
      return false;
    }
  }

  /**
   * Redo a file operation
   */
  private async redoFileOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onFileChange) {
      return false;
    }

    try {
      // For redo, we swap before and after
      const redoOperation = {
        ...operation,
        data: {
          ...operation.data,
          before: operation.data.after,
          after: operation.data.before,
        },
      };
      await this.callbacks.onFileChange(redoOperation);
      return true;
    } catch (error) {
      console.error('❌ File redo operation failed:', error);
      return false;
    }
  }

  /**
   * Redo a setting operation
   */
  private async redoSettingOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onSettingChange) {
      return false;
    }

    try {
      const redoOperation = {
        ...operation,
        data: {
          ...operation.data,
          before: operation.data.after,
          after: operation.data.before,
        },
      };
      await this.callbacks.onSettingChange(redoOperation);
      return true;
    } catch (error) {
      console.error('❌ Setting redo operation failed:', error);
      return false;
    }
  }

  /**
   * Redo a project operation
   */
  private async redoProjectOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onProjectChange) {
      return false;
    }

    try {
      const redoOperation = {
        ...operation,
        data: {
          ...operation.data,
          before: operation.data.after,
          after: operation.data.before,
        },
      };
      await this.callbacks.onProjectChange(redoOperation);
      return true;
    } catch (error) {
      console.error('❌ Project redo operation failed:', error);
      return false;
    }
  }

  /**
   * Redo a session operation
   */
  private async redoSessionOperation(operation: UndoRedoOperation): Promise<boolean> {
    if (!this.callbacks.onSessionChange) {
      return false;
    }

    try {
      const redoOperation = {
        ...operation,
        data: {
          ...operation.data,
          before: operation.data.after,
          after: operation.data.before,
        },
      };
      await this.callbacks.onSessionChange(redoOperation);
      return true;
    } catch (error) {
      console.error('❌ Session redo operation failed:', error);
      return false;
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return !this.state.isUndoing && !this.state.isRedoing && this.state.currentIndex >= 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return !this.state.isUndoing && !this.state.isRedoing &&
           this.state.currentIndex < this.state.operations.length - 1;
  }

  /**
   * Get the current undo/redo state
   */
  getState(): UndoRedoState {
    return { ...this.state };
  }

  /**
   * Get operations history
   */
  getOperations(limit?: number): UndoRedoOperation[] {
    const operations = [...this.state.operations];
    return limit ? operations.slice(-limit) : operations;
  }

  /**
   * Get the last operation that can be undone
   */
  getLastUndoableOperation(): UndoRedoOperation | null {
    if (this.state.currentIndex < 0) {
      return null;
    }
    return this.state.operations[this.state.currentIndex];
  }

  /**
   * Get the next operation that can be redone
   */
  getNextRedoableOperation(): UndoRedoOperation | null {
    if (this.state.currentIndex >= this.state.operations.length - 1) {
      return null;
    }
    return this.state.operations[this.state.currentIndex + 1];
  }

  /**
   * Clear all operations history
   */
  clearHistory(): void {
    this.state.operations = [];
    this.state.currentIndex = -1;
    this.operationGroups.clear();
    this.emit('historyCleared');
    this.emit('stateChanged', this.getState());
  }

  /**
   * Group operations together (for batch operations)
   */
  startOperationGroup(groupId: string): void {
    this.operationGroups.set(groupId, []);
  }

  /**
   * End operation group and merge operations
   */
  endOperationGroup(groupId: string, description?: string): string | null {
    const groupOperations = this.operationGroups.get(groupId);
    if (!groupOperations || groupOperations.length === 0) {
      this.operationGroups.delete(groupId);
      return null;
    }

    // Create a composite operation
    const compositeOperation: UndoRedoOperation = {
      id: `group_${groupId}_${Date.now()}`,
      type: 'session',
      action: 'batch_operation',
      timestamp: new Date(),
      description: description || `Batch operation: ${groupOperations.length} operations`,
      data: {
        metadata: { groupId, operations: groupOperations },
      },
      canUndo: true,
      canRedo: false,
    };

    this.operationGroups.delete(groupId);
    return this.addOperation(compositeOperation);
  }

  /**
   * Set maximum number of operations to keep in history
   */
  setMaxOperations(maxOperations: number): void {
    this.state.maxOperations = maxOperations;

    if (this.state.operations.length > maxOperations) {
      const removedCount = this.state.operations.length - maxOperations;
      this.state.operations.splice(0, removedCount);
      this.state.currentIndex = Math.max(-1, this.state.currentIndex - removedCount);

      this.emit('operationsTrimmed', { removedCount });
      this.emit('stateChanged', this.getState());
    }
  }

  /**
   * Export operations history for backup
   */
  exportHistory(): string {
    return JSON.stringify({
      state: this.state,
      operations: this.state.operations,
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import operations history from backup
   */
  importHistory(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);

      if (!data.state || !Array.isArray(data.operations)) {
        throw new Error('Invalid history data format');
      }

      this.state = data.state;
      this.state.operations = data.operations;

      this.emit('historyImported', { operationCount: data.operations.length });
      this.emit('stateChanged', this.getState());

      return true;
    } catch (error) {
      console.error('❌ Failed to import history:', error);
      return false;
    }
  }

  /**
   * Get statistics about the undo/redo history
   */
  getStatistics(): {
    totalOperations: number;
    undoableOperations: number;
    redoableOperations: number;
    memoryUsage: number; // approximate bytes
    oldestOperation?: Date;
    newestOperation?: Date;
  } {
    const totalOperations = this.state.operations.length;
    const undoableOperations = this.state.currentIndex + 1;
    const redoableOperations = totalOperations - undoableOperations;

    // Calculate approximate memory usage
    const memoryUsage = JSON.stringify(this.state.operations).length;

    return {
      totalOperations,
      undoableOperations,
      redoableOperations,
      memoryUsage,
      oldestOperation: totalOperations > 0 ? this.state.operations[0].timestamp : undefined,
      newestOperation: totalOperations > 0 ? this.state.operations[totalOperations - 1].timestamp : undefined,
    };
  }
}

// Singleton instance
let undoRedoService: UndoRedoService | null = null;

export function initializeUndoRedo(
  callbacks: UndoRedoCallbacks,
  maxOperations?: number
): UndoRedoService {
  if (!undoRedoService) {
    undoRedoService = new UndoRedoService(maxOperations);
    undoRedoService.initialize(callbacks);
  }
  return undoRedoService;
}

export function getUndoRedoService(): UndoRedoService | null {
  return undoRedoService;
}

// Convenience functions for common operations
export async function undoLastOperation(): Promise<boolean> {
  const service = getUndoRedoService();
  return service ? service.undo() : false;
}

export async function redoLastOperation(): Promise<boolean> {
  const service = getUndoRedoService();
  return service ? service.redo() : false;
}

export function canUndo(): boolean {
  const service = getUndoRedoService();
  return service ? service.canUndo() : false;
}

export function canRedo(): boolean {
  const service = getUndoRedoService();
  return service ? service.canRedo() : false;
}

export function getUndoRedoState() {
  const service = getUndoRedoService();
  return service ? service.getState() : null;
}
