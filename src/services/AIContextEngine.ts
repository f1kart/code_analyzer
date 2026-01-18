/**
 * AI Context-Aware Suggestions Engine
 * Intelligent code suggestions using entire codebase context
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

export interface CodeContext {
  currentFile: string;
  currentCode: string;
  cursorPosition: { line: number; column: number };
  selectedText?: string;
  projectFiles?: Array<{ path: string; content: string }>;
  recentFiles?: string[];
  imports?: string[];
  dependencies?: Record<string, string>;
}

export interface CodeSuggestion {
  id: string;
  type: 'completion' | 'refactor' | 'fix' | 'optimization' | 'pattern';
  title: string;
  description: string;
  code: string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  category: string;
  reasoning: string;
  relatedFiles?: string[];
  estimatedTimeMs?: number;
}

export interface ArchitecturePattern {
  name: string;
  description: string;
  applicability: string;
  files: Array<{
    path: string;
    purpose: string;
    template: string;
  }>;
  dependencies?: string[];
}

export interface RefactoringRecommendation {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  affectedFiles: string[];
  changes: Array<{
    file: string;
    original: string;
    refactored: string;
    explanation: string;
  }>;
  estimatedImpact: {
    linesChanged: number;
    filesAffected: number;
    testCoverage?: number;
  };
}

export interface LearningData {
  patterns: Map<string, { count: number; context: string[] }>;
  preferences: Map<string, any>;
  history: Array<{
    action: string;
    context: string;
    timestamp: Date;
    accepted: boolean;
  }>;
}

/**
 * AI Context-Aware Suggestions Engine
 */
export class AIContextEngine {
  private learningData: LearningData = {
    patterns: new Map(),
    preferences: new Map(),
    history: [],
  };
  
  private codebaseIndex: Map<string, string> = new Map();
  private symbolIndex: Map<string, Set<string>> = new Map();
  private apiKey: string;

  constructor() {
    this.apiKey = this.getAPIKey();
    console.log('[AIContextEngine] Initialized');
  }

  /**
   * Get context-aware suggestions
   */
  public async getSuggestions(context: CodeContext): Promise<CodeSuggestion[]> {
    console.log('[AIContextEngine] Generating suggestions...');

    const suggestions: CodeSuggestion[] = [];

    // Analyze context
    const analysis = await this.analyzeContext(context);

    // Generate completions
    if (context.selectedText && context.selectedText.length < 100) {
      const completions = await this.generateCompletions(context, analysis);
      suggestions.push(...completions);
    }

    // Generate refactorings
    if (context.selectedText && context.selectedText.length > 10) {
      const refactorings = await this.generateRefactorings(context, analysis);
      suggestions.push(...refactorings);
    }

    // Generate fixes
    const fixes = await this.generateFixes(context, analysis);
    suggestions.push(...fixes);

    // Generate optimizations
    const optimizations = await this.generateOptimizations(context, analysis);
    suggestions.push(...optimizations);

    // Pattern suggestions based on learning
    const patterns = this.getPatternSuggestions(context);
    suggestions.push(...patterns);

    // Sort by confidence and relevance
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Top 10 suggestions
  }

  /**
   * Analyze code context
   */
  private async analyzeContext(context: CodeContext): Promise<{
    language: string;
    framework?: string;
    patterns: string[];
    complexity: number;
    issues: string[];
    symbols: string[];
  }> {
    const language = this.detectLanguage(context.currentFile);
    const framework = this.detectFramework(context.currentCode);
    const patterns = this.detectPatterns(context.currentCode);
    const complexity = this.calculateComplexity(context.currentCode);
    const issues = this.detectIssues(context.currentCode);
    const symbols = this.extractSymbols(context.currentCode);

    return {
      language,
      framework,
      patterns,
      complexity,
      issues,
      symbols,
    };
  }

  /**
   * Generate code completions
   */
  private async generateCompletions(
    context: CodeContext,
    analysis: any
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    try {
      const prompt = `You are an expert ${analysis.language} developer. Generate intelligent code completions.

Current code:
\`\`\`${analysis.language}
${context.currentCode}
\`\`\`

Cursor position: Line ${context.cursorPosition.line}, Column ${context.cursorPosition.column}
Selected text: "${context.selectedText || 'none'}"

Generate 3 intelligent completions that:
1. Follow ${analysis.framework || 'standard'} patterns
2. Are type-safe and production-ready
3. Match the existing code style
4. Include proper error handling

Return JSON array:
[{
  "title": "Completion name",
  "code": "completed code",
  "reasoning": "why this completion",
  "confidence": 0.9
}]`;

      const response = await this.callAI(prompt);
      const completions = this.parseAISuggestions(response);

      for (let i = 0; i < completions.length; i++) {
        suggestions.push({
          id: `completion-${Date.now()}-${i}`,
          type: 'completion',
          title: completions[i].title,
          description: 'AI-generated code completion',
          code: completions[i].code,
          confidence: completions[i].confidence || 0.8,
          impact: 'low',
          category: 'completion',
          reasoning: completions[i].reasoning,
        });
      }
    } catch (error: any) {
      console.error('[AIContextEngine] Completion generation failed:', error.message);
    }

    return suggestions;
  }

  /**
   * Generate refactoring suggestions
   */
  private async generateRefactorings(
    context: CodeContext,
    analysis: any
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    try {
      const prompt = `Analyze this ${analysis.language} code and suggest refactorings:

\`\`\`${analysis.language}
${context.selectedText || context.currentCode}
\`\`\`

Current patterns detected: ${analysis.patterns.join(', ')}
Complexity score: ${analysis.complexity}

Suggest 3 refactorings to improve:
1. Code quality and maintainability
2. Performance
3. Type safety and error handling

Return JSON array:
[{
  "title": "Refactoring name",
  "code": "refactored code",
  "reasoning": "why this improves the code",
  "impact": "medium",
  "confidence": 0.85
}]`;

      const response = await this.callAI(prompt);
      const refactorings = this.parseAISuggestions(response);

      for (let i = 0; i < refactorings.length; i++) {
        suggestions.push({
          id: `refactor-${Date.now()}-${i}`,
          type: 'refactor',
          title: refactorings[i].title,
          description: 'Refactoring suggestion',
          code: refactorings[i].code,
          confidence: refactorings[i].confidence || 0.8,
          impact: (refactorings[i].impact || 'medium') as any,
          category: 'refactoring',
          reasoning: refactorings[i].reasoning,
        });
      }
    } catch (error: any) {
      console.error('[AIContextEngine] Refactoring generation failed:', error.message);
    }

    return suggestions;
  }

  /**
   * Generate fixes
   */
  private async generateFixes(context: CodeContext, analysis: any): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    if (analysis.issues.length === 0) {
      return suggestions;
    }

    try {
      const prompt = `Fix these issues in the code:

\`\`\`${analysis.language}
${context.currentCode}
\`\`\`

Issues detected:
${analysis.issues.map((issue: string, i: number) => `${i + 1}. ${issue}`).join('\n')}

Generate fixes for each issue. Return JSON:
[{
  "title": "Fix description",
  "code": "fixed code",
  "reasoning": "what was fixed and why",
  "confidence": 0.9
}]`;

      const response = await this.callAI(prompt);
      const fixes = this.parseAISuggestions(response);

      for (let i = 0; i < fixes.length; i++) {
        suggestions.push({
          id: `fix-${Date.now()}-${i}`,
          type: 'fix',
          title: fixes[i].title,
          description: 'Bug fix suggestion',
          code: fixes[i].code,
          confidence: fixes[i].confidence || 0.9,
          impact: 'high',
          category: 'fix',
          reasoning: fixes[i].reasoning,
        });
      }
    } catch (error: any) {
      console.error('[AIContextEngine] Fix generation failed:', error.message);
    }

    return suggestions;
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizations(
    context: CodeContext,
    analysis: any
  ): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    if (analysis.complexity < 5) {
      return suggestions; // Code is already simple
    }

    try {
      const prompt = `Optimize this ${analysis.language} code for performance:

\`\`\`${analysis.language}
${context.selectedText || context.currentCode}
\`\`\`

Complexity: ${analysis.complexity}
Framework: ${analysis.framework || 'none'}

Suggest optimizations for:
1. Time complexity
2. Memory usage
3. Bundle size (if web)

Return JSON:
[{
  "title": "Optimization name",
  "code": "optimized code",
  "reasoning": "performance improvement explanation",
  "confidence": 0.8
}]`;

      const response = await this.callAI(prompt);
      const optimizations = this.parseAISuggestions(response);

      for (let i = 0; i < optimizations.length; i++) {
        suggestions.push({
          id: `optimize-${Date.now()}-${i}`,
          type: 'optimization',
          title: optimizations[i].title,
          description: 'Performance optimization',
          code: optimizations[i].code,
          confidence: optimizations[i].confidence || 0.75,
          impact: 'medium',
          category: 'optimization',
          reasoning: optimizations[i].reasoning,
        });
      }
    } catch (error: any) {
      console.error('[AIContextEngine] Optimization generation failed:', error.message);
    }

    return suggestions;
  }

  /**
   * Get pattern suggestions based on learning
   */
  private getPatternSuggestions(context: CodeContext): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];

    // Check learned patterns
    for (const [pattern, data] of this.learningData.patterns.entries()) {
      if (data.count > 3 && context.currentCode.includes(pattern.substring(0, 20))) {
        suggestions.push({
          id: `pattern-${Date.now()}-${pattern}`,
          type: 'pattern',
          title: `Use learned pattern: ${pattern}`,
          description: `This pattern has been used ${data.count} times before`,
          code: pattern,
          confidence: Math.min(0.9, data.count / 10),
          impact: 'low',
          category: 'pattern',
          reasoning: `Frequently used pattern in your codebase`,
        });
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get architecture pattern suggestions
   */
  public async suggestArchitecturePatterns(
    projectFiles: Array<{ path: string; content: string }>
  ): Promise<ArchitecturePattern[]> {
    const patterns: ArchitecturePattern[] = [];

    try {
      const filesContext = projectFiles
        .slice(0, 10)
        .map((f) => `${f.path}:\n${f.content.substring(0, 500)}`)
        .join('\n\n---\n\n');

      const prompt = `Analyze this project structure and suggest architecture patterns:

${filesContext}

Suggest 3 architecture patterns that would improve:
1. Code organization
2. Scalability
3. Maintainability

Return JSON:
[{
  "name": "Pattern name",
  "description": "What this pattern does",
  "applicability": "When to use it",
  "files": [
    {"path": "suggested/file/path.ts", "purpose": "file purpose"}
  ]
}]`;

      const response = await this.callAI(prompt);
      const suggested = JSON.parse(this.cleanJSONResponse(response));

      patterns.push(...suggested);
    } catch (error: any) {
      console.error('[AIContextEngine] Architecture suggestion failed:', error.message);
    }

    return patterns;
  }

  /**
   * Get multi-file refactoring recommendations
   */
  public async getMultiFileRefactorings(
    files: Array<{ path: string; content: string }>
  ): Promise<RefactoringRecommendation[]> {
    const recommendations: RefactoringRecommendation[] = [];

    try {
      const filesContext = files
        .map((f) => `File: ${f.path}\n${f.content}`)
        .join('\n\n---\n\n');

      const prompt = `Analyze these related files and suggest multi-file refactorings:

${filesContext}

Look for:
1. Duplicate code that can be extracted
2. Inconsistent patterns
3. Missing abstractions
4. Coupling issues

Return JSON:
[{
  "title": "Refactoring name",
  "description": "What it improves",
  "severity": "warning",
  "affectedFiles": ["file1.ts", "file2.ts"],
  "changes": [
    {
      "file": "file1.ts",
      "original": "code before",
      "refactored": "code after",
      "explanation": "why this change"
    }
  ]
}]`;

      const response = await this.callAI(prompt);
      const refactorings = JSON.parse(this.cleanJSONResponse(response));

      for (const r of refactorings) {
        recommendations.push({
          id: `multifile-${Date.now()}`,
          ...r,
          estimatedImpact: {
            linesChanged: r.changes.reduce((sum: number, c: any) => sum + c.refactored.split('\n').length, 0),
            filesAffected: r.affectedFiles.length,
          },
        });
      }
    } catch (error: any) {
      console.error('[AIContextEngine] Multi-file refactoring failed:', error.message);
    }

    return recommendations;
  }

  /**
   * Learn from accepted suggestions
   */
  public learnFromAcceptance(
    suggestion: CodeSuggestion,
    context: CodeContext,
    accepted: boolean
  ): void {
    // Store learning data
    this.learningData.history.push({
      action: suggestion.type,
      context: context.currentFile,
      timestamp: new Date(),
      accepted,
    });

    if (accepted) {
      // Update patterns
      const pattern = suggestion.code;
      const existing = this.learningData.patterns.get(pattern) || { count: 0, context: [] };
      existing.count++;
      existing.context.push(context.currentFile);
      this.learningData.patterns.set(pattern, existing);

      console.log(`[AIContextEngine] Learned from accepted suggestion: ${suggestion.title}`);
    }

    // Cleanup old history (keep last 1000)
    if (this.learningData.history.length > 1000) {
      this.learningData.history = this.learningData.history.slice(-1000);
    }
  }

  /**
   * Index codebase for faster context retrieval
   */
  public indexCodebase(files: Array<{ path: string; content: string }>): void {
    console.log(`[AIContextEngine] Indexing ${files.length} files...`);

    for (const file of files) {
      this.codebaseIndex.set(file.path, file.content);

      // Extract and index symbols
      const symbols = this.extractSymbols(file.content);
      for (const symbol of symbols) {
        const locations = this.symbolIndex.get(symbol) || new Set();
        locations.add(file.path);
        this.symbolIndex.set(symbol, locations);
      }
    }

    console.log(`[AIContextEngine] Indexed ${this.symbolIndex.size} symbols`);
  }

  /**
   * Find symbol usages across codebase
   */
  public findSymbolUsages(symbol: string): string[] {
    const locations = this.symbolIndex.get(symbol);
    return locations ? Array.from(locations) : [];
  }

  /**
   * Helper methods
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    };
    return langMap[ext || ''] || 'unknown';
  }

  private detectFramework(code: string): string | undefined {
    if (code.includes('import React') || code.includes('from "react"')) return 'React';
    if (code.includes('import Vue') || code.includes('from "vue"')) return 'Vue';
    if (code.includes('import { Component }') && code.includes('@angular')) return 'Angular';
    if (code.includes('import express')) return 'Express';
    return undefined;
  }

  private detectPatterns(code: string): string[] {
    const patterns: string[] = [];
    if (code.includes('async') && code.includes('await')) patterns.push('async/await');
    if (code.includes('Promise')) patterns.push('promises');
    if (code.includes('class ')) patterns.push('oop');
    if (code.includes('function ')) patterns.push('functional');
    if (code.includes('interface ') || code.includes('type ')) patterns.push('typescript');
    return patterns;
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;
    complexity += (code.match(/if\s*\(/g) || []).length;
    complexity += (code.match(/for\s*\(/g) || []).length;
    complexity += (code.match(/while\s*\(/g) || []).length;
    complexity += (code.match(/case\s+/g) || []).length;
    complexity += (code.match(/catch\s*\(/g) || []).length;
    return complexity;
  }

  private detectIssues(code: string): string[] {
    const issues: string[] = [];
    if (code.includes('any')) issues.push('Using "any" type - should be more specific');
    if (code.includes('console.log')) issues.push('Console.log statement should be removed');
    if (code.match(/\/\/ TODO/)) issues.push('TODO comment found');
    if (!code.includes('try') && code.includes('await')) issues.push('Missing error handling for async code');
    return issues;
  }

  private extractSymbols(code: string): string[] {
    const symbols: string[] = [];
    
    // Extract function names
    const functions = code.match(/function\s+(\w+)/g);
    if (functions) symbols.push(...functions.map((f) => f.split(' ')[1]));

    // Extract class names
    const classes = code.match(/class\s+(\w+)/g);
    if (classes) symbols.push(...classes.map((c) => c.split(' ')[1]));

    // Extract const/let/var names
    const variables = code.match(/(?:const|let|var)\s+(\w+)/g);
    if (variables) symbols.push(...variables.map((v) => v.split(' ')[1]));

    return symbols;
  }

  private async callAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`AI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseAISuggestions(response: string): any[] {
    try {
      const cleaned = this.cleanJSONResponse(response);
      return JSON.parse(cleaned);
    } catch {
      return [];
    }
  }

  private cleanJSONResponse(response: string): string {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find JSON array or object
    const jsonMatch = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    return cleaned.trim();
  }

  private getAPIKey(): string {
    // Try environment variable first
    if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
      return process.env.VITE_GEMINI_API_KEY;
    }

    // Try import.meta.env (Vite)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) {
      return (import.meta as any).env.VITE_GEMINI_API_KEY;
    }

    // Try localStorage
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('gemini_api_key');
      if (stored) return stored;
    }

    console.warn('[AIContextEngine] Gemini API key not found');
    return '';
  }

  /**
   * Export learning data
   */
  public exportLearningData(): string {
    return JSON.stringify({
      patterns: Array.from(this.learningData.patterns.entries()),
      preferences: Array.from(this.learningData.preferences.entries()),
      historyCount: this.learningData.history.length,
    }, null, 2);
  }

  /**
   * Import learning data
   */
  public importLearningData(json: string): void {
    try {
      const data = JSON.parse(json);
      this.learningData.patterns = new Map(data.patterns);
      this.learningData.preferences = new Map(data.preferences);
      console.log('[AIContextEngine] Learning data imported');
    } catch (error: any) {
      console.error('[AIContextEngine] Failed to import learning data:', error.message);
    }
  }
}

// Singleton instance
let aiContextEngineInstance: AIContextEngine | null = null;

/**
 * Get singleton AI context engine instance
 */
export function getAIContextEngine(): AIContextEngine {
  if (!aiContextEngineInstance) {
    aiContextEngineInstance = new AIContextEngine();
  }
  return aiContextEngineInstance;
}
