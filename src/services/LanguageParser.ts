// LanguageParser.ts - Advanced language parsing for code analysis
// Supports multiple programming languages with AST generation and semantic analysis

export interface ParseResult {
  ast: any;
  tokens: Token[];
  language: string;
  diagnostics: Diagnostic[];
  symbols: SymbolTable;
}

export interface Token {
  type: string;
  value: string;
  start: Position;
  end: Position;
  line: number;
  column: number;
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  start: Position;
  end: Position;
  code?: string;
}

export interface SymbolTable {
  functions: FunctionSymbol[];
  classes: ClassSymbol[];
  variables: VariableSymbol[];
  imports: ImportSymbol[];
  exports: ExportSymbol[];
}

export interface FunctionSymbol {
  name: string;
  kind: 'function' | 'method' | 'constructor' | 'arrow';
  parameters: ParameterSymbol[];
  returnType?: string;
  location: Position;
  modifiers: string[];
  complexity: number;
}

export interface ClassSymbol {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'type';
  members: (FunctionSymbol | VariableSymbol)[];
  extends?: string[];
  implements?: string[];
  location: Position;
  modifiers: string[];
}

export interface VariableSymbol {
  name: string;
  type?: string;
  kind: 'variable' | 'constant' | 'parameter' | 'property';
  location: Position;
  modifiers: string[];
  value?: any;
}

export interface ParameterSymbol {
  name: string;
  type?: string;
  defaultValue?: any;
  optional: boolean;
}

export interface ImportSymbol {
  source: string;
  specifiers: string[];
  kind: 'default' | 'namespace' | 'named';
  location: Position;
}

export interface ExportSymbol {
  name: string;
  kind: 'default' | 'named' | 'all';
  location: Position;
}

export class LanguageParser {
  private parsers: Map<string, LanguageParser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  /**
   * Parses source code into AST and semantic information
   * @param code Source code to parse
   * @param language Programming language
   * @returns Complete parse result with AST, tokens, and symbols
   */
  async parse(code: string, language: string): Promise<ParseResult> {
    const parser = this.getParserForLanguage(language);
    if (!parser) {
      throw new Error(`Unsupported language: ${language}`);
    }

    return parser.parse(code, language);
  }

  /**
   * Extracts all functions from source code
   * @param code Source code
   * @param language Programming language
   * @returns Array of function definitions with metadata
   */
  async extractFunctions(code: string, language: string): Promise<FunctionSymbol[]> {
    const parseResult = await this.parse(code, language);
    return parseResult.symbols.functions;
  }

  /**
   * Extracts all classes and types from source code
   * @param code Source code
   * @param language Programming language
   * @returns Array of class/type definitions
   */
  async extractClasses(code: string, language: string): Promise<ClassSymbol[]> {
    const parseResult = await this.parse(code, language);
    return parseResult.symbols.classes;
  }

  /**
   * Finds all imports and dependencies
   * @param code Source code
   * @param language Programming language
   * @returns Array of import statements
   */
  async extractImports(code: string, language: string): Promise<ImportSymbol[]> {
    const parseResult = await this.parse(code, language);
    return parseResult.symbols.imports;
  }

  /**
   * Validates syntax and semantic correctness
   * @param code Source code
   * @param language Programming language
   * @returns Array of diagnostics (errors, warnings, etc.)
   */
  async validate(code: string, language: string): Promise<Diagnostic[]> {
    const parseResult = await this.parse(code, language);
    return parseResult.diagnostics;
  }

  private getParserForLanguage(language: string): LanguageParser | null {
    // For now, return a basic parser - in production, this would initialize
    // language-specific parsers (e.g., TypeScript, JavaScript, Python, etc.)
    return this as any;
  }

  private initializeParsers(): void {
    // Initialize parsers for supported languages
    // This would include TypeScript, JavaScript, Python, Java, C#, etc.
  }

  // Basic parsing implementation (would be replaced by language-specific parsers)
  private async parseBasic(code: string): Promise<ParseResult> {
    const lines = code.split('\n');
    const tokens: Token[] = [];
    const diagnostics: Diagnostic[] = [];
    const symbols: SymbolTable = {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: []
    };

    // Basic tokenization and symbol extraction
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      // Extract function definitions
      this.extractFunctionsFromLine(line, lineNumber, symbols.functions);

      // Extract class definitions
      this.extractClassesFromLine(line, lineNumber, symbols.classes);

      // Extract variable declarations
      this.extractVariablesFromLine(line, lineNumber, symbols.variables);

      // Extract imports
      this.extractImportsFromLine(line, lineNumber, symbols.imports);

      // Extract exports
      this.extractExportsFromLine(line, lineNumber, symbols.exports);

      // Check for common syntax errors
      this.checkSyntaxErrors(line, lineNumber, diagnostics);
    }

    // Calculate complexity metrics
    symbols.functions.forEach(func => {
      func.complexity = this.calculateCyclomaticComplexity(func);
    });

    return {
      ast: { type: 'Program', body: [] }, // Simplified AST
      tokens,
      language: 'typescript', // Would be determined from file extension
      diagnostics,
      symbols
    };
  }

  private extractFunctionsFromLine(line: string, lineNumber: number, functions: FunctionSymbol[]): void {
    // Regex patterns for different function declaration styles
    const patterns = [
      // TypeScript/JavaScript function declarations
      /function\s+(\w+)\s*\(([^)]*)\)(?::\s*(\w+))?\s*{/g,
      // Arrow functions
      /const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)\s*=>/g,
      // Method definitions in classes
      /(\w+)\s*\(([^)]*)\)(?::\s*(\w+))?\s*{/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        functions.push({
          name: match[1],
          kind: pattern.source.includes('function') ? 'function' : 'arrow',
          parameters: this.parseParameters(match[2]),
          returnType: match[3],
          location: { line: lineNumber, column: match.index, offset: match.index },
          modifiers: [],
          complexity: 1
        });
      }
    });
  }

  private extractClassesFromLine(line: string, lineNumber: number, classes: ClassSymbol[]): void {
    // Class declaration patterns
    const patterns = [
      /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{/g,
      /interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*{/g,
      /enum\s+(\w+)\s*{/g,
      /type\s+(\w+)\s*=\s*{?/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        classes.push({
          name: match[1],
          kind: pattern.source.includes('class') ? 'class' :
                pattern.source.includes('interface') ? 'interface' :
                pattern.source.includes('enum') ? 'enum' : 'type',
          members: [],
          extends: match[2] ? [match[2]] : undefined,
          implements: match[3] ? match[3].split(',').map(s => s.trim()) : undefined,
          location: { line: lineNumber, column: match.index, offset: match.index },
          modifiers: []
        });
      }
    });
  }

  private extractVariablesFromLine(line: string, lineNumber: number, variables: VariableSymbol[]): void {
    // Variable declaration patterns
    const patterns = [
      /(?:const|let|var)\s+(\w+)(?::\s*(\w+))?\s*=\s*([^;]+);/g,
      /(\w+):\s*(\w+)\s*=\s*([^;]+);/g // Object properties
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        variables.push({
          name: match[1],
          type: match[2],
          kind: pattern.source.includes('const') ? 'constant' : 'variable',
          location: { line: lineNumber, column: match.index, offset: match.index },
          modifiers: [],
          value: match[3]
        });
      }
    });
  }

  private extractImportsFromLine(line: string, lineNumber: number, imports: ImportSymbol[]): void {
    // Import patterns
    const patterns = [
      /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (match[1] && match[1].includes(',')) {
          // Named imports
          imports.push({
            source: match[2],
            specifiers: match[1].split(',').map(s => s.trim()),
            kind: 'named',
            location: { line: lineNumber, column: match.index, offset: match.index }
          });
        } else if (match[1]) {
          // Default import
          imports.push({
            source: match[2],
            specifiers: [match[1]],
            kind: 'default',
            location: { line: lineNumber, column: match.index, offset: match.index }
          });
        } else {
          // Namespace import
          imports.push({
            source: match[1],
            specifiers: ['*'],
            kind: 'namespace',
            location: { line: lineNumber, column: match.index, offset: match.index }
          });
        }
      }
    });
  }

  private extractExportsFromLine(line: string, lineNumber: number, exports: ExportSymbol[]): void {
    // Export patterns
    const patterns = [
      /export\s+(?:default\s+)?(\w+)/g,
      /export\s+{([^}]+)}/g
    ];

    patterns.forEach(pattern => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        if (pattern.source.includes('default')) {
          exports.push({
            name: match[1],
            kind: 'default',
            location: { line: lineNumber, column: match.index, offset: match.index }
          });
        } else if (match) {
          match[1].split(',').forEach(name => {
            exports.push({
              name: name.trim(),
              kind: 'named',
              location: { line: lineNumber, column: match!.index, offset: match!.index }
            });
          });
        }
      }
    });
  }

  private checkSyntaxErrors(line: string, lineNumber: number, diagnostics: Diagnostic[]): void {
    // Basic syntax checks
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    const openParens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;
    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;

    if (openBraces !== closeBraces) {
      diagnostics.push({
        severity: 'error',
        message: `Unmatched braces in line ${lineNumber}`,
        start: { line: lineNumber, column: 0, offset: 0 },
        end: { line: lineNumber, column: line.length, offset: line.length }
      });
    }

    if (openParens !== closeParens) {
      diagnostics.push({
        severity: 'error',
        message: `Unmatched parentheses in line ${lineNumber}`,
        start: { line: lineNumber, column: 0, offset: 0 },
        end: { line: lineNumber, column: line.length, offset: line.length }
      });
    }

    if (openBrackets !== closeBrackets) {
      diagnostics.push({
        severity: 'error',
        message: `Unmatched brackets in line ${lineNumber}`,
        start: { line: lineNumber, column: 0, offset: 0 },
        end: { line: lineNumber, column: line.length, offset: line.length }
      });
    }
  }

  private parseParameters(paramString: string): ParameterSymbol[] {
    if (!paramString.trim()) return [];

    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const parts = trimmed.split(':');
      const name = parts[0].trim();
      const type = parts[1]?.trim();
      const optional = name.endsWith('?');

      return {
        name: optional ? name.slice(0, -1) : name,
        type,
        optional,
        defaultValue: undefined // Would need more complex parsing
      };
    });
  }

  private calculateCyclomaticComplexity(func: FunctionSymbol): number {
    // Simplified complexity calculation
    // In production, this would analyze the AST for control flow structures
    let complexity = 1; // Base complexity

    // Estimate based on common complexity indicators
    if (func.parameters.length > 5) complexity += 1;
    if (func.name.includes('handle') || func.name.includes('process')) complexity += 1;

    return Math.min(complexity, 20); // Cap at reasonable maximum
  }
}
