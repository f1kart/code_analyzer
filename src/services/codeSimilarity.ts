import { aiWorkflowEngine } from './aiWorkflowEngine';
import { listProjectTextFiles, readTextFile } from './fileAccessGateway';
import { logError } from '../utils/logger';

export interface SimilarityMatch {
  id: string;
  sourceFile: string;
  targetFile: string;
  sourceLines: [number, number];
  targetLines: [number, number];
  sourceCode: string;
  targetCode: string;
  similarityScore: number;
  matchType: 'exact' | 'structural' | 'semantic' | 'functional';
  confidence: number;
  suggestions: string[];
  refactoringOpportunity: boolean;
}

export interface DuplicateCluster {
  id: string;
  files: string[];
  codeBlocks: CodeBlock[];
  commonPattern: string;
  averageSimilarity: number;
  refactoringPriority: 'high' | 'medium' | 'low';
  estimatedSavings: {
    linesOfCode: number;
    maintainabilityImprovement: number;
  };
}

export interface CodeBlock {
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  hash: string;
  tokens: string[];
  ast?: any;
}

export interface SimilarityReport {
  id: string;
  projectPath: string;
  timestamp: number;
  totalFiles: number;
  totalMatches: number;
  duplicateClusters: DuplicateCluster[];
  similarityMatches: SimilarityMatch[];
  statistics: {
    exactDuplicates: number;
    structuralSimilar: number;
    semanticSimilar: number;
    functionalSimilar: number;
    potentialSavings: number;
  };
}

export class CodeSimilarityAnalyzer {
  private analysisCache = new Map<string, SimilarityReport>();
  private codeBlocks = new Map<string, CodeBlock[]>();
  private isAnalyzing = false;
  private analysisProgress = 0;
  private progressCallbacks = new Set<(progress: number) => void>();

  // Main Analysis Methods
  async analyzeProject(projectPath: string): Promise<SimilarityReport> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    this.analysisProgress = 0;
    this.notifyProgress(0);

    try {
      const files = await this.getProjectFiles(projectPath);
      const report: SimilarityReport = {
        id: `similarity-${Date.now()}`,
        projectPath,
        timestamp: Date.now(),
        totalFiles: files.length,
        totalMatches: 0,
        duplicateClusters: [],
        similarityMatches: [],
        statistics: {
          exactDuplicates: 0,
          structuralSimilar: 0,
          semanticSimilar: 0,
          functionalSimilar: 0,
          potentialSavings: 0,
        },
      };

      // Step 1: Extract code blocks (20%)
      await this.extractCodeBlocks(files);
      this.analysisProgress = 20;
      this.notifyProgress(20);

      // Step 2: Find exact duplicates (40%)
      const exactMatches = await this.findExactDuplicates();
      report.similarityMatches.push(...exactMatches);
      this.analysisProgress = 40;
      this.notifyProgress(40);

      // Step 3: Find structural similarities (60%)
      const structuralMatches = await this.findStructuralSimilarities();
      report.similarityMatches.push(...structuralMatches);
      this.analysisProgress = 60;
      this.notifyProgress(60);

      // Step 4: Find semantic similarities (80%)
      const semanticMatches = await this.findSemanticSimilarities();
      report.similarityMatches.push(...semanticMatches);
      this.analysisProgress = 80;
      this.notifyProgress(80);

      // Step 5: Cluster duplicates and generate report (100%)
      report.duplicateClusters = await this.clusterDuplicates(report.similarityMatches);
      report.totalMatches = report.similarityMatches.length;
      this.calculateStatistics(report);

      this.analysisProgress = 100;
      this.notifyProgress(100);

      this.analysisCache.set(projectPath, report);
      return report;
    } finally {
      this.isAnalyzing = false;
    }
  }

  async compareFiles(file1: string, file2: string): Promise<SimilarityMatch[]> {
    const blocks1 = await this.extractFileCodeBlocks(file1);
    const blocks2 = await this.extractFileCodeBlocks(file2);
    const matches: SimilarityMatch[] = [];

    for (const block1 of blocks1) {
      for (const block2 of blocks2) {
        const similarity = await this.calculateSimilarity(block1, block2);
        if (similarity.score >= 0.7) {
          matches.push({
            id: `${block1.filePath}-${block1.startLine}-${block2.filePath}-${block2.startLine}`,
            sourceFile: block1.filePath,
            targetFile: block2.filePath,
            sourceLines: [block1.startLine, block1.endLine],
            targetLines: [block2.startLine, block2.endLine],
            sourceCode: block1.code,
            targetCode: block2.code,
            similarityScore: similarity.score,
            matchType: similarity.type,
            confidence: similarity.confidence,
            suggestions: similarity.suggestions,
            refactoringOpportunity: similarity.score >= 0.8,
          });
        }
      }
    }

    return matches.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  // Code Block Extraction
  private async extractCodeBlocks(files: string[]): Promise<void> {
    this.codeBlocks.clear();

    for (const file of files) {
      const blocks = await this.extractFileCodeBlocks(file);
      this.codeBlocks.set(file, blocks);
    }
  }

  private async extractFileCodeBlocks(filePath: string): Promise<CodeBlock[]> {
    try {
      const content = await this.readFile(filePath);
      const language = this.detectLanguage(filePath);
      const blocks: CodeBlock[] = [];

      // Extract function blocks
      const functionBlocks = this.extractFunctionBlocks(content, language);
      blocks.push(
        ...functionBlocks.map((block) => ({
          ...block,
          filePath,
          hash: this.calculateHash(block.code),
          tokens: this.tokenize(block.code, language),
        })),
      );

      // Extract class blocks
      const classBlocks = this.extractClassBlocks(content, language);
      blocks.push(
        ...classBlocks.map((block) => ({
          ...block,
          filePath,
          hash: this.calculateHash(block.code),
          tokens: this.tokenize(block.code, language),
        })),
      );

      // Extract logical blocks (if-else, loops, etc.)
      const logicalBlocks = this.extractLogicalBlocks(content, language);
      blocks.push(
        ...logicalBlocks.map((block) => ({
          ...block,
          filePath,
          hash: this.calculateHash(block.code),
          tokens: this.tokenize(block.code, language),
        })),
      );

      return blocks;
    } catch (error) {
      console.warn(`Failed to extract blocks from ${filePath}:`, error);
      return [];
    }
  }

  // Similarity Detection Methods
  private async findExactDuplicates(): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = [];
    const hashMap = new Map<string, CodeBlock[]>();

    // Group blocks by hash
    for (const [_filePath, blocks] of this.codeBlocks) {
      for (const block of blocks) {
        if (!hashMap.has(block.hash)) {
          hashMap.set(block.hash, []);
        }
        hashMap.get(block.hash)!.push(block);
      }
    }

    // Find duplicates
    for (const [_hash, blocks] of hashMap) {
      if (blocks.length > 1) {
        for (let i = 0; i < blocks.length; i++) {
          for (let j = i + 1; j < blocks.length; j++) {
            matches.push({
              id: `exact-${blocks[i].filePath}-${blocks[i].startLine}-${blocks[j].filePath}-${blocks[j].startLine}`,
              sourceFile: blocks[i].filePath,
              targetFile: blocks[j].filePath,
              sourceLines: [blocks[i].startLine, blocks[i].endLine],
              targetLines: [blocks[j].startLine, blocks[j].endLine],
              sourceCode: blocks[i].code,
              targetCode: blocks[j].code,
              similarityScore: 1.0,
              matchType: 'exact',
              confidence: 1.0,
              suggestions: ['Consider extracting to a shared function or module'],
              refactoringOpportunity: true,
            });
          }
        }
      }
    }

    return matches;
  }

  private async findStructuralSimilarities(): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = [];
    const allBlocks: CodeBlock[] = [];

    // Collect all blocks
    for (const blocks of this.codeBlocks.values()) {
      allBlocks.push(...blocks);
    }

    // Compare each pair
    for (let i = 0; i < allBlocks.length; i++) {
      for (let j = i + 1; j < allBlocks.length; j++) {
        const block1 = allBlocks[i];
        const block2 = allBlocks[j];

        if (block1.filePath === block2.filePath) continue;

        const structuralSimilarity = this.calculateStructuralSimilarity(block1, block2);

        if (structuralSimilarity >= 0.7) {
          matches.push({
            id: `structural-${block1.filePath}-${block1.startLine}-${block2.filePath}-${block2.startLine}`,
            sourceFile: block1.filePath,
            targetFile: block2.filePath,
            sourceLines: [block1.startLine, block1.endLine],
            targetLines: [block2.startLine, block2.endLine],
            sourceCode: block1.code,
            targetCode: block2.code,
            similarityScore: structuralSimilarity,
            matchType: 'structural',
            confidence: structuralSimilarity * 0.9,
            suggestions: [
              'Similar code structure detected',
              'Consider refactoring common patterns',
            ],
            refactoringOpportunity: structuralSimilarity >= 0.8,
          });
        }
      }
    }

    return matches;
  }

  private async findSemanticSimilarities(): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = [];

    // Use AI to find semantic similarities
    try {
      const allBlocks: CodeBlock[] = [];
      for (const blocks of this.codeBlocks.values()) {
        allBlocks.push(...blocks);
      }

      // Process in batches to avoid overwhelming the AI
      const batchSize = 10;
      for (let i = 0; i < allBlocks.length; i += batchSize) {
        const batch = allBlocks.slice(i, i + batchSize);
        const semanticMatches = await this.findSemanticSimilaritiesInBatch(batch);
        matches.push(...semanticMatches);
      }
    } catch (error) {
      console.warn('Semantic similarity analysis failed:', error);
    }

    return matches;
  }

  private async findSemanticSimilaritiesInBatch(blocks: CodeBlock[]): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = [];

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const block1 = blocks[i];
        const block2 = blocks[j];

        if (block1.filePath === block2.filePath) continue;

        try {
          const prompt = `Compare these two code blocks for semantic similarity:

Block 1 (${block1.filePath}):
\`\`\`
${block1.code}
\`\`\`

Block 2 (${block2.filePath}):
\`\`\`
${block2.code}
\`\`\`

Analyze:
1. Functional similarity (do they accomplish the same thing?)
2. Algorithmic similarity (similar approach/logic?)
3. Semantic similarity (similar meaning/purpose?)

Return a JSON object with:
{
  "similarity": 0.0-1.0,
  "type": "functional|algorithmic|semantic",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "suggestions": ["suggestion1", "suggestion2"]
}`;

          const agent = aiWorkflowEngine.getAllAgents()[0];
          if (agent) {
            const session = await aiWorkflowEngine.runSequentialWorkflow(
              { userGoal: prompt, additionalContext: 'Code similarity analysis' },
              [agent.id],
            );

            const result = this.parseAIResponse(session.result?.finalOutput || '{}');

            if (result.similarity >= 0.6) {
              matches.push({
                id: `semantic-${block1.filePath}-${block1.startLine}-${block2.filePath}-${block2.startLine}`,
                sourceFile: block1.filePath,
                targetFile: block2.filePath,
                sourceLines: [block1.startLine, block1.endLine],
                targetLines: [block2.startLine, block2.endLine],
                sourceCode: block1.code,
                targetCode: block2.code,
                similarityScore: result.similarity,
                matchType: 'semantic',
                confidence: result.confidence,
                suggestions: result.suggestions || [],
                refactoringOpportunity: result.similarity >= 0.8,
              });
            }
          }
        } catch (error) {
          console.warn('Failed to analyze semantic similarity:', error);
        }
      }
    }

    return matches;
  }

  // Clustering and Analysis
  private async clusterDuplicates(matches: SimilarityMatch[]): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];
    const processedMatches = new Set<string>();

    for (const match of matches) {
      if (processedMatches.has(match.id)) continue;

      const cluster: DuplicateCluster = {
        id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        files: [match.sourceFile, match.targetFile],
        codeBlocks: [
          {
            filePath: match.sourceFile,
            startLine: match.sourceLines[0],
            endLine: match.sourceLines[1],
            code: match.sourceCode,
            hash: this.calculateHash(match.sourceCode),
            tokens: [],
          },
          {
            filePath: match.targetFile,
            startLine: match.targetLines[0],
            endLine: match.targetLines[1],
            code: match.targetCode,
            hash: this.calculateHash(match.targetCode),
            tokens: [],
          },
        ],
        commonPattern: await this.extractCommonPattern([match.sourceCode, match.targetCode]),
        averageSimilarity: match.similarityScore,
        refactoringPriority: this.calculateRefactoringPriority(match),
        estimatedSavings: this.calculateEstimatedSavings([match]),
      };

      // Find related matches to expand cluster
      const relatedMatches = matches.filter(
        (m) =>
          !processedMatches.has(m.id) &&
          (m.sourceFile === match.sourceFile ||
            m.targetFile === match.targetFile ||
            m.sourceFile === match.targetFile ||
            m.targetFile === match.sourceFile),
      );

      for (const related of relatedMatches) {
        if (!cluster.files.includes(related.sourceFile)) {
          cluster.files.push(related.sourceFile);
        }
        if (!cluster.files.includes(related.targetFile)) {
          cluster.files.push(related.targetFile);
        }
        processedMatches.add(related.id);
      }

      processedMatches.add(match.id);
      clusters.push(cluster);
    }

    return clusters.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
  }

  // Utility Methods
  private calculateSimilarity(
    block1: CodeBlock,
    block2: CodeBlock,
  ): Promise<{
    score: number;
    type: SimilarityMatch['matchType'];
    confidence: number;
    suggestions: string[];
  }> {
    // Hash-based exact match
    if (block1.hash === block2.hash) {
      return Promise.resolve({
        score: 1.0,
        type: 'exact',
        confidence: 1.0,
        suggestions: ['Exact duplicate found'],
      });
    }

    // Token-based structural similarity
    const tokenSimilarity = this.calculateTokenSimilarity(block1.tokens, block2.tokens);

    return Promise.resolve({
      score: tokenSimilarity,
      type: tokenSimilarity > 0.9 ? 'structural' : 'semantic',
      confidence: tokenSimilarity * 0.8,
      suggestions: tokenSimilarity > 0.8 ? ['High structural similarity'] : ['Moderate similarity'],
    });
  }

  private calculateStructuralSimilarity(block1: CodeBlock, block2: CodeBlock): number {
    return this.calculateTokenSimilarity(block1.tokens, block2.tokens);
  }

  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateHash(code: string): string {
    // Simple hash for demonstration - in production use a proper hash function
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private tokenize(code: string, _language: string): string[] {
    // Simple tokenization - in production use proper language-specific tokenizers
    return code
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 1);
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
    };
    return languageMap[ext || ''] || 'text';
  }

  private extractFunctionBlocks(
    content: string,
    language: string,
  ): Omit<CodeBlock, 'filePath' | 'hash' | 'tokens' | 'ast'>[] {
    const blocks: Omit<CodeBlock, 'filePath' | 'hash' | 'tokens' | 'ast'>[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (this.isFunctionStart(line, language)) {
        const endLine = this.findBlockEnd(lines, i, language);
        if (endLine > i) {
          blocks.push({
            startLine: i + 1,
            endLine: endLine + 1,
            code: lines.slice(i, endLine + 1).join('\n'),
          });
        }
      }
    }

    return blocks;
  }

  private extractClassBlocks(
    content: string,
    language: string,
  ): Omit<CodeBlock, 'filePath' | 'hash' | 'tokens' | 'ast'>[] {
    const blocks: Omit<CodeBlock, 'filePath' | 'hash' | 'tokens' | 'ast'>[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (this.isClassStart(line, language)) {
        const endLine = this.findBlockEnd(lines, i, language);
        if (endLine > i) {
          blocks.push({
            startLine: i + 1,
            endLine: endLine + 1,
            code: lines.slice(i, endLine + 1).join('\n'),
          });
        }
      }
    }

    return blocks;
  }

  private extractLogicalBlocks(
    _content: string,
    _language: string,
  ): Omit<CodeBlock, 'filePath' | 'hash' | 'tokens' | 'ast'>[] {
    // Extract if-else, loops, try-catch blocks
    return [];
  }

  private isFunctionStart(line: string, language: string): boolean {
    const patterns = {
      javascript: /^(function\s+\w+|const\s+\w+\s*=.*=>|\w+\s*\([^)]*\)\s*{)/,
      typescript: /^(function\s+\w+|const\s+\w+\s*=.*=>|\w+\s*\([^)]*\)\s*{)/,
      python: /^def\s+\w+\s*\(/,
      java: /^(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/,
      csharp: /^(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/,
    };

    const pattern = patterns[language as keyof typeof patterns];
    return pattern ? pattern.test(line) : false;
  }

  private isClassStart(line: string, language: string): boolean {
    const patterns = {
      javascript: /^class\s+\w+/,
      typescript: /^class\s+\w+/,
      python: /^class\s+\w+/,
      java: /^(public|private)?\s*class\s+\w+/,
      csharp: /^(public|private)?\s*class\s+\w+/,
    };

    const pattern = patterns[language as keyof typeof patterns];
    return pattern ? pattern.test(line) : false;
  }

  private findBlockEnd(lines: string[], startLine: number, _language: string): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (!inString && (char === '"' || char === "'")) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && line[j - 1] !== '\\') {
          inString = false;
          stringChar = '';
        } else if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
        }
      }

      if (braceCount === 0 && i > startLine) {
        return i;
      }
    }

    return lines.length - 1;
  }

  private async extractCommonPattern(codes: string[]): Promise<string> {
    // Extract common patterns using AI
    try {
      const prompt = `Analyze these code blocks and extract the common pattern:

${codes.map((code, i) => `Block ${i + 1}:\n\`\`\`\n${code}\n\`\`\`\n`).join('\n')}

Identify the common algorithmic or structural pattern and describe it concisely.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (agent) {
        const session = await aiWorkflowEngine.runSequentialWorkflow(
          { userGoal: prompt, additionalContext: 'Pattern extraction' },
          [agent.id],
        );
        return session.result?.finalOutput || 'Common pattern detected';
      }
    } catch (error) {
      console.warn('Pattern extraction failed:', error);
    }

    return 'Similar code structure';
  }

  private calculateRefactoringPriority(match: SimilarityMatch): 'high' | 'medium' | 'low' {
    if (match.similarityScore >= 0.9) return 'high';
    if (match.similarityScore >= 0.7) return 'medium';
    return 'low';
  }

  private calculateEstimatedSavings(matches: SimilarityMatch[]): {
    linesOfCode: number;
    maintainabilityImprovement: number;
  } {
    const totalLines = matches.reduce((sum, match) => {
      return sum + (match.sourceLines[1] - match.sourceLines[0] + 1);
    }, 0);

    return {
      linesOfCode: Math.floor(totalLines * 0.7), // Estimate 70% reduction
      maintainabilityImprovement: matches.length * 10, // Arbitrary improvement score
    };
  }

  private calculateStatistics(report: SimilarityReport): void {
    report.statistics.exactDuplicates = report.similarityMatches.filter(
      (m) => m.matchType === 'exact',
    ).length;
    report.statistics.structuralSimilar = report.similarityMatches.filter(
      (m) => m.matchType === 'structural',
    ).length;
    report.statistics.semanticSimilar = report.similarityMatches.filter(
      (m) => m.matchType === 'semantic',
    ).length;
    report.statistics.functionalSimilar = report.similarityMatches.filter(
      (m) => m.matchType === 'functional',
    ).length;
    report.statistics.potentialSavings = report.duplicateClusters.reduce(
      (sum, cluster) => sum + cluster.estimatedSavings.linesOfCode,
      0,
    );
  }

  private parseAIResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (error) {
      return { similarity: 0, confidence: 0, suggestions: [] };
    }
  }

  // File operations (placeholder - implement with actual file system)
  private async readFile(filePath: string): Promise<string> {
    try {
      return await readTextFile(filePath);
    } catch (error) {
      logError('CodeSimilarityAnalyzer.readFileFailure', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async getProjectFiles(projectPath: string): Promise<string[]> {
    try {
      return await listProjectTextFiles(projectPath);
    } catch (error) {
      logError('CodeSimilarityAnalyzer.projectListingFailure', {
        projectPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Progress tracking
  onProgress(callback: (progress: number) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private notifyProgress(progress: number): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback failed:', error);
      }
    });
  }

  // Public getters
  getIsAnalyzing(): boolean {
    return this.isAnalyzing;
  }

  getAnalysisProgress(): number {
    return this.analysisProgress;
  }

  getLastReport(projectPath: string): SimilarityReport | null {
    return this.analysisCache.get(projectPath) || null;
  }

  clearCache(): void {
    this.analysisCache.clear();
    this.codeBlocks.clear();
  }
}

export const codeSimilarityAnalyzer = new CodeSimilarityAnalyzer();
