// BugDetectionService.ts - Advanced bug detection and analysis service
// Identifies security vulnerabilities, logic errors, performance issues, and code smells

import { ParseResult, Diagnostic } from './LanguageParser';

export interface BugReport {
  id: string;
  type: 'syntax' | 'logic' | 'runtime' | 'security' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  lineNumber: number;
  suggestedFix: string;
  confidence: number;
  cweId?: string; // Common Weakness Enumeration
  impact: string;
  category: 'injection' | 'authentication' | 'authorization' | 'cryptography' | 'input-validation' | 'error-handling' | 'race-condition' | 'memory' | 'logic' | 'performance';
}

export interface FixSuggestion {
  description: string;
  codeBefore: string;
  codeAfter: string;
  explanation: string;
  automated: boolean;
}

export class BugDetectionService {
  private securityPatterns: SecurityPattern[] = [];
  private logicPatterns: LogicPattern[] = [];
  private performancePatterns: PerformancePattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Analyzes code for bugs and security vulnerabilities
   * @param parseResult Parsed AST and symbol information
   * @param sourceCode Original source code
   * @returns Array of detected bugs with fix suggestions
   */
  async analyze(parseResult: ParseResult, sourceCode: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    const lines = sourceCode.split('\n');

    // Run different types of analysis
    bugs.push(...this.detectSecurityIssues(parseResult, lines));
    bugs.push(...this.detectLogicErrors(parseResult, lines));
    bugs.push(...this.detectRuntimeIssues(parseResult, lines));
    bugs.push(...this.detectPerformanceIssues(parseResult, lines));
    bugs.push(...this.detectCodeSmells(parseResult, lines));

    // Remove duplicates and sort by severity
    const uniqueBugs = this.deduplicateBugs(bugs);
    return this.sortBugsBySeverity(uniqueBugs);
  }

  /**
   * Generates a specific fix for a detected bug
   * @param filePath Path to the source file
   * @param sourceCode Original source code
   * @param bug Bug report to fix
   * @returns Fix suggestion with before/after code
   */
  async generateFix(
    filePath: string,
    sourceCode: string,
    bug: BugReport
  ): Promise<{ fixedCode: string; explanation: string }> {
    const lines = sourceCode.split('\n');
    const fix = this.generateFixForBug(bug, lines);

    if (!fix) {
      return {
        fixedCode: sourceCode,
        explanation: 'No automated fix available for this issue.'
      };
    }

    return {
      fixedCode: this.applyFixToCode(sourceCode, fix),
      explanation: fix.explanation
    };
  }

  private detectSecurityIssues(parseResult: ParseResult, lines: string[]): BugReport[] {
    const bugs: BugReport[] = [];

    // SQL Injection detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for dangerous SQL patterns
      if (this.containsSQLInjection(line, i + 1)) {
        bugs.push({
          id: `sql_injection_${i}`,
          type: 'security',
          severity: 'critical',
          title: 'Potential SQL Injection Vulnerability',
          description: 'Direct string concatenation in SQL query can lead to injection attacks',
          lineNumber: i + 1,
          suggestedFix: 'Use parameterized queries or prepared statements',
          confidence: 0.9,
          cweId: 'CWE-89',
          impact: 'Attackers can execute arbitrary SQL commands',
          category: 'injection'
        });
      }

      // Check for XSS vulnerabilities
      if (this.containsXSSVulnerability(line, i + 1)) {
        bugs.push({
          id: `xss_${i}`,
          type: 'security',
          severity: 'high',
          title: 'Potential Cross-Site Scripting (XSS) Vulnerability',
          description: 'Unescaped user input being output to HTML',
          lineNumber: i + 1,
          suggestedFix: 'Escape user input or use a templating engine with auto-escaping',
          confidence: 0.8,
          cweId: 'CWE-79',
          impact: 'Attackers can inject malicious scripts',
          category: 'injection'
        });
      }

      // Check for insecure random number generation
      if (this.containsInsecureRandom(line, i + 1)) {
        bugs.push({
          id: `insecure_random_${i}`,
          type: 'security',
          severity: 'medium',
          title: 'Insecure Random Number Generation',
          description: 'Using Math.random() for security-sensitive operations',
          lineNumber: i + 1,
          suggestedFix: 'Use crypto.randomBytes() or crypto.getRandomValues()',
          confidence: 0.9,
          cweId: 'CWE-338',
          impact: 'Predictable random values compromise security',
          category: 'cryptography'
        });
      }
    }

    return bugs;
  }

  private detectLogicErrors(parseResult: ParseResult, lines: string[]): BugReport[] {
    const bugs: BugReport[] = [];

    // Check for infinite loops
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (this.containsInfiniteLoop(line, i + 1)) {
        bugs.push({
          id: `infinite_loop_${i}`,
          type: 'logic',
          severity: 'high',
          title: 'Potential Infinite Loop',
          description: 'Loop condition may never evaluate to false',
          lineNumber: i + 1,
          suggestedFix: 'Add proper loop termination condition or maximum iteration limit',
          confidence: 0.7,
          impact: 'Application may freeze or consume excessive resources',
          category: 'logic'
        });
      }

      // Check for null pointer exceptions
      if (this.containsNullPointerRisk(line, i + 1)) {
        bugs.push({
          id: `null_pointer_${i}`,
          type: 'runtime',
          severity: 'medium',
          title: 'Potential Null Pointer Exception',
          description: 'Accessing properties of potentially null/undefined values',
          lineNumber: i + 1,
          suggestedFix: 'Add null/undefined checks before accessing properties',
          confidence: 0.8,
          impact: 'Runtime errors and application crashes',
          category: 'error-handling'
        });
      }
    }

    return bugs;
  }

  private detectRuntimeIssues(parseResult: ParseResult, lines: string[]): BugReport[] {
    const bugs: BugReport[] = [];

    // Check for memory leaks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (this.containsMemoryLeak(line, i + 1)) {
        bugs.push({
          id: `memory_leak_${i}`,
          type: 'runtime',
          severity: 'medium',
          title: 'Potential Memory Leak',
          description: 'Event listeners or timers not properly cleaned up',
          lineNumber: i + 1,
          suggestedFix: 'Ensure proper cleanup of event listeners and timers',
          confidence: 0.6,
          impact: 'Gradual memory consumption leading to performance degradation',
          category: 'memory'
        });
      }
    }

    return bugs;
  }

  private detectPerformanceIssues(parseResult: ParseResult, lines: string[]): BugReport[] {
    const bugs: BugReport[] = [];

    // Check for inefficient operations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (this.containsInefficientOperation(line, i + 1)) {
        bugs.push({
          id: `performance_${i}`,
          type: 'performance',
          severity: 'low',
          title: 'Performance Issue',
          description: 'Inefficient operation that could impact performance',
          lineNumber: i + 1,
          suggestedFix: 'Consider optimizing this operation or caching results',
          confidence: 0.6,
          impact: 'Reduced application performance',
          category: 'performance'
        });
      }
    }

    return bugs;
  }

  private detectCodeSmells(parseResult: ParseResult, lines: string[]): BugReport[] {
    const bugs: BugReport[] = [];

    // Check for long functions
    parseResult.symbols.functions.forEach(func => {
      if (func.location.line > 0) {
        const functionLines = this.countFunctionLines(func, lines);
        if (functionLines > 50) {
          bugs.push({
            id: `long_function_${func.name}`,
            type: 'logic',
            severity: 'low',
            title: 'Long Function',
            description: `Function ${func.name} is too long (${functionLines} lines)`,
            lineNumber: func.location.line,
            suggestedFix: 'Consider breaking this function into smaller, more focused functions',
            confidence: 0.8,
            impact: 'Reduced maintainability and testability',
            category: 'logic'
          });
        }
      }
    });

    // Check for large classes
    parseResult.symbols.classes.forEach(cls => {
      if (cls.members.length > 20) {
        bugs.push({
          id: `large_class_${cls.name}`,
          type: 'logic',
          severity: 'low',
          title: 'Large Class',
          description: `Class ${cls.name} has too many members (${cls.members.length})`,
          lineNumber: cls.location.line,
          suggestedFix: 'Consider breaking this class into smaller, more focused classes',
          confidence: 0.7,
          impact: 'Reduced maintainability and increased complexity',
          category: 'logic'
        });
      }
    });

    return bugs;
  }

  private containsSQLInjection(line: string, lineNumber: number): boolean {
    // Check for dangerous SQL patterns
    const dangerousPatterns = [
      /query\s*=\s*["'].*\+.*["']/i,
      /SELECT.*\+.*FROM/i,
      /INSERT.*\+.*VALUES/i,
      /UPDATE.*\+.*SET/i,
      /DELETE.*\+.*FROM/i
    ];

    return dangerousPatterns.some(pattern => pattern.test(line));
  }

  private containsXSSVulnerability(line: string, lineNumber: number): boolean {
    // Check for unescaped output patterns
    const xssPatterns = [
      /innerHTML\s*=\s*[^<]*\$\{[^}]*\}/i,
      /outerHTML\s*=\s*[^<]*\$\{[^}]*\}/i,
      /document\.write\s*\([^)]*\$\{[^}]*\}/i,
      /innerHTML\s*=\s*["'][^"']*\+[^"']*["']/i
    ];

    return xssPatterns.some(pattern => pattern.test(line));
  }

  private containsInsecureRandom(line: string, lineNumber: number): boolean {
    // Check for insecure random usage
    return /\bMath\.random\(\)/.test(line) &&
           (line.includes('password') || line.includes('token') || line.includes('secret') || line.includes('key'));
  }

  private containsInfiniteLoop(line: string, lineNumber: number): boolean {
    // Check for loops without clear exit conditions
    const infiniteLoopPatterns = [
      /for\s*\(\s*;;\s*\)/i,
      /while\s*\(\s*true\s*\)/i,
      /while\s*\(\s*1\s*\)/i
    ];

    return infiniteLoopPatterns.some(pattern => pattern.test(line));
  }

  private containsNullPointerRisk(line: string, lineNumber: number): boolean {
    // Check for property access without null checks
    const nullRiskPatterns = [
      /(\w+)\.(\w+)\s*\?\s*\w+.*:.*\w+\.(\w+)/, // Ternary with property access in else
      /(\w+)\.(\w+)\s*&&\s*\w+\.(\w+)/, // Logical AND with property access on both sides
      /!\s*(\w+)\s*&&\s*\w+\.(\w+)/ // Not null check followed by property access
    ];

    return nullRiskPatterns.some(pattern => pattern.test(line));
  }

  private containsMemoryLeak(line: string, lineNumber: number): boolean {
    // Check for potential memory leaks
    const memoryLeakPatterns = [
      /addEventListener\s*\(\s*[^,]+,\s*[^)]+\)/.test(line) && !/removeEventListener/.test(line),
      /setInterval\s*\(\s*[^,]+,\s*[^)]+\)/.test(line) && !/clearInterval/.test(line),
      /setTimeout\s*\(\s*[^,]+,\s*[^)]+\)/.test(line) && !/clearTimeout/.test(line)
    ];

    return memoryLeakPatterns.some(pattern => pattern);
  }

  private containsInefficientOperation(line: string, lineNumber: number): boolean {
    // Check for inefficient patterns
    const inefficientPatterns = [
      /\bfor\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+\.length\s*;\s*\w+\+\+\s*\)\s*{\s*\w+\[\w+\]\s*}/.test(line) && /indexOf/.test(line),
      /\.find\s*\(\s*[^)]*\)\s*===\s*-1/.test(line), // Inefficient negative search
      /Object\.assign\s*\(\s*\{\s*\},\s*[^}]+\)/.test(line) // Unnecessary Object.assign with empty object
    ];

    return inefficientPatterns.some(pattern => pattern);
  }

  private countFunctionLines(func: any, lines: string[]): number {
    // Simplified function line counting - in production would use AST
    let count = 0;
    let braceCount = 0;
    let inFunction = false;

    for (let i = func.location.line - 1; i < lines.length && (inFunction || braceCount > 0); i++) {
      const line = lines[i];
      count++;

      // Count braces to determine function boundaries
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (i === func.location.line - 1) {
        inFunction = true;
      }

      if (braceCount <= 0 && i > func.location.line - 1) {
        break;
      }
    }

    return count;
  }

  private generateFixForBug(bug: BugReport, lines: string[]): FixSuggestion | null {
    // Generate fixes based on bug type
    switch (bug.category) {
      case 'injection':
        return this.generateInjectionFix(bug, lines);
      case 'error-handling':
        return this.generateErrorHandlingFix(bug, lines);
      case 'memory':
        return this.generateMemoryFix(bug, lines);
      default:
        return null;
    }
  }

  private generateInjectionFix(bug: BugReport, lines: string[]): FixSuggestion | null {
    const line = lines[bug.lineNumber - 1];

    if (line.includes('innerHTML')) {
      return {
        description: 'Escape HTML content to prevent XSS',
        codeBefore: line,
        codeAfter: line.replace(/innerHTML\s*=\s*/, 'textContent = '),
        explanation: 'Using textContent instead of innerHTML prevents script injection',
        automated: true
      };
    }

    return null;
  }

  private generateErrorHandlingFix(bug: BugReport, lines: string[]): FixSuggestion | null {
    const line = lines[bug.lineNumber - 1];

    if (line.includes('.')) {
      return {
        description: 'Add null/undefined check',
        codeBefore: line,
        codeAfter: `if (${line.split('.')[0]}) {\n  ${line}\n}`,
        explanation: 'Adding null check prevents runtime errors',
        automated: true
      };
    }

    return null;
  }

  private generateMemoryFix(bug: BugReport, lines: string[]): FixSuggestion | null {
    const line = lines[bug.lineNumber - 1];

    if (line.includes('addEventListener')) {
      return {
        description: 'Store reference for cleanup',
        codeBefore: line,
        codeAfter: `const listener = ${line};\n// Store 'listener' for cleanup with removeEventListener`,
        explanation: 'Store event listener reference for proper cleanup',
        automated: false
      };
    }

    return null;
  }

  private applyFixToCode(sourceCode: string, fix: FixSuggestion): string {
    const lines = sourceCode.split('\n');
    lines[fix.codeBefore.split('\n')[0].length - 1] = fix.codeAfter;
    return lines.join('\n');
  }

  private deduplicateBugs(bugs: BugReport[]): BugReport[] {
    const seen = new Set<string>();
    return bugs.filter(bug => {
      const key = `${bug.lineNumber}_${bug.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sortBugsBySeverity(bugs: BugReport[]): BugReport[] {
    const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    return bugs.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }

  private initializePatterns(): void {
    // Initialize security, logic, and performance detection patterns
    // This would be expanded with comprehensive rule sets
  }
}

// Supporting interfaces and classes
interface SecurityPattern {
  name: string;
  pattern: RegExp;
  cweId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface LogicPattern {
  name: string;
  pattern: RegExp;
  description: string;
  fix: string;
}

interface PerformancePattern {
  name: string;
  pattern: RegExp;
  impact: string;
  optimization: string;
}
