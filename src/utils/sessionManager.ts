import {
  AITeamRefactorResult,
  RefactorResult,
  Message,
  SimilarityResult,
  RootCauseAnalysisResult,
  AITeamProjectResult,
} from '../services/geminiService';
import { HistoryState } from '../hooks/useHistoryState';

// Re-export Message type for other modules to import from sessionManager
export type { Message, RootCauseAnalysisResult };

const SESSION_STORAGE_KEY = 'geminiCodeIDESession';

export interface AppFile {
  name: string;
  content: string;
  identifier: string;
}

// Export CodeSnippet interface to be used in other modules
export interface CodeSnippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
}

export interface ModelConfig {
  id: string;
  name: string;
  isLocal: boolean;
}

export interface DesktopSettings {
  fileSystem: boolean;
  database: boolean;
}

export interface AIToolSettings {
  webSearch: boolean;
  projectSearch: boolean;
  editFile: boolean;
  createFile: boolean;
  runTerminalCommand: boolean;
  visualSnapshot: boolean;
  autoRunTools: boolean;
  analyzeDependencies: boolean;
  projectWideRefactor: boolean;
  generateDocs: boolean;
}

export interface AgentConfig {
  role:
    | 'Brainstormer'
    | 'Planner'
    | 'Coder'
    | 'SecurityAnalyst'
    | 'Critic'
    | 'ErrorChecker'
    | 'FeatureComplete'
    | 'Optimizer'
    | 'Integrator';
  enabled: boolean;
  order: number;
  systemPrompt: string;
  modelId: string;
}

export type LogVerbosity = 'normal' | 'debug';

export interface AppSettings {
  aiPersona: string;
  customRules: string;
  explorerStyle: 'list' | 'tree';
  availableModels: ModelConfig[];
  desktopSettings: DesktopSettings;
  aiTools: AIToolSettings;
  aiTeamConfiguration: AgentConfig[];
  logVerbosity: LogVerbosity;
}

export interface UIPreferences {
  rightPanelMode?: 'tools' | 'chat' | 'enterprise';
  rightPanelLayout?: 'tabs' | 'split';
  rightPanelWidth?: number;
  innerSplitRatio?: number;
}

export interface SessionState {
  appSettings: AppSettings;
  projectPath: string | null;
  uploadedFiles: AppFile[];
  codeSnippets: CodeSnippet[];
  activeFileIdentifier: string | null;
  selectedFileIdentifiers: string[];
  refactoredFiles: string[];
  originalCode: string;
  refactorResult: RefactorResult | null;
  aiTeamRefactorResult: AITeamRefactorResult | null;
  aiTeamProjectResult: AITeamProjectResult | null;
  similarityResults: SimilarityResult | null;
  rootCauseAnalysisResult: RootCauseAnalysisResult | null;
  editedRefactoredCodeHistory: HistoryState<string> | null;
  refactoringGoals: string[];
  lastAction: string | null;
  explanation: string | null;
  placeholderSummary: string | null;
  chatHistory: Message[];
  selectedModelId: string;
  ui?: UIPreferences;
}

const getDefaultState = (): SessionState => ({
  appSettings: {
    aiPersona:
      "You are an expert AI programming assistant, a Socratic tutor. Your primary goal is to help the user understand and improve their code. You should guide them with questions and explain the 'why' behind your suggestions.",
    customRules:
      "1. Always provide clear, concise explanations.\n2. When refactoring, prioritize readability and maintainability.\n3. If you're unsure about something, ask for clarification.",
    explorerStyle: 'list',
    availableModels: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)', isLocal: false },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isLocal: false },
      { id: 'gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Stable)', isLocal: false },
      { id: 'ollama-llama3', name: 'Llama 3 (Ollama)', isLocal: true },
      { id: 'ollama-codellama', name: 'Code Llama (Ollama)', isLocal: true },
      { id: 'ollama-mistral', name: 'Mistral (Ollama)', isLocal: true },
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
      runTerminalCommand: true,
      visualSnapshot: true,
      autoRunTools: true,
      analyzeDependencies: true,
      projectWideRefactor: true,
      generateDocs: true,
    },
    aiTeamConfiguration: [
      { role: 'Brainstormer', enabled: true, order: 0, systemPrompt: '', modelId: '' },
      { role: 'Planner', enabled: true, order: 1, systemPrompt: '', modelId: '' },
      { role: 'Coder', enabled: true, order: 2, systemPrompt: '', modelId: '' },
      { role: 'FeatureComplete', enabled: false, order: 3, systemPrompt: '', modelId: '' },
      { role: 'Optimizer', enabled: false, order: 4, systemPrompt: '', modelId: '' },
      { role: 'SecurityAnalyst', enabled: false, order: 5, systemPrompt: '', modelId: '' },
      { role: 'Critic', enabled: true, order: 6, systemPrompt: '', modelId: '' },
      { role: 'ErrorChecker', enabled: true, order: 7, systemPrompt: '', modelId: '' },
      { role: 'Integrator', enabled: true, order: 99, systemPrompt: '', modelId: '' }, // Integrator should always be last
    ],
    logVerbosity: 'normal',
  },
  projectPath: null,
  uploadedFiles: [],
  codeSnippets: [],
  activeFileIdentifier: null,
  selectedFileIdentifiers: [],
  refactoredFiles: [],
  originalCode: '',
  refactorResult: null,
  aiTeamRefactorResult: null,
  aiTeamProjectResult: null,
  similarityResults: null,
  rootCauseAnalysisResult: null,
  editedRefactoredCodeHistory: null,
  refactoringGoals: [],
  lastAction: null,
  explanation: null,
  placeholderSummary: null,
  chatHistory: [],
  selectedModelId: 'gemini-2.5-flash',
  ui: {
    rightPanelMode: 'tools',
    rightPanelLayout: 'tabs',
    rightPanelWidth: 360,
    innerSplitRatio: 0.5,
  },
});

export const saveSession = (state: SessionState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(SESSION_STORAGE_KEY, serializedState);
  } catch (error) {
    console.error('Could not save session to local storage:', error);
  }
};

export const loadSession = (): SessionState => {
  try {
    const serializedState = localStorage.getItem(SESSION_STORAGE_KEY);
    if (serializedState === null) {
      return getDefaultState();
    }
    const defaultState = getDefaultState();
    const parsedState = JSON.parse(serializedState);

    const mergedSettings = {
      ...defaultState.appSettings,
      ...(parsedState.appSettings || {}),
      aiTeamConfiguration: parsedState.appSettings?.aiTeamConfiguration
        ? parsedState.appSettings.aiTeamConfiguration.map((agent: any) => ({
            ...defaultState.appSettings.aiTeamConfiguration.find((d) => d.role === agent.role),
            ...agent,
          }))
        : defaultState.appSettings.aiTeamConfiguration,
    };

    const mergedUI: UIPreferences = {
      ...defaultState.ui,
      ...(parsedState.ui || {}),
    };

    return { ...defaultState, ...parsedState, appSettings: mergedSettings, ui: mergedUI };
  } catch (error) {
    console.error('Could not load session from local storage:', error);
    return getDefaultState();
  }
};

export const clearSession = (): void => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Could not clear session from local storage:', error);
  }
};
