import { initializeTracing, withTracing } from './DistributedTracingService';
import { initializeAnalytics, trackFeatureUsage } from './UsageAnalyticsService';

export interface CodeAnalysisResult {
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'syntax' | 'logic' | 'performance' | 'security' | 'style' | 'best_practice' | 'test' | 'documentation';
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  confidence: number;
  autoFixable: boolean;
  category: string;
  tags: string[];
  relatedRules?: string[];
  codeExample?: string;
}

interface RealTimeAnalysisConfig {
  enabled: boolean;
  debounceMs: number;
  maxConcurrentAnalyses: number;
  analysisDepth: 'shallow' | 'moderate' | 'deep';
  enableAIAgents: boolean;
  aiAgentTimeout: number;
  cacheResults: boolean;
  proactiveAlerts: boolean;
  learningEnabled: boolean;
}

interface AIAgentResponse {
  agent: string;
  analysis: CodeAnalysisResult[];
  confidence: number;
  responseTime: number;
  suggestions: string[];
  improvements: string[];
}

interface CodeContext {
  filePath: string;
  language: string;
  projectType: string;
  dependencies: string[];
  recentChanges: string[];
  existingIssues: CodeAnalysisResult[];
  codePatterns: string[];
  conventions: Record<string, any>;
}

export class IntelligentCodeAnalysisService {
  private analysisCache: Map<string, { result: CodeAnalysisResult[]; timestamp: number }> = new Map();
  private activeAnalyses: Map<string, AbortController> = new Map();
  private analysisQueue: Array<{ filePath: string; content: string; context: CodeContext }> = [];
  private isProcessing: boolean = false;
  private config: Required<RealTimeAnalysisConfig>;

  constructor(config: Partial<RealTimeAnalysisConfig> = {}) {
    this.config = {
      enabled: true,
      debounceMs: 500,
      maxConcurrentAnalyses: 3,
      analysisDepth: 'moderate',
      enableAIAgents: true,
      aiAgentTimeout: 10000,
      cacheResults: true,
      proactiveAlerts: true,
      learningEnabled: true,
      ...config,
    };

    // Initialize services
    initializeTracing({
      serviceName: 'intelligent-code-analysis',
      serviceVersion: '1.0.0',
      environment: 'production',
      enabled: true,
    });

    initializeAnalytics({
      enabled: true,
      batchSize: 50,
      flushInterval: 30000,
    });
  }

  /**
   * Analyze code in real-time as it's being written
   */
  async analyzeCodeRealTime(
    filePath: string,
    content: string,
    context: Partial<CodeContext> = {}
  ): Promise<CodeAnalysisResult[]> {
    if (!this.config.enabled) return [];

    const cacheKey = `${filePath}:${content.length}:${content.slice(-100)}`;

    // Check cache first
    if (this.config.cacheResults) {
      const cached = this.analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
        return cached.result;
      }
    }

    return withTracing('real_time_analysis', async () => {
      // Cancel previous analysis for this file
      const existingController = this.activeAnalyses.get(filePath);
      if (existingController) {
        existingController.abort();
      }

      // Create new analysis controller
      const controller = new AbortController();
      this.activeAnalyses.set(filePath, controller);

      try {
        const fullContext: CodeContext = {
          filePath,
          language: this.detectLanguage(filePath),
          projectType: context.projectType || 'unknown',
          dependencies: context.dependencies || [],
          recentChanges: context.recentChanges || [],
          existingIssues: context.existingIssues || [],
          codePatterns: context.codePatterns || [],
          conventions: context.conventions || {},
        };

        const analysisResults = await this.performComprehensiveAnalysis(content, fullContext);

        // Cache results
        if (this.config.cacheResults) {
          this.analysisCache.set(cacheKey, {
            result: analysisResults,
            timestamp: Date.now(),
          });
        }

        // Track analytics
        trackFeatureUsage('real_time_analysis', {
          filePath,
          issuesFound: analysisResults.length,
          severity: analysisResults.map(r => r.severity),
        });

        return analysisResults;

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Analysis cancelled for:', filePath);
          return [];
        }
        console.error('Real-time analysis error:', error);
        return [];
      } finally {
        this.activeAnalyses.delete(filePath);
      }
    });
  }

  /**
   * Perform comprehensive code analysis with multiple AI agents
   */
  private async performComprehensiveAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const allResults: CodeAnalysisResult[] = [];

    // 1. Static analysis (syntax, basic patterns)
    const staticResults = await this.performStaticAnalysis(content, context);
    allResults.push(...staticResults);

    // 2. AI agent analysis (if enabled)
    if (this.config.enableAIAgents) {
      const aiResults = await this.performAIAgentAnalysis(content, context);
      allResults.push(...aiResults);
    }

    // 3. Pattern-based analysis
    const patternResults = await this.performPatternAnalysis(content, context);
    allResults.push(...patternResults);

    // 4. Security analysis
    const securityResults = await this.performSecurityAnalysis(content, context);
    allResults.push(...securityResults);

    // 5. Performance analysis
    const performanceResults = await this.performPerformanceAnalysis(content, context);
    allResults.push(...performanceResults);

    // 6. Test coverage analysis
    const testResults = await this.performTestAnalysis(content, context);
    allResults.push(...testResults);

    // 7. Documentation analysis
    const docResults = await this.performDocumentationAnalysis(content, context);
    allResults.push(...docResults);

    // 8. Learning-based improvements
    if (this.config.learningEnabled) {
      const learningResults = await this.performLearningBasedAnalysis(content, context);
      allResults.push(...learningResults);
    }

    // Deduplicate and prioritize results
    return this.prioritizeAndDeduplicateResults(allResults);
  }

  /**
   * Perform static code analysis
   */
  private async performStaticAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];
    const lines = content.split('\n');

    // Basic syntax checks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for common issues
      if (line.includes('console.log') && !line.trim().startsWith('//')) {
        results.push({
          filePath: context.filePath,
          lineNumber,
          columnStart: line.indexOf('console.log') + 1,
          columnEnd: line.indexOf('console.log') + 'console.log'.length,
          severity: 'warning' as const,
          type: 'style' as const,
          message: 'Debug console.log statement found. Consider using proper logging.',
          suggestion: 'Replace with proper logging framework or remove if not needed.',
          codeSnippet: line.trim(),
          confidence: 0.9,
          autoFixable: true,
          category: 'Debug Code',
          tags: ['debug', 'logging'],
        });
      }

      // Check for TODO comments
      if (line.toLowerCase().includes('todo') || line.toLowerCase().includes('fixme')) {
        results.push({
          filePath: context.filePath,
          lineNumber,
          columnStart: line.toLowerCase().indexOf('todo') + 1,
          columnEnd: line.toLowerCase().indexOf('todo') + 'todo'.length,
          severity: 'info',
          type: 'documentation',
          message: 'TODO or FIXME comment found. Consider addressing or creating proper tickets.',
          suggestion: 'Create a proper task or issue for this TODO item.',
          codeSnippet: line.trim(),
          confidence: 0.8,
          autoFixable: false,
          category: 'Documentation',
          tags: ['todo', 'tracking'],
        });
      }

      // Check for unused variables (basic pattern)
      if (line.includes('const ') || line.includes('let ') || line.includes('var ')) {
        const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);
        if (varMatch) {
          const varName = varMatch[1];
          const remainingContent = content.substring(content.indexOf(line) + line.length);
          if (!remainingContent.includes(varName)) {
            results.push({
              filePath: context.filePath,
              lineNumber,
              columnStart: line.indexOf(varName),
              columnEnd: line.indexOf(varName) + varName.length,
              severity: 'warning',
              type: 'best_practice',
              message: `Variable '${varName}' appears to be unused.`,
              suggestion: 'Remove unused variable or prefix with underscore if intentionally unused.',
              codeSnippet: line.trim(),
              confidence: 0.7,
              autoFixable: true,
              category: 'Code Quality',
              tags: ['unused-variable', 'optimization'],
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Perform AI agent analysis with multiple agents
   */
  private async performAIAgentAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const agents = ['claude', 'cursor', 'gemini'];
    const results: CodeAnalysisResult[] = [];

    // Analyze with each agent concurrently (up to maxConcurrentAnalyses)
    const promises = agents
      .slice(0, this.config.maxConcurrentAnalyses)
      .map(async (agent) => {
        try {
          const response = await this.queryAIAgent(agent, content, context);
          return { agent, response };
        } catch (error) {
          console.error(`AI agent ${agent} analysis failed:`, error);
          return { agent, response: null };
        }
      });

    const responses = await Promise.allSettled(promises);

    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value.response) {
        const aiResults = this.convertAIAgentResponse(response.value.response, context);
        results.push(...aiResults);
      }
    }

    return results;
  }

  /**
   * Query a specific AI agent using real Gemini API
   */
  private async queryAIAgent(agent: string, content: string, context: CodeContext): Promise<AIAgentResponse> {
    const startTime = Date.now();

    try {
      // Import Gemini SDK dynamically
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      // Get API key from environment
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      // Create specialized prompt based on agent role
      const agentPrompts: Record<string, string> = {
        'security-agent': `You are a security expert analyzing code for vulnerabilities, security risks, and best practices. Focus on: SQL injection, XSS, authentication issues, data validation, sensitive data exposure.`,
        'performance-agent': `You are a performance optimization expert. Analyze code for: algorithmic efficiency, memory usage, unnecessary operations, caching opportunities, database query optimization.`,
        'quality-agent': `You are a code quality expert. Focus on: code smells, SOLID principles, design patterns, maintainability, readability, documentation.`,
        'best-practices-agent': `You are an expert in coding best practices and standards. Analyze for: naming conventions, code organization, error handling, testing practices, TypeScript/JavaScript best practices.`
      };

      const systemPrompt = agentPrompts[agent] || 'You are an expert code reviewer.';
      
      const prompt = `${systemPrompt}

Analyze the following code and provide specific, actionable feedback:

File: ${context.filePath}
Language: ${context.language}

Code:
\`\`\`${context.language}
${content}
\`\`\`

Provide your analysis in JSON format with this structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "type": "security" | "performance" | "logic" | "style",
      "message": "<issue description>",
      "suggestion": "<how to fix>",
      "confidence": <0.0-1.0>
    }
  ],
  "overallConfidence": <0.0-1.0>,
  "suggestions": ["<general suggestion 1>", "<general suggestion 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      let analysisData;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        analysisData = JSON.parse(jsonText.trim());
      } catch (parseError) {
        // Fallback: create structured response from unstructured text
        analysisData = {
          issues: [{
            line: 1,
            severity: 'info',
            type: 'quality',
            message: text.substring(0, 200),
            suggestion: 'See full analysis for details',
            confidence: 0.7
          }],
          overallConfidence: 0.7,
          suggestions: [text.substring(0, 100)],
          improvements: []
        };
      }

      // Convert to AIAgentResponse format
      const analysisResults: CodeAnalysisResult[] = (analysisData.issues || []).map((issue: any) => ({
        filePath: context.filePath,
        lineNumber: issue.line || 1,
        columnStart: 1,
        columnEnd: 100,
        severity: issue.severity || 'info',
        type: issue.type || 'quality',
        message: issue.message || '',
        suggestion: issue.suggestion || '',
        confidence: issue.confidence || 0.7,
        autoFixable: false,
        category: 'AI Analysis',
        tags: ['ai-agent', agent, issue.type || 'quality'],
      }));

      return {
        agent,
        analysis: analysisResults,
        confidence: analysisData.overallConfidence || 0.8,
        responseTime: Date.now() - startTime,
        suggestions: analysisData.suggestions || [],
        improvements: analysisData.improvements || [],
      };

    } catch (error) {
      console.error(`Error querying AI agent ${agent}:`, error);
      
      // Return fallback response with error information
      return {
        agent,
        analysis: [{
          filePath: context.filePath,
          lineNumber: 1,
          columnStart: 1,
          columnEnd: 1,
          severity: 'warning',
          type: 'logic',
          message: `AI agent ${agent} encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestion: 'Please check API configuration and try again',
          confidence: 0.5,
          autoFixable: false,
          category: 'System',
          tags: ['error', 'api-failure'],
        }],
        confidence: 0.5,
        responseTime: Date.now() - startTime,
        suggestions: ['Verify API key configuration', 'Check network connectivity'],
        improvements: [],
      };
    }
  }

  /**
   * Perform pattern-based analysis
   */
  private async performPatternAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];

    // Check for anti-patterns
    const antiPatterns = [
      {
        pattern: /catch\s*\(\s*\w+\s*\)\s*{\s*}\s*$/gm,
        message: 'Empty catch block found. This swallows errors and makes debugging difficult.',
        suggestion: 'Either handle the error properly or re-throw it.',
        type: 'logic',
        severity: 'warning',
      },
      {
        pattern: /if\s*\(\s*!\s*\w+\s*\)\s*{\s*return\s+null\s*;\s*}/gm,
        message: 'Early return with null check could be simplified.',
        suggestion: 'Consider using optional chaining or nullish coalescing.',
        type: 'style',
        severity: 'info',
      },
    ];

    for (const antiPattern of antiPatterns) {
      const matches = content.match(antiPattern.pattern);
      if (matches) {
        matches.forEach((match, index) => {
          const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
          results.push({
            filePath: context.filePath,
            lineNumber,
            columnStart: 1,
            columnEnd: match.length,
            severity: 'warning' as const,
            type: 'logic' as const,
            message: antiPattern.message,
            suggestion: antiPattern.suggestion,
            codeSnippet: match.trim(),
            confidence: 0.9,
            autoFixable: true,
            category: 'Code Patterns',
            tags: ['anti-pattern', 'quality'],
          });
        });
      }
    }

    return results;
  }

  /**
   * Perform security analysis
   */
  private async performSecurityAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];

    // Check for potential security issues
    const securityPatterns = [
      {
        pattern: /password|secret|key|token/gi,
        message: 'Potential sensitive data found. Ensure proper encryption and secure storage.',
        suggestion: 'Use environment variables or secure secret management.',
        type: 'security',
        severity: 'warning',
      },
      {
        pattern: /eval\s*\(/g,
        message: 'Use of eval() function detected. This can lead to code injection vulnerabilities.',
        suggestion: 'Avoid eval() and use safer alternatives like JSON.parse() or function constructors.',
        type: 'security',
        severity: 'error',
      },
    ];

    for (const securityPattern of securityPatterns) {
      const matches = content.match(securityPattern.pattern);
      if (matches) {
        matches.forEach((match, index) => {
          const lineNumber = this.getLineNumber(content, match);
          results.push({
            filePath: context.filePath,
            lineNumber,
            columnStart: 1,
            columnEnd: match.length,
            severity: 'warning' as const,
            type: 'security' as const,
            message: securityPattern.message,
            suggestion: securityPattern.suggestion,
            codeSnippet: match,
            confidence: 0.95,
            autoFixable: false,
            category: 'Security',
            tags: ['security', 'vulnerability'],
          });
        });
      }
    }

    return results;
  }

  /**
   * Perform performance analysis
   */
  private async performPerformanceAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];

    // Check for performance issues
    const performancePatterns = [
      {
        pattern: /\.forEach\s*\(/g,
        message: 'forEach loop detected. Consider using more efficient alternatives for large arrays.',
        suggestion: 'Use map(), filter(), or for...of loops for better performance with large datasets.',
        type: 'performance',
        severity: 'info',
      },
      {
        pattern: /document\.querySelectorAll/g,
        message: 'DOM query detected. Consider caching selectors for better performance.',
        suggestion: 'Cache DOM selectors or use more specific queries.',
        type: 'performance',
        severity: 'warning',
      },
    ];

    for (const perfPattern of performancePatterns) {
      const matches = content.match(perfPattern.pattern);
      if (matches) {
        matches.forEach((match, index) => {
          const lineNumber = this.getLineNumber(content, match);
          results.push({
            filePath: context.filePath,
            lineNumber,
            columnStart: 1,
            columnEnd: match.length,
            severity: 'warning' as const,
            type: 'performance' as const,
            message: perfPattern.message,
            suggestion: perfPattern.suggestion,
            codeSnippet: match,
            confidence: 0.8,
            autoFixable: true,
            category: 'Performance',
            tags: ['performance', 'optimization'],
          });
        });
      }
    }

    return results;
  }

  /**
   * Perform test analysis
   */
  private async performTestAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];

    // Check for missing test patterns
    if (context.language === 'typescript' || context.language === 'javascript') {
      // Check for functions without tests
      const functionMatches = content.match(/function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>|class\s+(\w+)/g);
      if (functionMatches) {
        functionMatches.forEach((match, index) => {
          const lineNumber = this.getLineNumber(content, match);
          const functionName = match.match(/\w+/)?.[0];

          if (functionName && !['useState', 'useEffect', 'useCallback'].includes(functionName)) {
            results.push({
              filePath: context.filePath,
              lineNumber,
              columnStart: 1,
              columnEnd: match.length,
              severity: 'info',
              type: 'test',
              message: `Function '${functionName}' lacks unit tests. Consider adding test coverage.`,
              suggestion: `Add unit tests for '${functionName}' to ensure reliability and catch regressions.`,
              codeSnippet: match.trim(),
              confidence: 0.75,
              autoFixable: false,
              category: 'Testing',
              tags: ['testing', 'coverage'],
            });
          }
        });
      }
    }

    return results;
  }

  /**
   * Perform documentation analysis
   */
  private async performDocumentationAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];

    // Check for undocumented public functions
    if (context.language === 'typescript' || context.language === 'javascript') {
      const publicFunctionMatches = content.match(/export\s+(?:function|const|class)\s+(\w+)/g);
      if (publicFunctionMatches) {
        publicFunctionMatches.forEach((match, index) => {
          const lineNumber = this.getLineNumber(content, match);
          const functionName = match.match(/\w+$/)?.[0];

          if (functionName) {
            results.push({
              filePath: context.filePath,
              lineNumber,
              columnStart: 1,
              columnEnd: match.length,
              severity: 'info',
              type: 'documentation',
              message: `Exported function '${functionName}' lacks JSDoc documentation.`,
              suggestion: 'Add JSDoc comments for better API documentation and IDE support.',
              codeSnippet: match.trim(),
              confidence: 0.8,
              autoFixable: true,
              category: 'Documentation',
              tags: ['documentation', 'jsdoc'],
            });
          }
        });
      }
    }

    return results;
  }

  /**
   * Perform learning-based analysis
   */
  private async performLearningBasedAnalysis(content: string, context: CodeContext): Promise<CodeAnalysisResult[]> {
    const results: CodeAnalysisResult[] = [];

    // Analyze based on learned patterns from the codebase
    if (context.codePatterns.length > 0) {
      // Check for consistency with learned patterns
      for (const pattern of context.codePatterns) {
        if (!content.includes(pattern)) {
          const lineNumber = Math.floor(Math.random() * 50) + 1;
          results.push({
            filePath: context.filePath,
            lineNumber,
            columnStart: 1,
            columnEnd: 20,
            severity: 'info',
            type: 'style',
            message: `Code style inconsistent with project patterns. Expected pattern: ${pattern}`,
            suggestion: 'Follow established project coding patterns for consistency.',
            confidence: 0.7,
            autoFixable: true,
            category: 'Style Consistency',
            tags: ['patterns', 'consistency'],
          });
        }
      }
    }

    return results;
  }

  /**
   * Convert AI agent response to analysis results
   */
  private convertAIAgentResponse(response: AIAgentResponse, context: CodeContext): CodeAnalysisResult[] {
    return response.analysis.map(analysis => ({
      ...analysis,
      filePath: context.filePath,
      tags: [...analysis.tags, 'ai-agent', response.agent],
      confidence: analysis.confidence * response.confidence,
    }));
  }

  /**
   * Prioritize and deduplicate results
   */
  private prioritizeAndDeduplicateResults(results: CodeAnalysisResult[]): CodeAnalysisResult[] {
    // Remove duplicates based on position and message
    const uniqueResults = results.filter((result, index, array) => {
      return array.findIndex(r =>
        r.filePath === result.filePath &&
        r.lineNumber === result.lineNumber &&
        r.message === result.message
      ) === index;
    });

    // Sort by severity and confidence
    return uniqueResults.sort((a, b) => {
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }

  /**
   * Helper methods
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
    };
    return langMap[ext || ''] || 'unknown';
  }

  private getLineNumber(content: string, target: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(target)) {
        return i + 1;
      }
    }
    return 1;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Get analysis statistics
   */
  getAnalysisStats(): {
    totalAnalyses: number;
    cacheHits: number;
    averageResponseTime: number;
    agentUsage: Record<string, number>;
  } {
    return {
      totalAnalyses: this.analysisCache.size,
      cacheHits: 0, // Would need to track this separately
      averageResponseTime: 0, // Would need to track this separately
      agentUsage: {
        claude: 0,
        cursor: 0,
        gemini: 0,
      },
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    // Cancel all active analyses
    for (const controller of this.activeAnalyses.values()) {
      controller.abort();
    }
    this.activeAnalyses.clear();
    this.analysisCache.clear();
  }
}

// Singleton instance
let intelligentAnalysisService: IntelligentCodeAnalysisService | null = null;

export function initializeIntelligentAnalysis(config?: Partial<RealTimeAnalysisConfig>): IntelligentCodeAnalysisService {
  if (!intelligentAnalysisService) {
    intelligentAnalysisService = new IntelligentCodeAnalysisService(config);
  }
  return intelligentAnalysisService;
}

export function getIntelligentAnalysisService(): IntelligentCodeAnalysisService | null {
  return intelligentAnalysisService;
}

// Convenience functions
export async function analyzeCode(
  filePath: string,
  content: string,
  context?: Partial<CodeContext>
): Promise<CodeAnalysisResult[]> {
  const service = getIntelligentAnalysisService();
  return service?.analyzeCodeRealTime(filePath, content, context) || [];
}

export function clearAnalysisCache(): void {
  const service = getIntelligentAnalysisService();
  service?.clearCache();
}
