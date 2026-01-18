import { aiWorkflowEngine } from './aiWorkflowEngine';
import * as fs from 'fs';
import * as path from 'path';

export interface AutonomousAgent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: AgentCapability[];
  configuration: AgentConfiguration;
  metrics: AgentMetrics;
  lastActivity: number;
  createdAt: number;
}

export type AgentType =
  | 'code-healer'
  | 'security-scanner'
  | 'performance-optimizer'
  | 'dependency-updater'
  | 'test-generator'
  | 'documentation-writer'
  | 'refactoring-assistant'
  | 'bug-detector'
  | 'code-reviewer'
  | 'style-enforcer';

export type AgentStatus = 'active' | 'paused' | 'stopped' | 'error' | 'configuring';

export interface AgentCapability {
  name: string;
  description: string;
  enabled: boolean;
  confidence: number;
  lastUsed?: number;
}

export interface AgentConfiguration {
  autoFix: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  scope: 'file' | 'project' | 'workspace';
  schedule: ScheduleConfig;
  notifications: NotificationConfig;
  filters: FilterConfig;
  thresholds: ThresholdConfig;
}

export interface ScheduleConfig {
  enabled: boolean;
  interval: number; // milliseconds
  runOnSave: boolean;
  runOnCommit: boolean;
  runOnStartup: boolean;
  quietHours: { start: string; end: string } | null;
}

export interface NotificationConfig {
  onIssueFound: boolean;
  onFixApplied: boolean;
  onError: boolean;
  channels: ('popup' | 'status' | 'log')[];
}

export interface FilterConfig {
  filePatterns: string[];
  excludePatterns: string[];
  languages: string[];
  minSeverity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ScannedProjectFile {
  relativePath: string;
  absolutePath: string;
}

export interface ThresholdConfig {
  maxIssuesPerRun: number;
  maxFixesPerRun: number;
  confidenceThreshold: number;
  timeoutMs: number;
}

export interface AgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  issuesDetected: number;
  issuesFixed: number;
  avgRunTime: number;
  lastRunTime: number;
  uptime: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  input: TaskInput;
  output?: TaskOutput;
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

export type TaskType =
  | 'scan-file'
  | 'scan-project'
  | 'fix-issue'
  | 'optimize-code'
  | 'update-dependency'
  | 'generate-test'
  | 'write-docs'
  | 'refactor-code'
  | 'review-changes';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskInput {
  filePath?: string;
  relativeFilePath?: string;
  absoluteFilePath?: string;
  projectPath?: string;
  absoluteProjectPath?: string;
  codeContent?: string;
  issueDescription?: string;
  parameters?: Record<string, any>;
}

export interface TaskOutput {
  success: boolean;
  changes: CodeChange[];
  issues: DetectedIssue[];
  recommendations: Recommendation[];
  metrics: TaskMetrics;
}

export interface CodeChange {
  id: string;
  filePath: string;
  relativeFilePath?: string;
  absoluteFilePath?: string;
  type: 'insert' | 'delete' | 'replace' | 'move';
  startLine: number;
  endLine: number;
  originalContent: string;
  newContent: string;
  reason: string;
  confidence: number;
  applied: boolean;
}

export interface DetectedIssue {
  id: string;
  type: IssueType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  filePath: string;
  relativeFilePath?: string;
  absoluteFilePath?: string;
  line: number;
  column: number;
  rule?: string;
  fixable: boolean;
  suggestedFix?: string;
  confidence: number;
}

export type IssueType =
  | 'syntax-error'
  | 'type-error'
  | 'logic-error'
  | 'performance-issue'
  | 'security-vulnerability'
  | 'code-smell'
  | 'style-violation'
  | 'deprecated-usage'
  | 'unused-code'
  | 'duplicate-code';

export interface Recommendation {
  id: string;
  type: 'refactor' | 'optimize' | 'security' | 'maintainability' | 'performance';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number;
  actions: RecommendationAction[];
}

export interface RecommendationAction {
  type: 'code-change' | 'dependency-update' | 'config-change' | 'documentation';
  description: string;
  automated: boolean;
}

export interface TaskMetrics {
  executionTime: number;
  memoryUsage: number;
  linesProcessed: number;
  issuesFound: number;
  fixesApplied: number;
}

export class AutonomousAgentSystem {
  private agents = new Map<string, AutonomousAgent>();
  private taskQueue: AgentTask[] = [];
  private runningTasks = new Map<string, AgentTask>();
  private taskHistory: AgentTask[] = [];
  private isRunning = false;
  private agentCallbacks = new Set<(agent: AutonomousAgent, event: string) => void>();
  private taskCallbacks = new Set<(task: AgentTask) => void>();

  constructor() {
    this.loadAgents();
    this.startSystem();
  }

  // Agent Management
  createAgent(config: {
    name: string;
    description: string;
    type: AgentType;
    capabilities: string[];
    configuration?: Partial<AgentConfiguration>;
  }): AutonomousAgent {
    const agent: AutonomousAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: config.name,
      description: config.description,
      type: config.type,
      status: 'configuring',
      capabilities: config.capabilities.map((cap) => ({
        name: cap,
        description: `${cap} capability`,
        enabled: true,
        confidence: 0.8,
      })),
      configuration: {
        ...this.getDefaultConfiguration(),
        ...config.configuration,
      },
      metrics: this.createEmptyMetrics(),
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    this.agents.set(agent.id, agent);
    this.saveAgents();
    return agent;
  }

  async startAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    agent.status = 'active';
    agent.lastActivity = Date.now();
    this.saveAgents();
    this.notifyAgentCallbacks(agent, 'started');

    // Schedule initial scan if configured
    if (agent.configuration.schedule.runOnStartup) {
      await this.scheduleTask(agentId, 'scan-project', 'medium', {
        projectPath: process.cwd(),
      });
    }
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = 'stopped';
    agent.lastActivity = Date.now();

    // Cancel running tasks for this agent
    for (const [taskId, task] of this.runningTasks) {
      if (task.agentId === agentId) {
        task.status = 'cancelled';
        this.runningTasks.delete(taskId);
      }
    }

    this.saveAgents();
    this.notifyAgentCallbacks(agent, 'stopped');
  }

  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = 'paused';
    agent.lastActivity = Date.now();
    this.saveAgents();
    this.notifyAgentCallbacks(agent, 'paused');
  }

  updateAgentConfiguration(agentId: string, config: Partial<AgentConfiguration>): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.configuration = { ...agent.configuration, ...config };
    agent.lastActivity = Date.now();
    this.saveAgents();
    this.notifyAgentCallbacks(agent, 'configured');
  }

  // Task Management
  async scheduleTask(
    agentId: string,
    type: TaskType,
    priority: TaskPriority,
    input: TaskInput,
  ): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'active') {
      throw new Error(`Agent ${agentId} is not active`);
    }

    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      type,
      priority,
      status: 'pending',
      input,
      progress: 0,
      startTime: Date.now(),
    };

    // Insert task based on priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const insertIndex = this.taskQueue.findIndex(
      (t) => priorityOrder[t.priority] > priorityOrder[priority],
    );

    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    this.notifyTaskCallbacks(task);
    return task.id;
  }

  async executeTask(taskId: string): Promise<TaskOutput> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const agent = this.agents.get(task.agentId);
    if (!agent) throw new Error(`Agent ${task.agentId} not found`);

    // Move task to running state
    task.status = 'running';
    task.startTime = Date.now();
    this.runningTasks.set(taskId, task);
    this.taskQueue = this.taskQueue.filter((t) => t.id !== taskId);

    try {
      const output = await this.executeAgentTask(agent, task);

      task.status = 'completed';
      task.endTime = Date.now();
      task.output = output;
      task.progress = 100;

      // Update agent metrics
      agent.metrics.totalRuns++;
      agent.metrics.successfulRuns++;
      agent.metrics.lastRunTime = task.endTime - task.startTime;
      agent.metrics.avgRunTime = (agent.metrics.avgRunTime + agent.metrics.lastRunTime) / 2;
      agent.lastActivity = Date.now();

      this.runningTasks.delete(taskId);
      this.taskHistory.push(task);
      this.saveAgents();
      this.notifyTaskCallbacks(task);

      return output;
    } catch (error) {
      task.status = 'failed';
      task.endTime = Date.now();
      task.error = error instanceof Error ? error.message : String(error);

      agent.metrics.totalRuns++;
      agent.metrics.failedRuns++;
      agent.status = 'error';
      agent.lastActivity = Date.now();

      this.runningTasks.delete(taskId);
      this.taskHistory.push(task);
      this.saveAgents();
      this.notifyTaskCallbacks(task);

      throw error;
    }
  }

  private async executeAgentTask(agent: AutonomousAgent, task: AgentTask): Promise<TaskOutput> {
    const startTime = Date.now();
    let memoryBefore = 0;

    try {
      memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
    } catch (e) {
      // Memory API not available
    }

    const output: TaskOutput = {
      success: false,
      changes: [],
      issues: [],
      recommendations: [],
      metrics: {
        executionTime: 0,
        memoryUsage: 0,
        linesProcessed: 0,
        issuesFound: 0,
        fixesApplied: 0,
      },
    };

    try {
      switch (task.type) {
        case 'scan-file':
          await this.scanFile(agent, task, output);
          break;
        case 'scan-project':
          await this.scanProject(agent, task, output);
          break;
        case 'fix-issue':
          await this.fixIssue(agent, task, output);
          break;
        case 'optimize-code':
          await this.optimizeCode(agent, task, output);
          break;
        case 'generate-test':
          await this.generateTest(agent, task, output);
          break;
        case 'write-docs':
          await this.writeDocs(agent, task, output);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      output.success = true;
    } finally {
      const endTime = Date.now();
      let memoryAfter = 0;

      try {
        memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
      } catch (e) {
        // Memory API not available
      }

      output.metrics.executionTime = endTime - startTime;
      output.metrics.memoryUsage = Math.max(0, memoryAfter - memoryBefore);
      output.metrics.issuesFound = output.issues.length;
      output.metrics.fixesApplied = output.changes.filter((c) => c.applied).length;
    }

    return output;
  }

  // Agent Task Implementations
  private async scanFile(
    agent: AutonomousAgent,
    task: AgentTask,
    output: TaskOutput,
  ): Promise<void> {
    if (!task.input.filePath || !task.input.codeContent) {
      throw new Error('File path and content required for file scan');
    }

    task.progress = 10;

    // Use AI workflow engine for analysis
    const analysisResult = await aiWorkflowEngine.runSequentialWorkflow(
      {
        selectedCode: task.input.codeContent,
        filePath: task.input.filePath,
        userGoal: `Analyze code quality and identify issues in ${task.input.filePath}`,
        additionalContext: `Agent type: ${agent.type}, Capabilities: ${agent.capabilities
          .filter((c) => c.enabled)
          .map((c) => c.name)
          .join(', ')}`,
      },
      ['primary-coder', 'critic-reviewer'],
    );

    task.progress = 50;

    if (analysisResult.result?.finalOutput) {
      try {
        const analysis = JSON.parse(analysisResult.result.finalOutput);

        // Parse issues from AI analysis
        if (analysis.issues) {
          output.issues = analysis.issues.map((issue: any) => ({
            id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: issue.type || 'code-smell',
            severity: issue.severity || 'warning',
            title: issue.title || 'Code issue detected',
            description: issue.description || '',
            filePath: task.input.filePath!,
            relativeFilePath: task.input.relativeFilePath || task.input.filePath!,
            absoluteFilePath:
              task.input.absoluteFilePath ||
              (task.input.projectPath && task.input.filePath
                ? path.resolve(task.input.projectPath, task.input.filePath)
                : undefined),
            line: issue.line || 1,
            column: issue.column || 1,
            fixable: issue.fixable || false,
            suggestedFix: issue.suggestedFix,
            confidence: issue.confidence || 0.7,
          }));
        }

        // Parse recommendations
        if (analysis.recommendations) {
          output.recommendations = analysis.recommendations.map((rec: any) => ({
            id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: rec.type || 'maintainability',
            title: rec.title || 'Code improvement',
            description: rec.description || '',
            impact: rec.impact || 'medium',
            effort: rec.effort || 'medium',
            priority: rec.priority || 5,
            actions: rec.actions || [],
          }));
        }
      } catch (parseError) {
        console.warn('Failed to parse AI analysis result:', parseError);
      }
    }

    task.progress = 100;
    output.metrics.linesProcessed = task.input.codeContent.split('\n').length;
  }

  private async scanProject(
    agent: AutonomousAgent,
    task: AgentTask,
    output: TaskOutput,
  ): Promise<void> {
    if (!task.input.projectPath && !task.input.absoluteProjectPath) {
      throw new Error('Project path required for project scan');
    }

    const projectRoot = task.input.absoluteProjectPath
      ? path.resolve(task.input.absoluteProjectPath)
      : path.resolve(task.input.projectPath as string);

    const scannedFiles: ScannedProjectFile[] = [];
    const maxFiles = Math.max(1, agent.configuration.thresholds.maxIssuesPerRun * 2);
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'out', '.turbo', '.next'];

    const stack: string[] = [projectRoot];

    while (stack.length > 0 && scannedFiles.length < maxFiles) {
      const currentDir = stack.pop() as string;
      let entries: fs.Dirent[];

      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (error) {
        console.warn('[AutonomousAgentSystem] Failed to read directory during project scan:', {
          currentDir,
          error,
        });
        continue;
      }

      for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = path.relative(projectRoot, absolutePath) || entry.name;

        if (entry.isDirectory()) {
          if (ignoreDirs.some((dir) => relativePath.split(path.sep).includes(dir))) {
            continue;
          }
          stack.push(absolutePath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        scannedFiles.push({ relativePath, absolutePath });
        if (scannedFiles.length >= maxFiles) {
          break;
        }
      }
    }

    let totalBytes = 0;
    const largeFiles: ScannedProjectFile[] = [];

    for (const file of scannedFiles) {
      try {
        const stats = await fs.promises.stat(file.absolutePath);
        totalBytes += stats.size;
        if (stats.size > 512 * 1024) {
          largeFiles.push(file);
        }
      } catch (error) {
        console.warn('[AutonomousAgentSystem] Failed to stat file during project scan:', {
          file: file.absolutePath,
          error,
        });
      }
    }

    const totalKb = Math.round(totalBytes / 1024);

    const summaryRecommendation: Recommendation = {
      id: `project-scan-summary-${Date.now()}`,
      type: 'maintainability',
      title: 'Project scan summary',
      description: `Scanned ${scannedFiles.length} files (~${totalKb} KB) starting at ${projectRoot}.`,
      impact: 'medium',
      effort: 'low',
      priority: 5,
      actions: [],
    };

    const largeFileRecommendations: Recommendation[] = largeFiles.map((file) => ({
      id: `project-scan-large-file-${file.absolutePath}`,
      type: 'performance',
      title: 'Large file detected',
      description: `File ${file.relativePath} is larger than 512KB. Consider splitting or optimizing it for better tooling performance.`,
      impact: 'medium',
      effort: 'medium',
      priority: 6,
      actions: [],
    }));

    output.recommendations.push(summaryRecommendation, ...largeFileRecommendations);
    output.metrics.linesProcessed += scannedFiles.length;
  }

  private async fixIssue(
    agent: AutonomousAgent,
    task: AgentTask,
    output: TaskOutput,
  ): Promise<void> {
    if (!task.input.issueDescription || !task.input.filePath) {
      throw new Error('Issue description and file path required for fix');
    }

    task.progress = 20;

    // Use AI workflow engine to generate fix
    const fixResult = await aiWorkflowEngine.runSequentialWorkflow(
      {
        selectedCode: task.input.codeContent,
        filePath: task.input.filePath,
        userGoal: `Fix the following issue in ${task.input.filePath}: ${task.input.issueDescription}`,
        additionalContext: `Agent type: ${agent.type}, Auto-fix enabled: ${agent.configuration.autoFix}`,
      },
      ['primary-coder', 'integrator-finalizer'],
    );

    task.progress = 70;

    if (fixResult.result?.finalOutput) {
      try {
        const fix = JSON.parse(fixResult.result.finalOutput);

        if (fix.changes) {
          output.changes = fix.changes.map((change: any) => {
            const resolvedRelative = change.filePath || task.input.filePath!;
            const resolvedAbsolute =
              change.absolutePath ||
              task.input.absoluteFilePath ||
              (task.input.projectPath && resolvedRelative
                ? path.resolve(task.input.projectPath, resolvedRelative)
                : undefined);

            return {
              id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filePath: resolvedRelative,
              relativeFilePath: resolvedRelative,
              absoluteFilePath: resolvedAbsolute,
              type: change.type || 'replace',
              startLine: change.startLine || 1,
              endLine: change.endLine || 1,
              originalContent: change.originalContent || '',
              newContent: change.newContent || '',
              reason: change.reason || 'AI-generated fix',
              confidence: change.confidence || 0.8,
              applied:
                agent.configuration.autoFix &&
                change.confidence > agent.configuration.thresholds.confidenceThreshold,
            };
          });
        }
      } catch (parseError) {
        console.warn('Failed to parse AI fix result:', parseError);
      }
    }

    task.progress = 100;
  }

  private async optimizeCode(
    agent: AutonomousAgent,
    task: AgentTask,
    output: TaskOutput,
  ): Promise<void> {
    if (!task.input.filePath || !task.input.codeContent) {
      throw new Error('File path and content required for optimization');
    }

    task.progress = 20;

    // Use AI workflow engine to optimize code
    const optimizationResult = await aiWorkflowEngine.runSequentialWorkflow(
      {
        selectedCode: task.input.codeContent,
        filePath: task.input.filePath,
        userGoal: `Optimize the following code for performance, maintainability, and best practices: ${task.input.filePath}`,
        additionalContext: `Agent type: ${agent.type}. Focus on performance optimizations, code simplification, and modern best practices.`,
      },
      ['primary-coder', 'integrator-finalizer'],
    );

    task.progress = 70;

    if (optimizationResult.result?.finalOutput) {
      try {
        const optimization = JSON.parse(optimizationResult.result.finalOutput);

        if (optimization.changes) {
          output.changes = optimization.changes.map((change: any) => {
            const resolvedRelative = change.filePath || task.input.filePath!;
            const resolvedAbsolute =
              change.absolutePath ||
              task.input.absoluteFilePath ||
              (task.input.projectPath && resolvedRelative
                ? path.resolve(task.input.projectPath, resolvedRelative)
                : undefined);

            return {
              id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filePath: resolvedRelative,
              relativeFilePath: resolvedRelative,
              absoluteFilePath: resolvedAbsolute,
              type: change.type || 'replace',
              startLine: change.startLine || 1,
              endLine: change.endLine || 1,
              originalContent: change.originalContent || '',
              newContent: change.newContent || '',
              reason: change.reason || 'Performance and maintainability optimization',
              confidence: change.confidence || 0.8,
              applied:
                agent.configuration.autoFix &&
                change.confidence > agent.configuration.thresholds.confidenceThreshold,
            };
          });
        }
      } catch (parseError) {
        console.warn('Failed to parse AI optimization result:', parseError);
      }
    }

    task.progress = 100;
  }

  private async generateTest(
    agent: AutonomousAgent,
    task: AgentTask,
    output: TaskOutput,
  ): Promise<void> {
    if (!task.input.filePath || !task.input.codeContent) {
      throw new Error('File path and content required for test generation');
    }

    task.progress = 20;

    // Use AI workflow engine to generate tests
    const testResult = await aiWorkflowEngine.runSequentialWorkflow(
      {
        selectedCode: task.input.codeContent,
        filePath: task.input.filePath,
        userGoal: `Generate comprehensive unit tests for the following code: ${task.input.filePath}`,
        additionalContext: `Agent type: ${agent.type}. Generate tests covering edge cases, error conditions, and main functionality.`,
      },
      ['primary-coder', 'integrator-finalizer'],
    );

    task.progress = 70;

    if (testResult.result?.finalOutput) {
      try {
        const testData = JSON.parse(testResult.result.finalOutput);

        if (testData.changes) {
          output.changes = testData.changes.map((change: any) => {
            const relativeTestPath =
              change.filePath ||
              `${task.input.filePath}.test${path.extname(task.input.filePath || 'file.js')}`;
            const absoluteTestPath =
              change.absolutePath ||
              (task.input.projectPath && relativeTestPath
                ? path.resolve(task.input.projectPath, relativeTestPath)
                : undefined);

            return {
              id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filePath: relativeTestPath,
              relativeFilePath: relativeTestPath,
              absoluteFilePath: absoluteTestPath,
              type: change.type || 'create',
              startLine: change.startLine || 1,
              endLine: change.endLine || 1,
              originalContent: change.originalContent || '',
              newContent: change.newContent || '',
              reason: change.reason || 'Generated test case',
              confidence: change.confidence || 0.8,
              applied:
                agent.configuration.autoFix &&
                change.confidence > agent.configuration.thresholds.confidenceThreshold,
            };
          });
        }
      } catch (parseError) {
        console.warn('Failed to parse AI test generation result:', parseError);
      }
    }

    task.progress = 100;
  }

  private async writeDocs(
    agent: AutonomousAgent,
    task: AgentTask,
    output: TaskOutput,
  ): Promise<void> {
    if (!task.input.filePath || !task.input.codeContent) {
      throw new Error('File path and content required for documentation generation');
    }

    task.progress = 20;

    // Use AI workflow engine to generate documentation
    const docsResult = await aiWorkflowEngine.runSequentialWorkflow(
      {
        selectedCode: task.input.codeContent,
        filePath: task.input.filePath,
        userGoal: `Generate comprehensive documentation for the following code: ${task.input.filePath}`,
        additionalContext: `Agent type: ${agent.type}. Generate API documentation, usage examples, and inline comments.`,
      },
      ['primary-coder', 'integrator-finalizer'],
    );

    task.progress = 70;

    if (docsResult.result?.finalOutput) {
      try {
        const docsData = JSON.parse(docsResult.result.finalOutput);

        if (docsData.changes) {
          output.changes = docsData.changes.map((change: any) => {
            const relativeDocPath = change.filePath || `${task.input.filePath}.md`;
            const absoluteDocPath =
              change.absolutePath ||
              (task.input.projectPath && relativeDocPath
                ? path.resolve(task.input.projectPath, relativeDocPath)
                : undefined);

            return {
              id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filePath: relativeDocPath,
              relativeFilePath: relativeDocPath,
              absoluteFilePath: absoluteDocPath,
              type: change.type || 'create',
              startLine: change.startLine || 1,
              endLine: change.endLine || 1,
              originalContent: change.originalContent || '',
              newContent: change.newContent || '',
              reason: change.reason || 'Generated documentation',
              confidence: change.confidence || 0.8,
              applied:
                agent.configuration.autoFix &&
                change.confidence > agent.configuration.thresholds.confidenceThreshold,
            };
          });
        }
      } catch (parseError) {
        console.warn('Failed to parse AI documentation result:', parseError);
      }
    }

    task.progress = 100;
  }
  private startSystem(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processTaskQueue();
    this.schedulePeriodicTasks();
  }

  private async processTaskQueue(): Promise<void> {
    while (this.isRunning) {
      if (this.taskQueue.length > 0 && this.runningTasks.size < 3) {
        const task = this.taskQueue.shift()!;

        try {
          await this.executeTask(task.id);
        } catch (error) {
          console.warn(`Task ${task.id} failed:`, error);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private schedulePeriodicTasks(): void {
    // Schedule periodic tasks for active agents
    setInterval(() => {
      for (const agent of this.agents.values()) {
        if (agent.status === 'active' && agent.configuration.schedule.enabled) {
          const now = Date.now();
          const interval = agent.configuration.schedule.interval;

          if (now - agent.lastActivity >= interval) {
            this.scheduleTask(agent.id, 'scan-project', 'low', {
              projectPath: process.cwd(),
            }).catch(console.warn);
          }
        }
      }
    }, 60000); // Check every minute
  }

  // Utility Methods
  private getDefaultConfiguration(): AgentConfiguration {
    return {
      autoFix: false,
      severity: 'medium',
      scope: 'project',
      schedule: {
        enabled: true,
        interval: 300000, // 5 minutes
        runOnSave: true,
        runOnCommit: true,
        runOnStartup: false,
        quietHours: null,
      },
      notifications: {
        onIssueFound: true,
        onFixApplied: true,
        onError: true,
        channels: ['status', 'log'],
      },
      filters: {
        filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        excludePatterns: ['**/node_modules/**', '**/dist/**'],
        languages: ['typescript', 'javascript'],
        minSeverity: 'warning',
      },
      thresholds: {
        maxIssuesPerRun: 50,
        maxFixesPerRun: 10,
        confidenceThreshold: 0.8,
        timeoutMs: 30000,
      },
    };
  }

  private createEmptyMetrics(): AgentMetrics {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      issuesDetected: 0,
      issuesFixed: 0,
      avgRunTime: 0,
      lastRunTime: 0,
      uptime: 0,
    };
  }

  // Persistence
  private loadAgents(): void {
    try {
      const saved = localStorage.getItem('autonomous_agents');
      if (saved) {
        const data = JSON.parse(saved);
        this.agents = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load autonomous agents:', error);
    }
  }

  private saveAgents(): void {
    try {
      const data = Array.from(this.agents.entries());
      localStorage.setItem('autonomous_agents', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save autonomous agents:', error);
    }
  }

  // Event Handling
  onAgentChanged(callback: (agent: AutonomousAgent, event: string) => void): () => void {
    this.agentCallbacks.add(callback);
    return () => this.agentCallbacks.delete(callback);
  }

  onTaskChanged(callback: (task: AgentTask) => void): () => void {
    this.taskCallbacks.add(callback);
    return () => this.taskCallbacks.delete(callback);
  }

  private notifyAgentCallbacks(agent: AutonomousAgent, event: string): void {
    this.agentCallbacks.forEach((callback) => {
      try {
        callback(agent, event);
      } catch (error) {
        console.warn('Agent callback failed:', error);
      }
    });
  }

  private notifyTaskCallbacks(task: AgentTask): void {
    this.taskCallbacks.forEach((callback) => {
      try {
        callback(task);
      } catch (error) {
        console.warn('Task callback failed:', error);
      }
    });
  }

  // Public API
  getAgents(): AutonomousAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): AutonomousAgent | null {
    return this.agents.get(agentId) || null;
  }

  getTasks(): AgentTask[] {
    return [...this.taskQueue, ...Array.from(this.runningTasks.values())];
  }

  getTaskHistory(): AgentTask[] {
    return this.taskHistory.slice(-100); // Return last 100 tasks
  }

  getSystemStatus(): {
    totalAgents: number;
    activeAgents: number;
    queuedTasks: number;
    runningTasks: number;
    completedTasks: number;
  } {
    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter((a) => a.status === 'active').length,
      queuedTasks: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
      completedTasks: this.taskHistory.filter((t) => t.status === 'completed').length,
    };
  }
}

export const autonomousAgentSystem = new AutonomousAgentSystem();
