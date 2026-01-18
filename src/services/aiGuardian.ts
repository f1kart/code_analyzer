import { aiWorkflowEngine } from './aiWorkflowEngine';
import {
  readDirectory as readDirectoryEntries,
  readFile as readFileContentBridge,
  watchDirectory as watchDirectoryBridge,
  unwatchDirectory as unwatchDirectoryBridge,
  writeFile as writeFileBridge,
} from './fileSystemService';
import { isDesktopApp } from '../utils/env';

export interface GuardianIssue {
  id: string;
  type: 'bug' | 'security' | 'performance' | 'maintainability' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
  codeSnippet: string;
  suggestion: string;
  autoFixAvailable: boolean;
  autoFix?: string;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface GuardianReport {
  id: string;
  projectPath: string;
  scanStarted: number;
  scanCompleted?: number;
  totalFiles: number;
  scannedFiles: number;
  issues: GuardianIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<GuardianIssue['type'], number>;
  };
  status: 'scanning' | 'completed' | 'failed';
}

export class AIGuardian {
  private isActive = false;
  private watchedProjects = new Set<string>();
  private currentReport: GuardianReport | null = null;
  private scanInterval: NodeJS.Timeout | null = null;
  private fileWatchers = new Map<string, any>();
  private issueCallbacks = new Set<(issues: GuardianIssue[]) => void>();

  // Configuration
  private config = {
    scanIntervalMs: 30000, // 30 seconds
    maxFilesPerScan: 50,
    enableAutoFix: false,
    severityThreshold: 'medium' as GuardianIssue['severity'],
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.bundle.js',
    ],
  };

  start(projectPath: string): void {
    if (this.isActive) {
      this.stop();
    }

    this.isActive = true;
    this.watchedProjects.add(projectPath);

    // Initial scan
    this.performScan(projectPath);

    // Set up periodic scanning
    this.scanInterval = setInterval(() => {
      if (this.isActive) {
        this.performScan(projectPath);
      }
    }, this.config.scanIntervalMs);

    // Set up file system watchers
    this.setupFileWatchers(projectPath);
  }

  stop(): void {
    this.isActive = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    // Clean up file watchers
    this.fileWatchers.forEach((watcher) => {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
      }
    });
    this.fileWatchers.clear();
    // AI Guardian stopped monitoring
  }

  private async setupFileWatchers(projectPath: string): Promise<void> {
    try {
      if (!isDesktopApp()) {
        return;
      }

      const result = await watchDirectoryBridge(projectPath, (event) => {
        const eventType = event.eventType || event.type;
        if (eventType === 'change' || eventType === 'add' || eventType === 'modified' || eventType === 'created') {
          this.debouncedScan(projectPath);
        }
      });

      if (result?.watchId) {
        this.fileWatchers.set(projectPath, {
          watchId: result.watchId,
          close: async () => {
            try {
              await unwatchDirectoryBridge(result.watchId as string);
            } catch (error) {
              console.warn('Failed to unwatch directory:', error);
            }
          },
        });
      }
    } catch (error) {
      console.warn('Failed to setup file watchers:', error);
    }
  }

  private debouncedScan = this.debounce((projectPath: string) => {
    this.performScan(projectPath);
  }, 2000);

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  private async performScan(projectPath: string): Promise<void> {
    if (!this.isActive) return;

    const reportId = `guardian-${Date.now()}`;
    this.currentReport = {
      id: reportId,
      projectPath,
      scanStarted: Date.now(),
      totalFiles: 0,
      scannedFiles: 0,
      issues: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byType: {
          bug: 0,
          security: 0,
          performance: 0,
          maintainability: 0,
          style: 0,
        },
      },
      status: 'scanning',
    };

    try {
      const files = await this.getProjectFiles(projectPath);
      this.currentReport.totalFiles = files.length;

      // Scan files in batches
      const batchSize = Math.min(this.config.maxFilesPerScan, files.length);
      const filesToScan = files.slice(0, batchSize);

      for (const filePath of filesToScan) {
        if (!this.isActive) break;

        try {
          const issues = await this.scanFile(filePath);
          this.currentReport.issues.push(...issues);
          this.currentReport.scannedFiles++;
        } catch (error) {
          console.warn(`Failed to scan file ${filePath}:`, error);
        }
      }

      // Update summary
      this.updateReportSummary();
      this.currentReport.scanCompleted = Date.now();
      this.currentReport.status = 'completed';

      // Notify callbacks
      this.notifyIssueCallbacks(this.currentReport.issues);
    } catch (error) {
      console.error('Guardian scan failed:', error);
      if (this.currentReport) {
        this.currentReport.status = 'failed';
      }
    }
  }

  private async getProjectFiles(projectPath: string): Promise<string[]> {
    try {
      if (!isDesktopApp()) {
        return [];
      }

      const entries = await readDirectoryEntries(projectPath, true);
      return entries
        .filter((entry) => !entry.isDirectory && this.shouldScanFile(entry.path))
        .map((entry) => entry.path);
    } catch (error) {
      console.warn('Failed to read project directory:', error);
    }
    return [];
  }

  private getFileLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
    };
    return languageMap[ext || ''] || 'text';
  }

  private shouldScanFile(filePath: string): boolean {
    const supportedExtensions = [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.cs',
      '.php',
      '.rb',
      '.go',
      '.rs',
    ];
    const hasValidExtension = supportedExtensions.some((ext) => filePath.endsWith(ext));

    if (!hasValidExtension) return false;

    // Check exclude patterns
    return !this.config.excludePatterns.some((pattern) => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  private async scanFile(filePath: string): Promise<GuardianIssue[]> {
    try {
      // Read file content
      const fileContent = await this.readFileContent(filePath);
      if (!fileContent) return [];

      // Use AI to analyze the code
      const issues = await this.analyzeCodeWithAI(filePath, fileContent);
      return issues;
    } catch (error) {
      console.warn(`Failed to scan file ${filePath}:`, error);
      return [];
    }
  }

  private async readFileContent(filePath: string): Promise<string | null> {
    try {
      if (!isDesktopApp()) {
        return null;
      }

      const result = await readFileContentBridge(filePath);
      if (result?.content) {
        return result.content;
      }
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
    }
    return null;
  }

  private async analyzeCodeWithAI(filePath: string, content: string): Promise<GuardianIssue[]> {
    try {
      // Determine file language from extension
      const language = this.getFileLanguage(filePath);

      // Prepare analysis prompt
      const _prompt = `Analyze the following ${language} code for potential issues:

File: ${filePath}

Code:
\`\`\`${language}
${content}
\`\`\`

Please identify:
1. Security vulnerabilities
2. Performance issues
3. Logic bugs
4. Code quality problems
5. Best practice violations
6. Potential maintainability issues

For each issue found, provide:
- Type (bug, security, performance, maintainability, style)
- Severity (low, medium, high, critical)
- Title (brief description)
- Detailed description
- Line number if possible
- Code snippet showing the issue
- Suggestion for fix
- Whether auto-fix is possible

Format as JSON array of issue objects. Return empty array if no issues found.`;

      // Use AI workflow engine for analysis
      const session = await aiWorkflowEngine.runSequentialWorkflow(
        {
          selectedCode: content,
          filePath: filePath,
          userGoal: `Analyze ${language} code for issues and provide detailed feedback`,
          additionalContext: `File language: ${language}. Focus on production code quality, security, and maintainability.`,
        },
        ['primary-coder', 'critic-reviewer'], // Use code analysis agents
      );

      // Parse AI response
      if (session.result?.finalOutput) {
        return this.parseAIResponse(session.result.finalOutput, filePath);
      }

      return [];
    } catch (error) {
      console.warn('AI code analysis failed:', error);
      return [];
    }
  }

  private parseAIResponse(response: string, filePath: string): GuardianIssue[] {
    try {
      // Try to parse as JSON first
      const parsedResponse = JSON.parse(response);
      if (Array.isArray(parsedResponse)) {
        return parsedResponse.map((issue: any) => this.completeIssue(issue, filePath));
      }

      // Fallback to text parsing for common issue patterns
      const issues: GuardianIssue[] = [];
      const lines = response.split('\n');
      let currentIssue: Partial<GuardianIssue> = {};

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.includes('security') || trimmed.includes('vulnerability')) {
          if (currentIssue.description) {
            issues.push(this.completeIssue(currentIssue, filePath));
          }
          currentIssue = {
            type: 'security',
            severity: 'high',
            description: trimmed,
          };
        } else if (trimmed.includes('performance') || trimmed.includes('slow')) {
          if (currentIssue.description) {
            issues.push(this.completeIssue(currentIssue, filePath));
          }
          currentIssue = {
            type: 'performance',
            severity: 'medium',
            description: trimmed,
          };
        } else if (trimmed.includes('bug') || trimmed.includes('error')) {
          if (currentIssue.description) {
            issues.push(this.completeIssue(currentIssue, filePath));
          }
          currentIssue = {
            type: 'bug',
            severity: 'high',
            description: trimmed,
          };
        } else if (trimmed && currentIssue.description) {
          currentIssue.suggestion = trimmed;
        }
      }

      if (currentIssue.description) {
        issues.push(this.completeIssue(currentIssue, filePath));
      }

      return issues;
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return [];
    }
  }

  private completeIssue(partial: Partial<GuardianIssue>, filePath: string): GuardianIssue {
    return {
      id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: partial.type || 'maintainability',
      severity: partial.severity || 'medium',
      title: partial.title || partial.description?.substring(0, 50) || 'Code Issue',
      description: partial.description || 'Issue detected by AI Guardian',
      filePath,
      lineNumber: partial.lineNumber,
      columnNumber: partial.columnNumber,
      codeSnippet: partial.codeSnippet || '',
      suggestion: partial.suggestion || 'Review and fix manually',
      autoFixAvailable: Boolean(partial.autoFix),
      autoFix: partial.autoFix,
      detectedAt: Date.now(),
      resolved: false,
    };
  }

  private updateReportSummary(): void {
    if (!this.currentReport) return;

    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byType: {
        bug: 0,
        security: 0,
        performance: 0,
        maintainability: 0,
        style: 0,
      },
    };

    this.currentReport.issues.forEach((issue) => {
      summary[issue.severity]++;
      summary.byType[issue.type]++;
    });

    this.currentReport.summary = summary;
  }

  private notifyIssueCallbacks(issues: GuardianIssue[]): void {
    const criticalIssues = issues.filter(
      (issue) => issue.severity === 'critical' || issue.severity === 'high',
    );

    this.issueCallbacks.forEach((callback) => {
      try {
        callback(criticalIssues);
      } catch (error) {
        console.warn('Issue callback failed:', error);
      }
    });
  }

  // Public API
  getCurrentReport(): GuardianReport | null {
    return this.currentReport;
  }

  getIssues(filePath?: string): GuardianIssue[] {
    if (!this.currentReport) return [];

    return filePath
      ? this.currentReport.issues.filter((issue) => issue.filePath === filePath)
      : this.currentReport.issues;
  }

  resolveIssue(issueId: string): boolean {
    if (!this.currentReport) return false;

    const issue = this.currentReport.issues.find((i) => i.id === issueId);
    if (!issue) return false;

    issue.resolved = true;
    issue.resolvedAt = Date.now();
    return true;
  }

  async applyAutoFix(issueId: string): Promise<boolean> {
    if (!this.config.enableAutoFix) return false;

    const issue = this.getIssues().find((i) => i.id === issueId);
    if (!issue || !issue.autoFixAvailable || !issue.autoFix) return false;

    try {
      // Apply the auto-fix
      const currentContent = await this.readFileContent(issue.filePath);
      const codeSnippet = issue.codeSnippet || '';

      if (!currentContent) {
        console.warn(`Failed to load original content for ${issue.filePath}`);
        return false;
      }

      // Simple string replacement for now - could be enhanced with AST manipulation
      const fixedContent = currentContent.replace(codeSnippet, issue.autoFix);

      if (isDesktopApp()) {
        const result = await writeFileBridge(issue.filePath, fixedContent);
        if (result.success) {
          this.resolveIssue(issueId);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Failed to apply fix for issue ${issueId}:`, error);
      return false;
    }
  }

  onIssuesDetected(callback: (issues: GuardianIssue[]) => void): () => void {
    this.issueCallbacks.add(callback);
    return () => this.issueCallbacks.delete(callback);
  }

  updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): typeof this.config {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.isActive;
  }

  getWatchedProjects(): string[] {
    return Array.from(this.watchedProjects);
  }
}

// Global instance
export const aiGuardian = new AIGuardian();
