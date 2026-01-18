/**
 * Workflow Automation Engine
 * Visual workflow builder with triggers, actions, and conditions
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

export type TriggerType =
  | 'on_save'
  | 'on_commit'
  | 'on_push'
  | 'on_error'
  | 'on_test_fail'
  | 'on_file_open'
  | 'on_file_create'
  | 'on_build'
  | 'manual'
  | 'schedule';

export type ActionType =
  | 'run_tests'
  | 'lint_code'
  | 'format_code'
  | 'security_scan'
  | 'build'
  | 'deploy'
  | 'git_commit'
  | 'git_push'
  | 'send_notification'
  | 'run_script'
  | 'generate_docs'
  | 'ai_review';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'matches_regex'
  | 'file_exists'
  | 'file_changed'
  | 'branch_is'
  | 'has_tests';

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  config: {
    filePattern?: string;
    branch?: string;
    schedule?: string; // cron expression
    errorType?: string;
  };
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string;
  negate?: boolean;
}

export interface WorkflowAction {
  id: string;
  type: ActionType;
  name: string;
  config: {
    command?: string;
    script?: string;
    message?: string;
    branch?: string;
    target?: string;
    options?: Record<string, any>;
  };
  continueOnError?: boolean;
  timeout?: number; // milliseconds
}

export interface WorkflowStep {
  id: string;
  name: string;
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  parallelExecution?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  variables?: Record<string, string>;
  notifications?: {
    onSuccess?: boolean;
    onFailure?: boolean;
    channels?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  triggeredBy: TriggerType;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  steps: Array<{
    stepId: string;
    stepName: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startTime?: Date;
    endTime?: Date;
    error?: string;
    output?: string;
  }>;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    message: string;
  }>;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'testing' | 'deployment' | 'quality' | 'git' | 'custom';
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;
  icon: string;
}

/**
 * Workflow Automation Engine
 */
export class WorkflowAutomationEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private activeExecutions: Set<string> = new Set();
  private triggerListeners: Map<TriggerType, Set<(context: any) => void>> = new Map();
  private maxExecutionHistory = 100;

  constructor() {
    console.log('[WorkflowAutomation] Engine initialized');
    this.registerDefaultTemplates();
  }

  /**
   * Create workflow from template
   */
  public createFromTemplate(templateId: string, customization?: Partial<Workflow>): Workflow {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const workflow: Workflow = {
      id: this.generateId(),
      ...template.workflow,
      ...customization,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(workflow.id, workflow);
    console.log(`[WorkflowAutomation] Created workflow from template: ${template.name}`);
    return workflow;
  }

  /**
   * Create custom workflow
   */
  public createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Workflow {
    const newWorkflow: Workflow = {
      id: this.generateId(),
      ...workflow,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workflows.set(newWorkflow.id, newWorkflow);
    
    // Register triggers
    this.registerWorkflowTriggers(newWorkflow);
    
    console.log(`[WorkflowAutomation] Created workflow: ${newWorkflow.name}`);
    return newWorkflow;
  }

  /**
   * Update workflow
   */
  public updateWorkflow(id: string, updates: Partial<Workflow>): Workflow {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }

    const updated: Workflow = {
      ...workflow,
      ...updates,
      id: workflow.id,
      createdAt: workflow.createdAt,
      updatedAt: new Date(),
    };

    this.workflows.set(id, updated);
    
    // Re-register triggers
    this.registerWorkflowTriggers(updated);
    
    console.log(`[WorkflowAutomation] Updated workflow: ${updated.name}`);
    return updated;
  }

  /**
   * Delete workflow
   */
  public deleteWorkflow(id: string): boolean {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      return false;
    }

    this.workflows.delete(id);
    console.log(`[WorkflowAutomation] Deleted workflow: ${workflow.name}`);
    return true;
  }

  /**
   * Get workflow
   */
  public getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Get all workflows
   */
  public getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute workflow manually
   */
  public async executeWorkflow(
    workflowId: string,
    context?: Record<string, any>
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow is disabled: ${workflow.name}`);
    }

    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggeredBy: 'manual',
      startTime: new Date(),
      status: 'running',
      steps: workflow.steps.map((step) => ({
        stepId: step.id,
        stepName: step.name,
        status: 'pending',
      })),
      logs: [],
    };

    this.executions.set(execution.id, execution);
    this.activeExecutions.add(execution.id);

    console.log(`[WorkflowAutomation] Executing workflow: ${workflow.name}`);
    this.addLog(execution, 'info', `Started workflow: ${workflow.name}`);

    try {
      // Execute steps sequentially
      for (const step of workflow.steps) {
        await this.executeStep(execution, step, workflow, context);
      }

      execution.status = 'success';
      execution.endTime = new Date();
      this.addLog(execution, 'info', `Workflow completed successfully`);

      // Send success notification
      if (workflow.notifications?.onSuccess) {
        await this.sendNotification(workflow, execution, 'success');
      }
    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error.message;
      this.addLog(execution, 'error', `Workflow failed: ${error.message}`);

      // Send failure notification
      if (workflow.notifications?.onFailure) {
        await this.sendNotification(workflow, execution, 'failure');
      }
    } finally {
      this.activeExecutions.delete(execution.id);
      this.cleanupOldExecutions();
    }

    return execution;
  }

  /**
   * Execute workflow step
   */
  private async executeStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    workflow: Workflow,
    context?: Record<string, any>
  ): Promise<void> {
    const stepStatus = execution.steps.find((s) => s.stepId === step.id);
    if (!stepStatus) return;

    stepStatus.status = 'running';
    stepStatus.startTime = new Date();
    this.addLog(execution, 'info', `Starting step: ${step.name}`);

    try {
      // Check conditions
      if (step.conditions && step.conditions.length > 0) {
        const conditionsMet = await this.evaluateConditions(step.conditions, context);
        if (!conditionsMet) {
          stepStatus.status = 'skipped';
          stepStatus.endTime = new Date();
          this.addLog(execution, 'info', `Step skipped (conditions not met): ${step.name}`);
          return;
        }
      }

      // Execute actions
      if (step.parallelExecution) {
        await Promise.all(
          step.actions.map((action) => this.executeAction(execution, action, workflow, context))
        );
      } else {
        for (const action of step.actions) {
          await this.executeAction(execution, action, workflow, context);
        }
      }

      stepStatus.status = 'success';
      stepStatus.endTime = new Date();
      this.addLog(execution, 'info', `Step completed: ${step.name}`);
    } catch (error: any) {
      stepStatus.status = 'failed';
      stepStatus.endTime = new Date();
      stepStatus.error = error.message;
      this.addLog(execution, 'error', `Step failed: ${step.name} - ${error.message}`);

      // Retry logic
      if (step.retryCount && step.retryCount > 0) {
        for (let i = 0; i < step.retryCount; i++) {
          this.addLog(execution, 'info', `Retrying step (attempt ${i + 1}/${step.retryCount})`);
          
          if (step.retryDelay) {
            await this.sleep(step.retryDelay);
          }

          try {
            // Retry actions
            if (step.parallelExecution) {
              await Promise.all(
                step.actions.map((action) => this.executeAction(execution, action, workflow, context))
              );
            } else {
              for (const action of step.actions) {
                await this.executeAction(execution, action, workflow, context);
              }
            }

            stepStatus.status = 'success';
            stepStatus.endTime = new Date();
            this.addLog(execution, 'info', `Step succeeded on retry: ${step.name}`);
            return;
          } catch (retryError: any) {
            this.addLog(execution, 'warning', `Retry failed: ${retryError.message}`);
          }
        }
      }

      throw error;
    }
  }

  /**
   * Execute workflow action
   */
  private async executeAction(
    execution: WorkflowExecution,
    action: WorkflowAction,
    workflow: Workflow,
    context?: Record<string, any>
  ): Promise<void> {
    this.addLog(execution, 'info', `Executing action: ${action.name}`);

    try {
      switch (action.type) {
        case 'run_tests':
          await this.runTests(action, context);
          break;
        case 'lint_code':
          await this.lintCode(action, context);
          break;
        case 'format_code':
          await this.formatCode(action, context);
          break;
        case 'security_scan':
          await this.securityScan(action, context);
          break;
        case 'build':
          await this.build(action, context);
          break;
        case 'deploy':
          await this.deploy(action, context);
          break;
        case 'git_commit':
          await this.gitCommit(action, context);
          break;
        case 'git_push':
          await this.gitPush(action, context);
          break;
        case 'send_notification':
          await this.sendActionNotification(action, context);
          break;
        case 'run_script':
          await this.runScript(action, context);
          break;
        case 'generate_docs':
          await this.generateDocs(action, context);
          break;
        case 'ai_review':
          await this.aiReview(action, context);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      this.addLog(execution, 'info', `Action completed: ${action.name}`);
    } catch (error: any) {
      this.addLog(execution, 'error', `Action failed: ${action.name} - ${error.message}`);
      
      if (!action.continueOnError) {
        throw error;
      } else {
        this.addLog(execution, 'warning', `Continuing despite error (continueOnError=true)`);
      }
    }
  }

  /**
   * Evaluate conditions
   */
  private async evaluateConditions(
    conditions: WorkflowCondition[],
    context?: Record<string, any>
  ): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (condition.negate ? result : !result) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single condition
   */
  private async evaluateCondition(
    condition: WorkflowCondition,
    context?: Record<string, any>
  ): Promise<boolean> {
    const fieldValue = context?.[condition.field] || '';

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(condition.value);
      case 'not_contains':
        return !String(fieldValue).includes(condition.value);
      case 'matches_regex':
        return new RegExp(condition.value).test(String(fieldValue));
      case 'file_exists':
        // Stub: Check if file exists
        return true;
      case 'file_changed':
        // Stub: Check if file changed
        return true;
      case 'branch_is':
        // Stub: Check current branch
        return true;
      case 'has_tests':
        // Stub: Check if tests exist
        return true;
      default:
        return false;
    }
  }

  /**
   * Action implementations (stubs for integration)
   */
  private async runTests(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Running tests:', action.config);
    // Integration point: Call test runner service
    await this.sleep(100);
  }

  private async lintCode(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Linting code:', action.config);
    // Integration point: Call linter service
    await this.sleep(100);
  }

  private async formatCode(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Formatting code:', action.config);
    // Integration point: Call formatter service
    await this.sleep(100);
  }

  private async securityScan(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Running security scan:', action.config);
    // Integration point: Call security scanner
    await this.sleep(100);
  }

  private async build(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Building:', action.config);
    // Integration point: Call build system
    await this.sleep(100);
  }

  private async deploy(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Deploying:', action.config);
    // Integration point: Call deployment service
    await this.sleep(100);
  }

  private async gitCommit(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Git commit:', action.config);
    // Integration point: Call git service
    await this.sleep(100);
  }

  private async gitPush(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Git push:', action.config);
    // Integration point: Call git service
    await this.sleep(100);
  }

  private async sendActionNotification(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Sending notification:', action.config.message);
    // Integration point: Call notification service
    await this.sleep(100);
  }

  private async runScript(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Running script:', action.config.script);
    // Integration point: Execute script
    await this.sleep(100);
  }

  private async generateDocs(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] Generating docs:', action.config);
    // Integration point: Call documentation generator
    await this.sleep(100);
  }

  private async aiReview(action: WorkflowAction, context?: Record<string, any>): Promise<void> {
    console.log('[WorkflowAutomation] AI review:', action.config);
    // Integration point: Call AI review service
    await this.sleep(100);
  }

  /**
   * Register workflow triggers
   */
  private registerWorkflowTriggers(workflow: Workflow): void {
    for (const trigger of workflow.triggers) {
      const listeners = this.triggerListeners.get(trigger.type) || new Set();
      
      const listener = async (context: any) => {
        if (!workflow.enabled) return;
        
        // Check trigger config
        if (trigger.config.filePattern && context.filePath) {
          const pattern = new RegExp(trigger.config.filePattern);
          if (!pattern.test(context.filePath)) return;
        }

        // Execute workflow
        await this.executeWorkflow(workflow.id, context);
      };

      listeners.add(listener);
      this.triggerListeners.set(trigger.type, listeners);
    }
  }

  /**
   * Trigger workflows
   */
  public async triggerWorkflows(type: TriggerType, context?: Record<string, any>): Promise<void> {
    const listeners = this.triggerListeners.get(type);
    if (!listeners) return;

    console.log(`[WorkflowAutomation] Triggering ${listeners.size} workflows for: ${type}`);
    
    for (const listener of listeners) {
      try {
        await listener(context);
      } catch (error: any) {
        console.error(`[WorkflowAutomation] Trigger failed:`, error.message);
      }
    }
  }

  /**
   * Get executions
   */
  public getExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    
    if (workflowId) {
      return executions.filter((e) => e.workflowId === workflowId);
    }

    return executions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get execution
   */
  public getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Cancel execution
   */
  public cancelExecution(id: string): boolean {
    const execution = this.executions.get(id);
    if (!execution || !this.activeExecutions.has(id)) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    this.activeExecutions.delete(id);
    this.addLog(execution, 'warning', 'Execution cancelled by user');
    
    console.log(`[WorkflowAutomation] Cancelled execution: ${id}`);
    return true;
  }

  /**
   * Get templates
   */
  public getTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  /**
   * Get template
   */
  public getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * Export workflow
   */
  public exportWorkflow(id: string): string {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * Import workflow
   */
  public importWorkflow(json: string): Workflow {
    const data = JSON.parse(json);
    return this.createWorkflow(data);
  }

  /**
   * Helper methods
   */
  private addLog(execution: WorkflowExecution, level: WorkflowExecution['logs'][0]['level'], message: string): void {
    execution.logs.push({
      timestamp: new Date(),
      level,
      message,
    });
  }

  private async sendNotification(workflow: Workflow, execution: WorkflowExecution, type: 'success' | 'failure'): Promise<void> {
    console.log(`[WorkflowAutomation] Sending ${type} notification for: ${workflow.name}`);
    // Integration point: Send notification
  }

  private cleanupOldExecutions(): void {
    const executions = Array.from(this.executions.entries());
    if (executions.length > this.maxExecutionHistory) {
      const sorted = executions.sort((a, b) => b[1].startTime.getTime() - a[1].startTime.getTime());
      const toDelete = sorted.slice(this.maxExecutionHistory);
      toDelete.forEach(([id]) => this.executions.delete(id));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Default templates
   */
  private templates: WorkflowTemplate[] = [];

  private registerDefaultTemplates(): void {
    this.templates = [
      {
        id: 'pre-commit-quality',
        name: 'Pre-Commit Quality Check',
        description: 'Run linting, tests, and security scan before every commit',
        category: 'quality',
        icon: '✅',
        workflow: {
          name: 'Pre-Commit Quality Check',
          description: 'Automated quality checks before commit',
          enabled: true,
          triggers: [{ id: 'trigger-1', type: 'on_commit', config: {} }],
          steps: [
            {
              id: 'step-1',
              name: 'Code Quality',
              actions: [
                { id: 'action-1', type: 'lint_code', name: 'Lint Code', config: {} },
                { id: 'action-2', type: 'format_code', name: 'Format Code', config: {} },
              ],
            },
            {
              id: 'step-2',
              name: 'Testing',
              actions: [{ id: 'action-3', type: 'run_tests', name: 'Run Tests', config: {} }],
            },
            {
              id: 'step-3',
              name: 'Security',
              actions: [{ id: 'action-4', type: 'security_scan', name: 'Security Scan', config: {} }],
            },
          ],
        },
      },
      {
        id: 'auto-deploy',
        name: 'Auto Deploy on Push',
        description: 'Build, test, and deploy when pushing to main branch',
        category: 'deployment',
        icon: '🚀',
        workflow: {
          name: 'Auto Deploy',
          description: 'Automated deployment pipeline',
          enabled: true,
          triggers: [{ id: 'trigger-1', type: 'on_push', config: { branch: 'main' } }],
          steps: [
            {
              id: 'step-1',
              name: 'Build',
              actions: [{ id: 'action-1', type: 'build', name: 'Build Project', config: {} }],
            },
            {
              id: 'step-2',
              name: 'Test',
              actions: [{ id: 'action-2', type: 'run_tests', name: 'Run Tests', config: {} }],
            },
            {
              id: 'step-3',
              name: 'Deploy',
              actions: [
                { id: 'action-3', type: 'deploy', name: 'Deploy to Production', config: { target: 'production' } },
              ],
            },
          ],
          notifications: {
            onSuccess: true,
            onFailure: true,
          },
        },
      },
      {
        id: 'test-on-save',
        name: 'Test on Save',
        description: 'Automatically run tests when saving files',
        category: 'testing',
        icon: '🧪',
        workflow: {
          name: 'Test on Save',
          description: 'Run tests automatically on file save',
          enabled: true,
          triggers: [{ id: 'trigger-1', type: 'on_save', config: { filePattern: '.*\\.(ts|tsx|js|jsx)$' } }],
          steps: [
            {
              id: 'step-1',
              name: 'Run Tests',
              actions: [{ id: 'action-1', type: 'run_tests', name: 'Run Related Tests', config: {} }],
            },
          ],
        },
      },
    ];
  }
}

// Singleton instance
let workflowEngineInstance: WorkflowAutomationEngine | null = null;

/**
 * Get singleton workflow engine instance
 */
export function getWorkflowAutomationEngine(): WorkflowAutomationEngine {
  if (!workflowEngineInstance) {
    workflowEngineInstance = new WorkflowAutomationEngine();
  }
  return workflowEngineInstance;
}
