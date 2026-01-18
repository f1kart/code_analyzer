// CodeReviewEngine.ts - Enterprise-grade AI-powered code review system
// Provides senior developer level code analysis, bug detection, refactoring suggestions, and test recommendations

import { LanguageParser } from "./LanguageParser";
import { BugDetectionService } from "./BugDetectionService";
import type { BugReport } from "./BugDetectionService";
import { TestRecommendationEngine } from "./TestRecommendationEngine";
import type { TestRecommendation } from "./TestRecommendationEngine";
import { RefactoringEngine } from "./RefactoringEngine";
import type { RefactoringSuggestion } from "./RefactoringEngine";
import { QualityMetricsCalculator } from "./QualityMetricsCalculator";
import type { QualityMetrics } from "./QualityMetricsCalculator";
import { AIAgentIntegrator } from "./AIAgentIntegrator";
import type { AIAgentContext } from "./AIAgentIntegrator";

// Re-export types for external use
export type { BugReport, TestRecommendation, RefactoringSuggestion, QualityMetrics };

export interface CodeReviewResult {
  filePath: string;
  language: string;
  reviewComments: ReviewComment[];
  bugs: BugReport[];
  refactoringSuggestions: RefactoringSuggestion[];
  testRecommendations: TestRecommendation[];
  qualityMetrics: QualityMetrics;
  aiAgentContext: AIAgentContext;
  timestamp: Date;
  reviewId: string;
}

export interface ReviewComment {
  id: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  type: "info" | "warning" | "error" | "suggestion" | "praise";
  severity: "info" | "low" | "medium" | "high" | "critical";
  category:
    | "style"
    | "performance"
    | "security"
    | "maintainability"
    | "functionality"
    | "testing";
  message: string;
  suggestion?: string;
  codeExample?: string;
  relatedRules?: string[];
  autoFixable: boolean;
  confidence: number; // 0-1
}

export interface CodeReviewOptions {
  includeBugs: boolean;
  includeRefactoring: boolean;
  includeTests: boolean;
  includeQualityMetrics: boolean;
  includeAIAgentContext: boolean;
  severityThreshold: "info" | "low" | "medium" | "high" | "critical";
  maxComments: number;
  enableAutoFix: boolean;
  agentIntegrations: string[]; // ['claude', 'cursor', 'gemini']
}

export class CodeReviewEngine {
  private parser: LanguageParser;
  private bugDetector: BugDetectionService;
  private testEngine: TestRecommendationEngine;
  private refactoringEngine: RefactoringEngine;
  private qualityCalculator: QualityMetricsCalculator;
  private aiIntegrator: AIAgentIntegrator;

  constructor() {
    this.parser = new LanguageParser();
    this.bugDetector = new BugDetectionService();
    this.testEngine = new TestRecommendationEngine();
    this.refactoringEngine = new RefactoringEngine();
    this.qualityCalculator = new QualityMetricsCalculator();
    this.aiIntegrator = new AIAgentIntegrator();
  }

  /**
   * Performs comprehensive AI-powered code review on a file
   * @param filePath Path to the file to review
   * @param code Content of the file to review
   * @param options Review configuration options
   * @returns Complete review result with all analysis
   */
  async reviewCode(
    filePath: string,
    code: string,
    options: Partial<CodeReviewOptions> = {},
  ): Promise<CodeReviewResult> {
    const opts: CodeReviewOptions = {
      includeBugs: true,
      includeRefactoring: true,
      includeTests: true,
      includeQualityMetrics: true,
      includeAIAgentContext: true,
      severityThreshold: "medium",
      maxComments: 100,
      enableAutoFix: false,
      agentIntegrations: ["claude", "cursor", "gemini"],
      ...options,
    };

    const reviewId = this.generateReviewId();
    const language = this.detectLanguage(filePath);

    // Parse the code for AST and structural analysis
    const parseResult = await this.parser.parse(code, language);

    const [bugs, refactoringSuggestions, testRecommendations, qualityMetrics, aiAgentContext] =
      await Promise.all([
        opts.includeBugs
          ? this.bugDetector.analyze(parseResult, code)
          : Promise.resolve<BugReport[]>([]),
        opts.includeRefactoring
          ? this.refactoringEngine.analyze(parseResult, code)
          : Promise.resolve<RefactoringSuggestion[]>([]),
        opts.includeTests
          ? this.testEngine.analyze(parseResult, code)
          : Promise.resolve<TestRecommendation[]>([]),
        opts.includeQualityMetrics
          ? this.qualityCalculator.calculate(parseResult, code)
          : Promise.resolve(this.getDefaultQualityMetrics()),
        opts.includeAIAgentContext
          ? this.aiIntegrator.generateContext(
              parseResult,
              code,
              opts.agentIntegrations,
            )
          : Promise.resolve(this.getDefaultAIAgentContext()),
      ]);

    const reviewComments = this.generateReviewComments(
      {
        bugs,
        refactoringSuggestions,
        testRecommendations,
        qualityMetrics,
      },
      opts,
    );

    // Filter comments by severity threshold
    const filteredComments = reviewComments.filter(
      (comment) =>
        this.getSeverityLevel(comment.severity) >=
        this.getSeverityLevel(opts.severityThreshold),
    );

    // Limit number of comments
    const limitedComments = filteredComments.slice(0, opts.maxComments);

    return {
      filePath,
      language,
      reviewComments: limitedComments,
      bugs,
      refactoringSuggestions,
      testRecommendations,
      qualityMetrics,
      aiAgentContext,
      timestamp: new Date(),
      reviewId,
    };
  }

  /**
   * Reviews multiple files in batch for large-scale code review
   * @param files Array of file paths and their contents
   * @param options Review configuration options
   * @returns Array of review results
   */
  async reviewBatch(
    files: Array<{ path: string; content: string }>,
    options: Partial<CodeReviewOptions> = {},
  ): Promise<CodeReviewResult[]> {
    const promises = files.map(({ path, content }) =>
      this.reviewCode(path, content, options),
    );

    return Promise.all(promises);
  }

  /**
   * Generates a one-click fix for a specific bug or issue
   * @param filePath Path to the file
   * @param code Original code content
   * @param bug Bug report to fix
   * @returns Fixed code and explanation
   */
  async generateFix(
    filePath: string,
    code: string,
    bug: BugReport,
  ): Promise<{ fixedCode: string; explanation: string }> {
    return this.bugDetector.generateFix(filePath, code, bug);
  }

  /**
   * Generates a complete test suite for a file
   * @param filePath Path to the file
   * @param code Code content
   * @param testType Type of tests to generate
   * @returns Complete test code
   */
  async generateTests(
    filePath: string,
    code: string,
    testType: "unit" | "integration" | "e2e" = "unit",
  ): Promise<string> {
    return this.testEngine.generateTestSuite(filePath, code, testType);
  }

  /**
   * Applies a refactoring suggestion to code
   * @param code Original code
   * @param refactoring Refactoring suggestion
   * @returns Refactored code
   */
  async applyRefactoring(
    code: string,
    refactoring: RefactoringSuggestion,
  ): Promise<string> {
    return this.refactoringEngine.apply(code, refactoring);
  }

  /**
   * Exports review context for external AI agents
   * @param reviewResult Review result to export
   * @param targetAgent Target AI agent ('claude' | 'cursor' | 'gemini')
   * @returns Agent-specific context and prompts
   */
  exportForAgent(
    reviewResult: CodeReviewResult,
    targetAgent: "claude" | "cursor" | "gemini",
  ): string {
    return this.aiIntegrator.exportForAgent(reviewResult, targetAgent);
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
      html: "html",
      css: "css",
      scss: "scss",
      less: "less",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sh: "bash",
      ps1: "powershell",
      sql: "sql",
    };

    return languageMap[ext || ""] || "plaintext";
  }

  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReviewComments(
    analysis: {
      bugs: BugReport[];
      refactoringSuggestions: RefactoringSuggestion[];
      testRecommendations: TestRecommendation[];
      qualityMetrics: QualityMetrics;
    },
    options: CodeReviewOptions,
  ): ReviewComment[] {
    const comments: ReviewComment[] = [];

    // Generate comments from different analysis engines
    if (options.includeBugs && analysis.bugs.length > 0) {
      comments.push(...this.generateBugComments(analysis.bugs));
    }

    if (options.includeRefactoring && analysis.refactoringSuggestions.length > 0) {
      comments.push(
        ...this.generateRefactoringComments(analysis.refactoringSuggestions),
      );
    }

    if (options.includeTests && analysis.testRecommendations.length > 0) {
      comments.push(...this.generateTestComments(analysis.testRecommendations));
    }

    if (options.includeQualityMetrics) {
      comments.push(...this.generateQualityComments(analysis.qualityMetrics));
    }

    return comments;
  }

  private generateBugComments(bugs: BugReport[]): ReviewComment[] {
    return bugs.map((bug) => ({
      id: `bug_${bug.id}`,
      lineNumber: bug.lineNumber,
      columnStart: 0,
      columnEnd: 0,
      type: bug.severity === "critical" ? "error" : "warning",
      severity: bug.severity,
      category: this.mapBugTypeToCategory(bug.type),
      message: `${bug.title}: ${bug.description}`,
      suggestion: bug.suggestedFix,
      relatedRules: bug.cweId ? [`CWE-${bug.cweId}`] : [],
      autoFixable: true,
      confidence: bug.confidence,
    }));
  }

  private generateRefactoringComments(
    refactorings: RefactoringSuggestion[],
  ): ReviewComment[] {
    return refactorings.map((refactoring) => ({
      id: `refactor_${refactoring.id}`,
      lineNumber: refactoring.lineNumbers[0] || 1,
      columnStart: 0,
      columnEnd: 0,
      type: "suggestion",
      severity: "low",
      category: "maintainability",
      message: refactoring.description,
      suggestion: refactoring.afterCode,
      autoFixable: true,
      confidence: 0.8,
    }));
  }

  private generateTestComments(tests: TestRecommendation[]): ReviewComment[] {
    return tests.map((test) => ({
      id: `test_${test.id}`,
      lineNumber: 1,
      columnStart: 0,
      columnEnd: 0,
      type: "info",
      severity: "low",
      category: "testing",
      message: `${test.title}: ${test.description}`,
      suggestion: test.testCode,
      autoFixable: false,
      confidence: 0.9,
    }));
  }

  private generateQualityComments(metrics: QualityMetrics): ReviewComment[] {
    const comments: ReviewComment[] = [];

    if (metrics.maintainabilityIndex < 70) {
      comments.push({
        id: "quality_maintainability",
        lineNumber: 1,
        columnStart: 0,
        columnEnd: 0,
        type: "warning",
        severity: "medium",
        category: "maintainability",
        message: `Maintainability index is low (${metrics.maintainabilityIndex}/100). Consider refactoring for better readability.`,
        autoFixable: false,
        confidence: 0.8,
      });
    }

    if (metrics.cyclomaticComplexity > 10) {
      comments.push({
        id: "quality_complexity",
        lineNumber: 1,
        columnStart: 0,
        columnEnd: 0,
        type: "warning",
        severity: "medium",
        category: "maintainability",
        message: `High cyclomatic complexity (${metrics.cyclomaticComplexity}). Consider breaking down complex functions.`,
        autoFixable: false,
        confidence: 0.8,
      });
    }

    if (typeof metrics.codeCoverage === "number" && metrics.codeCoverage < 80) {
      comments.push({
        id: "quality_coverage",
        lineNumber: 1,
        columnStart: 0,
        columnEnd: 0,
        type: "info",
        severity: "low",
        category: "testing",
        message: `Code coverage is below the recommended threshold (${metrics.codeCoverage}%). Consider adding more automated tests.`,
        autoFixable: false,
        confidence: 0.7,
      });
    }

    if (metrics.testability < 70) {
      comments.push({
        id: "quality_testability",
        lineNumber: 1,
        columnStart: 0,
        columnEnd: 0,
        type: "suggestion",
        severity: "low",
        category: "testing",
        message: `Testability score is low (${metrics.testability}/100). Break down complex units and inject dependencies to simplify testing.`,
        autoFixable: false,
        confidence: 0.7,
      });
    }

    if (metrics.securityScore < 80) {
      comments.push({
        id: "quality_security",
        lineNumber: 1,
        columnStart: 0,
        columnEnd: 0,
        type: "warning",
        severity: "medium",
        category: "security",
        message: `Security score is below target (${metrics.securityScore}/100). Review security-critical paths and harden input validation.`,
        autoFixable: false,
        confidence: 0.75,
      });
    }

    return comments;
  }

  private mapBugTypeToCategory(type: string): ReviewComment["category"] {
    const mapping: Record<string, ReviewComment["category"]> = {
      syntax: "functionality",
      logic: "functionality",
      runtime: "functionality",
      security: "security",
      performance: "performance",
    };
    return mapping[type] || "functionality";
  }

  private getSeverityLevel(severity: string): number {
    const levels = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity as keyof typeof levels] || 1;
  }

  private getDefaultQualityMetrics(): QualityMetrics {
    return {
      maintainabilityIndex: 0,
      cyclomaticComplexity: 0,
      linesOfCode: 0,
      codeCoverage: undefined,
      technicalDebt: 0,
      codeSmells: 0,
      duplication: 0,
      testability: 0,
      performanceScore: 0,
      securityScore: 0,
      documentation: 0,
    };
  }

  private getDefaultAIAgentContext(): AIAgentContext {
    return {
      suggestedPrompts: [],
      relatedPatterns: [],
      similarCodeExamples: [],
      learningResources: [],
      agentSpecificGuidance: {},
    };
  }
}
