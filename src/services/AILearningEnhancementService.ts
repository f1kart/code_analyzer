interface ProjectContext {
  projectId: string;
  name: string;
  type: 'nodejs' | 'python' | 'java' | 'dotnet' | 'go' | 'rust' | 'other';
  framework?: string;
  language: string;
  dependencies: Record<string, string>;
  fileStructure: Array<{
    path: string;
    type: 'file' | 'directory';
    language?: string;
    size: number;
    lastModified: Date;
  }>;
  codingPatterns: Array<{
    pattern: string;
    frequency: number;
    confidence: number;
    examples: string[];
  }>;
  conventions: {
    naming: Record<string, string>;
    structure: Record<string, string>;
    style: Record<string, string>;
  };
}

interface LearningData {
  contextId: string;
  timestamp: Date;
  interactionType: 'code_review' | 'code_generation' | 'bug_fix' | 'refactoring' | 'explanation';
  userFeedback: 'positive' | 'negative' | 'neutral';
  aiModel: string;
  prompt: string;
  response: string;
  codeContext?: string;
  improvements: string[];
  accuracy: number;
  relevance: number;
  completeness: number;
}

interface AdaptiveModel {
  modelId: string;
  baseModel: string;
  projectContext: ProjectContext;
  trainingData: LearningData[];
  performanceMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  adaptations: Array<{
    type: 'pattern_recognition' | 'style_matching' | 'context_awareness' | 'error_reduction';
    description: string;
    impact: number;
    appliedAt: Date;
  }>;
  lastUpdated: Date;
}

interface LearningConfig {
  enabled: boolean;
  learningRate: number;
  minTrainingSamples: number;
  contextWindow: number; // days to consider for context
  feedbackWeight: number;
  patternThreshold: number;
  modelUpdateInterval: number; // hours
}

export class AILearningEnhancementService {
  private projectContexts: Map<string, ProjectContext> = new Map();
  private learningData: LearningData[] = [];
  private adaptiveModels: Map<string, AdaptiveModel> = new Map();
  private config: Required<LearningConfig>;

  constructor(config: Partial<LearningConfig> = {}) {
    this.config = {
      enabled: true,
      learningRate: 0.01,
      minTrainingSamples: 100,
      contextWindow: 30,
      feedbackWeight: 0.3,
      patternThreshold: 0.7,
      modelUpdateInterval: 24,
      ...config,
    };
  }

  /**
   * Learn from project context
   */
  async learnFromProject(projectPath: string, analysis: any): Promise<ProjectContext> {
    if (!this.config.enabled) {
      throw new Error('AI learning is disabled');
    }

    console.log(`🧠 Learning from project: ${projectPath}`);

    const context: ProjectContext = {
      projectId: this.generateProjectId(projectPath),
      name: analysis.name || 'Unknown Project',
      type: this.detectProjectType(analysis),
      language: this.detectPrimaryLanguage(analysis),
      dependencies: analysis.dependencies || {},
      fileStructure: analysis.files || [],
      codingPatterns: [],
      conventions: {
        naming: {},
        structure: {},
        style: {},
      },
    };

    // Analyze coding patterns
    context.codingPatterns = await this.analyzeCodingPatterns(analysis);

    // Learn project conventions
    context.conventions = await this.learnProjectConventions(analysis);

    this.projectContexts.set(context.projectId, context);

    // Initialize adaptive model for this project
    await this.initializeAdaptiveModel(context);

    console.log(`✅ Project context learned for ${context.name}`);

    return context;
  }

  /**
   * Record learning data from AI interaction
   */
  async recordLearningData(data: Omit<LearningData, 'contextId' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) return;

    const contextId = this.generateContextId();
    const learningEntry: LearningData = {
      ...data,
      contextId,
      timestamp: new Date(),
    };

    this.learningData.push(learningEntry);

    // Update adaptive model if enough data
    await this.updateAdaptiveModel(data.aiModel, learningEntry);
  }

  /**
   * Generate enhanced prompt based on learned context
   */
  async generateEnhancedPrompt(
    basePrompt: string,
    projectId: string,
    interactionType: LearningData['interactionType']
  ): Promise<string> {
    if (!this.config.enabled) return basePrompt;

    const context = this.projectContexts.get(projectId);
    if (!context) return basePrompt;

    const adaptiveModel = this.adaptiveModels.get(projectId);
    if (!adaptiveModel) return basePrompt;

    let enhancedPrompt = basePrompt;

    // Add project context
    enhancedPrompt += `\n\nProject Context:
- Type: ${context.type}
- Language: ${context.language}
- Framework: ${context.framework || 'Not specified'}
- Dependencies: ${Object.keys(context.dependencies).slice(0, 5).join(', ')}`;

    // Add coding patterns
    if (context.codingPatterns.length > 0) {
      const topPatterns = context.codingPatterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      enhancedPrompt += `\n\nCommon Patterns:
${topPatterns.map(p => `- ${p.pattern} (confidence: ${(p.confidence * 100).toFixed(1)}%)`).join('\n')}`;
    }

    // Add learned conventions
    if (Object.keys(context.conventions.naming).length > 0) {
      enhancedPrompt += `\n\nNaming Conventions:
${Object.entries(context.conventions.naming)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}`;
    }

    // Add model adaptations
    if (adaptiveModel.adaptations.length > 0) {
      const recentAdaptations = adaptiveModel.adaptations
        .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime())
        .slice(0, 2);

      enhancedPrompt += `\n\nModel Adaptations Applied:
${recentAdaptations.map(a => `- ${a.description} (impact: ${(a.impact * 100).toFixed(1)}%)`).join('\n')}`;
    }

    return enhancedPrompt;
  }

  /**
   * Get learning insights for a project
   */
  getLearningInsights(projectId: string): {
    context: ProjectContext | null;
    model: AdaptiveModel | null;
    recentLearning: LearningData[];
    recommendations: string[];
  } {
    const context = this.projectContexts.get(projectId) || null;
    const model = this.adaptiveModels.get(projectId) || null;

    // Get recent learning data for this project
    const recentLearning = this.learningData
      .filter(data => {
        // Match by project context (simplified - in real implementation would have proper project mapping)
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(context, model, recentLearning);

    return {
      context,
      model,
      recentLearning,
      recommendations,
    };
  }

  /**
   * Export learning data for analysis
   */
  exportLearningData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      projectContexts: Array.from(this.projectContexts.values()),
      adaptiveModels: Array.from(this.adaptiveModels.values()),
      learningData: this.learningData,
      exportedAt: new Date().toISOString(),
    };

    if (format === 'csv') {
      return this.convertLearningDataToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Analyze coding patterns from actual project files
   */
  private async analyzeCodingPatterns(analysis: any): Promise<ProjectContext['codingPatterns']> {
    const patterns: ProjectContext['codingPatterns'] = [];
    const patternCounts = new Map<string, { count: number; examples: string[] }>();

    // Real pattern analysis from project files
    try {
      const files = analysis.files || [];
      const totalFiles = files.length;

      if (totalFiles === 0) {
        return patterns;
      }

      // Analyze each file for patterns
      for (const file of files) {
        const content = file.content || '';
        
        // Detect async/await pattern
        const asyncMatches = content.match(/async\s+(function|\(|\w+\s*=>)/g);
        const awaitMatches = content.match(/await\s+\w+/g);
        if (asyncMatches || awaitMatches) {
          this.incrementPattern(patternCounts, 'async/await usage', 
            asyncMatches?.[0] || awaitMatches?.[0] || 'async/await');
        }

        // Detect ES6+ features
        const destructuring = content.match(/const\s*\{[^}]+\}\s*=/g);
        const arrowFunctions = content.match(/\([^)]*\)\s*=>/g);
        const templateLiterals = content.match(/`[^`]*\$\{[^}]+\}[^`]*`/g);
        if (destructuring || arrowFunctions || templateLiterals) {
          this.incrementPattern(patternCounts, 'ES6+ features',
            destructuring?.[0] || arrowFunctions?.[0] || templateLiterals?.[0] || 'ES6+');
        }

        // Detect error handling
        const tryCatch = content.match(/try\s*\{[\s\S]*?\}\s*catch/g);
        const throwError = content.match(/throw\s+new\s+\w*Error/g);
        if (tryCatch || throwError) {
          this.incrementPattern(patternCounts, 'error handling',
            tryCatch?.[0]?.substring(0, 50) || throwError?.[0] || 'try/catch');
        }

        // Detect TypeScript features
        const interfaces = content.match(/interface\s+\w+/g);
        const types = content.match(/type\s+\w+\s*=/g);
        if (interfaces || types) {
          this.incrementPattern(patternCounts, 'TypeScript types',
            interfaces?.[0] || types?.[0] || 'interface/type');
        }

        // Detect React patterns
        const reactHooks = content.match(/use\w+\(/g);
        const jsxElements = content.match(/<\w+[^>]*>/g);
        if (reactHooks || jsxElements) {
          this.incrementPattern(patternCounts, 'React patterns',
            reactHooks?.[0] || jsxElements?.[0] || 'React');
        }

        // Detect functional programming
        const mapFilterReduce = content.match(/\.(map|filter|reduce)\(/g);
        if (mapFilterReduce && mapFilterReduce.length > 2) {
          this.incrementPattern(patternCounts, 'functional programming',
            mapFilterReduce[0]);
        }
      }

      // Convert counts to patterns with frequency and confidence
      for (const [pattern, data] of patternCounts.entries()) {
        const frequency = data.count / totalFiles;
        const confidence = Math.min(0.95, 0.7 + (data.count / totalFiles) * 0.25);
        
        patterns.push({
          pattern,
          frequency: Math.round(frequency * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          examples: data.examples.slice(0, 3),
        });
      }

      // Sort by frequency
      patterns.sort((a, b) => b.frequency - a.frequency);

    } catch (error) {
      console.error('Pattern analysis failed:', error);
    }

    return patterns;
  }

  private incrementPattern(map: Map<string, { count: number; examples: string[] }>, pattern: string, example: string): void {
    const existing = map.get(pattern);
    if (existing) {
      existing.count++;
      if (existing.examples.length < 3 && !existing.examples.includes(example)) {
        existing.examples.push(example);
      }
    } else {
      map.set(pattern, { count: 1, examples: [example] });
    }
  }

  /**
   * Learn project conventions from actual code
   */
  private async learnProjectConventions(analysis: any): Promise<ProjectContext['conventions']> {
    const conventions: ProjectContext['conventions'] = {
      naming: {},
      structure: {},
      style: {},
    };

    // Real convention learning from project files
    try {
      const files = analysis.files || [];
      const fileNames: string[] = [];
      const classNames: string[] = [];
      const functionNames: string[] = [];
      const variableNames: string[] = [];
      const directories = new Set<string>();

      // Extract naming patterns from actual code
      for (const file of files) {
        const content = file.content || '';
        const filePath = file.path || '';

        // Collect file names
        const fileName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '');
        if (fileName) fileNames.push(fileName);

        // Collect directory structure
        const dir = filePath.split('/').slice(0, -1).join('/');
        if (dir) directories.add(dir);

        // Extract class names
        const classes = content.match(/class\s+(\w+)/g);
        if (classes) {
          classes.forEach((c: string) => {
            const name = c.replace('class ', '');
            if (name) classNames.push(name);
          });
        }

        // Extract function names
        const functions = content.match(/function\s+(\w+)|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g);
        if (functions) {
          functions.forEach((f: string) => {
            const name = f.match(/\w+/)?.[0];
            if (name && name !== 'function' && name !== 'const') {
              functionNames.push(name);
            }
          });
        }

        // Extract variable names
        const variables = content.match(/(?:const|let|var)\s+(\w+)/g);
        if (variables) {
          variables.forEach((v: string) => {
            const name = v.match(/\w+$/)?.[0];
            if (name) variableNames.push(name);
          });
        }
      }

      // Determine naming conventions
      conventions.naming = {
        files: this.detectNamingCase(fileNames),
        classes: this.detectNamingCase(classNames),
        functions: this.detectNamingCase(functionNames),
        variables: this.detectNamingCase(variableNames),
      };

      // Determine structure conventions
      conventions.structure = {};
      for (const dir of directories) {
        const parts = dir.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          conventions.structure[lastPart] = dir;
        }
      }

      // Determine style conventions from code
      const allContent = files.map((f: any) => f.content || '').join('\n');
      conventions.style = {
        indentation: this.detectIndentation(allContent),
        quotes: this.detectQuoteStyle(allContent),
        semicolons: this.detectSemicolonUsage(allContent),
        trailingCommas: this.detectTrailingCommas(allContent),
      };

    } catch (error) {
      console.error('Convention learning failed:', error);
      // Fallback to common conventions
      conventions.naming = {
        files: 'kebab-case',
        classes: 'PascalCase',
        functions: 'camelCase',
        variables: 'camelCase',
      };

      conventions.structure = {
        components: 'src/components',
        utilities: 'src/utils',
        types: 'src/types',
        tests: 'tests',
      };

      conventions.style = {
        quotes: 'single',
        semicolons: 'always',
        indentation: '2 spaces',
        lineLength: '100 characters',
      };
    }

    return conventions;
  }

  /**
   * Detect naming case convention from examples
   */
  private detectNamingCase(names: string[]): string {
    if (names.length === 0) return 'camelCase';

    let camelCase = 0;
    let PascalCase = 0;
    let snake_case = 0;
    let kebabCase = 0;

    for (const name of names) {
      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camelCase++;
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) PascalCase++;
      else if (/^[a-z][a-z0-9_]*$/.test(name)) snake_case++;
      else if (/^[a-z][a-z0-9-]*$/.test(name)) kebabCase++;
    }

    const max = Math.max(camelCase, PascalCase, snake_case, kebabCase);
    if (max === PascalCase) return 'PascalCase';
    if (max === snake_case) return 'snake_case';
    if (max === kebabCase) return 'kebab-case';
    return 'camelCase';
  }

  /**
   * Detect indentation style from code
   */
  private detectIndentation(content: string): string {
    const lines = content.split('\n');
    let spaces2 = 0;
    let spaces4 = 0;
    let tabs = 0;

    for (const line of lines) {
      if (line.startsWith('  ') && !line.startsWith('   ')) spaces2++;
      else if (line.startsWith('    ')) spaces4++;
      else if (line.startsWith('\t')) tabs++;
    }

    const max = Math.max(spaces2, spaces4, tabs);
    if (max === tabs) return 'tabs';
    if (max === spaces4) return '4 spaces';
    return '2 spaces';
  }

  /**
   * Detect quote style preference
   */
  private detectQuoteStyle(content: string): string {
    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;
    const backticks = (content.match(/`/g) || []).length;

    const max = Math.max(singleQuotes, doubleQuotes, backticks);
    if (max === backticks && backticks > 10) return 'template literals';
    if (max === doubleQuotes) return 'double';
    return 'single';
  }

  /**
   * Detect semicolon usage
   */
  private detectSemicolonUsage(content: string): string {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const withSemicolon = lines.filter(l => l.trim().endsWith(';')).length;
    const ratio = withSemicolon / lines.length;

    return ratio > 0.5 ? 'always' : 'never';
  }

  /**
   * Detect trailing comma usage
   */
  private detectTrailingCommas(content: string): string {
    const arrayEndings = content.match(/,\s*\]/g) || [];
    const objectEndings = content.match(/,\s*\}/g) || [];
    const trailingCommas = arrayEndings.length + objectEndings.length;

    return trailingCommas > 5 ? 'always' : 'never';
  }

  /**
   * Initialize adaptive model for project
   */
  private async initializeAdaptiveModel(context: ProjectContext): Promise<void> {
    const model: AdaptiveModel = {
      modelId: `adaptive_${context.projectId}`,
      baseModel: 'gemini-2.5-flash',
      projectContext: context,
      trainingData: [],
      performanceMetrics: {
        accuracy: 0.8,
        precision: 0.75,
        recall: 0.82,
        f1Score: 0.78,
      },
      adaptations: [],
      lastUpdated: new Date(),
    };

    this.adaptiveModels.set(context.projectId, model);
  }

  /**
   * Update adaptive model with new learning data
   */
  private async updateAdaptiveModel(modelName: string, learningData: LearningData): Promise<void> {
    // Find relevant adaptive model
    let adaptiveModel: AdaptiveModel | null = null;

    for (const model of this.adaptiveModels.values()) {
      if (model.baseModel === modelName) {
        adaptiveModel = model;
        break;
      }
    }

    if (!adaptiveModel) return;

    // Add to training data
    adaptiveModel.trainingData.push(learningData);

    // Update performance metrics based on feedback
    if (learningData.userFeedback === 'positive') {
      adaptiveModel.performanceMetrics.accuracy = Math.min(0.95,
        adaptiveModel.performanceMetrics.accuracy + this.config.learningRate);
    } else if (learningData.userFeedback === 'negative') {
      adaptiveModel.performanceMetrics.accuracy = Math.max(0.5,
        adaptiveModel.performanceMetrics.accuracy - this.config.learningRate);
    }

    // Apply adaptations based on patterns
    if (adaptiveModel.trainingData.length % 10 === 0) {
      await this.applyModelAdaptations(adaptiveModel);
    }

    adaptiveModel.lastUpdated = new Date();
  }

  /**
   * Apply model adaptations
   */
  private async applyModelAdaptations(model: AdaptiveModel): Promise<void> {
    // Analyze training data for improvement opportunities
    const recentData = model.trainingData.slice(-10);

    const avgAccuracy = recentData.reduce((sum, data) => sum + data.accuracy, 0) / recentData.length;
    const avgRelevance = recentData.reduce((sum, data) => sum + data.relevance, 0) / recentData.length;

    // Apply pattern recognition adaptation
    if (avgAccuracy < 0.7) {
      model.adaptations.push({
        type: 'pattern_recognition',
        description: 'Enhanced pattern recognition for better code analysis',
        impact: 0.15,
        appliedAt: new Date(),
      });
    }

    // Apply context awareness adaptation
    if (avgRelevance < 0.75) {
      model.adaptations.push({
        type: 'context_awareness',
        description: 'Improved context understanding for project-specific responses',
        impact: 0.12,
        appliedAt: new Date(),
      });
    }

    // Apply error reduction adaptation
    const errorCount = recentData.filter(data => data.userFeedback === 'negative').length;
    if (errorCount > 3) {
      model.adaptations.push({
        type: 'error_reduction',
        description: 'Enhanced error detection and correction mechanisms',
        impact: 0.18,
        appliedAt: new Date(),
      });
    }
  }

  /**
   * Generate recommendations based on learning data
   */
  private generateRecommendations(
    context: ProjectContext | null,
    model: AdaptiveModel | null,
    recentLearning: LearningData[]
  ): string[] {
    const recommendations: string[] = [];

    if (!context) {
      recommendations.push('Analyze project structure to enable context-aware AI responses');
    }

    if (!model || model.trainingData.length < this.config.minTrainingSamples) {
      recommendations.push(`Collect ${this.config.minTrainingSamples - (model?.trainingData.length || 0)} more training samples for optimal performance`);
    }

    if (recentLearning.length > 0) {
      const avgAccuracy = recentLearning.reduce((sum, data) => sum + data.accuracy, 0) / recentLearning.length;

      if (avgAccuracy < 0.8) {
        recommendations.push('Consider adjusting prompt engineering for better AI accuracy');
      }

      if (avgAccuracy > 0.9) {
        recommendations.push('Model performance is excellent - consider expanding to more complex tasks');
      }
    }

    if (context && context.codingPatterns.length === 0) {
      recommendations.push('Analyze codebase to identify common patterns and conventions');
    }

    return recommendations;
  }

  /**
   * Detect project type from analysis
   */
  private detectProjectType(analysis: any): ProjectContext['type'] {
    // Simple detection based on file extensions and dependencies
    if (analysis.files?.some((f: any) => f.path.endsWith('.js') || f.path.endsWith('.ts'))) {
      return 'nodejs';
    }
    if (analysis.files?.some((f: any) => f.path.endsWith('.py'))) {
      return 'python';
    }
    if (analysis.files?.some((f: any) => f.path.endsWith('.java'))) {
      return 'java';
    }
    if (analysis.files?.some((f: any) => f.path.endsWith('.cs'))) {
      return 'dotnet';
    }
    if (analysis.files?.some((f: any) => f.path.endsWith('.go'))) {
      return 'go';
    }
    if (analysis.files?.some((f: any) => f.path.endsWith('.rs'))) {
      return 'rust';
    }

    return 'other';
  }

  /**
   * Detect primary language
   */
  private detectPrimaryLanguage(analysis: any): string {
    const typeToLanguage: Record<string, string> = {
      nodejs: 'JavaScript/TypeScript',
      python: 'Python',
      java: 'Java',
      dotnet: 'C#',
      go: 'Go',
      rust: 'Rust',
    };

    const detectedType = this.detectProjectType(analysis);
    return typeToLanguage[detectedType] || 'Unknown';
  }

  /**
   * Generate unique IDs
   */
  private generateProjectId(projectPath: string): string {
    return `project_${Buffer.from(projectPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
  }

  private generateContextId(): string {
    return `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert learning data to CSV
   */
  private convertLearningDataToCSV(data: any): string {
    const learningData = data.learningData || [];
    if (learningData.length === 0) return '';

    const headers = ['contextId', 'timestamp', 'interactionType', 'userFeedback', 'aiModel', 'accuracy', 'relevance', 'completeness'];
    const csvRows = [headers.join(',')];

    learningData.forEach((entry: LearningData) => {
      const row = [
        entry.contextId,
        entry.timestamp.toISOString(),
        entry.interactionType,
        entry.userFeedback,
        entry.aiModel,
        entry.accuracy.toString(),
        entry.relevance.toString(),
        entry.completeness.toString(),
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Get all project contexts
   */
  getAllProjectContexts(): ProjectContext[] {
    return Array.from(this.projectContexts.values());
  }

  /**
   * Get adaptive models
   */
  getAdaptiveModels(): AdaptiveModel[] {
    return Array.from(this.adaptiveModels.values());
  }

  /**
   * Clean up old learning data
   */
  cleanupOldData(): void {
    const cutoffDate = new Date(Date.now() - (this.config.contextWindow * 24 * 60 * 60 * 1000));

    this.learningData = this.learningData.filter(data => data.timestamp >= cutoffDate);

    // Remove outdated model adaptations
    for (const model of this.adaptiveModels.values()) {
      model.adaptations = model.adaptations.filter(
        adaptation => adaptation.appliedAt >= cutoffDate
      );
    }
  }
}

// Singleton instance
let aiLearningService: AILearningEnhancementService | null = null;

export function initializeAILearningService(config?: Partial<LearningConfig>): AILearningEnhancementService {
  if (!aiLearningService) {
    aiLearningService = new AILearningEnhancementService(config);
  }
  return aiLearningService;
}

export function getAILearningService(): AILearningEnhancementService | null {
  return aiLearningService;
}

// Convenience functions
export async function learnFromProject(projectPath: string, analysis: any): Promise<ProjectContext> {
  const service = getAILearningService();
  return service?.learnFromProject(projectPath, analysis) || null as any;
}

export async function recordAILearningData(data: Omit<LearningData, 'contextId' | 'timestamp'>): Promise<void> {
  const service = getAILearningService();
  return service?.recordLearningData(data);
}

export async function generateEnhancedPrompt(
  basePrompt: string,
  projectId: string,
  interactionType: LearningData['interactionType']
): Promise<string> {
  const service = getAILearningService();
  return service?.generateEnhancedPrompt(basePrompt, projectId, interactionType) || basePrompt;
}

export function getLearningInsights(projectId: string) {
  const service = getAILearningService();
  return service?.getLearningInsights(projectId) || {
    context: null,
    model: null,
    recentLearning: [],
    recommendations: [],
  };
}
