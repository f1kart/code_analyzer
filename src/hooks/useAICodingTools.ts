import { useState, useCallback } from 'react';
import {
  aiCodingTools,
  CodeAnalysis,
  RefactoringSuggestion,
  TestSuite,
} from '../services/aiCodingTools';
import { useNotifications } from '../components/NotificationSystem';

export type ToolType =
  | 'analyze'
  | 'refactor'
  | 'test'
  | 'document'
  | 'explain'
  | 'optimize'
  | 'review'
  | 'format'
  | 'format-local'
  | 'translate'
  | 'duplicate'
  | 'complete';

export const useAICodingTools = (
  selectedCode: string,
  language: string,
  filePath?: string,
  projectPath?: string
) => {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [translationTarget, setTranslationTarget] = useState('python');
  const [optimizationType, setOptimizationType] = useState<
    'performance' | 'memory' | 'readability' | 'security'
  >('performance');
  const [explanationLevel, setExplanationLevel] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('intermediate');
  const [docType, setDocType] = useState<'function' | 'class' | 'module' | 'api' | 'readme' >(
    'function'
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const { addNotification } = useNotifications();

  const toAbsolutePath = useCallback(
    (relative: string) => {
      if (!projectPath) return relative;
      const normalized = relative.replace(/\\/g, '/');
      const sep = projectPath.endsWith('/') || projectPath.endsWith('\\') ? '' : '/';
      return `${projectPath}${sep}${normalized}`;
    },
    [projectPath]
  );

  const gatherProjectFiles = useCallback(async (): Promise<
    Array<{ identifier: string; content: string }>
  > => {
    const api: any = (window as any).electronAPI;
    if (!api) return [];
    if (projectPath) {
      try {
        const result = await api.getFolderTree?.(projectPath);
        const files: Array<{ identifier: string; content: string }> = [];
        const flatten = (nodes: any[]) => {
          for (const node of nodes || []) {
            if (node.type === 'file') {
              files.push({ identifier: node.path, content: '' });
            }
            if (node.children) flatten(node.children);
          }
        };
        flatten(result?.tree || []);
        const limited = files.slice(0, 100);
        for (const file of limited) {
          try {
            const absolute = toAbsolutePath(file.identifier);
            const res = await api.readFile?.(absolute);
            const content = res?.success ? res.content || '' : '';
            if (content.length > 100000 || content.trim().length === 0) continue;
            file.content = content;
          } catch {
            /* ignore */
          }
        }
        return limited.filter((f) => f.content.trim().length > 0);
      } catch {
        // fallback to active file only
      }
    }
    if (filePath) {
      try {
        const res = await (window as any).electronAPI?.readFile?.(filePath);
        if (res?.success) {
          return [
            {
              identifier: projectPath
                ? filePath.replace(projectPath, '').replace(/^[\\/]/, '')
                : filePath,
              content: res.content || '',
            },
          ];
        }
      } catch {
        /* ignore */
      }
    }
    return [];
  }, [projectPath, filePath, toAbsolutePath]);

  const runTool = useCallback(
    async (toolType: ToolType) => {
      setLocalError(null);

      const requiresCode = !['duplicate'].includes(toolType);
      let codeToUse = selectedCode;
      if (requiresCode) {
        if (!codeToUse.trim() && filePath) {
          try {
            const api: any = (window as any).electronAPI;
            const res = await api?.readFile?.(filePath);
            codeToUse = res?.success ? res.content || '' : '';
          } catch {
            codeToUse = '';
          }
        }
        if (!codeToUse.trim()) {
          try {
            addNotification('warning', 'No Code Available', {
              message: 'Open a file or select code, then try again.',
              duration: 3000,
            });
          } catch {
            /* noop */
          }
          setLocalError(
            'No code available. Open a file or select text in the editor, then try again.'
          );
          return;
        }
      }

      setActiveTool(toolType);
      setIsLoading(true);
      setResults(null);

      try {
        let result;

        switch (toolType) {
          case 'analyze':
            result = await aiCodingTools.analyzeCode(codeToUse, language, filePath);
            break;
          case 'refactor':
            result = await aiCodingTools.suggestRefactoring(codeToUse, language, filePath);
            break;
          case 'test':
            result = await aiCodingTools.generateTests(codeToUse, language, undefined, filePath);
            break;
          case 'document':
            result = await aiCodingTools.generateDocumentation(
              codeToUse,
              language,
              docType,
              'markdown',
              filePath
            );
            break;
          case 'explain':
            result = await aiCodingTools.explainCode(
              codeToUse,
              language,
              explanationLevel,
              filePath
            );
            break;
          case 'optimize':
            result = await aiCodingTools.optimizeCode(
              codeToUse,
              language,
              optimizationType,
              filePath
            );
            break;
          case 'review':
            result = await aiCodingTools.reviewCode(codeToUse, language, filePath);
            break;
          case 'format':
            try {
              result = await aiCodingTools.formatCode(codeToUse, language, undefined, filePath);
              if (!result || (typeof result === 'string' && result.trim().length === 0)) {
                throw new Error('AI formatter returned empty');
              }
            } catch (e) {
              // Fallback to local Prettier via IPC
              try {
                const api: any = (window as any).electronAPI;
                const fmt = await api?.formatContent?.(filePath || 'file.txt', codeToUse);
                if (fmt?.success && typeof fmt.content === 'string') {
                  result = fmt.content;
                } else {
                  throw new Error(fmt?.error || 'Local format failed');
                }
              } catch (err) {
                throw err instanceof Error ? err : new Error('Formatting failed');
              }
            }
            break;
          case 'format-local': {
            const api: any = (window as any).electronAPI;
            const fmt = await api?.formatContent?.(filePath || 'file.txt', codeToUse);
            if (fmt?.success && typeof fmt.content === 'string') {
              result = fmt.content;
            } else {
              throw new Error(fmt?.error || 'Local Prettier format failed');
            }
            break;
          }
          case 'translate':
            result = await aiCodingTools.translateCode(
              codeToUse,
              language,
              translationTarget,
              filePath
            );
            break;
          case 'complete':
            result = await aiCodingTools.suggestCompletion(
              codeToUse,
              codeToUse.length,
              language,
              filePath
            );
            break;
          case 'duplicate': {
            const files = await gatherProjectFiles();
            result = await aiCodingTools.findSimilarCodeAcrossProject(files, {}, undefined);
            break;
          }
        }

        setResults(result);
        addNotification('success', 'Analysis Complete', {
          message: `Tool completed successfully`,
          duration: 2000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        try {
          addNotification('error', 'Analysis Failed', { message, duration: 3000 });
        } catch {
          /* noop */
        }
        setLocalError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedCode,
      language,
      filePath,
      translationTarget,
      optimizationType,
      explanationLevel,
      docType,
      addNotification,
      gatherProjectFiles,
    ]
  );

  return {
    activeTool,
    isLoading,
    results,
    localError,
    runTool,
    translationTarget,
    setTranslationTarget,
    optimizationType,
    setOptimizationType,
    explanationLevel,
    setExplanationLevel,
    docType,
    setDocType,
  };
};
