import { aiWorkflowEngine } from './aiWorkflowEngine';

export interface CodeAnalysis {
  complexity: number;
  maintainabilityIndex: number;
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  technicalDebt: string[];
  suggestions: string[];
}

export interface RefactoringSuggestion {
  id: string;
  type: 'extract_method' | 'rename' | 'simplify' | 'optimize' | 'pattern' | 'structure';
  title: string;
  description: string;
  originalCode: string;
  refactoredCode: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  benefits: string[];
  risks: string[];
}

export interface TestSuite {
  id: string;
  framework: string;
  testCases: TestCase[];
  coverage: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  mockData: any[];
  setupCode: string;
  teardownCode: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  code: string;
  expectedResult: string;
  mockRequirements: string[];
}

export interface Documentation {
  id: string;
  type: 'function' | 'class' | 'module' | 'api' | 'readme';
  title: string;
  content: string;
  format: 'markdown' | 'jsdoc' | 'sphinx' | 'javadoc';
  sections: DocumentationSection[];
  examples: CodeExample[];
}

export interface DocumentationSection {
  title: string;
  content: string;
  subsections?: DocumentationSection[];
}

export interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: string;
  output?: string;
}

export interface CodeExplanation {
  id: string;
  summary: string;
  purpose: string;
  algorithm: string;
  complexity: string;
  dependencies: string[];
  parameters: ParameterExplanation[];
  returnValue: string;
  sideEffects: string[];
  examples: CodeExample[];
  relatedConcepts: string[];
}

export interface ParameterExplanation {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export interface CodeOptimization {
  id: string;
  type: 'performance' | 'memory' | 'readability' | 'security';
  title: string;
  description: string;
  originalCode: string;
  optimizedCode: string;
  improvement: {
    metric: string;
    before: string;
    after: string;
    percentage: number;
  };
  explanation: string;
  tradeoffs: string[];
}

export interface CodeReview {
  id: string;
  overall: {
    score: number;
    summary: string;
    recommendation: 'approve' | 'request_changes' | 'needs_discussion';
  };
  issues: CodeReviewIssue[];
  strengths: string[];
  suggestions: string[];
  securityConcerns: string[];
  performanceNotes: string[];
}

export interface CodeReviewIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: 'bug' | 'security' | 'performance' | 'style' | 'maintainability';
  title: string;
  description: string;
  line?: number;
  column?: number;
  suggestion: string;
  autoFixAvailable: boolean;
}

export class AICodingTools {
  private analysisCache = new Map<string, CodeAnalysis>();
  private refactoringCache = new Map<string, RefactoringSuggestion[]>();
  private testCache = new Map<string, TestSuite>();
  private docCache = new Map<string, Documentation>();

  // Helper Methods for Gemini API Interaction

  /**
   * Centralized Gemini API access with availability check
   */
  private async _getGeminiApi(): Promise<any | null> {
    const api: any = (window as any).electronAPI;
    if (!api?.gemini) return null;

    try {
      const aiAvail = await api.gemini.isAvailable?.();
      return aiAvail?.available ? api : null;
    } catch (error) {
      console.warn('Gemini API availability check failed:', error);
      return null;
    }
  }

  /**
   * Standardized Gemini chat call for JSON responses
   */
  private async _callGeminiChatWithJson<T>(
    prompt: string,
    modelId: string = 'gemini-2.5-flash',
    filePath?: string
  ): Promise<T> {
    const api = await this._getGeminiApi();
    if (!api?.gemini?.chat) {
      // Fallback to generic AI workflow
      const result = await this.callAI(prompt, filePath);
      return this.parseJSONResponse(result) as T;
    }

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const result = await api.gemini.chat(contents, {}, modelId);
    return this.parseJSONResponse(result) as T;
  }

  /**
   * Standardized call for specialized Gemini API methods
   */
  private async _callGeminiSpecificMethod<T>(
    methodName: string,
    args: any[],
    modelId: string = 'gemini-2.5-flash'
  ): Promise<T | null> {
    const api = await this._getGeminiApi();
    if (!api?.gemini?.[methodName]) return null;

    try {
      return await api.gemini[methodName](...args, {}, modelId);
    } catch (error) {
      console.warn(`Gemini ${methodName} call failed:`, error);
      return null;
    }
  }

  // Code Analysis
  async analyzeCode(code: string, language: string, filePath?: string): Promise<CodeAnalysis> {
    const cacheKey = `${language}:${this.hashCode(code)}`;

    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    try {
      const prompt = `Analyze this ${language} code and provide detailed metrics:

\`\`\`${language}
${code}
\`\`\`

Please provide:
1. Complexity metrics (cyclomatic, cognitive)
2. Maintainability index (0-100)
3. Lines of code count
4. Technical debt identification
5. Improvement suggestions

Format as JSON with the following structure:
{
  "complexity": number,
  "maintainabilityIndex": number,
  "linesOfCode": number,
  "cyclomaticComplexity": number,
  "cognitiveComplexity": number,
  "technicalDebt": ["debt1", "debt2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

      const analysis = await this._callGeminiChatWithJson<CodeAnalysis>(prompt, 'gemini-2.5-flash', filePath);

      this.analysisCache.set(cacheKey, analysis);
      return analysis;
    } catch (error) {
      console.error('Code analysis failed:', error);
      return this.getDefaultAnalysis(code);
    }
  }

  // Code Refactoring
  async suggestRefactoring(
    code: string,
    language: string,
    filePath?: string,
    context?: string,
  ): Promise<RefactoringSuggestion[]> {
    const cacheKey = `refactor:${language}:${this.hashCode(code)}`;

    if (this.refactoringCache.has(cacheKey)) {
      return this.refactoringCache.get(cacheKey)!;
    }

    try {
      // Try Gemini refactorCode method first
      const geminiResult = await this._callGeminiSpecificMethod<any>(
        'refactorCode',
        [code, language, [], {}, 'gemini-2.5-flash']
      );

      if (geminiResult?.refactoredCode && geminiResult?.summary) {
        const suggestions = [
          {
            id: `refactor-${Date.now()}-0`,
            type: 'structure' as const,
            title: 'AI Refactor',
            description: geminiResult.summary,
            originalCode: code,
            refactoredCode: geminiResult.refactoredCode,
            confidence: 0.75,
            impact: 'medium' as const,
            benefits: [geminiResult.summary], // Populate benefits with summary
            risks: [],
          },
        ] as RefactoringSuggestion[];
        this.refactoringCache.set(cacheKey, suggestions);
        return suggestions;
      }

      // Fallback to generic prompt-based refactoring
      const prompt = `Analyze this ${language} code and suggest refactoring improvements:

\`\`\`${language}
${code}
\`\`\`

${context ? `Context: ${context}` : ''}

Provide refactoring suggestions focusing on:
1. Extract method opportunities
2. Variable/function renaming
3. Code simplification
4. Performance optimizations
5. Design pattern applications
6. Structure improvements

For each suggestion, provide:
- Type of refactoring
- Clear description
- Original and refactored code
- Confidence level (0-1)
- Impact assessment
- Benefits and risks

Format as JSON array of refactoring objects.`;

      const suggestions = await this._callGeminiChatWithJson<RefactoringSuggestion[]>(prompt, 'gemini-2.5-flash', filePath);

      // Add IDs to suggestions
      suggestions.forEach((suggestion, index) => {
        suggestion.id = `refactor-${Date.now()}-${index}`;
      });

      this.refactoringCache.set(cacheKey, suggestions);
      return suggestions;
    } catch (error) {
      console.error('Refactoring suggestion failed:', error);
      return [];
    }
  }

  // Test Generation
  async generateTests(
    code: string,
    language: string,
    framework?: string,
    filePath?: string,
  ): Promise<TestSuite> {
    const cacheKey = `test:${language}:${framework}:${this.hashCode(code)}`;

    if (this.testCache.has(cacheKey)) {
      return this.testCache.get(cacheKey)!;
    }

    try {
      // Try Gemini generateUnitTests method first
      const geminiResult = await this._callGeminiSpecificMethod<any>(
        'generateUnitTests',
        [{ identifier: filePath || 'snippet', content: code }, {}, 'gemini-2.5-flash']
      );

      if (geminiResult?.testFileContent) {
        const suite: TestSuite = {
          id: `test-${Date.now()}`,
          framework: framework || this.getDefaultTestFramework(language),
          testCases: [
            {
              id: 't1',
              name: 'Generated',
              description: 'AI generated tests',
              type: 'unit',
              code: geminiResult.testFileContent,
              expectedResult: '',
              mockRequirements: [],
            },
          ],
          coverage: { lines: 0, functions: 0, branches: 0, statements: 0 },
          mockData: [],
          setupCode: '',
          teardownCode: '',
        };
        this.testCache.set(cacheKey, suite);
        return suite;
      }

      // Fallback to generic prompt-based test generation
      const testFramework = framework || this.getDefaultTestFramework(language);

      const prompt = `Generate comprehensive tests for this ${language} code using ${testFramework}:

\`\`\`${language}
${code}
\`\`\`

Create:
1. Unit tests for all functions/methods
2. Integration tests for complex interactions
3. Edge case tests
4. Error handling tests
5. Mock data where needed
6. Setup and teardown code

Include:
- Test descriptions
- Expected results
- Mock requirements
- Coverage estimation
- Test organization

Format as JSON test suite object.`;

      const testSuite = await this._callGeminiChatWithJson<TestSuite>(prompt, 'gemini-2.5-flash', filePath);

      testSuite.id = `test-${Date.now()}`;
      testSuite.framework = testFramework;

      this.testCache.set(cacheKey, testSuite);
      return testSuite;
    } catch (error) {
      console.error('Test generation failed:', error);
      return this.getDefaultTestSuite(language, framework);
    }
  }

  // Documentation Generation
  async generateDocumentation(
    code: string,
    language: string,
    type: Documentation['type'] = 'function',
    format: Documentation['format'] = 'markdown',
    filePath?: string,
  ): Promise<Documentation> {
    const cacheKey = `doc:${language}:${type}:${format}:${this.hashCode(code)}`;

    if (this.docCache.has(cacheKey)) {
      return this.docCache.get(cacheKey)!;
    }

    try {
      // Try Gemini generateDocumentation method first
      const geminiResult = await this._callGeminiSpecificMethod<string>(
        'generateDocumentation',
        [{ identifier: filePath || 'snippet', content: code }, {}, 'gemini-2.5-flash']
      );

      if (geminiResult) {
        return {
          id: `doc-${Date.now()}`,
          type,
          title: 'Documentation',
          content: geminiResult,
          format,
          sections: [],
          examples: [],
        };
      }

      // Fallback to generic prompt-based documentation
      const prompt = `Generate comprehensive ${format} documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Create ${type} documentation including:
1. Clear title and description
2. Purpose and functionality
3. Parameters and return values
4. Usage examples
5. Code samples
6. Best practices
7. Related concepts
8. API reference (if applicable)

Format as ${format} with proper structure and examples.
Provide as JSON object with sections and examples arrays.`;

      const doc = await this._callGeminiChatWithJson<Documentation>(prompt, 'gemini-2.5-flash', filePath);

      doc.id = `doc-${Date.now()}`;
      doc.type = type;
      doc.format = format;

      this.docCache.set(cacheKey, doc);
      return doc;
    } catch (error) {
      console.error('Documentation generation failed:', error);
      return this.getDefaultDocumentation(type, format);
    }
  }

  // Code Explanation
  async explainCode(
    code: string,
    language: string,
    level: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
    filePath?: string,
  ): Promise<CodeExplanation> {
    try {
      const prompt = `Explain this ${language} code at ${level} level as JSON with the required fields.\n\n\`\`\`${language}\n${code}\n\`\`\``;

      const explanation = await this._callGeminiChatWithJson<CodeExplanation>(prompt, 'gemini-2.5-flash', filePath);

      explanation.id = `explain-${Date.now()}`;
      return explanation;
    } catch (error) {
      console.error('Code explanation failed:', error);
      return this.getDefaultExplanation();
    }
  }

  // Code Optimization
  async optimizeCode(
    code: string,
    language: string,
    optimizationType: CodeOptimization['type'] = 'performance',
    filePath?: string,
  ): Promise<CodeOptimization[]> {
    try {
      const prompt = `Optimize this ${language} code for ${optimizationType} and return a JSON list of optimization objects with before/after code and metrics.\n\n\`\`\`${language}\n${code}\n\`\`\``;

      const optimizations = await this._callGeminiChatWithJson<CodeOptimization[]>(prompt, 'gemini-2.5-flash', filePath);

      optimizations.forEach((opt, index) => {
        opt.id = `opt-${Date.now()}-${index}`;
        opt.type = optimizationType;
      });

      return optimizations;
    } catch (error) {
      console.error('Code optimization failed:', error);
      return [];
    }
  }

  // Code Review
  async reviewCode(
    code: string,
    language: string,
    filePath?: string,
    _context?: string,
  ): Promise<CodeReview> {
    try {
      const prompt = `Perform a comprehensive code review for this ${language} code and return JSON per schema.\n\n\`\`\`${language}\n${code}\n\`\`\``;

      const review = await this._callGeminiChatWithJson<CodeReview>(prompt, 'gemini-2.5-flash', filePath);

      review.id = `review-${Date.now()}`;
      if (Array.isArray(review.issues))
        review.issues.forEach((issue, index) => {
          issue.id = `issue-${Date.now()}-${index}`;
        });
      return review;
    } catch (error) {
      console.error('Code review failed:', error);
      return this.getDefaultCodeReview();
    }
  }

  // Code Completion
  async suggestCompletion(
    code: string,
    cursorPosition: number,
    language: string,
    filePath?: string,
    _context?: string,
  ): Promise<string[]> {
    try {
      const beforeCursor = code.substring(0, cursorPosition);
      const afterCursor = code.substring(cursorPosition);

      const prompt = `Suggest code completions for this ${language} code at cursor position:

Before cursor:
\`\`\`${language}
${beforeCursor}
\`\`\`

After cursor:
\`\`\`${language}
${afterCursor}
\`\`\`

Provide relevant completions considering:
1. Current context and scope
2. Variable names and types
3. Function signatures
4. Language syntax
5. Common patterns
6. Best practices

Return array of completion suggestions (max 10).`;

      const result = await this.callAI(prompt, filePath);
      const completions = this.parseJSONResponse(result) as string[];

      return completions.slice(0, 10); // Limit to 10 suggestions
    } catch (error) {
      console.error('Code completion failed:', error);
      return [];
    }
  }

  // Code Formatting
  async formatCode(
    code: string,
    language: string,
    style?: string,
    filePath?: string,
  ): Promise<string> {
    try {
      const codeStyle = style || this.getDefaultStyle(language);

      const prompt = `Format this ${language} code according to ${codeStyle} style guidelines:

\`\`\`${language}
${code}
\`\`\`

Apply:
1. Proper indentation
2. Consistent spacing
3. Line length limits
4. Naming conventions
5. Comment formatting
6. Import organization
7. Code structure

Return only the formatted code without explanations.`;

      const result = await this.callAI(prompt, filePath);

      // Extract code from response if wrapped in code blocks
      const codeMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
      return codeMatch ? codeMatch[1] : result.trim();
    } catch (error) {
      console.error('Code formatting failed:', error);
      return code; // Return original code if formatting fails
    }
  }

  // Code Translation
  async translateCode(
    code: string,
    fromLanguage: string,
    toLanguage: string,
    filePath?: string,
  ): Promise<string> {
    try {
      const prompt = `Translate this ${fromLanguage} code to ${toLanguage}:

\`\`\`${fromLanguage}
${code}
\`\`\`

Ensure:
1. Equivalent functionality
2. Idiomatic ${toLanguage} patterns
3. Proper syntax and conventions
4. Comments translation
5. Error handling adaptation
6. Library/framework equivalents

Provide only the translated code with brief comments explaining any significant changes.`;

      const result = await this.callAI(prompt, filePath);

      // Extract code from response if wrapped in code blocks
      const codeMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
      return codeMatch ? codeMatch[1] : result.trim();
    } catch (error) {
      console.error('Code translation failed:', error);
      throw error;
    }
  }

  // Utility Methods
  private async callAI(prompt: string, filePath?: string): Promise<string> {
    const agent = aiWorkflowEngine.getAllAgents()[0];
    if (!agent) {
      throw new Error('No AI agent available');
    }

    const session = await aiWorkflowEngine.runSequentialWorkflow(
      {
        userGoal: prompt,
        filePath,
        additionalContext: 'AI Coding Tools Request',
      },
      [agent.id],
    );

    return session.result?.finalOutput || '';
  }

  private parseJSONResponse(response: string): any {
    try {
      // First attempt: direct JSON parsing if response looks like valid JSON
      if (response.trim().startsWith('{') && response.trim().endsWith('}')) {
        return JSON.parse(response.trim());
      }

      // Second attempt: extract JSON from ```json code blocks
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }

      // Third attempt: extract JSON from generic code blocks
      const codeMatch = response.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch && codeMatch[1].trim().startsWith('{') && codeMatch[1].trim().endsWith('}')) {
        return JSON.parse(codeMatch[1].trim());
      }

      // Fourth attempt: find JSON substring delimited by {}
      const jsonSubstring = response.match(/\{[\s\S]*\}/);
      if (jsonSubstring) {
        return JSON.parse(jsonSubstring[0]);
      }

      // Final fallback: return empty object
      console.warn('Failed to parse JSON response:', response);
      return {};
    } catch (error) {
      console.warn('Failed to parse JSON response:', error, response);
      return {};
    }
  }

  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getDefaultTestFramework(language: string): string {
    const frameworks: Record<string, string> = {
      javascript: 'Jest',
      typescript: 'Jest',
      python: 'pytest',
      java: 'JUnit',
      csharp: 'NUnit',
      go: 'testing',
      rust: 'cargo test',
      php: 'PHPUnit',
      ruby: 'RSpec',
    };
    return frameworks[language.toLowerCase()] || 'Generic';
  }

  private getDefaultStyle(language: string): string {
    const styles: Record<string, string> = {
      javascript: 'Prettier',
      typescript: 'Prettier',
      python: 'PEP 8',
      java: 'Google Java Style',
      csharp: 'Microsoft C# Style',
      go: 'gofmt',
      rust: 'rustfmt',
      php: 'PSR-12',
      ruby: 'RuboCop',
    };
    return styles[language.toLowerCase()] || 'Standard';
  }

  private getDefaultAnalysis(code: string): CodeAnalysis {
    const lines = code.split('\n').length;
    return {
      complexity: Math.min(lines / 10, 10),
      maintainabilityIndex: Math.max(100 - lines / 5, 0),
      linesOfCode: lines,
      cyclomaticComplexity: Math.ceil(lines / 20),
      cognitiveComplexity: Math.ceil(lines / 15),
      technicalDebt: ['Analysis unavailable - using estimated metrics'],
      suggestions: ['Consider breaking down large functions', 'Add comments for clarity'],
    };
  }

  private getDefaultTestSuite(language: string, framework?: string): TestSuite {
    return {
      id: `test-${Date.now()}`,
      framework: framework || this.getDefaultTestFramework(language),
      testCases: [],
      coverage: { lines: 0, functions: 0, branches: 0, statements: 0 },
      mockData: [],
      setupCode: '',
      teardownCode: '',
    };
  }

  private getDefaultDocumentation(
    type: Documentation['type'],
    format: Documentation['format'],
  ): Documentation {
    return {
      id: `doc-${Date.now()}`,
      type,
      title: 'Documentation',
      content: 'Documentation generation failed. Please try again.',
      format,
      sections: [],
      examples: [],
    };
  }

  private getDefaultExplanation(): CodeExplanation {
    return {
      id: `explain-${Date.now()}`,
      summary: 'Code explanation unavailable',
      purpose: 'Unable to analyze code purpose',
      algorithm: 'Algorithm analysis failed',
      complexity: 'Complexity analysis unavailable',
      dependencies: [],
      parameters: [],
      returnValue: 'Return value analysis unavailable',
      sideEffects: [],
      examples: [],
      relatedConcepts: [],
    };
  }

  private getDefaultCodeReview(): CodeReview {
    return {
      id: `review-${Date.now()}`,
      overall: {
        score: 50,
        summary: 'Code review unavailable',
        recommendation: 'needs_discussion',
      },
      issues: [],
      strengths: [],
      suggestions: ['Code review failed - please try again'],
      securityConcerns: [],
      performanceNotes: [],
    };
  }

  // Cache Management
  clearCache(): void {
    this.analysisCache.clear();
    this.refactoringCache.clear();
    this.testCache.clear();
    this.docCache.clear();
  }

  getCacheStats(): { analysis: number; refactoring: number; test: number; doc: number } {
    return {
      analysis: this.analysisCache.size,
      refactoring: this.refactoringCache.size,
      test: this.testCache.size,
      doc: this.docCache.size,
    };
  }

  // Duplicate/Similar Code Finder
  async findSimilarCodeAcrossProject(
    files: Array<{ identifier: string; content: string }>,
    settings?: any,
    modelId?: string,
  ): Promise<
    Array<{
      groupId: string;
      members: Array<{ identifier: string; lines: [number, number]; snippet: string }>;
    }>
  > {
    try {
      // Try Gemini findSimilarCode method first
      const geminiResult = await this._callGeminiSpecificMethod<any>(
        'findSimilarCode',
        [files, settings || {}, modelId || 'gemini-2.5-flash']
      );

      if (geminiResult?.groups) {
        return geminiResult.groups;
      }

      // Local fallback: naive n-gram similarity within provided files
      const groups: Array<{
        groupId: string;
        members: Array<{ identifier: string; lines: [number, number]; snippet: string }>;
      }> = [];
      const windowSize = 5;
      const sigs: Record<
        string,
        { identifier: string; start: number; end: number; text: string }[]
      > = {};
      for (const f of files) {
        const lines = (f.content || '').split(/\r?\n/);
        for (let i = 0; i + windowSize <= lines.length; i++) {
          const chunk = lines
            .slice(i, i + windowSize)
            .join('\n')
            .trim();
          if (chunk.length < 20) continue;
          const key = chunk.replace(/\s+/g, ' ').toLowerCase();
          (sigs[key] ||= []).push({
            identifier: f.identifier,
            start: i + 1,
            end: i + windowSize,
            text: chunk,
          });
        }
      }
      let gid = 0;
      for (const [k, arr] of Object.entries(sigs)) {
        if (arr.length < 2) continue;
        groups.push({
          groupId: `grp-${gid++}`,
          members: arr.map((a) => ({
            identifier: a.identifier,
            lines: [a.start, a.end],
            snippet: a.text,
          })),
        });
      }
      return groups;
    } catch {
      return [];
    }
  }
}

// Global instance
export const aiCodingTools = new AICodingTools();
