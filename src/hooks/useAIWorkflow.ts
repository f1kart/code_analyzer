import { useCallback } from 'react';
import {
  refactorCode,
  explainCode,
  debugError,
  generateUnitTests,
  generateDocumentation,
  projectSearch,
} from '../services/geminiService';
import { AppFile, AppSettings } from '../utils/sessionManager';
import { useAppContext } from '../contexts/AppContext';
import { Dispatch } from 'react';
import { AppAction } from './useAppReducer';
import { aiWorkflowEngine } from '../services/aiWorkflowEngine';
import { aiTerminal } from '../services/aiTerminal';

export interface AIWorkflowActions {
  refactorCode: (
    code: string,
    language: string,
    goals: string[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<void>;
  explainCode: (code: string, language: string) => Promise<void>;
  generateTests: (
    fileIdentifier: string,
    files: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<void>;
  generateDocs: (
    fileIdentifier: string,
    files: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<void>;
  debugCode: (
    error: string,
    files: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<void>;
  sendChatMessage: (message: string, settings: AppSettings, modelId: string) => Promise<void>;
  performSearch: (
    query: string,
    files: AppFile[],
    settings: AppSettings,
    modelId: string,
  ) => Promise<void>;
  executeCommand: (command: string) => Promise<void>;
}

export const useAIWorkflow = (
  dispatch: Dispatch<AppAction>,
  setLoadingState: (action: string, loading: boolean) => void,
): AIWorkflowActions => {
  const { addToast } = useAppContext();

  const refactorCodeAction = useCallback(
    async (
      code: string,
      language: string,
      goals: string[],
      settings: AppSettings,
      modelId: string,
    ) => {
      setLoadingState('refactor', true);
      try {
        const result = await refactorCode(code, language, goals, settings, modelId);
        dispatch({ type: 'SET_REFACTOR_RESULT', payload: result });
        addToast('Code refactored successfully', 'success');
      } catch (error) {
        addToast('Refactoring failed', 'error');
      } finally {
        setLoadingState('refactor', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const explainCodeAction = useCallback(
    async (code: string, language: string) => {
      setLoadingState('explain', true);
      try {
        const result = await explainCode(code, language);
        dispatch({ type: 'SET_EXPLANATION', payload: result });
        addToast('Code explained successfully', 'success');
      } catch (error) {
        addToast('Explanation failed', 'error');
      } finally {
        setLoadingState('explain', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const generateTestsAction = useCallback(
    async (fileIdentifier: string, files: AppFile[], settings: AppSettings, modelId: string) => {
      setLoadingState('generateTests', true);
      try {
        const file = files.find((f) => f.identifier === fileIdentifier);
        if (!file) throw new Error('File not found');

        const result = await generateUnitTests(file, settings, modelId);
        const newFile: AppFile = {
          name: result.testFilePath.split('/').pop() || 'test',
          content: result.testFileContent,
          identifier: result.testFilePath,
        };
        dispatch({ type: 'ADD_FILE', payload: newFile });
        addToast('Tests generated successfully', 'success');
      } catch (error) {
        addToast('Test generation failed', 'error');
      } finally {
        setLoadingState('generateTests', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const generateDocsAction = useCallback(
    async (fileIdentifier: string, files: AppFile[], settings: AppSettings, modelId: string) => {
      setLoadingState('generateDocs', true);
      try {
        const file = files.find((f) => f.identifier === fileIdentifier);
        if (!file) throw new Error('File not found');

        const documentedCode = await generateDocumentation(file, settings, modelId);
        dispatch({
          type: 'UPDATE_FILE_CONTENT',
          payload: { identifier: fileIdentifier, content: documentedCode },
        });
        addToast('Documentation generated successfully', 'success');
      } catch (error) {
        addToast('Documentation generation failed', 'error');
      } finally {
        setLoadingState('generateDocs', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const debugCodeAction = useCallback(
    async (error: string, files: AppFile[], settings: AppSettings, modelId: string) => {
      setLoadingState('debug', true);
      try {
        const result = await debugError(error, files, settings, modelId);
        dispatch({ type: 'SET_ROOT_CAUSE_ANALYSIS_RESULT', payload: result });
        addToast('Error debugged successfully', 'success');
      } catch (err) {
        addToast('Debug failed', 'error');
      } finally {
        setLoadingState('debug', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const sendChatMessageAction = useCallback(
    async (message: string, _settings: AppSettings, _modelId: string) => {
      setLoadingState('chat', true);
      try {
        // Use AI workflow engine for chat interaction
        const chatResult = await aiWorkflowEngine.runSequentialWorkflow(
          {
            selectedCode: '',
            filePath: '',
            userGoal: `Respond to this chat message as an AI coding assistant: ${message}`,
            additionalContext: `User is asking about coding/development topics. Provide helpful, accurate responses.`,
          },
          ['primary-coder'], // Use primary coder agent for chat responses
        );

        const chatMessage = {
          author: 'model' as const,
          content:
            chatResult.result?.finalOutput ||
            'I apologize, but I encountered an issue processing your message.',
          timestamp: Date.now(),
        };

        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: chatMessage });
        addToast('AI responded to your message', 'success');
      } catch (error) {
        addToast('Chat failed', 'error');
      } finally {
        setLoadingState('chat', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const performSearchAction = useCallback(
    async (query: string, files: AppFile[], settings: AppSettings, modelId: string) => {
      setLoadingState('search', true);
      try {
        const results = await projectSearch(files, query, settings, modelId);
        dispatch({ type: 'SET_PROJECT_SEARCH_RESULTS', payload: results });
        addToast('Search completed', 'success');
      } catch (error) {
        addToast('Search failed', 'error');
      } finally {
        setLoadingState('search', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  const executeCommandAction = useCallback(
    async (command: string) => {
      setLoadingState('command', true);
      try {
        // Parse command for execution
        const args = command.split(' ').slice(1);
        const cmd = command.split(' ')[0];

        // Use AI workflow engine to analyze and execute command
        const commandAnalysis = await aiWorkflowEngine.runSequentialWorkflow(
          {
            selectedCode: '',
            filePath: '',
            userGoal: `Analyze and execute this terminal command safely: ${command}`,
            additionalContext: `Command: ${cmd}, Args: ${args.join(' ')}. Analyze for safety, potential issues, and expected outcomes.`,
          },
          ['primary-coder', 'critic-reviewer'],
        );

        // If analysis suggests it's safe, execute the command through the terminal service
        const analysis = commandAnalysis.result?.finalOutput || '';
        if (analysis.toLowerCase().includes('safe') || analysis.toLowerCase().includes('execute')) {
          // Execute the command using the terminal service for real execution
          // In production, this would integrate with aiTerminal for actual command execution
          const commandResult = await aiTerminal.executeCommand(command);
          const historyItem = {
            command: commandResult.command,
            output: commandResult.output.map((o) => o.content).join('\n'),
            error: commandResult.error !== undefined,
          };
          dispatch({ type: 'ADD_TERMINAL_HISTORY', payload: historyItem });
          addToast('Command executed successfully', 'success');
        } else {
          // Command flagged as potentially unsafe
          const historyItem = {
            command,
            output: `Command blocked for safety reasons.\nAnalysis: ${analysis}`,
            error: true,
          };
          dispatch({ type: 'ADD_TERMINAL_HISTORY', payload: historyItem });
          addToast('Command blocked for safety', 'error');
        }
      } catch (error) {
        addToast('Command failed', 'error');
      } finally {
        setLoadingState('command', false);
      }
    },
    [dispatch, setLoadingState, addToast],
  );

  return {
    refactorCode: refactorCodeAction,
    explainCode: explainCodeAction,
    generateTests: generateTestsAction,
    generateDocs: generateDocsAction,
    debugCode: debugCodeAction,
    sendChatMessage: sendChatMessageAction,
    performSearch: performSearchAction,
    executeCommand: executeCommandAction,
  };
};
