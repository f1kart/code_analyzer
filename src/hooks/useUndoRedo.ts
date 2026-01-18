import { useState, useCallback, useRef, useEffect } from 'react';

export interface UndoRedoAction<T = any> {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  data?: T;
}

interface UndoRedoState {
  history: UndoRedoAction[];
  currentIndex: number;
  maxHistorySize: number;
}

export interface UndoRedoManager {
  canUndo: boolean;
  canRedo: boolean;
  undoStack: UndoRedoAction[];
  redoStack: UndoRedoAction[];
  currentAction: UndoRedoAction | null;
  execute: (action: UndoRedoAction) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
  getHistory: () => UndoRedoAction[];
  setMaxHistorySize: (size: number) => void;
}

export const useUndoRedo = (maxHistorySize: number = 100): UndoRedoManager => {
  const [state, setState] = useState<UndoRedoState>({
    history: [],
    currentIndex: -1,
    maxHistorySize,
  });

  const isExecuting = useRef(false);

  const canUndo = state.currentIndex >= 0;
  const canRedo = state.currentIndex < state.history.length - 1;

  const undoStack = state.history.slice(0, state.currentIndex + 1).reverse();
  const redoStack = state.history.slice(state.currentIndex + 1);
  const currentAction = state.currentIndex >= 0 ? state.history[state.currentIndex] : null;

  const execute = useCallback(async (action: UndoRedoAction) => {
    if (isExecuting.current) return;

    isExecuting.current = true;
    try {
      // Execute the redo action (the initial action)
      await action.redo();

      setState((prevState) => {
        // Remove any actions after current index (they become invalid)
        const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);

        // Add the new action
        newHistory.push(action);

        // Trim history if it exceeds max size
        const trimmedHistory =
          newHistory.length > prevState.maxHistorySize
            ? newHistory.slice(-prevState.maxHistorySize)
            : newHistory;

        return {
          ...prevState,
          history: trimmedHistory,
          currentIndex: trimmedHistory.length - 1,
        };
      });
    } catch (error) {
      console.error('Failed to execute action:', error);
      throw error;
    } finally {
      isExecuting.current = false;
    }
  }, []);

  const undo = useCallback(async () => {
    if (!canUndo || isExecuting.current) return;

    const action = state.history[state.currentIndex];
    if (!action) return;

    isExecuting.current = true;
    try {
      await action.undo();
      setState((prevState) => ({
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
      }));
    } catch (error) {
      console.error('Failed to undo action:', error);
      throw error;
    } finally {
      isExecuting.current = false;
    }
  }, [canUndo, state.history, state.currentIndex]);

  const redo = useCallback(async () => {
    if (!canRedo || isExecuting.current) return;

    const action = state.history[state.currentIndex + 1];
    if (!action) return;

    isExecuting.current = true;
    try {
      await action.redo();
      setState((prevState) => ({
        ...prevState,
        currentIndex: prevState.currentIndex + 1,
      }));
    } catch (error) {
      console.error('Failed to redo action:', error);
      throw error;
    } finally {
      isExecuting.current = false;
    }
  }, [canRedo, state.history, state.currentIndex]);

  const clear = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      history: [],
      currentIndex: -1,
    }));
  }, []);

  const getHistory = useCallback(() => {
    return [...state.history];
  }, [state.history]);

  const setMaxHistorySize = useCallback((size: number) => {
    setState((prevState) => {
      const trimmedHistory =
        prevState.history.length > size ? prevState.history.slice(-size) : prevState.history;

      const newCurrentIndex = prevState.currentIndex >= size ? size - 1 : prevState.currentIndex;

      return {
        ...prevState,
        history: trimmedHistory,
        currentIndex: newCurrentIndex,
        maxHistorySize: size,
      };
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    undoStack,
    redoStack,
    currentAction,
    execute,
    undo,
    redo,
    clear,
    getHistory,
    setMaxHistorySize,
  };
};

// Utility functions for creating common action types
export const createFileEditAction = (
  filePath: string,
  oldContent: string,
  newContent: string,
  onUpdate: (content: string) => void | Promise<void>,
): UndoRedoAction => ({
  id: `file-edit-${Date.now()}-${Math.random()}`,
  type: 'file-edit',
  description: `Edit ${filePath}`,
  timestamp: Date.now(),
  undo: () => onUpdate(oldContent),
  redo: () => onUpdate(newContent),
  data: { filePath, oldContent, newContent },
});

export const createFileCreateAction = (
  filePath: string,
  content: string,
  onCreate: (path: string, content: string) => void | Promise<void>,
  onDelete: (path: string) => void | Promise<void>,
): UndoRedoAction => ({
  id: `file-create-${Date.now()}-${Math.random()}`,
  type: 'file-create',
  description: `Create ${filePath}`,
  timestamp: Date.now(),
  undo: () => onDelete(filePath),
  redo: () => onCreate(filePath, content),
  data: { filePath, content },
});

export const createFileDeleteAction = (
  filePath: string,
  content: string,
  onCreate: (path: string, content: string) => void | Promise<void>,
  onDelete: (path: string) => void | Promise<void>,
): UndoRedoAction => ({
  id: `file-delete-${Date.now()}-${Math.random()}`,
  type: 'file-delete',
  description: `Delete ${filePath}`,
  timestamp: Date.now(),
  undo: () => onCreate(filePath, content),
  redo: () => onDelete(filePath),
  data: { filePath, content },
});

export const createFileRenameAction = (
  oldPath: string,
  newPath: string,
  onRename: (from: string, to: string) => void | Promise<void>,
): UndoRedoAction => ({
  id: `file-rename-${Date.now()}-${Math.random()}`,
  type: 'file-rename',
  description: `Rename ${oldPath} to ${newPath}`,
  timestamp: Date.now(),
  undo: () => onRename(newPath, oldPath),
  redo: () => onRename(oldPath, newPath),
  data: { oldPath, newPath },
});

export const createUIStateAction = <T>(
  description: string,
  oldState: T,
  newState: T,
  onStateChange: (state: T) => void | Promise<void>,
): UndoRedoAction<T> => ({
  id: `ui-state-${Date.now()}-${Math.random()}`,
  type: 'ui-state',
  description,
  timestamp: Date.now(),
  undo: () => onStateChange(oldState),
  redo: () => onStateChange(newState),
  data: { oldState, newState } as any,
});

export const createBatchAction = (
  description: string,
  actions: UndoRedoAction[],
): UndoRedoAction => ({
  id: `batch-${Date.now()}-${Math.random()}`,
  type: 'batch',
  description,
  timestamp: Date.now(),
  undo: async () => {
    // Execute undo actions in reverse order
    for (let i = actions.length - 1; i >= 0; i--) {
      await actions[i].undo();
    }
  },
  redo: async () => {
    // Execute redo actions in forward order
    for (const action of actions) {
      await action.redo();
    }
  },
  data: { actions },
});
