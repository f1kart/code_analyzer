import { useReducer, Dispatch } from 'react';
import { AppFile, AppSettings, CodeSnippet, Message } from '../utils/sessionManager';
import {
  RefactorResult,
  AITeamRefactorResult,
  AITeamProjectResult,
  SimilarityResult,
} from '../services/geminiService';
import { ProjectSearchResult } from '../components/SearchResultsModal';
import { ToastMessage } from '../components/ToastNotification';
import { MenuItem } from '../components/RightClickMenu';

// Add new state properties for enterprise features
export interface ExplorerSelectionState {
  active: {
    relativePath: string | null;
    absolutePath: string | null;
    isDirectory: boolean;
  };
  selected: Array<{
    relativePath: string | null;
    absolutePath: string | null;
    isDirectory: boolean;
  }>;
}

export interface AppState {
  // UI State
  isAdminModalOpen: boolean;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  isChatColumnOpen: boolean; // Separate chat column
  rightPanelActiveTab: 'ai' | 'search' | 'similarity' | 'dependencies';
  leftPanelTab: 'project' | 'snippets' | 'source';
  workbenchView: 'editor' | 'diff';
  rightPanelView: 'ai' | 'chat' | 'enterprise';
  isTerminalOpen: boolean;
  isHelpModalOpen: boolean;

  // Loading State
  isLoading: { [key: string]: boolean };

  // Toast and Context Menu
  toasts: ToastMessage[];
  contextMenu: { x: number; y: number; items: MenuItem[] } | null;

  // Project and File State
  projectPath: string | null;
  uploadedFiles: AppFile[];
  codeSnippets: CodeSnippet[];
  activeFileIdentifier: string | null;
  selectedFileIdentifiers: string[];
  activeFileAbsolutePath: string | null;
  selectedFileAbsolutePaths: string[];
  explorerSelection: ExplorerSelectionState;
  refactoredFiles: string[];
  originalCode: string;
  language: string;
  openFolders: string[];

  // AI Results State
  refactorResult: RefactorResult | null;
  aiTeamRefactorResult: AITeamRefactorResult | null;
  aiTeamProjectResult: AITeamProjectResult | null;
  refactoringGoals: string[];
  lastAction: string | null;
  explanation: string | null;
  placeholderSummary: string | null;
  similarityResults: SimilarityResult | null;
  rootCauseAnalysisResult: any | null;
  clarification: { prompt: string; fileIdentifier: string } | null;

  // Search and Analysis
  projectSearchResults: ProjectSearchResult[] | null;
  dependencyAnalysisResult: string | null;

  // Terminal State
  terminalHistory: { command: string; output: string; error?: boolean }[];

  // Chat State
  chatHistory: Message[];
  selectedModelId: string;

  // App Settings
  appSettings: AppSettings;

  // Plugin System State
  plugins: any[];
  pluginErrors: string[];

  // Testing Platform State
  testSuites: any[];
  mockServices: any[];
  benchmarks: any[];
  isTestingRunning: boolean;

  // Cloud Integration State
  cloudIntegrations: any[];
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime?: Date;

  // Team Collaboration State
  collaborationSessions: any[];
  activeCollaborators: any[];
  workspaceShares: any[];

  // Business Intelligence State
  analyticsData: any;
  teamMetrics: any;
  qualityTrends: any[];

  // Security Platform State
  securityReports: any[];
  complianceStatus: any;
  vulnerabilityAlerts: any[];

  // Advanced Debugging State
  debugSessions: any[];
  breakpoints: any[];
  watchExpressions: any[];

  // Performance Monitoring State
  performanceMetrics: any;
  systemHealth: any;
}

// Action Types
export type AppAction =
  // UI Actions
  | { type: 'SET_ADMIN_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_LEFT_PANEL_OPEN'; payload: boolean }
  | { type: 'SET_RIGHT_PANEL_OPEN'; payload: boolean }
  | { type: 'SET_CHAT_COLUMN_OPEN'; payload: boolean }
  | { type: 'SET_RIGHT_PANEL_ACTIVE_TAB'; payload: 'ai' | 'search' | 'similarity' | 'dependencies' }
  | { type: 'SET_LEFT_PANEL_TAB'; payload: 'project' | 'snippets' | 'source' }
  | { type: 'SET_WORKBENCH_VIEW'; payload: 'editor' | 'diff' }
  | { type: 'SET_RIGHT_PANEL_VIEW'; payload: 'ai' | 'chat' | 'enterprise' }
  | { type: 'SET_TERMINAL_OPEN'; payload: boolean }
  | { type: 'SET_HELP_MODAL_OPEN'; payload: boolean }

  // Loading Actions
  | { type: 'SET_LOADING_STATE'; payload: { action: string; value: boolean } }
  | { type: 'SET_LOADING'; payload: { key: string; value: boolean } }
  | { type: 'CLEAR_ALL_LOADING' }

  // Toast Actions
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: number }
  | { type: 'CLEAR_TOASTS' }

  // Context Menu Actions
  | { type: 'SET_CONTEXT_MENU'; payload: { x: number; y: number; items: MenuItem[] } | null }

  // File Actions
  | { type: 'SET_PROJECT_PATH'; payload: string | null }
  | { type: 'SET_UPLOADED_FILES'; payload: AppFile[] }
  | { type: 'UPDATE_FILE_CONTENT'; payload: { identifier: string; content: string } }
  | { type: 'ADD_FILE'; payload: AppFile }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'SET_CODE_SNIPPETS'; payload: CodeSnippet[] }
  | { type: 'ADD_CODE_SNIPPET'; payload: CodeSnippet }
  | { type: 'ADD_SNIPPET'; payload: CodeSnippet }
  | { type: 'REMOVE_CODE_SNIPPET'; payload: string }
  | { type: 'SET_ACTIVE_FILE_IDENTIFIER'; payload: string | null }
  | { type: 'SET_SELECTED_FILE_IDENTIFIERS'; payload: string[] }
  | { type: 'SET_ACTIVE_FILE_ABSOLUTE'; payload: string | null }
  | { type: 'SET_SELECTED_FILE_ABSOLUTE_PATHS'; payload: string[] }
  | { type: 'SET_EXPLORER_SELECTION'; payload: ExplorerSelectionState }
  | { type: 'SET_REFACTORED_FILES'; payload: string[] }
  | { type: 'ADD_REFACTORED_FILE'; payload: string }
  | { type: 'SET_ORIGINAL_CODE'; payload: string }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SET_OPEN_FOLDERS'; payload: string[] }

  // AI Results Actions
  | { type: 'SET_REFACTOR_RESULT'; payload: RefactorResult | null }
  | { type: 'SET_AI_TEAM_REFACTOR_RESULT'; payload: AITeamRefactorResult | null }
  | { type: 'SET_AI_TEAM_PROJECT_RESULT'; payload: AITeamProjectResult | null }
  | { type: 'SET_REFACTORING_GOALS'; payload: string[] }
  | { type: 'SET_LAST_ACTION'; payload: string | null }
  | { type: 'SET_EXPLANATION'; payload: string | null }
  | { type: 'SET_PLACEHOLDER_SUMMARY'; payload: string | null }
  | { type: 'SET_SIMILARITY_RESULTS'; payload: SimilarityResult | null }
  | { type: 'SET_ROOT_CAUSE_ANALYSIS_RESULT'; payload: any | null }
  | { type: 'SET_CLARIFICATION'; payload: { prompt: string; fileIdentifier: string } | null }

  // Search Actions
  | { type: 'SET_PROJECT_SEARCH_RESULTS'; payload: ProjectSearchResult[] | null }
  | { type: 'SET_DEPENDENCY_ANALYSIS_RESULT'; payload: string | null }

  // Terminal Actions
  | { type: 'ADD_TERMINAL_HISTORY'; payload: { command: string; output: string; error?: boolean } }
  | { type: 'CLEAR_TERMINAL_HISTORY' }

  // Chat Actions
  | { type: 'SET_CHAT_HISTORY'; payload: Message[] }
  | { type: 'ADD_CHAT_MESSAGE'; payload: Message }
  | { type: 'SET_SELECTED_MODEL_ID'; payload: string }

  // App Settings Actions
  | { type: 'SET_APP_SETTINGS'; payload: AppSettings }

  // Plugin System Actions
  | { type: 'SET_PLUGINS'; payload: any[] }
  | { type: 'ADD_PLUGIN_ERROR'; payload: string }
  | { type: 'SET_TEST_SUITES'; payload: any[] }
  | { type: 'SET_MOCK_SERVICES'; payload: any[] }
  | { type: 'SET_BENCHMARKS'; payload: any[] }
  | { type: 'SET_TESTING_RUNNING'; payload: boolean }
  | { type: 'SET_CLOUD_INTEGRATIONS'; payload: any[] }
  | { type: 'SET_SYNC_STATUS'; payload: 'idle' | 'syncing' | 'error' }
  | { type: 'SET_COLLABORATION_SESSIONS'; payload: any[] }
  | { type: 'SET_ACTIVE_COLLABORATORS'; payload: any[] }
  | { type: 'SET_WORKSPACE_SHARES'; payload: any[] }
  | { type: 'SET_ANALYTICS_DATA'; payload: any }
  | { type: 'SET_TEAM_METRICS'; payload: any }
  | { type: 'SET_QUALITY_TRENDS'; payload: any[] }
  | { type: 'SET_SECURITY_REPORTS'; payload: any[] }
  | { type: 'SET_COMPLIANCE_STATUS'; payload: any }
  | { type: 'SET_VULNERABILITY_ALERTS'; payload: any[] }
  | { type: 'SET_DEBUG_SESSIONS'; payload: any[] }
  | { type: 'SET_BREAKPOINTS'; payload: any[] }
  | { type: 'SET_WATCH_EXPRESSIONS'; payload: any[] }
  | { type: 'SET_PERFORMANCE_METRICS'; payload: any }
  | { type: 'SET_SYSTEM_HEALTH'; payload: any }

  // Complex Actions
  | {
      type: 'HANDLE_FILE_SELECTION';
      payload: {
        activeFileIdentifier: string | null;
        selectedIdentifiers: string[];
        uploadedFiles: AppFile[];
        activeFileAbsolutePath?: string | null;
        selectedAbsolutePaths?: string[];
        explorerSelection?: ExplorerSelectionState;
      };
    }
  | { type: 'CLEAR_AI_RESULTS' }
  | { type: 'RESET_SESSION'; payload: AppState };

// Reducer Function
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    // UI Actions
    case 'SET_ADMIN_MODAL_OPEN':
      return { ...state, isAdminModalOpen: action.payload };
    case 'SET_LEFT_PANEL_OPEN':
      return { ...state, isLeftPanelOpen: action.payload };
    case 'SET_RIGHT_PANEL_OPEN':
      return { ...state, isRightPanelOpen: action.payload };
    case 'SET_CHAT_COLUMN_OPEN':
      return { ...state, isChatColumnOpen: action.payload };
    case 'SET_RIGHT_PANEL_ACTIVE_TAB':
      return { ...state, rightPanelActiveTab: action.payload };
    case 'SET_LEFT_PANEL_TAB':
      return { ...state, leftPanelTab: action.payload };
    case 'SET_WORKBENCH_VIEW':
      return { ...state, workbenchView: action.payload };
    case 'SET_RIGHT_PANEL_VIEW':
      return { ...state, rightPanelView: action.payload };
    case 'SET_TERMINAL_OPEN':
      return { ...state, isTerminalOpen: action.payload };
    case 'SET_HELP_MODAL_OPEN':
      return { ...state, isHelpModalOpen: action.payload };

    // Loading Actions
    case 'SET_LOADING_STATE':
      return {
        ...state,
        isLoading: { ...state.isLoading, [action.payload.action]: action.payload.value },
      };
    case 'CLEAR_ALL_LOADING':
      return { ...state, isLoading: {} };

    // Toast Actions
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case 'CLEAR_TOASTS':
      return { ...state, toasts: [] };

    // Context Menu Actions
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.payload };

    // File Actions
    case 'SET_PROJECT_PATH':
      return { ...state, projectPath: action.payload };
    case 'SET_UPLOADED_FILES':
      console.log('[useAppReducer] SET_UPLOADED_FILES called with', action.payload.length, 'files');
      return { ...state, uploadedFiles: action.payload };
    case 'UPDATE_FILE_CONTENT':
      return {
        ...state,
        uploadedFiles: state.uploadedFiles.map((f) =>
          f.identifier === action.payload.identifier
            ? { ...f, content: action.payload.content }
            : f,
        ),
      };
    case 'ADD_FILE':
      return { ...state, uploadedFiles: [...state.uploadedFiles, action.payload] };
    case 'REMOVE_FILE':
      return {
        ...state,
        uploadedFiles: state.uploadedFiles.filter((f) => f.identifier !== action.payload),
      };
    case 'SET_CODE_SNIPPETS':
      return { ...state, codeSnippets: action.payload };
    case 'ADD_CODE_SNIPPET':
      return { ...state, codeSnippets: [action.payload, ...state.codeSnippets] };
    case 'REMOVE_CODE_SNIPPET':
      return {
        ...state,
        codeSnippets: state.codeSnippets.filter((s) => s.id !== action.payload),
      };
    case 'SET_ACTIVE_FILE_IDENTIFIER':
      return { ...state, activeFileIdentifier: action.payload };
    case 'SET_SELECTED_FILE_IDENTIFIERS':
      return { ...state, selectedFileIdentifiers: action.payload };
    case 'SET_ACTIVE_FILE_ABSOLUTE':
      return { ...state, activeFileAbsolutePath: action.payload };
    case 'SET_SELECTED_FILE_ABSOLUTE_PATHS':
      return { ...state, selectedFileAbsolutePaths: action.payload };
    case 'SET_EXPLORER_SELECTION':
      return { ...state, explorerSelection: action.payload };
    case 'SET_REFACTORED_FILES':
      return { ...state, refactoredFiles: action.payload };
    case 'ADD_REFACTORED_FILE':
      return {
        ...state,
        refactoredFiles: [...new Set([...state.refactoredFiles, action.payload])],
      };
    case 'SET_ORIGINAL_CODE':
      return { ...state, originalCode: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'SET_OPEN_FOLDERS':
      return { ...state, openFolders: action.payload };

    // AI Results Actions
    case 'SET_REFACTOR_RESULT':
      return { ...state, refactorResult: action.payload };
    case 'SET_AI_TEAM_REFACTOR_RESULT':
      return { ...state, aiTeamRefactorResult: action.payload };
    case 'SET_AI_TEAM_PROJECT_RESULT':
      return { ...state, aiTeamProjectResult: action.payload };
    case 'SET_REFACTORING_GOALS':
      return { ...state, refactoringGoals: action.payload };
    case 'SET_LAST_ACTION':
      return { ...state, lastAction: action.payload };
    case 'SET_EXPLANATION':
      return { ...state, explanation: action.payload };
    case 'SET_PLACEHOLDER_SUMMARY':
      return { ...state, placeholderSummary: action.payload };
    case 'SET_SIMILARITY_RESULTS':
      return { ...state, similarityResults: action.payload };
    case 'SET_ROOT_CAUSE_ANALYSIS_RESULT':
      return { ...state, rootCauseAnalysisResult: action.payload };
    case 'SET_CLARIFICATION':
      return { ...state, clarification: action.payload };

    // Search Actions
    case 'SET_PROJECT_SEARCH_RESULTS':
      return { ...state, projectSearchResults: action.payload };
    case 'SET_DEPENDENCY_ANALYSIS_RESULT':
      return { ...state, dependencyAnalysisResult: action.payload };

    // Terminal Actions
    case 'ADD_TERMINAL_HISTORY':
      return {
        ...state,
        terminalHistory: [...state.terminalHistory, action.payload],
      };
    case 'CLEAR_TERMINAL_HISTORY':
      return { ...state, terminalHistory: [] };

    // Chat Actions
    case 'SET_CHAT_HISTORY':
      return { ...state, chatHistory: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_SELECTED_MODEL_ID':
      return { ...state, selectedModelId: action.payload };

    // App Settings Actions
    case 'SET_APP_SETTINGS':
      return { ...state, appSettings: action.payload };

    // Plugin System Actions
    case 'SET_PLUGINS':
      return { ...state, plugins: action.payload };
    case 'ADD_PLUGIN_ERROR':
      return { ...state, pluginErrors: [...state.pluginErrors, action.payload] };

    // Testing Platform Actions
    case 'SET_TEST_SUITES':
      return { ...state, testSuites: action.payload };
    case 'SET_MOCK_SERVICES':
      return { ...state, mockServices: action.payload };
    case 'SET_BENCHMARKS':
      return { ...state, benchmarks: action.payload };
    case 'SET_TESTING_RUNNING':
      return { ...state, isTestingRunning: action.payload };

    // Cloud Integration Actions
    case 'SET_CLOUD_INTEGRATIONS':
      return { ...state, cloudIntegrations: action.payload };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };

    // Team Collaboration Actions
    case 'SET_COLLABORATION_SESSIONS':
      return { ...state, collaborationSessions: action.payload };
    case 'SET_ACTIVE_COLLABORATORS':
      return { ...state, activeCollaborators: action.payload };
    case 'SET_WORKSPACE_SHARES':
      return { ...state, workspaceShares: action.payload };

    // Business Intelligence Actions
    case 'SET_ANALYTICS_DATA':
      return { ...state, analyticsData: action.payload };
    case 'SET_TEAM_METRICS':
      return { ...state, teamMetrics: action.payload };
    case 'SET_QUALITY_TRENDS':
      return { ...state, qualityTrends: action.payload };

    // Security Platform Actions
    case 'SET_SECURITY_REPORTS':
      return { ...state, securityReports: action.payload };
    case 'SET_COMPLIANCE_STATUS':
      return { ...state, complianceStatus: action.payload };
    case 'SET_VULNERABILITY_ALERTS':
      return { ...state, vulnerabilityAlerts: action.payload };

    // Advanced Debugging Actions
    case 'SET_DEBUG_SESSIONS':
      return { ...state, debugSessions: action.payload };
    case 'SET_BREAKPOINTS':
      return { ...state, breakpoints: action.payload };
    case 'SET_WATCH_EXPRESSIONS':
      return { ...state, watchExpressions: action.payload };

    // Performance Monitoring Actions
    case 'SET_PERFORMANCE_METRICS':
      return { ...state, performanceMetrics: action.payload };
    case 'SET_SYSTEM_HEALTH':
      return { ...state, systemHealth: action.payload };
    case 'HANDLE_FILE_SELECTION': {
      const {
        activeFileIdentifier,
        selectedIdentifiers,
        uploadedFiles,
        activeFileAbsolutePath,
        selectedAbsolutePaths,
        explorerSelection,
      } = action.payload;
      let newOriginalCode = '';
      const newLanguage = 'plaintext';

      if (activeFileIdentifier) {
        const activeFile = uploadedFiles.find((f) => f.identifier === activeFileIdentifier);
        if (activeFile) {
          newOriginalCode = activeFile.content;
          // Import detectLanguage here would cause circular dependency, so we'll handle this in the component
        }
      }

      return {
        ...state,
        activeFileIdentifier,
        selectedFileIdentifiers: selectedIdentifiers,
        activeFileAbsolutePath: activeFileAbsolutePath ?? state.activeFileAbsolutePath,
        selectedFileAbsolutePaths: selectedAbsolutePaths ?? state.selectedFileAbsolutePaths,
        explorerSelection: explorerSelection ?? state.explorerSelection,
        originalCode: newOriginalCode,
        language: newLanguage,
        lastAction: null,
        refactorResult: null,
        workbenchView: 'editor',
        rightPanelView: 'ai',
      };
    }
    case 'CLEAR_AI_RESULTS':
      return {
        ...state,
        refactorResult: null,
        aiTeamRefactorResult: null,
        aiTeamProjectResult: null,
        explanation: null,
        placeholderSummary: null,
        similarityResults: null,
        rootCauseAnalysisResult: null,
        projectSearchResults: null,
        dependencyAnalysisResult: null,
        clarification: null,
        lastAction: null,
      };
    case 'RESET_SESSION':
      return action.payload;

    default:
      return state;
  }
};

// Default Initial State
export const getDefaultAppState = (): AppState => ({
  // UI State
  isAdminModalOpen: false,
  isLeftPanelOpen: true,
  isRightPanelOpen: true,
  isChatColumnOpen: false,
  rightPanelActiveTab: 'ai',
  leftPanelTab: 'project',
  workbenchView: 'editor',
  rightPanelView: 'ai',
  isTerminalOpen: false,
  isHelpModalOpen: false,

  // Loading State
  isLoading: {},

  // Toast and Context Menu
  toasts: [],
  contextMenu: null,

  // Project and File State
  projectPath: null,
  uploadedFiles: [],
  codeSnippets: [],
  activeFileIdentifier: null,
  selectedFileIdentifiers: [],
  activeFileAbsolutePath: null,
  selectedFileAbsolutePaths: [],
  explorerSelection: {
    active: {
      relativePath: null,
      absolutePath: null,
      isDirectory: false,
    },
    selected: [],
  },
  refactoredFiles: [],
  originalCode: '',
  language: 'plaintext',
  openFolders: [],

  // AI Results State
  refactorResult: null,
  aiTeamRefactorResult: null,
  aiTeamProjectResult: null,
  refactoringGoals: [],
  lastAction: null,
  explanation: null,
  placeholderSummary: null,
  similarityResults: null,
  rootCauseAnalysisResult: null,
  clarification: null,

  // Search and Analysis
  projectSearchResults: null,
  dependencyAnalysisResult: null,

  // Terminal State
  terminalHistory: [],

  // Chat State
  chatHistory: [],
  selectedModelId: 'gemini-2.5-flash',

  // App Settings
  appSettings: {
    aiPersona:
      "You are an expert AI programming assistant, a Socratic tutor. Your primary goal is to help the user understand and improve their code. You should guide them with questions and explain the 'why' behind your suggestions.",
    customRules:
      "1. Always provide clear, concise explanations.\n2. When refactoring, prioritize readability and maintainability.\n3. If you're unsure about something, ask for clarification.",
    explorerStyle: 'list',
    availableModels: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', isLocal: false },
      { id: 'local-model-placeholder', name: 'Local Model (Ollama)', isLocal: true },
    ],
    desktopSettings: {
      fileSystem: false,
      database: false,
    },
    aiTools: {
      webSearch: true,
      projectSearch: true,
      editFile: true,
      createFile: true,
      runTerminalCommand: false,
      visualSnapshot: true,
      autoRunTools: false,
      analyzeDependencies: true,
      projectWideRefactor: true,
      generateDocs: true,
    },
    aiTeamConfiguration: [
      {
        role: 'Brainstormer',
        enabled: true,
        order: 1,
        systemPrompt:
          'You are a creative brainstormer who generates innovative solutions and approaches.',
        modelId: 'gemini-2.5-flash',
      },
      {
        role: 'Planner',
        enabled: true,
        order: 2,
        systemPrompt: 'You are a strategic planner who creates detailed implementation plans.',
        modelId: 'gemini-2.5-flash',
      },
      {
        role: 'Coder',
        enabled: true,
        order: 3,
        systemPrompt:
          'You are an expert coder who implements solutions with clean, efficient code.',
        modelId: 'gemini-2.5-flash',
      },
      {
        role: 'Critic',
        enabled: true,
        order: 4,
        systemPrompt:
          'You are a critical reviewer who identifies potential issues and improvements.',
        modelId: 'gemini-2.5-flash',
      },
    ],
    logVerbosity: 'normal',
  },

  // Plugin System State
  plugins: [],
  pluginErrors: [],

  // Testing Platform State
  testSuites: [],
  mockServices: [],
  benchmarks: [],
  isTestingRunning: false,

  // Cloud Integration State
  cloudIntegrations: [],
  syncStatus: 'idle' as const,

  // Team Collaboration State
  collaborationSessions: [],
  activeCollaborators: [],
  workspaceShares: [],

  // Business Intelligence State
  analyticsData: null,
  teamMetrics: null,
  qualityTrends: [],

  // Security Platform State
  securityReports: [],
  complianceStatus: null,
  vulnerabilityAlerts: [],

  // Advanced Debugging State
  debugSessions: [],
  breakpoints: [],
  watchExpressions: [],

  // Performance Monitoring State
  performanceMetrics: null,
  systemHealth: null,
});

// Production-ready useAppReducer hook with error handling
export const useAppReducer = (
  initialState?: Partial<AppState>,
): [AppState, Dispatch<AppAction>] => {
  const defaultState = getDefaultAppState();
  const mergedState = initialState ? { ...defaultState, ...initialState } : defaultState;

  // Enhanced reducer with error handling
  const enhancedReducer = (state: AppState, action: AppAction): AppState => {
    try {
      const newState = appReducer(state, action);

      // Validate state integrity
      if (!newState || typeof newState !== 'object') {
        console.error('Invalid state returned from reducer:', newState);
        return state; // Return previous state if invalid
      }

      return newState;
    } catch (error) {
      console.error('Error in app reducer:', error, 'Action:', action);
      return state; // Return previous state on error
    }
  };

  return useReducer(enhancedReducer, mergedState);
};
