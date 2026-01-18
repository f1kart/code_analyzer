import { AppSettings, AppFile, CodeSnippet } from '../utils/sessionManager';
import { isDesktopApp } from '../utils/env';
import { Part } from '@google/genai';

// --- TYPE DEFINITIONS ---

export interface RefactorResult {
  summary: string;
  refactoredCode: string;
}

export interface AITeamRefactorStep {
  role: string;
  content: string;
}

export interface AITeamRefactorResult {
  steps: AITeamRefactorStep[];
  summary: string;
  refactoredCode: string;
  clarificationNeeded?: string;
}

export interface AITeamProjectResult {
  overallSummary: string;
  files: {
    identifier: string;
    refactoredCode: string;
    summary: string;
  }[];
}

export interface SuggestedSnippetResult {
  reasoning: string;
  snippets: CodeSnippet[];
}

export interface RootCauseAnalysisResult {
  explanation: string;
  culprit: {
    fileIdentifier: string;
    lineNumber: number;
    codeSnippet: string;
    language: string;
  };
  fix: {
    originalCode: string;
    refactoredCode: string;
  };
}

export interface TestFileResult {
  testFilePath: string;
  testFileContent: string;
}

export interface SnapshotDescription {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  fontSize?: string;
  fontWeight?: string;
  layout?: string;
  text?: string;
}

export interface SnapshotResult {
  before: SnapshotDescription;
  after: SnapshotDescription;
}

export interface AgentWorkflowState {
  goal: string;
  plan: string[];
}

export interface Message {
  author: 'user' | 'model' | 'ai' | 'system';
  content: string;
  image?: string;
  toolUse?: { name: string; input: any };
  searchResults?: any[];
  terminalOutput?: { command: string; output: string };
  suggestedSnippets?: CodeSnippet[];
}
export interface ChatMessage {
  role: 'user' | 'model';
  parts: Part[];
}

export interface SimilarityResult {
  groups: {
    fileIdentifiers: string[];
    reasoning: string;
    keyDifferences: string;
  }[];
}

export interface ProjectSearchResult {
  fileIdentifier: string;
  lineNumber: number;
  snippet: string;
  reasoning: string;
}

// --- Electron API Bridge ---
interface GeminiAPI {
  chat: (history: ChatMessage[], settings: AppSettings, modelId: string) => Promise<string>;
  explainCode: (code: string, language: string) => Promise<string>;
  summarizePlaceholders: (code: string, language: string) => Promise<string>;
  refactorCode: (
    code: string,
    language: string,
    goals: string[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<RefactorResult>;
  aiTeamRefactorCode: (
    code: string,
    language: string,
    goals: string[],
    settings: AppSettings,
    fileIdentifier: string,
    selectedModelId: string,
  ) => Promise<AITeamRefactorResult>;
  continueAITeamRefactor: (
    code: string,
    language: string,
    goals: string[],
    settings: AppSettings,
    fileIdentifier: string,
    selectedModelId: string,
  ) => Promise<AITeamRefactorResult>;
  aiTeamProjectRefactor: (
    files: AppFile[],
    goals: string[],
    settings: AppSettings,
    selectedModelId: string,
  ) => Promise<AITeamProjectResult>;
  suggestSnippets: (
    userQuery: string,
    activeCode: string,
    savedSnippets: CodeSnippet[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<SuggestedSnippetResult>;
  findSimilarCode: (
    files: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<SimilarityResult>;
  debugError: (
    errorMessage: string,
    relevantFiles: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<RootCauseAnalysisResult>;
  generateUnitTests: (
    file: AppFile,
    settings: AppSettings,
    modelId: string,
  ) => Promise<TestFileResult>;
  generateDocumentation: (file: AppFile, settings: AppSettings, modelId: string) => Promise<string>;
  analyzeDependencies: (
    files: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<string>;
  projectSearch: (
    files: AppFile[],
    query: string,
    settings: AppSettings,
    modelId: string,
  ) => Promise<ProjectSearchResult[]>;
}

const getApi = (): GeminiAPI => {
  if (!isDesktopApp()) {
    const errorFn = () => {
      throw new Error('AI features require the desktop application environment.');
    };
    return new Proxy({}, { get: () => errorFn }) as GeminiAPI;
  }
  return (window as any).electronAPI.gemini;
};

// --- API Functions ---

export const chat = async (
  history: ChatMessage[],
  settings: AppSettings,
  modelId: string,
): Promise<string> => {
  return getApi().chat(history, settings, modelId);
};

export const explainCode = async (code: string, language: string): Promise<string> => {
  return getApi().explainCode(code, language);
};

export const summarizePlaceholders = async (code: string, language: string): Promise<string> => {
  return getApi().summarizePlaceholders(code, language);
};

export const continueAITeamRefactor = async (
  code: string,
  language: string,
  goals: string[],
  settings: AppSettings,
  fileIdentifier: string,
  selectedModelId: string,
): Promise<AITeamRefactorResult> => {
  return getApi().continueAITeamRefactor(
    code,
    language,
    goals,
    settings,
    fileIdentifier,
    selectedModelId,
  );
};

export const aiTeamRefactorCode = async (
  code: string,
  language: string,
  goals: string[],
  settings: AppSettings,
  fileIdentifier: string,
  selectedModelId: string,
): Promise<AITeamRefactorResult> => {
  return getApi().aiTeamRefactorCode(
    code,
    language,
    goals,
    settings,
    fileIdentifier,
    selectedModelId,
  );
};

export const aiTeamProjectRefactor = async (
  files: AppFile[],
  goals: string[],
  settings: AppSettings,
  selectedModelId: string,
): Promise<AITeamProjectResult> => {
  return getApi().aiTeamProjectRefactor(files, goals, settings, selectedModelId);
};

export const refactorCode = async (
  code: string,
  language: string,
  goals: string[],
  settings: AppSettings,
  modelId: string,
): Promise<RefactorResult> => {
  return getApi().refactorCode(code, language, goals, settings, modelId);
};

export const suggestSnippets = async (
  userQuery: string,
  activeCode: string,
  savedSnippets: CodeSnippet[],
  settings: AppSettings,
  modelId: string,
): Promise<SuggestedSnippetResult> => {
  return getApi().suggestSnippets(userQuery, activeCode, savedSnippets, settings, modelId);
};

export const findSimilarCode = async (
  files: AppFile[],
  settings: AppSettings,
  modelId: string,
): Promise<SimilarityResult> => {
  return getApi().findSimilarCode(files, settings, modelId);
};

export const debugError = async (
  errorMessage: string,
  relevantFiles: AppFile[],
  settings: AppSettings,
  modelId: string,
): Promise<RootCauseAnalysisResult> => {
  return getApi().debugError(errorMessage, relevantFiles, settings, modelId);
};

export const generateUnitTests = async (
  file: AppFile,
  settings: AppSettings,
  modelId: string,
): Promise<TestFileResult> => {
  return getApi().generateUnitTests(file, settings, modelId);
};

export const generateDocumentation = async (
  file: AppFile,
  settings: AppSettings,
  modelId: string,
): Promise<string> => {
  return getApi().generateDocumentation(file, settings, modelId);
};

export const analyzeDependencies = async (
  files: AppFile[],
  settings: AppSettings,
  modelId: string,
): Promise<string> => {
  return getApi().analyzeDependencies(files, settings, modelId);
};

export const projectSearch = async (
  files: AppFile[],
  query: string,
  settings: AppSettings,
  modelId: string,
): Promise<ProjectSearchResult[]> => {
  return getApi().projectSearch(files, query, settings, modelId);
};

// The functions below are not used by the current UI but their types might be, so we keep the types but remove the dummy functions.
// This is to avoid confusion and make it clear what is and isn't implemented.
export const continueChatWithToolResults = async (
  history: any[],
  toolResults: any[],
  config: any,
): Promise<{ newHistory: Message[] }> => {
  throw new Error('Not implemented');
};
export const runProjectTaskAgent = async (
  goal: string,
  files: AppFile[],
  toolImplementations: any,
  settings: AppSettings,
  onUpdate: any,
): Promise<any> => {
  throw new Error('Not implemented');
};
