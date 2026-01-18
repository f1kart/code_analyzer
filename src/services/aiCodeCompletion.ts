import { aiWorkflowEngine } from './aiWorkflowEngine';

export interface CodeCompletionRequest {
  id: string;
  filePath: string;
  language: string;
  content: string;
  cursorPosition: CursorPosition;
  context: CompletionContext;
  timestamp: number;
}

export interface CursorPosition {
  line: number;
  column: number;
  offset: number;
}

export interface CompletionContext {
  precedingText: string;
  followingText: string;
  currentLine: string;
  indentation: string;
  scope: CodeScope;
  imports: ImportStatement[];
  nearbyFunctions: FunctionSignature[];
  variables: VariableInfo[];
  recentEdits: EditHistory[];
}

export interface CodeScope {
  type: 'global' | 'class' | 'function' | 'block' | 'module';
  name?: string;
  parentScope?: CodeScope;
  depth: number;
}

export interface ImportStatement {
  module: string;
  imports: string[];
  isDefault: boolean;
  alias?: string;
}

export interface FunctionSignature {
  name: string;
  parameters: Parameter[];
  returnType?: string;
  documentation?: string;
  location: CodeLocation;
}

export interface Parameter {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface VariableInfo {
  name: string;
  type?: string;
  scope: string;
  value?: any;
  location: CodeLocation;
}

export interface EditHistory {
  timestamp: number;
  type: 'insert' | 'delete' | 'replace';
  position: CursorPosition;
  content: string;
  length: number;
}

export interface CodeLocation {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface CompletionSuggestion {
  id: string;
  text: string;
  displayText: string;
  type: CompletionType;
  priority: number;
  confidence: number;
  insertText: string;
  replaceRange?: TextRange;
  additionalEdits?: TextEdit[];
  documentation?: string;
  detail?: string;
  sortText?: string;
  filterText?: string;
  commitCharacters?: string[];
  aiReasoning?: string;
}

export interface TextRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface TextEdit {
  range: TextRange;
  newText: string;
}

export type CompletionType =
  | 'keyword'
  | 'variable'
  | 'function'
  | 'method'
  | 'property'
  | 'class'
  | 'interface'
  | 'enum'
  | 'module'
  | 'snippet'
  | 'text'
  | 'value'
  | 'constant'
  | 'constructor'
  | 'field'
  | 'file'
  | 'reference'
  | 'folder'
  | 'typeParameter'
  | 'operator'
  | 'unit'
  | 'color'
  | 'event'
  | 'struct';

export interface GhostTextSuggestion {
  id: string;
  text: string;
  position: CursorPosition;
  confidence: number;
  type: 'inline' | 'multiline' | 'block';
  preview: string;
  fullCompletion: string;
  reasoning: string;
  alternatives: string[];
}

export interface CompletionSettings {
  enabled: boolean;
  ghostTextEnabled: boolean;
  autoTriggerEnabled: boolean;
  triggerCharacters: string[];
  maxSuggestions: number;
  minConfidence: number;
  debounceMs: number;
  contextLines: number;
  includeSnippets: boolean;
  includeImports: boolean;
  smartIndentation: boolean;
  caseInsensitive: boolean;
  fuzzyMatching: boolean;
}

export interface CompletionStats {
  totalRequests: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  averageConfidence: number;
  averageLatency: number;
  topLanguages: Record<string, number>;
  topCompletionTypes: Record<string, number>;
  dailyStats: DailyCompletionStats[];
}

export interface DailyCompletionStats {
  date: string;
  requests: number;
  accepted: number;
  rejected: number;
  averageConfidence: number;
}

export class AICodeCompletion {
  private completionCache = new Map<string, CompletionSuggestion[]>();
  private ghostTextCache = new Map<string, GhostTextSuggestion>();
  private requestQueue: CodeCompletionRequest[] = [];
  private isProcessing = false;
  private settings: CompletionSettings;
  private stats: CompletionStats;
  private completionCallbacks = new Set<(suggestions: CompletionSuggestion[]) => void>();
  private ghostTextCallbacks = new Set<(suggestion: GhostTextSuggestion | null) => void>();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.settings = this.getDefaultSettings();
    this.stats = this.loadStats();
    this.startProcessingQueue();
  }

  // Main Completion API
  async requestCompletion(
    request: Omit<CodeCompletionRequest, 'id' | 'timestamp'>,
  ): Promise<CompletionSuggestion[]> {
    if (!this.settings.enabled) return [];

    const completionRequest: CodeCompletionRequest = {
      ...request,
      id: `completion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Check cache first
    const cacheKey = this.getCacheKey(completionRequest);
    const cached = this.completionCache.get(cacheKey);
    if (cached) {
      this.notifyCompletionCallbacks(cached);
      return cached;
    }

    // Add to queue for processing
    this.requestQueue.push(completionRequest);
    this.processQueue();

    // Return empty array immediately, callbacks will provide results
    return [];
  }

  async requestGhostText(
    request: Omit<CodeCompletionRequest, 'id' | 'timestamp'>,
  ): Promise<GhostTextSuggestion | null> {
    if (!this.settings.enabled || !this.settings.ghostTextEnabled) return null;

    const completionRequest: CodeCompletionRequest = {
      ...request,
      id: `ghost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Check cache first
    const cacheKey = this.getCacheKey(completionRequest);
    const cached = this.ghostTextCache.get(cacheKey);
    if (cached) {
      this.notifyGhostTextCallbacks(cached);
      return cached;
    }

    // Generate ghost text suggestion
    const ghostText = await this.generateGhostText(completionRequest);
    if (ghostText) {
      this.ghostTextCache.set(cacheKey, ghostText);
      this.notifyGhostTextCallbacks(ghostText);
    }

    return ghostText;
  }

  // Debounced completion request
  requestCompletionDebounced(request: Omit<CodeCompletionRequest, 'id' | 'timestamp'>): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.requestCompletion(request);
    }, this.settings.debounceMs);
  }

  // Accept/Reject tracking
  acceptSuggestion(suggestionId: string, suggestion: CompletionSuggestion): void {
    this.stats.acceptedSuggestions++;
    this.stats.topCompletionTypes[suggestion.type] =
      (this.stats.topCompletionTypes[suggestion.type] || 0) + 1;
    this.updateDailyStats('accepted');
    this.saveStats();
  }

  rejectSuggestion(suggestionId: string): void {
    this.stats.rejectedSuggestions++;
    this.updateDailyStats('rejected');
    this.saveStats();
  }

  // Queue Processing
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;

      try {
        const suggestions = await this.generateCompletions(request);
        const cacheKey = this.getCacheKey(request);

        this.completionCache.set(cacheKey, suggestions);
        this.notifyCompletionCallbacks(suggestions);

        this.stats.totalRequests++;
        this.stats.topLanguages[request.language] =
          (this.stats.topLanguages[request.language] || 0) + 1;
        this.updateDailyStats('request');
      } catch (error) {
        console.warn('Completion generation failed:', error);
      }
    }

    this.isProcessing = false;
  }

  private startProcessingQueue(): void {
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  // AI Completion Generation
  private async generateCompletions(
    request: CodeCompletionRequest,
  ): Promise<CompletionSuggestion[]> {
    try {
      const prompt = `Generate code completions for this context:

File: ${request.filePath}
Language: ${request.language}
Current Line: ${request.context.currentLine}
Cursor Position: Line ${request.cursorPosition.line}, Column ${request.cursorPosition.column}

Context:
Preceding Text (last 10 lines):
${request.context.precedingText.split('\n').slice(-10).join('\n')}

Following Text (next 5 lines):
${request.context.followingText.split('\n').slice(0, 5).join('\n')}

Scope: ${request.context.scope.type} ${request.context.scope.name || ''}
Available Variables: ${request.context.variables
        .map((v) => `${v.name}: ${v.type}`)
        .slice(0, 10)
        .join(', ')}
Available Functions: ${request.context.nearbyFunctions
        .map((f) => f.name)
        .slice(0, 10)
        .join(', ')}
Imports: ${request.context.imports
        .map((i) => i.module)
        .slice(0, 5)
        .join(', ')}

Provide 5-10 relevant code completion suggestions including:
1. Variable names and function calls
2. Method completions
3. Keyword completions
4. Snippet completions
5. Import suggestions

For each suggestion provide:
- text: the completion text
- type: completion type (variable, function, method, etc.)
- priority: 1-10 (10 = highest)
- confidence: 0-1
- documentation: brief description
- reasoning: why this completion is relevant

Format as JSON array of suggestion objects.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        return this.getFallbackCompletions(request);
      }

      const completionSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Code completion generation' },
        [agent.id],
      );

      const result = this.parseAIResponse(completionSession.result?.finalOutput || '[]');
      const suggestions = (Array.isArray(result) ? result : [result]).map(
        (suggestion: any, index: number) => ({
          id: `suggestion-${request.id}-${index}`,
          text: suggestion.text || '',
          displayText: suggestion.displayText || suggestion.text || '',
          type: suggestion.type || 'text',
          priority: suggestion.priority || 5,
          confidence: suggestion.confidence || 0.5,
          insertText: suggestion.insertText || suggestion.text || '',
          documentation: suggestion.documentation || '',
          detail: suggestion.detail || '',
          aiReasoning: suggestion.reasoning || '',
        }),
      );

      return suggestions.filter((s) => s.text.length > 0).slice(0, this.settings.maxSuggestions);
    } catch (error) {
      console.warn('AI completion generation failed:', error);
      return this.getFallbackCompletions(request);
    }
  }

  private async generateGhostText(
    request: CodeCompletionRequest,
  ): Promise<GhostTextSuggestion | null> {
    try {
      const prompt = `Generate ghost text completion for this code context:

File: ${request.filePath}
Language: ${request.language}
Current Line: ${request.context.currentLine}
Cursor Position: Line ${request.cursorPosition.line}, Column ${request.cursorPosition.column}

Context:
${request.context.precedingText.split('\n').slice(-5).join('\n')}
[CURSOR]
${request.context.followingText.split('\n').slice(0, 3).join('\n')}

Scope: ${request.context.scope.type}
Recent Edits: ${request.context.recentEdits
        .slice(-3)
        .map((e) => e.content)
        .join(', ')}

Generate a single, most likely code completion that would appear as ghost text.
Consider:
1. Code patterns and conventions
2. Variable naming patterns
3. Function call completions
4. Control structure completions
5. Common code idioms

Provide:
- text: the ghost text to display
- confidence: 0-1 confidence score
- type: inline, multiline, or block
- reasoning: why this completion makes sense
- alternatives: 2-3 alternative completions

Format as JSON object.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        return this.getFallbackGhostText(request);
      }

      const ghostSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Ghost text generation' },
        [agent.id],
      );

      const result = this.parseAIResponse(ghostSession.result?.finalOutput || '{}');

      if (!result.text || result.confidence < this.settings.minConfidence) {
        return null;
      }

      return {
        id: `ghost-${request.id}`,
        text: result.text,
        position: request.cursorPosition,
        confidence: result.confidence || 0.5,
        type: result.type || 'inline',
        preview: result.text.split('\n')[0] || result.text,
        fullCompletion: result.text,
        reasoning: result.reasoning || '',
        alternatives: result.alternatives || [],
      };
    } catch (error) {
      console.warn('Ghost text generation failed:', error);
      return this.getFallbackGhostText(request);
    }
  }

  // Fallback Completions
  private getFallbackCompletions(request: CodeCompletionRequest): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];
    const currentWord = this.getCurrentWord(
      request.context.currentLine,
      request.cursorPosition.column,
    );

    // Add variable completions
    request.context.variables.forEach((variable, index) => {
      if (variable.name.toLowerCase().includes(currentWord.toLowerCase())) {
        suggestions.push({
          id: `fallback-var-${index}`,
          text: variable.name,
          displayText: variable.name,
          type: 'variable',
          priority: 7,
          confidence: 0.8,
          insertText: variable.name,
          documentation: `Variable of type ${variable.type || 'unknown'}`,
          detail: variable.type || 'variable',
        });
      }
    });

    // Add function completions
    request.context.nearbyFunctions.forEach((func, index) => {
      if (func.name.toLowerCase().includes(currentWord.toLowerCase())) {
        const params = func.parameters
          .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type || 'any'}`)
          .join(', ');
        suggestions.push({
          id: `fallback-func-${index}`,
          text: func.name,
          displayText: `${func.name}(${params})`,
          type: 'function',
          priority: 8,
          confidence: 0.7,
          insertText: `${func.name}($1)`,
          documentation: func.documentation || `Function ${func.name}`,
          detail: `(${params}) => ${func.returnType || 'void'}`,
        });
      }
    });

    // Add keyword completions based on language
    const keywords = this.getLanguageKeywords(request.language);
    keywords.forEach((keyword, index) => {
      if (keyword.toLowerCase().startsWith(currentWord.toLowerCase())) {
        suggestions.push({
          id: `fallback-keyword-${index}`,
          text: keyword,
          displayText: keyword,
          type: 'keyword',
          priority: 6,
          confidence: 0.9,
          insertText: keyword,
          documentation: `${request.language} keyword`,
          detail: 'keyword',
        });
      }
    });

    return suggestions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.settings.maxSuggestions);
  }

  private getFallbackGhostText(request: CodeCompletionRequest): GhostTextSuggestion | null {
    const currentLine = request.context.currentLine.trim();

    // Simple pattern-based ghost text
    if (currentLine.endsWith('if (')) {
      return {
        id: `fallback-ghost-${request.id}`,
        text: 'condition) {\n    \n}',
        position: request.cursorPosition,
        confidence: 0.6,
        type: 'block',
        preview: 'condition) {',
        fullCompletion: 'condition) {\n    \n}',
        reasoning: 'Completing if statement structure',
        alternatives: ['condition) {', 'condition)\n    '],
      };
    }

    if (currentLine.endsWith('function ')) {
      return {
        id: `fallback-ghost-${request.id}`,
        text: 'name() {\n    \n}',
        position: request.cursorPosition,
        confidence: 0.6,
        type: 'block',
        preview: 'name() {',
        fullCompletion: 'name() {\n    \n}',
        reasoning: 'Completing function declaration',
        alternatives: ['name()', 'name(params) {'],
      };
    }

    return null;
  }

  // Helper Methods
  private getCurrentWord(line: string, column: number): string {
    const beforeCursor = line.substring(0, column);
    const match = beforeCursor.match(/\w+$/);
    return match ? match[0] : '';
  }

  private getLanguageKeywords(language: string): string[] {
    const keywordMap: Record<string, string[]> = {
      javascript: [
        'const',
        'let',
        'var',
        'function',
        'class',
        'if',
        'else',
        'for',
        'while',
        'return',
        'import',
        'export',
      ],
      typescript: [
        'const',
        'let',
        'var',
        'function',
        'class',
        'interface',
        'type',
        'if',
        'else',
        'for',
        'while',
        'return',
        'import',
        'export',
      ],
      python: [
        'def',
        'class',
        'if',
        'elif',
        'else',
        'for',
        'while',
        'return',
        'import',
        'from',
        'try',
        'except',
      ],
      java: [
        'public',
        'private',
        'protected',
        'class',
        'interface',
        'if',
        'else',
        'for',
        'while',
        'return',
        'import',
      ],
      cpp: [
        'int',
        'char',
        'float',
        'double',
        'class',
        'struct',
        'if',
        'else',
        'for',
        'while',
        'return',
        'include',
      ],
    };

    return keywordMap[language] || [];
  }

  private getCacheKey(request: CodeCompletionRequest): string {
    return `${request.filePath}:${request.cursorPosition.line}:${request.cursorPosition.column}:${request.context.currentLine}`;
  }

  private parseAIResponse(response: string): any {
    try {
      const jsonMatch =
        response.match(/```json\n([\s\S]*?)\n```/) ||
        response.match(/\[[\s\S]*\]/) ||
        response.match(/\{[\s\S]*\}/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return [];
    }
  }

  private getDefaultSettings(): CompletionSettings {
    return {
      enabled: true,
      ghostTextEnabled: true,
      autoTriggerEnabled: true,
      triggerCharacters: ['.', '(', '[', ' ', '\n'],
      maxSuggestions: 10,
      minConfidence: 0.3,
      debounceMs: 300,
      contextLines: 20,
      includeSnippets: true,
      includeImports: true,
      smartIndentation: true,
      caseInsensitive: true,
      fuzzyMatching: true,
    };
  }

  private loadStats(): CompletionStats {
    try {
      const saved = localStorage.getItem('ai_completion_stats');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load completion stats:', error);
    }

    return {
      totalRequests: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      averageConfidence: 0,
      averageLatency: 0,
      topLanguages: {},
      topCompletionTypes: {},
      dailyStats: [],
    };
  }

  private saveStats(): void {
    try {
      localStorage.setItem('ai_completion_stats', JSON.stringify(this.stats));
    } catch (error) {
      console.warn('Failed to save completion stats:', error);
    }
  }

  private updateDailyStats(type: 'request' | 'accepted' | 'rejected'): void {
    const today = new Date().toISOString().split('T')[0];
    let dailyStat = this.stats.dailyStats.find((s) => s.date === today);

    if (!dailyStat) {
      dailyStat = {
        date: today,
        requests: 0,
        accepted: 0,
        rejected: 0,
        averageConfidence: 0,
      };
      this.stats.dailyStats.push(dailyStat);
    }

    switch (type) {
      case 'request':
        dailyStat.requests++;
        break;
      case 'accepted':
        dailyStat.accepted++;
        break;
      case 'rejected':
        dailyStat.rejected++;
        break;
    }

    // Keep only last 30 days
    this.stats.dailyStats = this.stats.dailyStats
      .filter((s) => Date.now() - new Date(s.date).getTime() < 30 * 24 * 60 * 60 * 1000)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Event Handling
  onCompletionReady(callback: (suggestions: CompletionSuggestion[]) => void): () => void {
    this.completionCallbacks.add(callback);
    return () => this.completionCallbacks.delete(callback);
  }

  onGhostTextReady(callback: (suggestion: GhostTextSuggestion | null) => void): () => void {
    this.ghostTextCallbacks.add(callback);
    return () => this.ghostTextCallbacks.delete(callback);
  }

  private notifyCompletionCallbacks(suggestions: CompletionSuggestion[]): void {
    this.completionCallbacks.forEach((callback) => {
      try {
        callback(suggestions);
      } catch (error) {
        console.warn('Completion callback failed:', error);
      }
    });
  }

  private notifyGhostTextCallbacks(suggestion: GhostTextSuggestion | null): void {
    this.ghostTextCallbacks.forEach((callback) => {
      try {
        callback(suggestion);
      } catch (error) {
        console.warn('Ghost text callback failed:', error);
      }
    });
  }

  // Public API
  updateSettings(newSettings: Partial<CompletionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): CompletionSettings {
    return { ...this.settings };
  }

  getStats(): CompletionStats {
    return { ...this.stats };
  }

  clearCache(): void {
    this.completionCache.clear();
    this.ghostTextCache.clear();
  }

  clearStats(): void {
    this.stats = {
      totalRequests: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      averageConfidence: 0,
      averageLatency: 0,
      topLanguages: {},
      topCompletionTypes: {},
      dailyStats: [],
    };
    this.saveStats();
  }
}

export const aiCodeCompletion = new AICodeCompletion();
