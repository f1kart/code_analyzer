// RefactoringEngine.ts - Advanced code refactoring and transformation engine
// Provides intelligent refactoring suggestions with automated code transformations

import { ParseResult, FunctionSymbol, ClassSymbol } from './LanguageParser';

export interface RefactoringSuggestion {
  id: string;
  type: 'extract-method' | 'rename' | 'move' | 'inline' | 'extract-class' | 'introduce-parameter';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  beforeCode: string;
  afterCode: string;
  lineNumbers: number[];
  rationale: string;
  benefits: string[];
  risks: string[];
}

export interface RefactoringResult {
  success: boolean;
  originalCode: string;
  refactoredCode: string;
  suggestions: RefactoringSuggestion[];
  warnings: string[];
  metrics: RefactoringMetrics;
}

export interface RefactoringMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  duplication: number;
  testability: number;
}

export class RefactoringEngine {
  private refactoringPatterns: RefactoringPattern[] = [];

  constructor() {
    this.initializeRefactoringPatterns();
  }

  /**
   * Analyzes code and generates refactoring suggestions
   * @param parseResult Parsed AST and symbol information
   * @param sourceCode Original source code
   * @returns Array of refactoring suggestions with before/after code
   */
  async analyze(parseResult: ParseResult, sourceCode: string): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];

    // Analyze functions for refactoring opportunities
    for (const func of parseResult.symbols.functions) {
      suggestions.push(...this.analyzeFunctionForRefactoring(func, sourceCode));
    }

    // Analyze classes for refactoring opportunities
    for (const cls of parseResult.symbols.classes) {
      suggestions.push(...this.analyzeClassForRefactoring(cls, sourceCode));
    }

    // Analyze overall code structure
    suggestions.push(...this.analyzeCodeStructure(sourceCode));

    return this.prioritizeSuggestions(suggestions);
  }

  /**
   * Applies a refactoring suggestion to source code
   * @param sourceCode Original source code
   * @param suggestion Refactoring suggestion to apply
   * @returns Refactored code and analysis
   */
  async apply(sourceCode: string, suggestion: RefactoringSuggestion): Promise<string> {
    switch (suggestion.type) {
      case 'extract-method':
        return this.applyExtractMethod(sourceCode, suggestion);
      case 'rename':
        return this.applyRename(sourceCode, suggestion);
      case 'move':
        return this.applyMove(sourceCode, suggestion);
      case 'inline':
        return this.applyInline(sourceCode, suggestion);
      case 'extract-class':
        return this.applyExtractClass(sourceCode, suggestion);
      case 'introduce-parameter':
        return this.applyIntroduceParameter(sourceCode, suggestion);
      default:
        return sourceCode;
    }
  }

  /**
   * Applies multiple refactoring suggestions in sequence
   * @param sourceCode Original source code
   * @param suggestions Array of refactoring suggestions to apply
   * @returns Refactored code with all changes applied
   */
  async applyMultiple(sourceCode: string, suggestions: RefactoringSuggestion[]): Promise<RefactoringResult> {
    let currentCode = sourceCode;
    const warnings: string[] = [];
    const metrics = this.calculateMetrics(currentCode);

    for (const suggestion of suggestions) {
      try {
        currentCode = await this.apply(currentCode, suggestion);
      } catch (error) {
        warnings.push(`Failed to apply refactoring ${suggestion.title}: ${error}`);
      }
    }

    return {
      success: warnings.length === 0,
      originalCode: sourceCode,
      refactoredCode: currentCode,
      suggestions,
      warnings,
      metrics: this.calculateMetrics(currentCode)
    };
  }

  private analyzeFunctionForRefactoring(func: FunctionSymbol, sourceCode: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = sourceCode.split('\n');

    // Extract method opportunities
    if (func.complexity > 10) {
      suggestions.push({
        id: `extract_method_${func.name}`,
        type: 'extract-method',
        title: `Extract method from ${func.name}`,
        description: `Break down complex function ${func.name} into smaller methods`,
        priority: 'high',
        effort: 'medium',
        impact: 'high',
        beforeCode: this.extractFunctionCode(func, lines),
        afterCode: this.generateExtractedMethods(func, lines),
        lineNumbers: [func.location.line],
        rationale: `Function ${func.name} has high complexity (${func.complexity}) and should be broken down`,
        benefits: ['Improved readability', 'Better testability', 'Easier maintenance'],
        risks: ['May require updating call sites', 'Could introduce bugs if not done carefully']
      });
    }

    // Rename opportunities
    if (this.shouldRenameFunction(func)) {
      suggestions.push({
        id: `rename_${func.name}`,
        type: 'rename',
        title: `Rename function ${func.name}`,
        description: `Rename ${func.name} to better reflect its purpose`,
        priority: 'medium',
        effort: 'low',
        impact: 'medium',
        beforeCode: func.name,
        afterCode: this.suggestBetterName(func),
        lineNumbers: [func.location.line],
        rationale: `Function name ${func.name} could be more descriptive`,
        benefits: ['Improved code readability', 'Better self-documentation'],
        risks: ['Requires updating all references']
      });
    }

    return suggestions;
  }

  private analyzeClassForRefactoring(cls: ClassSymbol, sourceCode: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Extract class opportunities
    if (cls.members.length > 20) {
      suggestions.push({
        id: `extract_class_${cls.name}`,
        type: 'extract-class',
        title: `Extract class from ${cls.name}`,
        description: `Break down large class ${cls.name} into smaller classes`,
        priority: 'high',
        effort: 'high',
        impact: 'high',
        beforeCode: cls.name,
        afterCode: this.generateExtractedClasses(cls),
        lineNumbers: [cls.location.line],
        rationale: `Class ${cls.name} has too many responsibilities (${cls.members.length} members)`,
        benefits: ['Better separation of concerns', 'Improved maintainability'],
        risks: ['Significant architectural changes', 'May affect multiple files']
      });
    }

    return suggestions;
  }

  private analyzeCodeStructure(sourceCode: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const lines = sourceCode.split('\n');

    // Look for duplicated code
    const duplicatedBlocks = this.findDuplicatedCode(lines);
    duplicatedBlocks.forEach((block, index) => {
      suggestions.push({
        id: `extract_duplicated_${index}`,
        type: 'extract-method',
        title: 'Extract duplicated code',
        description: `Extract duplicated code block into a reusable method`,
        priority: 'medium',
        effort: 'medium',
        impact: 'medium',
        beforeCode: block.original,
        afterCode: `extractedMethod_${index}()`,
        lineNumbers: block.lines,
        rationale: 'Identical or similar code blocks found',
        benefits: ['Reduces code duplication', 'Improves maintainability'],
        risks: ['May generalize too much', 'Could make code less readable']
      });
    });

    return suggestions;
  }

  private applyExtractMethod(sourceCode: string, suggestion: RefactoringSuggestion): string {
    // Extract the identified code block into a separate method
    const lines = sourceCode.split('\n');
    const extractedCode = suggestion.beforeCode;

    // Generate method name and signature
    const methodName = `extractedMethod_${Date.now()}`;
    const methodSignature = `function ${methodName}() {\n  ${extractedCode}\n}`;

    // Replace the original code with method call
    const modifiedSource = sourceCode.replace(extractedCode, `${methodName}();`);

    // Add the extracted method at the end of the file
    return modifiedSource + '\n\n' + methodSignature;
  }

  private applyRename(sourceCode: string, suggestion: RefactoringSuggestion): string {
    return sourceCode.replace(
      new RegExp(`\\b${suggestion.beforeCode}\\b`, 'g'),
      suggestion.afterCode
    );
  }

  private applyMove(sourceCode: string, suggestion: RefactoringSuggestion): string {
    // Move code to a different location (simplified implementation)
    return sourceCode.replace(suggestion.beforeCode, '');
  }

  private applyInline(sourceCode: string, suggestion: RefactoringSuggestion): string {
    // Inline method calls (opposite of extract method)
    return sourceCode.replace(
      new RegExp(`${suggestion.afterCode}\\(?\\)?`, 'g'),
      suggestion.beforeCode
    );
  }

  private applyExtractClass(sourceCode: string, suggestion: RefactoringSuggestion): string {
    // Extract class members into a separate class (simplified implementation)
    const lines = sourceCode.split('\n');
    const classPattern = new RegExp(`class ${suggestion.beforeCode}[\\s\\S]*?}`);
    const match = sourceCode.match(classPattern);

    if (match) {
      const newClassName = suggestion.afterCode;
      const extractedClass = match[0].replace(suggestion.beforeCode, newClassName);

      // Replace original class with reference to new class
      const modifiedSource = sourceCode.replace(match[0], `// Class extracted to ${newClassName}\nconst ${newClassName} = require('./${newClassName}');`);

      return modifiedSource + '\n\n' + extractedClass;
    }

    return sourceCode;
  }

  private applyIntroduceParameter(sourceCode: string, suggestion: RefactoringSuggestion): string {
    // Introduce a new parameter to a function (simplified implementation)
    const functionPattern = new RegExp(`function ${suggestion.beforeCode}\\(.*?\\)`);
    return sourceCode.replace(functionPattern, (match) => {
      const paramName = suggestion.afterCode.split('(')[1]?.split(')')[0] || 'newParam';
      return match.replace(/\((.*?)\)/, `($1, ${paramName})`);
    });
  }

  private extractFunctionCode(func: FunctionSymbol, lines: string[]): string {
    // Extract function code based on line numbers (simplified)
    const startLine = Math.max(0, func.location.line - 1);
    const endLine = Math.min(lines.length - 1, startLine + 20); // Assume 20 lines for demo
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private generateExtractedMethods(func: FunctionSymbol, lines: string[]): string {
    // Generate extracted method code (simplified)
    return `function extractedMethodFrom${func.name}() {\n  // Extracted logic from ${func.name}\n  return null;\n}`;
  }

  private generateExtractedClasses(cls: ClassSymbol): string {
    // Generate extracted class code (simplified)
    return `class ExtractedFrom${cls.name} {\n  // Extracted functionality\n}`;
  }

  private shouldRenameFunction(func: FunctionSymbol): boolean {
    // Check if function name follows naming conventions
    const badPatterns = [
      /^[a-z]$/, // Single letter
      /^[A-Z]/, // Starts with capital (not constructor)
      /_\d+$/, // Ends with number
      /test|temp|foo|bar/i // Generic names
    ];

    return badPatterns.some(pattern => pattern.test(func.name));
  }

  private suggestBetterName(func: FunctionSymbol): string {
    // Generate better function names based on context (simplified)
    const suggestions = {
      'get': 'retrieve',
      'set': 'update',
      'calc': 'calculate',
      'temp': 'temporary',
      'foo': 'processData',
      'bar': 'handleOperation'
    };

    return suggestions[func.name as keyof typeof suggestions] || `process${func.name}`;
  }

  private findDuplicatedCode(lines: string[]): Array<{original: string, lines: number[]}> {
    // Find duplicated code blocks (simplified implementation)
    const blocks: Array<{original: string, lines: number[]}> = [];
    const minBlockSize = 3;

    for (let i = 0; i < lines.length - minBlockSize; i++) {
      for (let j = i + minBlockSize; j < lines.length - minBlockSize; j++) {
        if (lines.slice(i, i + minBlockSize).join('\n') === lines.slice(j, j + minBlockSize).join('\n')) {
          blocks.push({
            original: lines.slice(i, i + minBlockSize).join('\n'),
            lines: [i + 1, j + 1] // Convert to 1-based line numbers
          });
          break; // Move to next block
        }
      }
    }

    return blocks;
  }

  private prioritizeSuggestions(suggestions: RefactoringSuggestion[]): RefactoringSuggestion[] {
    return suggestions.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by impact
      const impactOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
      if (impactDiff !== 0) return impactDiff;

      // Finally by effort (prefer lower effort)
      const effortOrder = { 'low': 3, 'medium': 2, 'high': 1 };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });
  }

  private calculateMetrics(code: string): RefactoringMetrics {
    const lines = code.split('\n');

    return {
      linesOfCode: lines.length,
      cyclomaticComplexity: this.calculateComplexity(code),
      maintainabilityIndex: this.calculateMaintainabilityIndex(code),
      duplication: this.calculateDuplication(code),
      testability: this.calculateTestability(code)
    };
  }

  private calculateComplexity(code: string): number {
    // Simplified complexity calculation
    const complexityIndicators = [
      /if\s*\(/g,
      /else\s+if/g,
      /switch\s*\(/g,
      /case\s+\w+/g,
      /catch\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /\?\s*.*\s*:/g // Ternary operators
    ];

    return complexityIndicators.reduce((complexity, pattern) => {
      return complexity + (code.match(pattern) || []).length;
    }, 1);
  }

  private calculateMaintainabilityIndex(code: string): number {
    // Simplified maintainability calculation
    const volume = code.length;
    const complexity = this.calculateComplexity(code);
    const lines = code.split('\n').length;

    // Basic maintainability index (simplified formula)
    const index = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(lines)) * 100 / 171);

    return Math.round(index);
  }

  private calculateDuplication(code: string): number {
    // Simplified duplication calculation
    const lines = code.split('\n');
    const totalLines = lines.length;
    const uniqueLines = new Set(lines).size;

    return Math.round(((totalLines - uniqueLines) / totalLines) * 100);
  }

  private calculateTestability(code: string): number {
    // Simplified testability calculation
    const testablePatterns = [
      /function\s+\w+\s*\(/g, // Named functions
      /export\s+/g, // Exported functions
      /class\s+\w+/g, // Classes
      /describe\s*\(/g, // Test blocks
      /it\s*\(/g, // Test cases
      /test\s*\(/g // Test functions
    ];

    const score = testablePatterns.reduce((score, pattern) => {
      return score + (code.match(pattern) || []).length;
    }, 0);

    return Math.min(100, score * 10);
  }

  private initializeRefactoringPatterns(): void {
    // Initialize common refactoring patterns and rules
    this.refactoringPatterns = [
      // Extract method patterns
      // Move method patterns
      // Rename patterns
      // Inline patterns
    ];
  }
}

interface RefactoringPattern {
  name: string;
  pattern: RegExp;
  type: RefactoringSuggestion['type'];
  description: string;
}
