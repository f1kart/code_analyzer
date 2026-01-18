import { initializeIntelligentAnalysis, CodeAnalysisResult } from '../services/IntelligentCodeAnalysisService';
import { initializeCICDPipelineService } from '../services/CICDPipelineService';
import { initializeTracing, withTracing } from '../services/DistributedTracingService';

interface CodeReviewPipelineConfig {
  enabled: boolean;
  failOnCritical: boolean;
  failOnError: boolean;
  failOnWarning: boolean;
  minConfidenceThreshold: number;
  maxIssuesPerFile: number;
  includePatterns: string[];
  excludePatterns: string[];
  outputFormat: 'json' | 'junit' | 'sarif' | 'html';
  outputPath?: string;
  enableAIAgents: boolean;
  agentTimeout: number;
  parallelAnalysis: boolean;
  maxConcurrentFiles: number;
}

export interface PipelineReviewResult {
  success: boolean;
  totalFiles: number;
  totalIssues: number;
  criticalIssues: number;
  errorIssues: number;
  warningIssues: number;
  infoIssues: number;
  filesWithIssues: Array<{
    filePath: string;
    issueCount: number;
    severityBreakdown: Record<string, number>;
  }>;
  summary: {
    passed: boolean;
    message: string;
    recommendations: string[];
  };
  reportPath?: string;
  duration: number;
}

interface FileAnalysisContext {
  filePath: string;
  content: string;
  language: string;
  projectType: string;
  dependencies: string[];
  existingIssues: CodeAnalysisResult[];
  gitInfo?: {
    branch: string;
    commit: string;
    author: string;
    changedLines: number[];
  };
}

export class CodeReviewPipelineService {
  private config: CodeReviewPipelineConfig;
  private analysisService = initializeIntelligentAnalysis();
  private pipelineService = initializeCICDPipelineService();

  constructor(config: Partial<CodeReviewPipelineConfig> = {}) {
    this.config = {
      enabled: true,
      failOnCritical: true,
      failOnError: false,
      failOnWarning: false,
      minConfidenceThreshold: 0.7,
      maxIssuesPerFile: 100,
      includePatterns: ['**/*.{js,ts,tsx,jsx,py,java,cs,go,rs}'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.min.js', '**/coverage/**'],
      outputFormat: 'json',
      enableAIAgents: true,
      agentTimeout: 30000,
      parallelAnalysis: true,
      maxConcurrentFiles: 5,
      ...config,
    };

    // Initialize tracing for pipeline operations
    initializeTracing({
      serviceName: 'code-review-pipeline',
      serviceVersion: '1.0.0',
      environment: 'production',
      enabled: true,
    });
  }

  /**
   * Run centralized code review for CI/CD pipeline
   */
  async runPipelineReview(
    projectPath: string,
    filesToAnalyze?: string[]
  ): Promise<PipelineReviewResult> {
    if (!this.config.enabled) {
      return this.createEmptyResult('Code review disabled');
    }

    const startTime = Date.now();

    console.log(`🚀 Starting centralized code review for: ${projectPath}`);

    return withTracing('pipeline_code_review', async () => {
      try {
        // 1. Discover files to analyze
        const files = filesToAnalyze || await this.discoverFiles(projectPath);

        if (files.length === 0) {
          return this.createEmptyResult('No files to analyze');
        }

        // 2. Analyze files (parallel or sequential based on config)
        const analysisResults = await this.analyzeFiles(files, projectPath);

        // 3. Aggregate results
        const aggregatedResult = this.aggregateResults(analysisResults);

        // 4. Generate report
        const reportPath = await this.generateReport(aggregatedResult, projectPath);

        // 5. Evaluate pipeline success/failure
        const pipelinePassed = this.evaluatePipelineSuccess(aggregatedResult);

        const result: PipelineReviewResult = {
          ...aggregatedResult,
          summary: {
            passed: pipelinePassed,
            message: this.generateSummaryMessage(aggregatedResult, pipelinePassed),
            recommendations: this.generateRecommendations(aggregatedResult),
          },
          reportPath,
          duration: Date.now() - startTime,
        };

        console.log(`✅ Pipeline code review completed in ${result.duration}ms`);
        console.log(`📊 Results: ${result.totalIssues} issues found across ${result.totalFiles} files`);

        return result;

      } catch (error) {
        console.error('❌ Pipeline code review failed:', error);

        return {
          success: false,
          totalFiles: 0,
          totalIssues: 0,
          criticalIssues: 0,
          errorIssues: 0,
          warningIssues: 0,
          infoIssues: 0,
          filesWithIssues: [],
          summary: {
            passed: false,
            message: `Pipeline review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            recommendations: ['Check pipeline configuration and file permissions'],
          },
          duration: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * Generate CI/CD pipeline configuration with integrated code review
   */
  generateReviewPipeline(config: any): string {
    const pipelineConfig = {
      platform: 'github', // Default platform
      projectType: 'nodejs',
      ...config,
    };

    let pipeline = '';

    switch (pipelineConfig.platform) {
      case 'github':
        pipeline = this.generateGitHubActionsReviewPipeline(pipelineConfig);
        break;
      case 'gitlab':
        pipeline = this.generateGitLabCIReviewPipeline(pipelineConfig);
        break;
      case 'azure':
        pipeline = this.generateAzureDevOpsReviewPipeline(pipelineConfig);
        break;
      default:
        throw new Error(`Unsupported platform: ${pipelineConfig.platform}`);
    }

    return pipeline;
  }

  /**
   * Get review configuration for different platforms
   */
  getPlatformReviewConfig(platform: string): any {
    const configs = {
      github: {
        steps: [
          {
            name: 'Checkout code',
            uses: 'actions/checkout@v3',
          },
          {
            name: 'Setup Node.js',
            uses: 'actions/setup-node@v3',
            with: {
              'node-version': '18',
              cache: 'npm',
            },
          },
          {
            name: 'Install dependencies',
            run: 'npm ci',
          },
          {
            name: 'Run code review',
            run: 'npm run review:code',
            continueOnError: false,
          },
          {
            name: 'Upload review report',
            uses: 'actions/upload-artifact@v3',
            with: {
              name: 'code-review-report',
              path: 'review-report.json',
            },
          },
        ],
      },
      gitlab: {
        stages: ['review', 'test', 'deploy'],
        review: {
          stage: 'review',
          image: 'node:18',
          script: [
            'npm ci',
            'npm run review:code',
          ],
          artifacts: {
            reports: {
              junit: 'review-report.xml',
            },
            paths: ['review-report.json'],
          },
        },
      },
    };

    return configs[platform as keyof typeof configs] || configs.github;
  }

  /**
   * Discover files to analyze based on patterns
   */
  private async discoverFiles(projectPath: string): Promise<string[]> {
    // In a real implementation, this would use glob patterns to find files
    // For now, return a sample set
    const commonFiles = [
      'src/App.tsx',
      'src/components/EnterpriseToolsPanel.tsx',
      'src/services/IntelligentCodeAnalysisService.ts',
      'src/services/UsageAnalyticsService.ts',
    ];

    return commonFiles.map(file => `${projectPath}/${file}`);
  }

  /**
   * Analyze multiple files
   */
  private async analyzeFiles(files: string[], projectPath: string): Promise<Array<{
    filePath: string;
    issues: CodeAnalysisResult[];
    analysisTime: number;
  }>> {
    if (this.config.parallelAnalysis) {
      // Analyze files in parallel with concurrency limit
      const semaphore = new Semaphore(this.config.maxConcurrentFiles);
      const analysisPromises = files.map(async (filePath) => {
        return semaphore.acquire(async () => {
          const startTime = Date.now();
          try {
            const content = await this.readFileContent(filePath);
            const issues = await this.analyzeSingleFile(filePath, content);
            return {
              filePath,
              issues,
              analysisTime: Date.now() - startTime,
            };
          } catch (error) {
            console.error(`Failed to analyze ${filePath}:`, error);
            return {
              filePath,
              issues: [],
              analysisTime: Date.now() - startTime,
            };
          }
        });
      });

      return Promise.all(analysisPromises);
    } else {
      // Analyze files sequentially
      const results = [];
      for (const filePath of files) {
        const startTime = Date.now();
        try {
          const content = await this.readFileContent(filePath);
          const issues = await this.analyzeSingleFile(filePath, content);
          results.push({
            filePath,
            issues,
            analysisTime: Date.now() - startTime,
          });
        } catch (error) {
          console.error(`Failed to analyze ${filePath}:`, error);
          results.push({
            filePath,
            issues: [],
            analysisTime: Date.now() - startTime,
          });
        }
      }
      return results;
    }
  }

  /**
   * Analyze a single file
   */
  private async analyzeSingleFile(filePath: string, content: string): Promise<CodeAnalysisResult[]> {
    const context: Partial<FileAnalysisContext> = {
      filePath,
      language: this.detectLanguage(filePath),
      projectType: 'typescript', // Would detect from project
      dependencies: [], // Would extract from package.json
      existingIssues: [], // Would load from previous analysis
    };

    return this.analysisService.analyzeCodeRealTime(filePath, content, context);
  }

  /**
   * Aggregate analysis results
   */
  private aggregateResults(results: Array<{
    filePath: string;
    issues: CodeAnalysisResult[];
    analysisTime: number;
  }>): Omit<PipelineReviewResult, 'summary' | 'reportPath' | 'duration'> {
    const totalFiles = results.length;
    let totalIssues = 0;
    let criticalIssues = 0;
    let errorIssues = 0;
    let warningIssues = 0;
    let infoIssues = 0;

    const filesWithIssues = results
      .filter(result => result.issues.length > 0)
      .map(result => {
        const severityBreakdown = result.issues.reduce((acc, issue) => {
          acc[issue.severity] = (acc[issue.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Update global counts
        totalIssues += result.issues.length;
        criticalIssues += severityBreakdown.critical || 0;
        errorIssues += severityBreakdown.error || 0;
        warningIssues += severityBreakdown.warning || 0;
        infoIssues += severityBreakdown.info || 0;

        return {
          filePath: result.filePath,
          issueCount: result.issues.length,
          severityBreakdown,
        };
      });

    return {
      success: true,
      totalFiles,
      totalIssues,
      criticalIssues,
      errorIssues,
      warningIssues,
      infoIssues,
      filesWithIssues,
    };
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(result: Omit<PipelineReviewResult, 'summary' | 'reportPath' | 'duration'>, projectPath: string): Promise<string> {
    const reportData = {
      timestamp: new Date().toISOString(),
      projectPath,
      config: this.config,
      results: result,
      metadata: {
        generator: 'IntelligentCodeAnalysisService',
        version: '1.0.0',
      },
    };

    const reportPath = `review-report.${this.config.outputFormat}`;

    switch (this.config.outputFormat) {
      case 'json':
        await this.writeFile(reportPath, JSON.stringify(reportData, null, 2));
        break;
      case 'html':
        await this.writeFile(reportPath, this.generateHTMLReport(reportData));
        break;
      case 'junit':
        await this.writeFile(reportPath, this.generateJUnitReport(reportData));
        break;
      case 'sarif':
        await this.writeFile(reportPath, this.generateSARIFReport(reportData));
        break;
    }

    return reportPath;
  }

  /**
   * Evaluate pipeline success/failure
   */
  private evaluatePipelineSuccess(result: Omit<PipelineReviewResult, 'summary' | 'reportPath' | 'duration'>): boolean {
    // Fail if critical issues found and failOnCritical is true
    if (this.config.failOnCritical && result.criticalIssues > 0) {
      return false;
    }

    // Fail if error issues found and failOnError is true
    if (this.config.failOnError && result.errorIssues > 0) {
      return false;
    }

    // Fail if warning issues found and failOnWarning is true
    if (this.config.failOnWarning && result.warningIssues > 0) {
      return false;
    }

    return true;
  }

  /**
   * Generate summary message
   */
  private generateSummaryMessage(result: Omit<PipelineReviewResult, 'summary' | 'reportPath' | 'duration'>, passed: boolean): string {
    if (passed) {
      return `✅ Code review passed: ${result.totalIssues} issues found across ${result.totalFiles} files`;
    } else {
      return `❌ Code review failed: ${result.criticalIssues} critical, ${result.errorIssues} errors, ${result.warningIssues} warnings found`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(result: Omit<PipelineReviewResult, 'summary' | 'reportPath' | 'duration'>): string[] {
    const recommendations: string[] = [];

    if (result.criticalIssues > 0) {
      recommendations.push(`Fix ${result.criticalIssues} critical issues before deployment`);
    }

    if (result.errorIssues > 0) {
      recommendations.push(`Address ${result.errorIssues} error issues to improve code quality`);
    }

    if (result.warningIssues > 5) {
      recommendations.push('Consider addressing warning issues to improve maintainability');
    }

    if (result.filesWithIssues.length > result.totalFiles * 0.5) {
      recommendations.push('High percentage of files have issues - consider code quality training');
    }

    if (recommendations.length === 0) {
      recommendations.push('Code quality looks good - maintain current standards');
    }

    return recommendations;
  }

  /**
   * Generate GitHub Actions pipeline with code review
   */
  private generateGitHubActionsReviewPipeline(config: any): string {
    return `name: Code Review Pipeline

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  code-review:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run intelligent code review
        run: npm run review:code -- --output-format=json --fail-on-critical
        env:
          CI: true

      - name: Upload review report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: code-review-report
          path: review-report.json

      - name: Comment PR with results
        uses: actions/github-script@v6
        if: github.event_name == 'pull_request'
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('review-report.json', 'utf8'));

            const body = \`## 🤖 Intelligent Code Review Results

            **Status:** \${report.summary.passed ? '✅ Passed' : '❌ Failed'}

            **Summary:** \${report.summary.message}

            **Files Analyzed:** \${report.totalFiles}
            **Total Issues:** \${report.totalIssues}
            - 🔴 Critical: \${report.criticalIssues}
            - 🟠 Errors: \${report.errorIssues}
            - 🟡 Warnings: \${report.warningIssues}
            - 🔵 Info: \${report.infoIssues}

            **Recommendations:**
            \${report.summary.recommendations.map(r => \`- \${r}\`).join('\\n')}

            *Generated by Intelligent Code Analysis Service*\`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });`;
  }

  /**
   * Generate GitLab CI pipeline with code review
   */
  private generateGitLabCIReviewPipeline(config: any): string {
    return `stages:
  - review
  - test
  - deploy

code-review:
  stage: review
  image: node:18
  script:
    - npm ci
    - npm run review:code -- --output-format=junit --fail-on-error
  artifacts:
    reports:
      junit: review-report.xml
    paths:
      - review-report.json
  only:
    - merge_requests
    - main`;
  }

  /**
   * Generate Azure DevOps pipeline with code review
   */
  private generateAzureDevOpsReviewPipeline(config: any): string {
    return `trigger:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
  - checkout: self
    fetchDepth: 0

  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npm run review:code -- --output-format=sarif --fail-on-critical
    displayName: 'Run intelligent code review'
    env:
      CI: true

  - publish: review-report.sarif
    artifact: code-review-report
    displayName: 'Upload review report'`;
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(data: any): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Code Review Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f6f8fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2d3748; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #2d3748; padding: 20px; border-radius: 8px; text-align: center; }
        .critical { border-left: 4px solid #dc3545; }
        .error { border-left: 4px solid #fd7e14; }
        .warning { border-left: 4px solid #ffc107; }
        .info { border-left: 4px solid #0dcaf0; }
        .stat-value { font-size: 2em; font-weight: bold; }
        .issues-list { background: #2d3748; border-radius: 8px; padding: 20px; }
        .issue { margin-bottom: 20px; padding: 15px; border-radius: 6px; border-left: 4px solid; }
        .issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .severity { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Intelligent Code Review Report</h1>
            <p>Generated: ${data.timestamp}</p>
            <p>Project: ${data.projectPath}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${data.results.totalFiles}</div>
                <div>Files Analyzed</div>
            </div>
            <div class="stat-card critical">
                <div class="stat-value">${data.results.criticalIssues}</div>
                <div>Critical Issues</div>
            </div>
            <div class="stat-card error">
                <div class="stat-value">${data.results.errorIssues}</div>
                <div>Error Issues</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${data.results.warningIssues}</div>
                <div>Warning Issues</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">${data.results.infoIssues}</div>
                <div>Info Issues</div>
            </div>
        </div>

        <div class="issues-list">
            <h2>Issues by File</h2>
            ${data.results.filesWithIssues.map((file: any) => `
                <div class="issue">
                    <div class="issue-header">
                        <strong>${file.filePath}</strong>
                        <span>${file.issueCount} issues</span>
                    </div>
                    <div>
                        ${Object.entries(file.severityBreakdown).map(([severity, count]) =>
                            `<span class="severity ${severity}">${severity}: ${count}</span>`
                        ).join(' ')}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitReport(data: any): string {
    const testSuites = data.results.filesWithIssues.map((file: any) => `
  <testsuite name="${file.filePath}" tests="${file.issueCount}" failures="${file.severityBreakdown.error || 0}" warnings="${file.severityBreakdown.warning || 0}">
    ${Array.from({ length: file.issueCount }, (_, i) => `
    <testcase name="Issue_${i + 1}" classname="${file.filePath}">
      <failure message="Code quality issue detected" type="CodeQualityError">
        See detailed report for specific issues
      </failure>
    </testcase>`).join('')}
  </testsuite>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="CodeReview" tests="${data.results.totalIssues}" failures="${data.results.errorIssues}" warnings="${data.results.warningIssues}" time="0">
    ${testSuites}
  </testsuite>
</testsuites>`;
  }

  /**
   * Generate SARIF report
   */
  private generateSARIFReport(data: any): string {
    const results = data.results.filesWithIssues.flatMap((file: any) =>
      Array.from({ length: file.issueCount }, (_, i) => ({
        ruleId: `code_quality_${i}`,
        level: 'warning',
        message: { text: 'Code quality issue detected' },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: file.filePath },
            region: { startLine: 1, startColumn: 1 },
          },
        }],
      }))
    );

    return JSON.stringify({
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [{
        tool: {
          driver: {
            name: 'IntelligentCodeAnalysisService',
            version: '1.0.0',
            informationUri: 'https://github.com/your-org/intelligent-code-analysis',
          },
        },
        results,
      }],
    }, null, 2);
  }

  /**
   * Helper methods
   */
  private async readFileContent(filePath: string): Promise<string> {
    // In a real implementation, this would read the file
    // For now, return a sample
    return `// Sample code for ${filePath}
function exampleFunction(param: string): void {
  console.log('Hello, ' + param); // This will trigger a warning
  // TODO: Add proper error handling
}`;
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    // In a real implementation, this would write the file
    console.log(`Writing report to: ${filePath}`);
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
    };
    return langMap[ext || ''] || 'unknown';
  }

  private createEmptyResult(message: string): PipelineReviewResult {
    return {
      success: true,
      totalFiles: 0,
      totalIssues: 0,
      criticalIssues: 0,
      errorIssues: 0,
      warningIssues: 0,
      infoIssues: 0,
      filesWithIssues: [],
      summary: {
        passed: true,
        message,
        recommendations: [],
      },
      duration: 0,
    };
  }
}

// Semaphore for controlling concurrent operations
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        fn().then(resolve).catch(reject).finally(() => {
          this.permits++;
          this.processWaiting();
        });
      } else {
        this.waiting.push(() => {
          this.permits--;
          fn().then(resolve).catch(reject).finally(() => {
            this.permits++;
            this.processWaiting();
          });
        });
      }
    });
  }

  private processWaiting(): void {
    if (this.waiting.length > 0 && this.permits > 0) {
      const next = this.waiting.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}

// Singleton instance
let codeReviewPipelineService: CodeReviewPipelineService | null = null;

export function initializeCodeReviewPipeline(config?: Partial<CodeReviewPipelineConfig>): CodeReviewPipelineService {
  if (!codeReviewPipelineService) {
    codeReviewPipelineService = new CodeReviewPipelineService(config);
  }
  return codeReviewPipelineService;
}

export function getCodeReviewPipelineService(): CodeReviewPipelineService | null {
  return codeReviewPipelineService;
}

// Convenience functions
export async function runCodeReview(projectPath: string, files?: string[]): Promise<PipelineReviewResult> {
  const service = getCodeReviewPipelineService();
  return service?.runPipelineReview(projectPath, files) || {
    success: false,
    totalFiles: 0,
    totalIssues: 0,
    criticalIssues: 0,
    errorIssues: 0,
    warningIssues: 0,
    infoIssues: 0,
    filesWithIssues: [],
    summary: {
      passed: false,
      message: 'Code review service not initialized',
      recommendations: [],
    },
    duration: 0,
  };
}

export function generateReviewPipeline(config: any): string {
  const service = getCodeReviewPipelineService();
  return service?.generateReviewPipeline(config) || '';
}
