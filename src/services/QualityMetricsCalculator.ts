// QualityMetricsCalculator.ts - Comprehensive code quality metrics calculation
// Measures maintainability, complexity, testability, and other quality indicators

import { ParseResult } from './LanguageParser';

export interface QualityMetrics {
  maintainabilityIndex: number; // 0-100
  cyclomaticComplexity: number;
  linesOfCode: number;
  codeCoverage?: number;
  technicalDebt: number; // in minutes
  codeSmells: number;
  duplication: number; // percentage
  testability: number;
  performanceScore: number;
  securityScore: number;
  documentation: number;
}

export interface QualityReport {
  overall: number; // Overall quality score 0-100
  metrics: QualityMetrics;
  recommendations: QualityRecommendation[];
  strengths: string[];
  weaknesses: string[];
  benchmarks: QualityBenchmark[];
}

export interface QualityRecommendation {
  category: 'maintainability' | 'performance' | 'security' | 'testability' | 'documentation';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface QualityBenchmark {
  metric: keyof QualityMetrics;
  current: number;
  industryAverage: number;
  industryStandard: number;
  status: 'below-average' | 'average' | 'above-average' | 'excellent';
}

export class QualityMetricsCalculator {
  private industryBenchmarks: Map<string, number> = new Map();

  constructor() {
    this.initializeBenchmarks();
  }

  /**
   * Calculates comprehensive quality metrics for source code
   * @param parseResult Parsed AST and symbol information
   * @param sourceCode Original source code
   * @returns Complete quality metrics and analysis
   */
  async calculate(parseResult: ParseResult, sourceCode: string): Promise<QualityMetrics> {
    return {
      maintainabilityIndex: this.calculateMaintainabilityIndex(sourceCode),
      cyclomaticComplexity: this.calculateCyclomaticComplexity(parseResult, sourceCode),
      linesOfCode: sourceCode.split('\n').length,
      codeCoverage: undefined, // Would be calculated from test coverage data
      technicalDebt: this.calculateTechnicalDebt(sourceCode),
      codeSmells: this.detectCodeSmells(parseResult, sourceCode),
      duplication: this.calculateDuplication(sourceCode),
      testability: this.calculateTestability(parseResult, sourceCode),
      performanceScore: this.calculatePerformanceScore(sourceCode),
      securityScore: this.calculateSecurityScore(sourceCode),
      documentation: this.calculateDocumentationScore(sourceCode)
    };
  }

  /**
   * Generates a comprehensive quality report with recommendations
   * @param parseResult Parsed AST and symbol information
   * @param sourceCode Original source code
   * @returns Complete quality report with benchmarks and recommendations
   */
  async generateReport(parseResult: ParseResult, sourceCode: string): Promise<QualityReport> {
    const metrics = await this.calculate(parseResult, sourceCode);
    const benchmarks = this.generateBenchmarks(metrics);
    const recommendations = this.generateRecommendations(metrics);
    const strengths = this.identifyStrengths(metrics);
    const weaknesses = this.identifyWeaknesses(metrics);

    const overall = this.calculateOverallScore(metrics);

    return {
      overall,
      metrics,
      recommendations,
      strengths,
      weaknesses,
      benchmarks
    };
  }

  private calculateMaintainabilityIndex(sourceCode: string): number {
    const volume = sourceCode.length;
    const lines = sourceCode.split('\n').length;
    const complexity = this.calculateComplexity(sourceCode);

    // Microsoft Maintainability Index formula (simplified)
    const index = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(lines)) * 100 / 171);

    return Math.round(index);
  }

  private calculateCyclomaticComplexity(parseResult: ParseResult, sourceCode: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionPatterns = [
      /\bif\s*\(/g,
      /\belse\s+if/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+\w+/g,
      /\bcatch\s*\(/g,
      /\?\s*.*\s*:/g, // Ternary operators
      /&&/g, // Logical AND
      /\|\|/g // Logical OR
    ];

    decisionPatterns.forEach(pattern => {
      const matches = sourceCode.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    // Add complexity from functions
    complexity += parseResult.symbols.functions.length * 0.5;

    return Math.round(complexity);
  }

  private calculateTechnicalDebt(sourceCode: string): number {
    // Estimate technical debt in minutes based on code quality issues
    let debt = 0;

    // Long functions (>50 lines)
    const longFunctions = sourceCode.match(/function[\s\S]{50,}/g) || [];
    debt += longFunctions.length * 30; // 30 minutes per long function

    // Code duplication
    const duplication = this.calculateDuplication(sourceCode);
    debt += (duplication / 100) * sourceCode.length * 0.5; // 0.5 minutes per duplicated line

    // Complex conditions
    const complexConditions = sourceCode.match(/(\w+\s*[\|\&]\s*\w+\s*[\|\&]\s*\w+)/g) || [];
    debt += complexConditions.length * 15; // 15 minutes per complex condition

    // Missing error handling
    const errorHandlingIssues = this.detectErrorHandlingIssues(sourceCode);
    debt += errorHandlingIssues * 20; // 20 minutes per missing error handling

    return Math.round(debt);
  }

  private detectCodeSmells(parseResult: ParseResult, sourceCode: string): number {
    let smells = 0;

    // Long parameter lists
    parseResult.symbols.functions.forEach(func => {
      if (func.parameters.length > 5) smells++;
    });

    // Deep nesting
    const nestingLevel = this.calculateNestingLevel(sourceCode);
    smells += Math.max(0, nestingLevel - 3);

    // Large classes
    parseResult.symbols.classes.forEach(cls => {
      if (cls.members.length > 20) smells++;
    });

    // Feature envy (methods using too many external properties)
    smells += this.detectFeatureEnvy(sourceCode);

    // Data clumps (related data always passed together)
    smells += this.detectDataClumps(sourceCode);

    return smells;
  }

  private calculateDuplication(sourceCode: string): number {
    const lines = sourceCode.split('\n');
    const totalLines = lines.length;

    // Simple duplication detection (in production would use more sophisticated algorithms)
    const uniqueLines = new Set(lines.map(line => line.trim())).size;
    const duplication = ((totalLines - uniqueLines) / totalLines) * 100;

    return Math.round(duplication);
  }

  private calculateTestability(parseResult: ParseResult, sourceCode: string): number {
    let score = 100;

    // Reduce score for complex functions
    parseResult.symbols.functions.forEach(func => {
      if (func.complexity > 10) score -= 5;
      if (func.parameters.length > 5) score -= 3;
    });

    // Reduce score for large classes
    parseResult.symbols.classes.forEach(cls => {
      if (cls.members.length > 20) score -= 10;
    });

    // Increase score for good practices
    if (sourceCode.includes('describe(')) score += 5;
    if (sourceCode.includes('it(')) score += 5;
    if (sourceCode.includes('test(')) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculatePerformanceScore(sourceCode: string): number {
    let score = 100;

    // Penalize inefficient patterns
    if (sourceCode.includes('forEach')) score -= 2;
    if (sourceCode.includes('indexOf')) score -= 1;
    if (sourceCode.includes('Math.random()')) score -= 3;

    // Bonus for good patterns
    if (sourceCode.includes('const ')) score += 1;
    if (sourceCode.includes('let ')) score += 1;
    if (sourceCode.includes('async/await')) score += 2;

    return Math.max(0, Math.min(100, score));
  }

  private calculateSecurityScore(sourceCode: string): number {
    let score = 100;

    // Penalize security issues
    if (sourceCode.includes('innerHTML')) score -= 20;
    if (sourceCode.includes('eval(')) score -= 30;
    if (sourceCode.includes('Math.random()') && sourceCode.includes('password')) score -= 15;

    // Bonus for security best practices
    if (sourceCode.includes('crypto.')) score += 5;
    if (sourceCode.includes('helmet')) score += 10;
    if (sourceCode.includes('bcrypt')) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateDocumentationScore(sourceCode: string): number {
    const lines = sourceCode.split('\n');
    let documentedLines = 0;

    lines.forEach(line => {
      if (line.trim().startsWith('//') ||
          line.trim().startsWith('/*') ||
          line.trim().startsWith('*') ||
          line.trim().startsWith('/**')) {
        documentedLines++;
      }
    });

    const documentationRatio = (documentedLines / lines.length) * 100;
    return Math.round(documentationRatio);
  }

  private calculateComplexity(sourceCode: string): number {
    // Simplified complexity calculation
    const operators = ['+', '-', '*', '/', '%', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '?', ':'];
    let complexity = 0;

    operators.forEach(op => {
      const regex = new RegExp(`\\${op}`, 'g');
      const matches = sourceCode.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  private detectErrorHandlingIssues(sourceCode: string): number {
    let issues = 0;

    // Check for try-catch blocks
    const tryBlocks = (sourceCode.match(/try\s*{/g) || []).length;
    const catchBlocks = (sourceCode.match(/catch\s*\(/g) || []).length;

    if (tryBlocks > catchBlocks) {
      issues += tryBlocks - catchBlocks;
    }

    // Check for unhandled promise rejections
    if (sourceCode.includes('.then(') && !sourceCode.includes('.catch(')) {
      issues++;
    }

    return issues;
  }

  private calculateNestingLevel(sourceCode: string): number {
    const lines = sourceCode.split('\n');
    let maxNesting = 0;
    let currentNesting = 0;

    lines.forEach(line => {
      const trimmed = line.trim();

      if (trimmed.includes('{')) {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      }

      if (trimmed.includes('}')) {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    });

    return maxNesting;
  }

  private detectFeatureEnvy(sourceCode: string): number {
    // Simplified feature envy detection
    const methodCalls = sourceCode.match(/\.(\w+)\s*\(/g) || [];
    const externalCalls = methodCalls.filter(call => {
      // Check if the method belongs to a different class (simplified)
      return !sourceCode.includes(`function ${call.slice(1, -2)}`);
    });

    return Math.floor(externalCalls.length / 10); // Every 10 external calls is a smell
  }

  private detectDataClumps(sourceCode: string): number {
    // Simplified data clump detection
    // Look for functions that always receive the same set of parameters
    const functionCalls = sourceCode.match(/\w+\s*\([^)]+\)/g) || [];

    // Group calls by parameter count and patterns (simplified)
    const patterns = new Map<string, number>();

    functionCalls.forEach(call => {
      const params = call.match(/\(([^)]+)\)/)?.[1];
      if (params) {
        const paramCount = params.split(',').length;
        const key = `${paramCount}_${params.length}`;
        patterns.set(key, (patterns.get(key) || 0) + 1);
      }
    });

    // If we see the same parameter pattern many times, it might be a data clump
    return Array.from(patterns.values()).filter(count => count > 5).length;
  }

  private generateBenchmarks(metrics: QualityMetrics): QualityBenchmark[] {
    return Object.entries(metrics).map(([key, value]) => {
      const benchmark = this.industryBenchmarks.get(key) || 50;
      const standard = this.industryBenchmarks.get(`${key}_standard`) || 75;

      let status: QualityBenchmark['status'];
      if (value >= standard) status = 'excellent';
      else if (value >= benchmark) status = 'above-average';
      else if (value >= benchmark * 0.8) status = 'average';
      else status = 'below-average';

      return {
        metric: key as keyof QualityMetrics,
        current: value,
        industryAverage: benchmark,
        industryStandard: standard,
        status
      };
    });
  }

  private generateRecommendations(metrics: QualityMetrics): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    if (metrics.maintainabilityIndex < 70) {
      recommendations.push({
        category: 'maintainability',
        priority: 'high',
        title: 'Improve maintainability',
        description: 'Code maintainability is below industry standards',
        effort: 'medium',
        impact: 'high'
      });
    }

    if (metrics.cyclomaticComplexity > 15) {
      recommendations.push({
        category: 'maintainability',
        priority: 'high',
        title: 'Reduce cyclomatic complexity',
        description: 'Functions are too complex and hard to understand',
        effort: 'medium',
        impact: 'high'
      });
    }

    if (metrics.testability < 70) {
      recommendations.push({
        category: 'testability',
        priority: 'medium',
        title: 'Improve testability',
        description: 'Code structure makes testing difficult',
        effort: 'low',
        impact: 'medium'
      });
    }

    if (metrics.securityScore < 80) {
      recommendations.push({
        category: 'security',
        priority: 'high',
        title: 'Address security concerns',
        description: 'Potential security vulnerabilities detected',
        effort: 'medium',
        impact: 'high'
      });
    }

    if (metrics.documentation < 20) {
      recommendations.push({
        category: 'documentation',
        priority: 'low',
        title: 'Add documentation',
        description: 'Code lacks sufficient documentation',
        effort: 'low',
        impact: 'low'
      });
    }

    return recommendations;
  }

  private identifyStrengths(metrics: QualityMetrics): string[] {
    const strengths: string[] = [];

    if (metrics.maintainabilityIndex > 80) {
      strengths.push('Excellent maintainability');
    }

    if (metrics.testability > 80) {
      strengths.push('Highly testable code structure');
    }

    if (metrics.securityScore > 90) {
      strengths.push('Strong security practices');
    }

    if (metrics.performanceScore > 90) {
      strengths.push('Optimized performance');
    }

    if (metrics.documentation > 30) {
      strengths.push('Well documented code');
    }

    return strengths;
  }

  private identifyWeaknesses(metrics: QualityMetrics): string[] {
    const weaknesses: string[] = [];

    if (metrics.maintainabilityIndex < 50) {
      weaknesses.push('Poor maintainability');
    }

    if (metrics.cyclomaticComplexity > 20) {
      weaknesses.push('High complexity');
    }

    if (metrics.codeSmells > 10) {
      weaknesses.push('Many code smells');
    }

    if (metrics.duplication > 15) {
      weaknesses.push('High code duplication');
    }

    if (metrics.securityScore < 60) {
      weaknesses.push('Security vulnerabilities');
    }

    return weaknesses;
  }

  private calculateOverallScore(metrics: QualityMetrics): number {
    // Weighted average of key metrics
    const weights = {
      maintainabilityIndex: 0.3,
      cyclomaticComplexity: 0.2, // Inverted (lower is better)
      testability: 0.2,
      securityScore: 0.15,
      performanceScore: 0.1,
      documentation: 0.05
    };

    const complexityScore = Math.max(0, 100 - metrics.cyclomaticComplexity);

    const weightedScore =
      metrics.maintainabilityIndex * weights.maintainabilityIndex +
      complexityScore * weights.cyclomaticComplexity +
      metrics.testability * weights.testability +
      metrics.securityScore * weights.securityScore +
      metrics.performanceScore * weights.performanceScore +
      metrics.documentation * weights.documentation;

    return Math.round(weightedScore);
  }

  private initializeBenchmarks(): void {
    // Industry average benchmarks
    this.industryBenchmarks.set('maintainabilityIndex', 65);
    this.industryBenchmarks.set('maintainabilityIndex_standard', 80);
    this.industryBenchmarks.set('cyclomaticComplexity', 8);
    this.industryBenchmarks.set('cyclomaticComplexity_standard', 5);
    this.industryBenchmarks.set('testability', 70);
    this.industryBenchmarks.set('testability_standard', 85);
    this.industryBenchmarks.set('securityScore', 75);
    this.industryBenchmarks.set('securityScore_standard', 90);
    this.industryBenchmarks.set('performanceScore', 80);
    this.industryBenchmarks.set('performanceScore_standard', 90);
    this.industryBenchmarks.set('documentation', 25);
    this.industryBenchmarks.set('documentation_standard', 40);
  }
}
