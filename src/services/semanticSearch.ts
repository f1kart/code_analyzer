import { listProjectTextFiles, readTextFile } from './fileAccessGateway';

export interface SearchResult {
  id: string;
  filePath: string;
  fileName: string;
  lineNumber: number;
  columnNumber: number;
  content: string;
  context: string;
  relevanceScore: number;
  type: 'code' | 'comment' | 'documentation' | 'variable' | 'function' | 'class' | 'import';
  language: string;
  matchReason: string;
  semanticContext: string[];
}

type LineClassification =
  | 'code'
  | 'comment'
  | 'documentation'
  | 'import'
  | 'class'
  | 'function'
  | 'variable';

export interface SearchIndex {
  files: Map<string, FileIndex>;
  symbols: Map<string, SymbolIndex>;
  concepts: Map<string, ConceptIndex>;
  lastUpdated: number;
}

export interface FileIndex {
  filePath: string;
  language: string;
  content: string;
  tokens: string[];
  embeddings: number[];
  symbols: string[];
  concepts: string[];
  lastModified: number;
}

export interface SymbolIndex {
  name: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'interface' | 'type';
  filePath: string;
  lineNumber: number;
  signature: string;
  description: string;
  embeddings: number[];
  references: Reference[];
}

export interface ConceptIndex {
  concept: string;
  description: string;
  relatedFiles: string[];
  relatedSymbols: string[];
  embeddings: number[];
  frequency: number;
}

export interface Reference {
  filePath: string;
  lineNumber: number;
  type: 'definition' | 'usage' | 'import' | 'call';
}

export interface SearchOptions {
  includeCode: boolean;
  includeComments: boolean;
  includeDocumentation: boolean;
  fileTypes: string[];
  maxResults: number;
  minRelevanceScore: number;
  searchType: 'semantic' | 'exact' | 'fuzzy' | 'regex';
  contextLines: number;
}

export class SemanticSearch {
  private searchIndex: SearchIndex;
  private isIndexing = false;
  private indexingProgress = 0;
  private indexingCallbacks = new Set<(progress: number) => void>();

  constructor() {
    this.searchIndex = {
      files: new Map(),
      symbols: new Map(),
      concepts: new Map(),
      lastUpdated: 0,
    };
    this.loadIndexFromStorage();
  }

  // Index Management
  async indexProject(projectPath: string): Promise<void> {
    if (this.isIndexing) return;

    this.isIndexing = true;
    this.indexingProgress = 0;
    this.notifyIndexingProgress(0);

    try {
      // Get all files in project
      const files = await this.getProjectFiles(projectPath);
      const totalFiles = files.length;

      // Clear existing index
      this.searchIndex.files.clear();
      this.searchIndex.symbols.clear();
      this.searchIndex.concepts.clear();

      // Index each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await this.indexFile(file);

        this.indexingProgress = ((i + 1) / totalFiles) * 100;
        this.notifyIndexingProgress(this.indexingProgress);
      }

      // Build concept index
      await this.buildConceptIndex();

      this.searchIndex.lastUpdated = Date.now();
      this.saveIndexToStorage();
    } finally {
      this.isIndexing = false;
      this.notifyIndexingProgress(100);
    }
  }

  private async indexFile(filePath: string): Promise<void> {
    try {
      const content = await this.readFile(filePath);
      const language = this.detectLanguage(filePath);

      // Tokenize content
      const tokens = this.tokenizeContent(content, language);

      // Extract symbols
      const symbols = await this.extractSymbols(content, language, filePath);

      // Generate embeddings for semantic search
      const embeddings = await this.generateEmbeddings(content);

      // Create file index
      const fileIndex: FileIndex = {
        filePath,
        language,
        content,
        tokens,
        embeddings,
        symbols: symbols.map((s) => s.name),
        concepts: await this.extractConcepts(content, language),
        lastModified: Date.now(),
      };

      this.searchIndex.files.set(filePath, fileIndex);

      // Index symbols
      for (const symbol of symbols) {
        const symbolIndex: SymbolIndex = {
          ...symbol,
          embeddings: await this.generateEmbeddings(symbol.signature + ' ' + symbol.description),
          references: await this.findSymbolReferences(symbol.name, filePath),
        };
        this.searchIndex.symbols.set(`${filePath}:${symbol.name}`, symbolIndex);
      }
    } catch (error) {
      console.warn(`Failed to index file ${filePath}:`, error);
    }
  }

  // Search Methods
  async search(query: string, options: Partial<SearchOptions> = {}): Promise<SearchResult[]> {
    const searchOptions: SearchOptions = {
      includeCode: true,
      includeComments: true,
      includeDocumentation: true,
      fileTypes: [],
      maxResults: 50,
      minRelevanceScore: 0.3,
      searchType: 'semantic',
      contextLines: 3,
      ...options,
    };

    const results: SearchResult[] = [];

    try {
      switch (searchOptions.searchType) {
        case 'semantic':
          results.push(...(await this.semanticSearch(query, searchOptions)));
          break;
        case 'exact':
          results.push(...(await this.exactSearch(query, searchOptions)));
          break;
        case 'fuzzy':
          results.push(...(await this.fuzzySearch(query, searchOptions)));
          break;
        case 'regex':
          results.push(...(await this.regexSearch(query, searchOptions)));
          break;
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply filters and limits
      return results
        .filter((r) => r.relevanceScore >= searchOptions.minRelevanceScore)
        .slice(0, searchOptions.maxResults);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  private async semanticSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryEmbeddings = await this.generateEmbeddings(query);

    // Search through files
    for (const [filePath, fileIndex] of this.searchIndex.files) {
      if (!this.matchesFileType(filePath, options.fileTypes)) continue;

      const similarity = this.calculateCosineSimilarity(queryEmbeddings, fileIndex.embeddings);

      if (similarity >= options.minRelevanceScore) {
        const matches = await this.findSemanticMatches(query, fileIndex, options);
        results.push(...matches);
      }
    }

    // Search through symbols
    for (const [_symbolKey, symbolIndex] of this.searchIndex.symbols) {
      const similarity = this.calculateCosineSimilarity(queryEmbeddings, symbolIndex.embeddings);

      if (similarity >= options.minRelevanceScore) {
        const result = await this.createSymbolResult(symbolIndex, similarity, query);
        if (result) results.push(result);
      }
    }

    return results;
  }

  private async exactSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [filePath, fileIndex] of this.searchIndex.files) {
      if (!this.matchesFileType(filePath, options.fileTypes)) continue;

      const lines = fileIndex.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes(queryLower)) {
          const result = await this.createSearchResult(
            filePath,
            i + 1,
            lowerLine.indexOf(queryLower),
            line,
            this.getContext(lines, i, options.contextLines),
            1.0,
            'code',
            fileIndex.language,
            'Exact text match',
            [],
          );
          results.push(result);
        }
      }
    }

    return results;
  }

  private async fuzzySearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const [filePath, fileIndex] of this.searchIndex.files) {
      if (!this.matchesFileType(filePath, options.fileTypes)) continue;

      const lines = fileIndex.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const similarity = this.calculateLevenshteinSimilarity(query, line);

        if (similarity >= options.minRelevanceScore) {
          const result = await this.createSearchResult(
            filePath,
            i + 1,
            0,
            line,
            this.getContext(lines, i, options.contextLines),
            similarity,
            'code',
            fileIndex.language,
            'Fuzzy text match',
            [],
          );
          results.push(result);
        }
      }
    }

    return results;
  }

  private async regexSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      const regex = new RegExp(query, 'gi');

      for (const [filePath, fileIndex] of this.searchIndex.files) {
        if (!this.matchesFileType(filePath, options.fileTypes)) continue;

        const lines = fileIndex.content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const matches = line.match(regex);

          if (matches) {
            const result = await this.createSearchResult(
              filePath,
              i + 1,
              line.search(regex),
              line,
              this.getContext(lines, i, options.contextLines),
              1.0,
              'code',
              fileIndex.language,
              'Regex pattern match',
              [],
            );
            results.push(result);
          }
        }
      }
    } catch (error) {
      console.warn('Invalid regex pattern:', error);
    }

    return results;
  }

  // Symbol and Concept Search
  async searchSymbols(query: string): Promise<SymbolIndex[]> {
    const results: SymbolIndex[] = [];
    const queryLower = query.toLowerCase();

    for (const [_key, symbol] of this.searchIndex.symbols) {
      if (
        symbol.name.toLowerCase().includes(queryLower) ||
        symbol.description.toLowerCase().includes(queryLower)
      ) {
        results.push(symbol);
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async searchConcepts(query: string): Promise<ConceptIndex[]> {
    const results: ConceptIndex[] = [];
    const queryLower = query.toLowerCase();

    for (const [concept, conceptIndex] of this.searchIndex.concepts) {
      if (
        concept.toLowerCase().includes(queryLower) ||
        conceptIndex.description.toLowerCase().includes(queryLower)
      ) {
        results.push(conceptIndex);
      }
    }

    return results.sort((a, b) => b.frequency - a.frequency);
  }

  // Utility Methods
  private async generateEmbeddings(text: string): Promise<number[]> {
    // In production, use a proper embedding service like OpenAI Embeddings
    // For now, create simple hash-based embeddings
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(100).fill(0);

    for (const word of words) {
      const hash = this.simpleHash(word);
      embedding[hash % 100] += 1;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  private classifyLineType(line: string): LineClassification {
    const trimmed = line.trim();
    if (!trimmed) {
      return 'code';
    }

    if (trimmed.startsWith('///') || trimmed.startsWith('/**') || trimmed.startsWith('/*!')) {
      return 'documentation';
    }

    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      return 'documentation';
    }

    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      return 'documentation';
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('--')) {
      return 'comment';
    }

    if (/^(import\s|from\s.+\simport\s)/.test(trimmed)) {
      return 'import';
    }

    if (/^(class|interface)\s+\w+/.test(trimmed)) {
      return 'class';
    }

    if (/^type\s+\w+/.test(trimmed)) {
      return 'variable';
    }

    if (/^(async\s+)?function\s+\w+/.test(trimmed) || /^def\s+\w+/.test(trimmed)) {
      return 'function';
    }

    if (/^\w[\w\d_\[\]\.]*\s*=/.test(trimmed)) {
      return 'variable';
    }

    return 'code';
  }

  private shouldIncludeLineType(lineType: LineClassification, options: SearchOptions): boolean {
    switch (lineType) {
      case 'comment':
        return options.includeComments;
      case 'documentation':
        return options.includeDocumentation;
      default:
        return options.includeCode;
    }
  }

  private collectSemanticContext(fileIndex: FileIndex, lineType: LineClassification): string[] {
    const contextSet = new Set<string>();
    contextSet.add(`Language: ${fileIndex.language}`);
    contextSet.add(`LineType: ${lineType}`);

    fileIndex.concepts.slice(0, 10).forEach((concept) => {
      contextSet.add(`Concept: ${concept}`);
    });

    fileIndex.symbols.slice(0, 10).forEach((symbolName) => {
      const symbol = this.searchIndex.symbols.get(`${fileIndex.filePath}:${symbolName}`);
      if (symbol) {
        contextSet.add(`Symbol: ${symbol.name}`);
        contextSet.add(`SymbolType: ${symbol.type}`);
      } else {
        contextSet.add(`Symbol: ${symbolName}`);
      }
    });

    return Array.from(contextSet);
  }

  private buildMatchReason(
    lineType: LineClassification,
    similarity: number,
    query: string,
  ): string {
    const similarityPercent = (similarity * 100).toFixed(1);
    const descriptionMap: Record<LineClassification, string> = {
      code: 'code segment',
      comment: 'comment',
      documentation: 'documentation block',
      import: 'import statement',
      class: 'class declaration',
      function: 'function definition',
      variable: 'variable declaration',
    };

    const description = descriptionMap[lineType] || 'code segment';
    return `Semantic ${description} match for "${query}" (${similarityPercent}% similarity).`;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }


  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateLevenshteinSimilarity(a: string, b: string): number {
    const matrix = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    const maxLength = Math.max(a.length, b.length);
    return maxLength > 0 ? 1 - matrix[b.length][a.length] / maxLength : 1;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async createSearchResult(
    filePath: string,
    lineNumber: number,
    columnNumber: number,
    content: string,
    context: string,
    relevanceScore: number,
    type: SearchResult['type'],
    language: string,
    matchReason: string,
    semanticContext: string[],
  ): Promise<SearchResult> {
    return {
      id: `${filePath}:${lineNumber}:${columnNumber}`,
      filePath,
      fileName: filePath.split('/').pop() || filePath,
      lineNumber,
      columnNumber,
      content: content.trim(),
      context,
      relevanceScore,
      type,
      language,
      matchReason,
      semanticContext,
    };
  }

  private getContext(lines: string[], lineIndex: number, contextLines: number): string {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).join('\n');
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      jsx: 'javascript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
    };
    return languageMap[ext || ''] || 'text';
  }

  private tokenizeContent(content: string, _language: string): string[] {
    // Simple tokenization - in production, use proper language-specific tokenizers
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private async extractSymbols(
    content: string,
    language: string,
    filePath: string,
  ): Promise<any[]> {
    // Simplified symbol extraction - in production, use proper AST parsing
    const symbols: any[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Function detection (simplified)
      if (line.includes('function ') || line.includes('def ') || line.includes('func ')) {
        const match = line.match(/(function|def|func)\s+(\w+)/);
        if (match) {
          symbols.push({
            name: match[2],
            type: 'function',
            filePath,
            lineNumber: i + 1,
            signature: line,
            description: `Function ${match[2]} defined in ${filePath}`,
          });
        }
      }

      // Class detection (simplified)
      if (line.includes('class ')) {
        const match = line.match(/class\s+(\w+)/);
        if (match) {
          symbols.push({
            name: match[1],
            type: 'class',
            filePath,
            lineNumber: i + 1,
            signature: line,
            description: `Class ${match[1]} defined in ${filePath}`,
          });
        }
      }
    }

    return symbols;
  }

  private async extractConcepts(content: string, _language: string): Promise<string[]> {
    // Extract programming concepts from content
    const concepts = new Set<string>();
    const conceptPatterns = [
      'async',
      'await',
      'promise',
      'callback',
      'event',
      'listener',
      'component',
      'service',
      'controller',
      'model',
      'view',
      'api',
      'endpoint',
      'route',
      'middleware',
      'authentication',
      'database',
      'query',
      'transaction',
      'migration',
      'schema',
      'test',
      'mock',
      'stub',
      'assertion',
      'coverage',
      'error',
      'exception',
      'try',
      'catch',
      'finally',
      'loop',
      'iteration',
      'recursion',
      'algorithm',
      'data structure',
    ];

    const contentLower = content.toLowerCase();
    for (const concept of conceptPatterns) {
      if (contentLower.includes(concept)) {
        concepts.add(concept);
      }
    }

    return Array.from(concepts);
  }

  // Storage Methods
  private saveIndexToStorage(): void {
    try {
      const indexData = {
        files: Array.from(this.searchIndex.files.entries()),
        symbols: Array.from(this.searchIndex.symbols.entries()),
        concepts: Array.from(this.searchIndex.concepts.entries()),
        lastUpdated: this.searchIndex.lastUpdated,
      };
      localStorage.setItem('semantic_search_index', JSON.stringify(indexData));
    } catch (error) {
      console.warn('Failed to save search index:', error);
    }
  }

  private loadIndexFromStorage(): void {
    try {
      const saved = localStorage.getItem('semantic_search_index');
      if (saved) {
        const indexData = JSON.parse(saved);
        this.searchIndex.files = new Map(indexData.files);
        this.searchIndex.symbols = new Map(indexData.symbols);
        this.searchIndex.concepts = new Map(indexData.concepts);
        this.searchIndex.lastUpdated = indexData.lastUpdated;
      }
    } catch (error) {
      console.warn('Failed to load search index:', error);
    }
  }

  // Helper methods for file operations and other utilities
  private async readFile(filePath: string): Promise<string> {
    try {
      return await readTextFile(filePath);
    } catch (error) {
      console.error('Failed to read file content:', error);
      throw error;
    }
  }

  private async getProjectFiles(projectPath: string): Promise<string[]> {
    return listProjectTextFiles(projectPath);
  }

  private matchesFileType(filePath: string, fileTypes: string[]): boolean {
    if (fileTypes.length === 0) return true;
    const ext = filePath.split('.').pop()?.toLowerCase();
    return fileTypes.includes(ext || '');
  }

  // Progress tracking
  onIndexingProgress(callback: (progress: number) => void): () => void {
    this.indexingCallbacks.add(callback);
    return () => this.indexingCallbacks.delete(callback);
  }

  private notifyIndexingProgress(progress: number): void {
    this.indexingCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Indexing progress callback failed:', error);
      }
    });
  }

  // Public getters
  isIndexingInProgress(): boolean {
    return this.isIndexing;
  }

  getIndexingProgress(): number {
    return this.indexingProgress;
  }

  getIndexStats(): { files: number; symbols: number; concepts: number; lastUpdated: number } {
    return {
      files: this.searchIndex.files.size,
      symbols: this.searchIndex.symbols.size,
      concepts: this.searchIndex.concepts.size,
      lastUpdated: this.searchIndex.lastUpdated,
    };
  }

  clearIndex(): void {
    this.searchIndex.files.clear();
    this.searchIndex.symbols.clear();
    this.searchIndex.concepts.clear();
    this.searchIndex.lastUpdated = 0;
    this.saveIndexToStorage();
  }

  // Placeholder methods that need proper implementation
  private async findSemanticMatches(
    query: string,
    fileIndex: FileIndex,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    if (!query.trim()) {
      return results;
    }

    const lines = fileIndex.content.split('\n');
    const queryEmbeddings = await this.generateEmbeddings(query);
    const queryLower = query.toLowerCase();

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const lineContent = lines[lineNumber];
      const trimmedLine = lineContent.trim();
      if (!trimmedLine) continue;

      const lineType = this.classifyLineType(trimmedLine);
      if (!this.shouldIncludeLineType(lineType, options)) continue;

      const lineEmbeddings = await this.generateEmbeddings(lineContent);
      const similarity = this.calculateCosineSimilarity(queryEmbeddings, lineEmbeddings);
      if (similarity < Math.max(options.minRelevanceScore, 0.35)) continue;

      const columnNumber = Math.max(lineContent.toLowerCase().indexOf(queryLower), 0);
      const context = this.getContext(lines, lineNumber, options.contextLines);
      const semanticContext = this.collectSemanticContext(fileIndex, lineType);
      const matchReason = this.buildMatchReason(lineType, similarity, query);

      const result = await this.createSearchResult(
        fileIndex.filePath,
        lineNumber + 1,
        columnNumber,
        lineContent,
        context,
        similarity,
        lineType,
        fileIndex.language,
        matchReason,
        semanticContext,
      );
      results.push(result);
    }

    return results;
  }

  private async createSymbolResult(
    symbolIndex: SymbolIndex,
    similarity: number,
    query: string,
  ): Promise<SearchResult | null> {
    const fileIndex = this.searchIndex.files.get(symbolIndex.filePath);
    if (!fileIndex) {
      return null;
    }

    const lines = fileIndex.content.split('\n');
    const lineContent = lines[symbolIndex.lineNumber - 1] || symbolIndex.signature;
    const columnNumber = Math.max(lineContent.indexOf(symbolIndex.name), 0);
    const context = this.getContext(lines, symbolIndex.lineNumber - 1, 3);
    const semanticContext = this.collectSemanticContext(fileIndex, symbolIndex.type === 'class' ? 'class' : 'code');

    const resultType: SearchResult['type'] =
      symbolIndex.type === 'function' || symbolIndex.type === 'class' || symbolIndex.type === 'variable'
        ? symbolIndex.type
        : 'code';

    return {
      id: `${symbolIndex.filePath}:${symbolIndex.lineNumber}:symbol:${symbolIndex.name}`,
      filePath: symbolIndex.filePath,
      fileName: symbolIndex.filePath.split('/').pop() || symbolIndex.filePath,
      lineNumber: symbolIndex.lineNumber,
      columnNumber,
      content: lineContent.trim(),
      context,
      relevanceScore: similarity,
      type: resultType,
      language: fileIndex.language,
      matchReason: `Symbol \"${symbolIndex.name}\" matches query \"${query}\" with similarity ${(similarity * 100).toFixed(1)}%.`,
      semanticContext,
    };
  }

  private async findSymbolReferences(symbolName: string, filePath: string): Promise<Reference[]> {
    const references: Reference[] = [];
    const referencePattern = new RegExp(`\\b${this.escapeRegExp(symbolName)}\\b`);

    for (const [indexedFilePath, fileIndex] of this.searchIndex.files) {
      const lines = fileIndex.content.split('\n');

      for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];
        if (!referencePattern.test(line)) continue;

        const trimmed = line.trim();
        let type: Reference['type'] = 'usage';
        if (indexedFilePath === filePath && trimmed.includes(symbolName)) {
          if (/\bclass\s+${symbolName}\b/.test(trimmed) || /\binterface\s+${symbolName}\b/.test(trimmed)) {
            type = 'definition';
          } else if (/function\s+${symbolName}\b/.test(trimmed) || new RegExp(`\b${symbolName}\s*=`).test(trimmed)) {
            type = 'definition';
          }
        } else if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
          type = 'import';
        } else if (trimmed.includes(`${symbolName}(`)) {
          type = 'call';
        }

        references.push({
          filePath: indexedFilePath,
          lineNumber: lineNumber + 1,
          type,
        });
      }
    }

    return references;
  }

  private async buildConceptIndex(): Promise<void> {
    const conceptAccumulator = new Map<string, ConceptIndex>();

    for (const [filePath, fileIndex] of this.searchIndex.files) {
      for (const concept of fileIndex.concepts) {
        const key = concept.toLowerCase();
        let entry = conceptAccumulator.get(key);
        if (!entry) {
          entry = {
            concept,
            description: `Occurrences of \"${concept}\" across indexed source files.`,
            relatedFiles: [],
            relatedSymbols: [],
            embeddings: [],
            frequency: 0,
          };
          conceptAccumulator.set(key, entry);
        }

        entry.frequency += 1;
        if (!entry.relatedFiles.includes(filePath)) {
          entry.relatedFiles.push(filePath);
        }
      }
    }

    for (const [, symbolIndex] of this.searchIndex.symbols) {
      const descriptor = `${symbolIndex.name.toLowerCase()} ${symbolIndex.description.toLowerCase()} ${symbolIndex.signature.toLowerCase()}`;
      for (const [conceptKey, conceptIndex] of conceptAccumulator) {
        if (descriptor.includes(conceptKey) && !conceptIndex.relatedSymbols.includes(symbolIndex.name)) {
          conceptIndex.relatedSymbols.push(symbolIndex.name);
        }
      }
    }

    const conceptEntries = await Promise.all(
      Array.from(conceptAccumulator.entries()).map(async ([conceptKey, conceptIndex]) => {
        if (conceptIndex.embeddings.length === 0) {
          conceptIndex.embeddings = await this.generateEmbeddings(conceptIndex.concept);
        }
        return [conceptKey, conceptIndex] as [string, ConceptIndex];
      }),
    );

    this.searchIndex.concepts = new Map(conceptEntries);
  }
}

export const semanticSearch = new SemanticSearch();
