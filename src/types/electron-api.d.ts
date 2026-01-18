/*
 * Global Electron bridge declarations
 */
export {}; // ensure this file is treated as a module

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  interface ElectronAPI {
    // File system core
    openFolderDialog: () => Promise<{ folderPath: string; files: import('../utils/sessionManager').AppFile[] } | null>;
    openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ filePath: string } | null>;
    saveFileContent: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    formatContent: (filePath: string, content: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    createFile: (projectPath: string) => Promise<import('../utils/sessionManager').AppFile | null>;
    deleteFile: (
      projectPath: string,
      fileIdentifier: string,
    ) => Promise<{ success: boolean; error?: string }>;
    readFile: (
      absolutePath: string,
    ) => Promise<{ content: string; encoding?: string; success?: boolean; error?: string } | null>;
    writeFile: (
      filePath: string,
      content: string,
      encoding?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    readDirectory: (dirPath: string, recursive?: boolean) => Promise<import('../services/fileSystemService').FileSystemEntry[]>;
    createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    deleteDirectory: (dirPath: string, recursive?: boolean) => Promise<{ success: boolean; error?: string }>;
    renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    copyFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
    moveFile: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
    getFileStats: (
      filePath: string,
    ) => Promise<{ size: number; lastModified: number; isDirectory: boolean } | null>;
    watchDirectory: (
      dirPath: string,
      callback: (event: import('../services/fileSystemService').FileWatchEvent) => void,
    ) => Promise<{ watchId?: string; dispose?: () => Promise<void>; error?: string }>;
    unwatchDirectory: (watchId: string) => Promise<void>;
    searchFiles: (
      dirPath: string,
      pattern: string,
      options?: { includeContent?: boolean; maxResults?: number },
    ) => Promise<Array<{ path: string; matches?: Array<{ line: number; content: string; column: number }> }>>;
    getProjectStats: (
      projectPath: string,
    ) => Promise<import('../services/fileSystemService').FileSystemStats | null>;
    revealInExplorer: (filePath: string) => Promise<void>;
    openInDefaultApp: (filePath: string) => Promise<void>;
    getFolderTree: (
      folderPath: string,
    ) => Promise<{
      folderPath: string;
      tree: Array<{
        path: string;
        type: 'file' | 'directory';
        children?: Array<{ path: string; type: 'file' | 'directory'; children?: unknown[] }>;
      }>;
      error?: string;
    }>;
    getRecentProjects: () => Promise<Array<{ name: string; path: string; lastOpened: number; type: 'folder' | 'file' }>>;
    addRecentProject: (name: string, path: string, type: 'folder' | 'file') => Promise<void>;
    removeRecentProject: (path: string) => Promise<void>;
    getProjectRoot: () => Promise<string | null>;

    // Node compatibility bridges exposed via preload for renderer access
    fs?: {
      readdir: (path: string) => Promise<string[]>;
      stat: (path: string) => Promise<{ isDirectory(): boolean; isFile(): boolean }>;
      readFile: (path: string, encoding?: string) => Promise<string>;
      existsSync?: (path: string) => boolean;
    };
    path?: {
      join: (...segments: string[]) => string;
      resolve: (...segments: string[]) => string;
      basename: (path: string) => string;
      dirname?: (path: string) => string;
      extname?: (path: string) => string;
      sep: string;
      delimiter?: string;
    };

    // Terminal
    runCommand: (
      command: string | { command: string; cwd?: string }
    ) => Promise<{ success: boolean; output: string; error?: string; exitCode?: number }>; 
    pty: {
      spawn: (cwd: string, cols: number, rows: number) => Promise<{ success: boolean; id?: string; error?: string }>;
      write: (id: string, data: string) => Promise<{ success: boolean; error?: string }>;
      resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
      kill: (id: string) => Promise<{ success: boolean; error?: string }>;
      onData: (listener: (payload: { id: string; data: string }) => void) => () => void;
      onExit: (listener: (payload: { id: string; code: number | null }) => void) => () => void;
    };

    // Gemini-specific APIs
    gemini: {
      isAvailable: () => Promise<boolean>;
      chat: (
        history: import('../services/geminiService').ChatMessage[],
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<string>;
      explainCode: (code: string, language: string) => Promise<string>;
      findSimilarCode: (
        files: import('../utils/sessionManager').AppFile[],
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<import('../services/geminiService').SimilarityResult>;
      summarizePlaceholders: (code: string, language: string) => Promise<string>;
      refactorCode: (
        code: string,
        language: string,
        goals: string[],
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<import('../services/geminiService').RefactorResult>;
      aiTeamRefactorCode: (
        code: string,
        language: string,
        goals: string[],
        settings: import('../utils/sessionManager').AppSettings,
        fileIdentifier: string,
        selectedModelId: string,
      ) => Promise<import('../services/geminiService').AITeamRefactorResult>;
      continueAITeamRefactor: (
        code: string,
        language: string,
        goals: string[],
        settings: import('../utils/sessionManager').AppSettings,
        fileIdentifier: string,
        selectedModelId: string,
      ) => Promise<import('../services/geminiService').AITeamRefactorResult>;
      aiTeamProjectRefactor: (
        files: import('../utils/sessionManager').AppFile[],
        goals: string[],
        settings: import('../utils/sessionManager').AppSettings,
        selectedModelId: string,
      ) => Promise<import('../services/geminiService').AITeamProjectResult>;
      suggestSnippets: (
        userQuery: string,
        activeCode: string,
        savedSnippets: import('../utils/sessionManager').CodeSnippet[],
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<import('../services/geminiService').SuggestedSnippetResult>;
      debugError: (
        errorMessage: string,
        relevantFiles: import('../utils/sessionManager').AppFile[],
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<import('../services/geminiService').RootCauseAnalysisResult>;
      generateUnitTests: (
        file: import('../utils/sessionManager').AppFile,
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<import('../services/geminiService').TestFileResult>;
      generateDocumentation: (
        file: import('../utils/sessionManager').AppFile,
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<string>;
      analyzeDependencies: (
        files: import('../utils/sessionManager').AppFile[],
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<string>;
      projectSearch: (
        files: import('../utils/sessionManager').AppFile[],
        query: string,
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<import('../services/geminiService').ProjectSearchResult[]>;
      aiTeamRefactorCode?: (...args: Parameters<import('../services/geminiService').GeminiAPI['aiTeamRefactorCode']>) => ReturnType<import('../services/geminiService').GeminiAPI['aiTeamRefactorCode']>;
      continueAITeamRefactor?: (...args: Parameters<import('../services/geminiService').GeminiAPI['continueAITeamRefactor']>) => ReturnType<import('../services/geminiService').GeminiAPI['continueAITeamRefactor']>;
      aiTeamProjectRefactor?: (...args: Parameters<import('../services/geminiService').GeminiAPI['aiTeamProjectRefactor']>) => ReturnType<import('../services/geminiService').GeminiAPI['aiTeamProjectRefactor']>;
    };

    // Provider-agnostic AI bridge
    ai: {
      chat: (payload: {
        messages: import('../services/geminiService').Message[];
        settings: import('../utils/sessionManager').AppSettings;
        projectPath?: string;
        modelId: string;
      }) => Promise<string>;
    };

    // Project management
    project: {
      create: () => Promise<{ success: boolean; projectPath?: string; readmePath?: string; error?: string }>;
    };

    // Git bridge
    git: {
      isEnabled?: () => Promise<{
        success: boolean;
        enabled: boolean;
        error?: string;
      }>;
      status: (
        repoPath: string,
      ) => Promise<{
        success: boolean;
        status?: unknown;
        error?: string;
      }>;
      stage: (
        repoPath: string,
        files: string[],
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      unstage: (
        repoPath: string,
        files: string[],
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      commit: (
        repoPath: string,
        message: string,
      ) => Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
      }>;
      aiCommitMessage: (
        repoPath: string,
        settings: import('../utils/sessionManager').AppSettings,
        modelId: string,
      ) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
    };

    // Database bridge
    db: {
      listSnippets: () => Promise<unknown>;
      createSnippet: (data: Record<string, unknown>) => Promise<unknown>;
      updateSnippet: (id: string, data: Record<string, unknown>) => Promise<unknown>;
      deleteSnippet: (id: string) => Promise<void>;
      listProviders: () => Promise<unknown>;
      createProvider: (data: Record<string, unknown>) => Promise<unknown>;
      updateProvider: (id: string, data: Record<string, unknown>) => Promise<unknown>;
      deleteProvider: (id: string) => Promise<void>;
      listWorkflows: () => Promise<unknown>;
      createWorkflow: (data: Record<string, unknown>) => Promise<unknown>;
      updateWorkflow: (id: string, data: Record<string, unknown>) => Promise<unknown>;
      deleteWorkflow: (id: string) => Promise<void>;
      listAgentMaps: (workflowId: string) => Promise<unknown>;
      setAgentMap: (data: Record<string, unknown>) => Promise<unknown>;
    };
  }
}
