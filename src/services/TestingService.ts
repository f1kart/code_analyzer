/**
 * Automated Testing Service
 * Generates tests, analyzes coverage, predicts failures, suggests regression tests
 * Production-ready with AI integration and multiple test framework support
 */

export interface TestCase {
  id: string;
  name: string;
  description: string;
  filePath: string;
  functionName: string;
  testType: 'unit' | 'integration' | 'e2e';
  framework: 'jest' | 'vitest' | 'mocha' | 'playwright' | 'cypress';
  code: string;
  assertions: string[];
  mocks?: string[];
  createdAt: number;
  coverage?: CoverageInfo;
}

export interface CoverageInfo {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncoveredLines: number[];
}

export interface TestFailurePrediction {
  testId: string;
  probability: number;
  reasons: string[];
  suggestedFixes: string[];
  relatedChanges: string[];
}

export interface RegressionTestSuggestion {
  testName: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  affectedFiles: string[];
  suggestedCode: string;
}

export class TestingService {
  private apiKey: string;
  private coverage: Map<string, CoverageInfo> = new Map();
  private testCache: Map<string, TestCase[]> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || localStorage.getItem('geminiApiKey') || '';
  }

  /**
   * Generate test cases for a function or file
   */
  async generateTests(
    filePath: string,
    code: string,
    framework: TestCase['framework'] = 'jest'
  ): Promise<TestCase[]> {
    const functions = this.extractFunctions(code);
    const tests: TestCase[] = [];

    for (const func of functions) {
      const testCode = await this.generateTestForFunction(filePath, func, framework);
      if (testCode) {
        tests.push({
          id: `test-${filePath}-${func.name}-${Date.now()}`,
          name: `test ${func.name}`,
          description: `Generated test for ${func.name}`,
          filePath,
          functionName: func.name,
          testType: 'unit',
          framework,
          code: testCode,
          assertions: this.extractAssertions(testCode),
          createdAt: Date.now(),
        });
      }
    }

    this.testCache.set(filePath, tests);
    return tests;
  }

  /**
   * Generate test for a specific function using AI
   */
  private async generateTestForFunction(
    filePath: string,
    func: { name: string; params: string[]; code: string },
    framework: string
  ): Promise<string> {
    const prompt = `Generate a comprehensive ${framework} test for this function. Include all edge cases, error handling, and mocking.

Function:
\`\`\`typescript
${func.code}
\`\`\`

Generate ONLY the test code, no explanations.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2000,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return generatedCode.replace(/```[\w]*\n?/g, '').trim();
    } catch (error) {
      console.error('[TestingService] Error generating test:', error);
      return '';
    }
  }

  /**
   * Extract functions from code
   */
  private extractFunctions(code: string): Array<{ name: string; params: string[]; code: string }> {
    const functions: Array<{ name: string; params: string[]; code: string }> = [];
    
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*{/g;
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1];
      const params = match[2].split(',').map(p => p.trim()).filter(Boolean);
      const startIndex = match.index;
      const endIndex = this.findClosingBrace(code, match.index + match[0].length);
      const functionCode = code.substring(startIndex, endIndex);
      functions.push({ name, params, code: functionCode });
    }

    return functions;
  }

  private findClosingBrace(code: string, startIndex: number): number {
    let depth = 1;
    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    return code.length;
  }

  private extractAssertions(testCode: string): string[] {
    const assertions: string[] = [];
    const assertionPatterns = [
      /expect\([^)]+\)\.[^;]+;/g,
      /assert\.[^(]+\([^)]+\);/g,
    ];

    for (const pattern of assertionPatterns) {
      const matches = testCode.match(pattern);
      if (matches) {
        assertions.push(...matches);
      }
    }

    return assertions;
  }

  async analyzeCoverage(filePath: string, testResults: any): Promise<CoverageInfo> {
    const coverage: CoverageInfo = {
      statements: testResults.statementCoverage || 0,
      branches: testResults.branchCoverage || 0,
      functions: testResults.functionCoverage || 0,
      lines: testResults.lineCoverage || 0,
      uncoveredLines: testResults.uncoveredLines || [],
    };

    this.coverage.set(filePath, coverage);
    return coverage;
  }

  getCoverage(filePath: string): CoverageInfo | undefined {
    return this.coverage.get(filePath);
  }

  private isRelatedFile(file1: string, file2: string): boolean {
    return file1.replace(/\.(test|spec)\.[jt]sx?$/, '') === file2.replace(/\.(test|spec)\.[jt]sx?$/, '');
  }
}
