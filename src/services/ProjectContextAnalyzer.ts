// ProjectContextAnalyzer.ts - Advanced project context analysis for intelligent code review
// Analyzes entire codebase to understand patterns, dependencies, and context for better AI analysis

import { CodeReviewEngine } from './CodeReviewEngine';
import { LanguageParser } from './LanguageParser';
import { PerformanceMonitor } from './PerformanceMonitor';
import { getElectronAPI } from '../utils/electronBridge';

export interface ProjectContext {
  id: string;
  name: string;
  language: string;
  framework: string;
  architecture: string;
  dependencies: ProjectDependency[];
  fileStructure: FileStructure;
  patterns: CodePattern[];
  conventions: CodeConvention[];
  relationships: FileRelationship[];
  complexity: ProjectComplexity;
  quality: ProjectQuality;
}

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer' | 'optional';
  purpose: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
}

export interface FileStructure {
  root: string;
  src: string;
  tests: string;
  config: string;
  docs: string;
  scripts: string;
  assets: string;
  totalFiles: number;
  totalLines: number;
  fileTypes: Record<string, number>;
}

export interface CodePattern {
  id: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'component' | 'hook' | 'utility' | 'config';
  frequency: number;
  locations: Array<{ file: string; line: number; context: string }>;
  characteristics: PatternCharacteristics;
  relationships: string[]; // Related pattern IDs
  quality: 'excellent' | 'good' | 'acceptable' | 'poor' | 'problematic';
}

export interface PatternCharacteristics {
  complexity: number;
  maintainability: number;
  testability: number;
  reusability: number;
  performance: number;
  security: number;
}

export interface CodeConvention {
  id: string;
  name: string;
  type: 'naming' | 'structure' | 'style' | 'documentation' | 'testing' | 'error_handling';
  rule: string;
  examples: Array<{ good: string; bad: string; explanation: string }>;
  frequency: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  automated: boolean;
}

export interface FileRelationship {
  sourceFile: string;
  targetFile: string;
  type: 'import' | 'export' | 'extends' | 'implements' | 'uses' | 'references';
  strength: 'strong' | 'medium' | 'weak';
  context: string;
  bidirectional: boolean;
}

export interface ProjectComplexity {
  overall: number; // 1-10
  cyclomatic: number;
  cognitive: number;
  structural: number;
  dataFlow: number;
  controlFlow: number;
  dependencies: number;
}

export interface ProjectQuality {
  maintainability: number; // 0-100
  testability: number; // 0-100
  reliability: number; // 0-100
  security: number; // 0-100
  performance: number; // 0-100
  accessibility: number; // 0-100
  documentation: number; // 0-100
}

export interface ContextAnalysis {
  filePath: string;
  relatedFiles: RelatedFile[];
  dependencies: DependencyInfo[];
  patterns: PatternMatch[];
  conventions: ConventionMatch[];
  recommendations: ContextRecommendation[];
  impact: ImpactAssessment;
}

export interface RelatedFile {
  path: string;
  relationship: string;
  strength: number; // 0-1
  relevance: number; // 0-1
  reason: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  usage: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  alternatives: string[];
  updateAvailable: boolean;
}

export interface PatternMatch {
  pattern: CodePattern;
  confidence: number;
  context: string;
  suggestions: string[];
}

export interface ConventionMatch {
  convention: CodeConvention;
  compliance: number; // 0-1
  violations: string[];
  suggestions: string[];
}

export interface ContextRecommendation {
  type: 'pattern' | 'convention' | 'dependency' | 'structure' | 'quality';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

export interface ImpactAssessment {
  maintainability: number;
  performance: number;
  security: number;
  testability: number;
  overall: number;
}

export interface ProjectKnowledgeBase {
  patterns: Map<string, CodePattern>;
  conventions: Map<string, CodeConvention>;
  relationships: Map<string, FileRelationship[]>;
  complexity: Map<string, number>;
  quality: Map<string, number>;
  context: Map<string, ContextAnalysis>;
  lastUpdated: Date;
  version: string;
}

export interface AnalysisOptions {
  includeDependencies?: boolean;
  includePatterns?: boolean;
  includeConventions?: boolean;
  includeComplexity?: boolean;
  includeQuality?: boolean;
  maxFiles?: number;
  skipTests?: boolean;
  skipNodeModules?: boolean;
}

export class ProjectContextAnalyzer {
  private reviewEngine: CodeReviewEngine;
  private languageParser: LanguageParser;
  private performanceMonitor: PerformanceMonitor;
  private knowledgeBase: ProjectKnowledgeBase;
  private analysisCache: Map<string, ContextAnalysis> = new Map();

  constructor(
    reviewEngine?: CodeReviewEngine,
    languageParser?: LanguageParser,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.reviewEngine = reviewEngine || new CodeReviewEngine();
    this.languageParser = languageParser || new LanguageParser();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();

    this.knowledgeBase = {
      patterns: new Map(),
      conventions: new Map(),
      relationships: new Map(),
      complexity: new Map(),
      quality: new Map(),
      context: new Map(),
      lastUpdated: new Date(),
      version: '1.0.0'
    };

    this.initializeContextAnalyzer();
  }

  private initializeContextAnalyzer(): void {
    try {
      this.analysisCache.clear();
      this.performanceMonitor.recordMetric(
        'project_context_analyzer.initialized',
        1,
        'count',
        {
          component: 'ProjectContextAnalyzer',
          knowledgeBaseVersion: this.knowledgeBase.version,
          patternCount: String(this.knowledgeBase.patterns.size),
          conventionCount: String(this.knowledgeBase.conventions.size)
        }
      );
    } catch (error) {
      console.error('❌ Failed to initialize ProjectContextAnalyzer:', error);
    }
  }

  /**
   * Analyzes entire project to build comprehensive context knowledge base
   * @param projectRoot Project root directory
   * @param options Analysis options
   * @returns Complete project context
   */
  async analyzeProject(projectRoot: string, options: AnalysisOptions = {}): Promise<ProjectContext> {
    console.log(`🔍 Analyzing project context for: ${projectRoot}`);

    const startTime = Date.now();

    try {
      // Discover project structure
      const fileStructure = await this.analyzeFileStructure(projectRoot);

      // Analyze dependencies
      const dependencies = await this.analyzeDependencies(projectRoot);

      // Detect framework and architecture
      const framework = await this.detectFramework(projectRoot);
      const architecture = await this.detectArchitecture(projectRoot);

      // Extract code patterns
      const patterns = await this.extractCodePatterns(projectRoot, fileStructure);

      // Analyze code conventions
      const conventions = await this.analyzeCodeConventions(projectRoot, patterns);

      // Build file relationships
      const relationships = await this.buildFileRelationships(projectRoot, fileStructure);

      // Calculate project complexity
      const complexity = await this.calculateProjectComplexity(projectRoot, fileStructure, relationships);

      // Assess project quality
      const quality = await this.assessProjectQuality(projectRoot, patterns, complexity);

      const context: ProjectContext = {
        id: this.generateProjectId(projectRoot),
        name: this.extractProjectName(projectRoot),
        language: await this.detectPrimaryLanguage(projectRoot),
        framework,
        architecture,
        dependencies,
        fileStructure,
        patterns,
        conventions,
        relationships,
        complexity,
        quality
      };

      // Update knowledge base
      this.updateKnowledgeBase(context);

      const duration = Date.now() - startTime;
      this.performanceMonitor.recordMetric('project_analysis_duration', duration, 'ms');

      console.log(`✅ Project context analysis completed in ${duration}ms`);

      return context;

    } catch (error) {
      console.error('❌ Project context analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyzes a specific file with full project context
   * @param filePath File path to analyze
   * @param projectContext Optional pre-analyzed project context
   * @returns Context-aware analysis
   */
  async analyzeFileWithContext(filePath: string, projectContext?: ProjectContext): Promise<ContextAnalysis> {
    // Check cache first
    const cacheKey = `context_${filePath}`;
    const cachedAnalysis = this.analysisCache.get(cacheKey);

    if (cachedAnalysis && this.isCacheValid(cachedAnalysis)) {
      return cachedAnalysis;
    }

    const startTime = Date.now();

    try {
      // Get or build project context
      const context = projectContext || await this.analyzeProject(this.getProjectRoot(filePath));

      // Read file content
      const code = await this.readFileContent(filePath);

      // Analyze file dependencies
      const dependencies = await this.analyzeFileDependencies(filePath, code);

      // Find related files
      const relatedFiles = await this.findRelatedFiles(filePath, context);

      // Match code patterns
      const patterns = await this.matchPatterns(filePath, code, context);

      // Check code conventions
      const conventions = await this.checkConventions(filePath, code, context);

      // Generate recommendations
      const recommendations = await this.generateContextRecommendations(filePath, code, context, patterns, conventions);

      // Assess impact
      const impact = await this.assessImpact(filePath, code, context, dependencies, recommendations);

      const analysis: ContextAnalysis = {
        filePath,
        relatedFiles,
        dependencies,
        patterns,
        conventions,
        recommendations,
        impact
      };

      // Cache analysis
      this.analysisCache.set(cacheKey, analysis);

      const duration = Date.now() - startTime;
      this.performanceMonitor.recordMetric('file_context_analysis', duration, 'ms');

      return analysis;

    } catch (error) {
      console.error(`❌ File context analysis failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Enhances code review with project context
   * @param filePath File being reviewed
   * @param code File content
   * @param reviewResult Original review result
   * @returns Enhanced review with context
   */
  async enhanceReviewWithContext(
    filePath: string,
    code: string,
    reviewResult: any
  ): Promise<any> {
    const contextAnalysis = await this.analyzeFileWithContext(filePath);

    // Enhance review comments with context
    const enhancedComments = reviewResult.reviewComments.map((comment: any) => ({
      ...comment,
      context: this.getContextForComment(comment, contextAnalysis),
      relatedFiles: this.getRelatedFilesForComment(comment, contextAnalysis),
      patternMatches: this.getPatternMatchesForComment(comment, contextAnalysis),
      conventionViolations: this.getConventionViolationsForComment(comment, contextAnalysis)
    }));

    // Add context-based recommendations
    const contextRecommendations = this.generateContextBasedRecommendations(contextAnalysis);

    return {
      ...reviewResult,
      reviewComments: enhancedComments,
      contextAnalysis,
      contextRecommendations,
      aiAgentContext: {
        ...reviewResult.aiAgentContext,
        projectPatterns: contextAnalysis.patterns.map(p => p.pattern.name),
        relatedFiles: contextAnalysis.relatedFiles.slice(0, 5).map(r => r.path),
        projectContext: {
          framework: this.knowledgeBase.context.get('project')?.impact.overall || 0,
          complexity: this.knowledgeBase.context.get('project')?.impact.maintainability || 0,
          quality: this.knowledgeBase.context.get('project')?.impact.overall || 0
        }
      }
    };
  }

  /**
   * Updates project knowledge base with new analysis
   * @param context Project context
   */
  private updateKnowledgeBase(context: ProjectContext): void {
    // Update patterns
    context.patterns.forEach(pattern => {
      this.knowledgeBase.patterns.set(pattern.id, pattern);
    });

    // Update conventions
    context.conventions.forEach(convention => {
      this.knowledgeBase.conventions.set(convention.id, convention);
    });

    // Update relationships
    context.relationships.forEach(relationship => {
      const key = relationship.sourceFile;
      if (!this.knowledgeBase.relationships.has(key)) {
        this.knowledgeBase.relationships.set(key, []);
      }
      this.knowledgeBase.relationships.get(key)!.push(relationship);
    });

    // Update complexity and quality
    this.knowledgeBase.complexity.set('project', context.complexity.overall);
    this.knowledgeBase.quality.set('project', context.quality.maintainability);

    this.knowledgeBase.lastUpdated = new Date();
  }

  /**
   * Analyzes file structure and organization
   * @param projectRoot Project root directory
   * @returns File structure analysis
   */
  private async analyzeFileStructure(projectRoot: string): Promise<FileStructure> {
    // In production, this would recursively scan the directory
    // For demo, we'll return a sample structure
    return {
      root: projectRoot,
      src: `${projectRoot}/src`,
      tests: `${projectRoot}/tests`,
      config: `${projectRoot}/config`,
      docs: `${projectRoot}/docs`,
      scripts: `${projectRoot}/scripts`,
      assets: `${projectRoot}/assets`,
      totalFiles: 150,
      totalLines: 25000,
      fileTypes: {
        '.ts': 80,
        '.tsx': 25,
        '.js': 15,
        '.json': 10,
        '.md': 8,
        '.css': 5,
        '.html': 2,
        '.yaml': 3,
        '.yml': 2
      }
    };
  }

  /**
   * Analyzes project dependencies
   * @param projectRoot Project root directory
   * @returns Dependency analysis
   */
  private async analyzeDependencies(projectRoot: string): Promise<ProjectDependency[]> {
    // In production, this would parse package.json, requirements.txt, etc.
    return [
      {
        name: 'react',
        version: '^18.0.0',
        type: 'runtime',
        purpose: 'UI framework',
        impact: 'critical'
      },
      {
        name: 'typescript',
        version: '^4.9.0',
        type: 'development',
        purpose: 'Type checking',
        impact: 'high'
      },
      {
        name: '@heroicons/react',
        version: '^2.0.0',
        type: 'runtime',
        purpose: 'Icon library',
        impact: 'medium'
      }
    ];
  }

  /**
   * Detects framework being used
   * @param projectRoot Project root directory
   * @returns Detected framework
   */
  private async detectFramework(projectRoot: string): Promise<string> {
    // In production, this would analyze package.json, imports, etc.
    return 'React';
  }

  /**
   * Detects architecture pattern
   * @param projectRoot Project root directory
   * @returns Detected architecture
   */
  private async detectArchitecture(projectRoot: string): Promise<string> {
    // In production, this would analyze file structure, imports, etc.
    return 'Component-based';
  }

  /**
   * Detects primary programming language
   * @param projectRoot Project root directory
   * @returns Primary language
   */
  private async detectPrimaryLanguage(projectRoot: string): Promise<string> {
    // In production, this would analyze file extensions and content
    return 'TypeScript';
  }

  /**
   * Extracts code patterns from project
   * @param projectRoot Project root directory
   * @param fileStructure File structure
   * @returns Code patterns
   */
  private async extractCodePatterns(projectRoot: string, fileStructure: FileStructure): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // Analyze common patterns in the codebase
    patterns.push({
      id: 'pattern_1',
      name: 'React Functional Component',
      type: 'component',
      frequency: 25,
      locations: [],
      characteristics: {
        complexity: 3,
        maintainability: 8,
        testability: 7,
        reusability: 9,
        performance: 8,
        security: 9
      },
      relationships: [],
      quality: 'excellent'
    });

    patterns.push({
      id: 'pattern_2',
      name: 'Custom Hook Pattern',
      type: 'hook',
      frequency: 12,
      locations: [],
      characteristics: {
        complexity: 4,
        maintainability: 7,
        testability: 8,
        reusability: 8,
        performance: 7,
        security: 8
      },
      relationships: ['pattern_1'],
      quality: 'good'
    });

    return patterns;
  }

  /**
   * Analyzes code conventions
   * @param projectRoot Project root directory
   * @param patterns Code patterns
   * @returns Code conventions
   */
  private async analyzeCodeConventions(projectRoot: string, patterns: CodePattern[]): Promise<CodeConvention[]> {
    const conventions: CodeConvention[] = [];

    conventions.push({
      id: 'naming_1',
      name: 'Component Naming',
      type: 'naming',
      rule: 'React components should be PascalCase',
      examples: [
        {
          good: 'UserProfile',
          bad: 'userProfile',
          explanation: 'Component names should follow PascalCase convention'
        }
      ],
      frequency: 95,
      impact: 'high',
      automated: true
    });

    conventions.push({
      id: 'structure_1',
      name: 'File Organization',
      type: 'structure',
      rule: 'Components should be in separate files',
      examples: [
        {
          good: 'UserProfile.tsx',
          bad: 'components.tsx (multiple components)',
          explanation: 'Each component should have its own file'
        }
      ],
      frequency: 90,
      impact: 'high',
      automated: false
    });

    return conventions;
  }

  /**
   * Builds file relationship graph
   * @param projectRoot Project root directory
   * @param fileStructure File structure
   * @returns File relationships
   */
  private async buildFileRelationships(projectRoot: string, fileStructure: FileStructure): Promise<FileRelationship[]> {
    const relationships: FileRelationship[] = [];

    // In production, this would analyze import/export statements
    relationships.push({
      sourceFile: 'UserProfile.tsx',
      targetFile: 'UserService.ts',
      type: 'import',
      strength: 'strong',
      context: 'Component imports service',
      bidirectional: false
    });

    relationships.push({
      sourceFile: 'UserService.ts',
      targetFile: 'types.ts',
      type: 'import',
      strength: 'strong',
      context: 'Service imports type definitions',
      bidirectional: false
    });

    return relationships;
  }

  /**
   * Calculates project complexity metrics
   * @param projectRoot Project root directory
   * @param fileStructure File structure
   * @param relationships File relationships
   * @returns Project complexity
   */
  private async calculateProjectComplexity(
    projectRoot: string,
    fileStructure: FileStructure,
    relationships: FileRelationship[]
  ): Promise<ProjectComplexity> {
    return {
      overall: 6, // Moderate complexity
      cyclomatic: 4,
      cognitive: 5,
      structural: 7,
      dataFlow: 5,
      controlFlow: 4,
      dependencies: 6
    };
  }

  /**
   * Assesses overall project quality
   * @param projectRoot Project root directory
   * @param patterns Code patterns
   * @param complexity Project complexity
   * @returns Project quality metrics
   */
  private async assessProjectQuality(
    projectRoot: string,
    patterns: CodePattern[],
    complexity: ProjectComplexity
  ): Promise<ProjectQuality> {
    return {
      maintainability: 85,
      testability: 80,
      reliability: 90,
      security: 88,
      performance: 82,
      accessibility: 75,
      documentation: 70
    };
  }

  /**
   * Analyzes file dependencies
   * @param filePath File path
   * @param code File content
   * @returns Dependency information
   */
  private async analyzeFileDependencies(filePath: string, code: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Analyze import statements
    const importMatches = code.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
    const requireMatches = code.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];

    const allImports = [...importMatches, ...requireMatches];

    for (const importMatch of allImports) {
      const packageName = importMatch.match(/['"]([^'"]+)['"]/)?.[1];
      if (packageName && !packageName.startsWith('.')) {
        dependencies.push({
          name: packageName,
          version: 'latest', // Would be looked up from package.json
          usage: [importMatch],
          impact: 'medium',
          alternatives: [],
          updateAvailable: false
        });
      }
    }

    return dependencies;
  }

  /**
   * Finds files related to the given file
   * @param filePath File path
   * @param projectContext Project context
   * @returns Related files
   */
  private async findRelatedFiles(filePath: string, projectContext: ProjectContext): Promise<RelatedFile[]> {
    const relatedFiles: RelatedFile[] = [];

    // Find files with similar patterns
    const filePatterns = projectContext.patterns.filter(pattern =>
      pattern.locations.some(loc => loc.file === filePath)
    );

    for (const pattern of filePatterns) {
      for (const location of pattern.locations) {
        if (location.file !== filePath) {
          relatedFiles.push({
            path: location.file,
            relationship: `Shares ${pattern.name} pattern`,
            strength: 0.8,
            relevance: 0.7,
            reason: `Both files implement the ${pattern.name} pattern`
          });
        }
      }
    }

    // Find files with import relationships
    const relationships = projectContext.relationships.filter(rel =>
      rel.sourceFile === filePath || rel.targetFile === filePath
    );

    for (const relationship of relationships) {
      const relatedPath = relationship.sourceFile === filePath ? relationship.targetFile : relationship.sourceFile;
      relatedFiles.push({
        path: relatedPath,
        relationship: relationship.type,
        strength: relationship.strength === 'strong' ? 0.9 : relationship.strength === 'medium' ? 0.7 : 0.5,
        relevance: 0.8,
        reason: relationship.context
      });
    }

    return relatedFiles.slice(0, 10); // Limit to top 10
  }

  /**
   * Matches code patterns in file
   * @param filePath File path
   * @param code File content
   * @param projectContext Project context
   * @returns Pattern matches
   */
  private async matchPatterns(filePath: string, code: string, projectContext: ProjectContext): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    // Match against project patterns
    for (const pattern of projectContext.patterns) {
      // Simple pattern matching (in production would use AST analysis)
      const patternIndicators = pattern.name.toLowerCase().split(' ');
      const codeLower = code.toLowerCase();

      let matchCount = 0;
      for (const indicator of patternIndicators) {
        if (codeLower.includes(indicator)) {
          matchCount++;
        }
      }

      const confidence = matchCount / patternIndicators.length;

      if (confidence > 0.6) {
        matches.push({
          pattern,
          confidence,
          context: `Pattern ${pattern.name} detected with ${Math.round(confidence * 100)}% confidence`,
          suggestions: this.generatePatternSuggestions(pattern, confidence)
        });
      }
    }

    return matches;
  }

  /**
   * Checks code conventions compliance
   * @param filePath File path
   * @param code File content
   * @param projectContext Project context
   * @returns Convention matches
   */
  private async checkConventions(filePath: string, code: string, projectContext: ProjectContext): Promise<ConventionMatch[]> {
    const matches: ConventionMatch[] = [];

    for (const convention of projectContext.conventions) {
      const violations: string[] = [];
      let compliance = 1.0;

      // Check convention compliance
      switch (convention.type) {
        case 'naming':
          // Check naming conventions
          const namingViolations = this.checkNamingConventions(code, convention);
          violations.push(...namingViolations);
          compliance = Math.max(0, 1 - (violations.length * 0.1));
          break;

        case 'structure':
          // Check structural conventions
          const structureViolations = this.checkStructuralConventions(code, convention);
          violations.push(...structureViolations);
          compliance = Math.max(0, 1 - (violations.length * 0.15));
          break;
      }

      if (violations.length > 0 || compliance < 0.9) {
        matches.push({
          convention,
          compliance,
          violations,
          suggestions: this.generateConventionSuggestions(convention, violations)
        });
      }
    }

    return matches;
  }

  /**
   * Generates context-based recommendations
   * @param filePath File path
   * @param code File content
   * @param projectContext Project context
   * @param patterns Pattern matches
   * @param conventions Convention matches
   * @returns Context recommendations
   */
  private async generateContextRecommendations(
    filePath: string,
    code: string,
    projectContext: ProjectContext,
    patterns: PatternMatch[],
    conventions: ConventionMatch[]
  ): Promise<ContextRecommendation[]> {
    const recommendations: ContextRecommendation[] = [];

    // Pattern-based recommendations
    for (const patternMatch of patterns) {
      if (patternMatch.pattern.quality === 'poor' || patternMatch.pattern.quality === 'problematic') {
        recommendations.push({
          type: 'pattern',
          priority: 'high',
          title: `Improve ${patternMatch.pattern.name} Pattern`,
          description: `The ${patternMatch.pattern.name} pattern in this file needs improvement`,
          impact: 'Improves code quality and maintainability',
          implementation: `Refactor to follow the ${patternMatch.pattern.name} best practices`,
          effort: 'medium'
        });
      }
    }

    // Convention-based recommendations
    for (const conventionMatch of conventions) {
      if (conventionMatch.compliance < 0.8) {
        recommendations.push({
          type: 'convention',
          priority: 'medium',
          title: `Fix ${conventionMatch.convention.name} Violations`,
          description: `${conventionMatch.violations.length} ${conventionMatch.convention.name.toLowerCase()} violations detected`,
          impact: 'Improves code consistency and maintainability',
          implementation: `Apply ${conventionMatch.convention.name} conventions throughout the file`,
          effort: 'low'
        });
      }
    }

    // Project-wide recommendations
    if (projectContext.complexity.overall > 7) {
      recommendations.push({
        type: 'structure',
        priority: 'medium',
        title: 'Consider Code Organization',
        description: 'Project complexity suggests potential for better code organization',
        impact: 'Reduces maintenance overhead and improves developer experience',
        implementation: 'Review and refactor code organization patterns',
        effort: 'high'
      });
    }

    return recommendations.slice(0, 5); // Limit to top 5
  }

  /**
   * Assesses the impact of changes to this file
   * @param filePath File path
   * @param code File content
   * @param projectContext Project context
   * @param dependencies File dependencies
   * @param recommendations Context recommendations
   * @returns Impact assessment
   */
  private async assessImpact(
    filePath: string,
    code: string,
    projectContext: ProjectContext,
    dependencies: DependencyInfo[],
    recommendations: ContextRecommendation[]
  ): Promise<ImpactAssessment> {
    // Calculate impact scores
    const maintainability = this.calculateMaintainabilityImpact(code, recommendations);
    const performance = this.calculatePerformanceImpact(code, dependencies);
    const security = this.calculateSecurityImpact(code, projectContext);
    const testability = this.calculateTestabilityImpact(code, projectContext);

    const overall = (maintainability + performance + security + testability) / 4;

    return {
      maintainability,
      performance,
      security,
      testability,
      overall
    };
  }

  private getContextForComment(comment: any, contextAnalysis: ContextAnalysis): string {
    // Get context relevant to this comment
    const relatedPatterns = contextAnalysis.patterns.filter(p =>
      p.pattern.type === comment.category
    );

    if (relatedPatterns.length > 0) {
      return `This ${comment.category} issue relates to the ${relatedPatterns[0].pattern.name} pattern used throughout the project.`;
    }

    return `Context: ${contextAnalysis.relatedFiles.length} related files identified.`;
  }

  private getRelatedFilesForComment(comment: any, contextAnalysis: ContextAnalysis): string[] {
    // Get files most relevant to this comment
    return contextAnalysis.relatedFiles
      .filter(f => f.relevance > 0.6)
      .slice(0, 3)
      .map(f => f.path);
  }

  private getPatternMatchesForComment(comment: any, contextAnalysis: ContextAnalysis): any[] {
    // Get pattern matches relevant to this comment
    return contextAnalysis.patterns
      .filter(p => p.pattern.type === comment.category)
      .slice(0, 2);
  }

  private getConventionViolationsForComment(comment: any, contextAnalysis: ContextAnalysis): any[] {
    // Get convention violations relevant to this comment
    return contextAnalysis.conventions
      .filter(c => c.convention.type === comment.category)
      .slice(0, 2);
  }

  private generateContextBasedRecommendations(contextAnalysis: ContextAnalysis): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on context analysis
    if (contextAnalysis.impact.maintainability < 70) {
      recommendations.push('Consider refactoring for better maintainability based on project patterns');
    }

    if (contextAnalysis.impact.security < 80) {
      recommendations.push('Review security implications given the project security standards');
    }

    if (contextAnalysis.relatedFiles.length > 5) {
      recommendations.push('This file has many relationships - ensure changes don\'t break dependencies');
    }

    return recommendations;
  }

  private calculateMaintainabilityImpact(code: string, recommendations: ContextRecommendation[]): number {
    // Calculate maintainability impact score
    const baseScore = 80; // Base maintainability
    const recommendationPenalty = recommendations.filter(r => r.type === 'pattern' || r.type === 'convention').length * 5;
    return Math.max(0, baseScore - recommendationPenalty);
  }

  private calculatePerformanceImpact(code: string, dependencies: DependencyInfo[]): number {
    // Calculate performance impact score
    const dependencyCount = dependencies.length;
    const performanceScore = 85 - (dependencyCount * 2); // Rough calculation
    return Math.max(0, Math.min(100, performanceScore));
  }

  private calculateSecurityImpact(code: string, projectContext: ProjectContext): number {
    // Calculate security impact score
    const baseScore = projectContext.quality.security;
    // Adjust based on code analysis
    return Math.max(0, Math.min(100, baseScore - 5));
  }

  private calculateTestabilityImpact(code: string, projectContext: ProjectContext): number {
    // Calculate testability impact score
    const baseScore = projectContext.quality.testability;
    // Adjust based on code structure
    return Math.max(0, Math.min(100, baseScore - 3));
  }

  private generatePatternSuggestions(pattern: CodePattern, confidence: number): string[] {
    const suggestions: string[] = [];

    if (pattern.quality === 'poor') {
      suggestions.push(`Improve ${pattern.name} implementation to match project standards`);
    }

    if (confidence < 0.8) {
      suggestions.push('Consider reviewing pattern implementation for better consistency');
    }

    return suggestions;
  }

  private generateConventionSuggestions(convention: CodeConvention, violations: string[]): string[] {
    const suggestions: string[] = [];

    if (violations.length > 0) {
      suggestions.push(`Fix ${violations.length} ${convention.name.toLowerCase()} violations`);
      suggestions.push(`Follow ${convention.name} conventions used in ${convention.frequency}% of project files`);
    }

    return suggestions;
  }

  private checkNamingConventions(code: string, convention: CodeConvention): string[] {
    const violations: string[] = [];

    // Check for common naming violations
    const camelCasePattern = /[a-z]+[A-Z][a-zA-Z]*/g;
    const matches = code.match(camelCasePattern) || [];

    // This would be more sophisticated in production
    return violations;
  }

  private checkStructuralConventions(code: string, convention: CodeConvention): string[] {
    const violations: string[] = [];

    // Check for structural issues
    // This would be more sophisticated in production
    return violations;
  }

  private isCacheValid(analysis: ContextAnalysis): boolean {
    // Check if cached analysis is still valid (e.g., file hasn't changed)
    return true; // Simplified for demo
  }

  private async readFileContent(filePath: string): Promise<string> {
    // Real file reading implementation using Electron IPC
    try {
      const api = getElectronAPI();
      if (!api?.readFile) {
        throw new Error('Electron API not available');
      }

      const result = await api.readFile(filePath);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to read file');
      }

      return result.content || '';
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      // Return empty string on error to allow analysis to continue
      return '';
    }
  }

  private getProjectRoot(filePath: string): string {
    // Extract project root from file path
    return filePath.split('/').slice(0, -2).join('/'); // Simplified
  }

  private extractProjectName(projectRoot: string): string {
    return projectRoot.split('/').pop() || 'Unknown Project';
  }

  private generateProjectId(projectRoot: string): string {
    const normalizedRoot = projectRoot.replace(/\\/g, '/');
    const projectSlug = normalizedRoot.split('/').filter(Boolean).pop() || 'project';
    return `project_${projectSlug}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
