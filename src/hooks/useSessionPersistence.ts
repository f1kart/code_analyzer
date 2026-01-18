import { useState, useEffect, useCallback, useRef } from 'react';
import { Tab } from '../components/TabbedMainView';

export interface SessionState {
  version: string;
  timestamp: number;
  workspace: {
    rootPath?: string;
    openTabs: Tab[];
    activeTabId: string | null;
    panelLayout: {
      left: number;
      main: number;
      bottom: number;
      right?: number;
    };
    leftPanelTab: string;
    bottomPanelVisible: boolean;
    rightPanelVisible: boolean;
  };
  editor: {
    dirtyFiles: Record<string, string>; // filePath -> content
    cursorPositions: Record<string, { line: number; column: number }>;
    scrollPositions: Record<string, { top: number; left: number }>;
    foldedRegions: Record<string, Array<{ start: number; end: number }>>;
  };
  chat: {
    history: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
      metadata?: Record<string, any>;
    }>;
    activeConversationId?: string;
  };
  terminal: {
    sessions: Array<{
      id: string;
      name: string;
      cwd: string;
      history: string[];
      isActive: boolean;
    }>;
  };
  search: {
    recentQueries: string[];
    searchResults?: any;
  };
  git: {
    stagedFiles: string[];
    lastCommitMessage?: string;
  };
  ai: {
    recentCommands: string[];
    workflowHistory: Array<{
      id: string;
      type: string;
      timestamp: number;
      status: 'pending' | 'running' | 'completed' | 'failed';
      results?: any;
    }>;
  };
  ui: {
    theme: string;
    fontSize: number;
    sidebarWidth: number;
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message?: string;
      timestamp: number;
      dismissed: boolean;
    }>;
  };
}

const SESSION_STORAGE_KEY = 'gemini-ide-session';
const SESSION_VERSION = '1.0.0';
const AUTOSAVE_INTERVAL = 5000; // 5 seconds

const createDefaultSession = (): SessionState => ({
  version: SESSION_VERSION,
  timestamp: Date.now(),
  workspace: {
    openTabs: [],
    activeTabId: null,
    panelLayout: { left: 20, main: 60, bottom: 20 },
    leftPanelTab: 'project',
    bottomPanelVisible: true,
    rightPanelVisible: false,
  },
  editor: {
    dirtyFiles: {},
    cursorPositions: {},
    scrollPositions: {},
    foldedRegions: {},
  },
  chat: {
    history: [],
  },
  terminal: {
    sessions: [],
  },
  search: {
    recentQueries: [],
  },
  git: {
    stagedFiles: [],
  },
  ai: {
    recentCommands: [],
    workflowHistory: [],
  },
  ui: {
    theme: 'dark',
    fontSize: 14,
    sidebarWidth: 300,
    notifications: [],
  },
});

export const useSessionPersistence = () => {
  const [session, setSession] = useState<SessionState>(createDefaultSession);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveRef = useRef<number>(0);

  // Load session from storage
  const loadSession = useCallback(async (): Promise<SessionState> => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        return createDefaultSession();
      }

      const parsed = JSON.parse(stored) as SessionState;

      // Version migration logic
      if (parsed.version !== SESSION_VERSION) {
        console.warn('Session version mismatch, creating new session');
        return createDefaultSession();
      }

      // Validate session structure
      if (!parsed.workspace || !parsed.editor || !parsed.chat) {
        console.warn('Invalid session structure, creating new session');
        return createDefaultSession();
      }

      return {
        ...createDefaultSession(),
        ...parsed,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to load session:', error);
      return createDefaultSession();
    }
  }, []);

  // Save session to storage
  const saveSession = useCallback(async (sessionData: SessionState) => {
    try {
      setIsSaving(true);
      const serialized = JSON.stringify({
        ...sessionData,
        timestamp: Date.now(),
      });

      localStorage.setItem(SESSION_STORAGE_KEY, serialized);
      lastSaveRef.current = Date.now();
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Auto-save with debouncing
  const scheduleAutosave = useCallback(
    (sessionData: SessionState) => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        saveSession(sessionData);
      }, AUTOSAVE_INTERVAL);
    },
    [saveSession],
  );

  // Update session state
  const updateSession = useCallback(
    (updater: (prev: SessionState) => SessionState) => {
      setSession((prev) => {
        const updated = updater(prev);
        scheduleAutosave(updated);
        return updated;
      });
    },
    [scheduleAutosave],
  );

  // Workspace methods
  const updateWorkspace = useCallback(
    (updates: Partial<SessionState['workspace']>) => {
      updateSession((prev) => ({
        ...prev,
        workspace: { ...prev.workspace, ...updates },
      }));
    },
    [updateSession],
  );

  const setOpenTabs = useCallback(
    (tabs: Tab[]) => {
      updateWorkspace({ openTabs: tabs });
    },
    [updateWorkspace],
  );

  const setActiveTab = useCallback(
    (tabId: string | null) => {
      updateWorkspace({ activeTabId: tabId });
    },
    [updateWorkspace],
  );

  const setPanelLayout = useCallback(
    (layout: SessionState['workspace']['panelLayout']) => {
      updateWorkspace({ panelLayout: layout });
    },
    [updateWorkspace],
  );

  // Editor methods
  const updateEditor = useCallback(
    (updates: Partial<SessionState['editor']>) => {
      updateSession((prev) => ({
        ...prev,
        editor: { ...prev.editor, ...updates },
      }));
    },
    [updateSession],
  );

  const setDirtyFile = useCallback(
    (filePath: string, content: string) => {
      updateEditor({
        dirtyFiles: { ...session.editor.dirtyFiles, [filePath]: content },
      });
    },
    [updateEditor, session.editor.dirtyFiles],
  );

  const removeDirtyFile = useCallback(
    (filePath: string) => {
      const { [filePath]: removed, ...rest } = session.editor.dirtyFiles;
      updateEditor({ dirtyFiles: rest });
    },
    [updateEditor, session.editor.dirtyFiles],
  );

  const setCursorPosition = useCallback(
    (filePath: string, position: { line: number; column: number }) => {
      updateEditor({
        cursorPositions: { ...session.editor.cursorPositions, [filePath]: position },
      });
    },
    [updateEditor, session.editor.cursorPositions],
  );

  const setScrollPosition = useCallback(
    (filePath: string, position: { top: number; left: number }) => {
      updateEditor({
        scrollPositions: { ...session.editor.scrollPositions, [filePath]: position },
      });
    },
    [updateEditor, session.editor.scrollPositions],
  );

  // Chat methods
  const updateChat = useCallback(
    (updates: Partial<SessionState['chat']>) => {
      updateSession((prev) => ({
        ...prev,
        chat: { ...prev.chat, ...updates },
      }));
    },
    [updateSession],
  );

  const addChatMessage = useCallback(
    (message: SessionState['chat']['history'][0]) => {
      updateChat({
        history: [...session.chat.history, message],
      });
    },
    [updateChat, session.chat.history],
  );

  const clearChatHistory = useCallback(() => {
    updateChat({ history: [] });
  }, [updateChat]);

  // Terminal methods
  const updateTerminal = useCallback(
    (updates: Partial<SessionState['terminal']>) => {
      updateSession((prev) => ({
        ...prev,
        terminal: { ...prev.terminal, ...updates },
      }));
    },
    [updateSession],
  );

  const addTerminalSession = useCallback(
    (terminalSession: SessionState['terminal']['sessions'][0]) => {
      updateTerminal({
        sessions: [...session.terminal.sessions, terminalSession],
      });
    },
    [updateTerminal, session.terminal.sessions],
  );

  const removeTerminalSession = useCallback(
    (sessionId: string) => {
      updateTerminal({
        sessions: session.terminal.sessions.filter((s) => s.id !== sessionId),
      });
    },
    [updateTerminal, session.terminal.sessions],
  );

  // Search methods
  const addSearchQuery = useCallback(
    (query: string) => {
      const queries = [query, ...session.search.recentQueries.filter((q) => q !== query)].slice(
        0,
        20,
      );
      updateSession((prev) => ({
        ...prev,
        search: { ...prev.search, recentQueries: queries },
      }));
    },
    [updateSession, session.search.recentQueries],
  );

  // Git methods
  const updateGit = useCallback(
    (updates: Partial<SessionState['git']>) => {
      updateSession((prev) => ({
        ...prev,
        git: { ...prev.git, ...updates },
      }));
    },
    [updateSession],
  );

  const setStagedFiles = useCallback(
    (files: string[]) => {
      updateGit({ stagedFiles: files });
    },
    [updateGit],
  );

  // AI methods
  const updateAI = useCallback(
    (updates: Partial<SessionState['ai']>) => {
      updateSession((prev) => ({
        ...prev,
        ai: { ...prev.ai, ...updates },
      }));
    },
    [updateSession],
  );

  const addRecentCommand = useCallback(
    (commandId: string) => {
      const commands = [
        commandId,
        ...session.ai.recentCommands.filter((c) => c !== commandId),
      ].slice(0, 10);
      updateAI({ recentCommands: commands });
    },
    [updateAI, session.ai.recentCommands],
  );

  const addWorkflowHistory = useCallback(
    (workflow: SessionState['ai']['workflowHistory'][0]) => {
      updateAI({
        workflowHistory: [workflow, ...session.ai.workflowHistory].slice(0, 50),
      });
    },
    [updateAI, session.ai.workflowHistory],
  );

  // UI methods
  const updateUI = useCallback(
    (updates: Partial<SessionState['ui']>) => {
      updateSession((prev) => ({
        ...prev,
        ui: { ...prev.ui, ...updates },
      }));
    },
    [updateSession],
  );

  const setTheme = useCallback(
    (theme: string) => {
      updateUI({ theme });
    },
    [updateUI],
  );

  const setFontSize = useCallback(
    (fontSize: number) => {
      updateUI({ fontSize });
    },
    [updateUI],
  );

  // Clear session
  const clearSession = useCallback(() => {
    const newSession = createDefaultSession();
    setSession(newSession);
    saveSession(newSession);
  }, [saveSession]);

  // Force save
  const forceSave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    return saveSession(session);
  }, [saveSession, session]);

  // Export/Import
  const exportSession = useCallback(() => {
    return JSON.stringify(session, null, 2);
  }, [session]);

  const importSession = useCallback(
    async (sessionData: string) => {
      try {
        const parsed = JSON.parse(sessionData) as SessionState;
        setSession(parsed);
        await saveSession(parsed);
      } catch (error) {
        console.error('Failed to import session:', error);
        throw new Error('Invalid session data');
      }
    },
    [saveSession],
  );

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const loadedSession = await loadSession();
        setSession(loadedSession);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        setSession(createDefaultSession());
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
  }, [loadSession]);

  // Save on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      // Synchronous save on page unload
      try {
        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            ...session,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        console.error('Failed to save session on unload:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [session]);

  return {
    session,
    isLoading,
    isSaving,
    lastSave: lastSaveRef.current,

    // General methods
    updateSession,
    clearSession,
    forceSave,
    exportSession,
    importSession,

    // Workspace methods
    updateWorkspace,
    setOpenTabs,
    setActiveTab,
    setPanelLayout,

    // Editor methods
    updateEditor,
    setDirtyFile,
    removeDirtyFile,
    setCursorPosition,
    setScrollPosition,

    // Chat methods
    updateChat,
    addChatMessage,
    clearChatHistory,

    // Terminal methods
    updateTerminal,
    addTerminalSession,
    removeTerminalSession,

    // Search methods
    addSearchQuery,

    // Git methods
    updateGit,
    setStagedFiles,

    // AI methods
    updateAI,
    addRecentCommand,
    addWorkflowHistory,

    // UI methods
    updateUI,
    setTheme,
    setFontSize,
  };
};
