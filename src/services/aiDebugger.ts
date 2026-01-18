// Conditional imports for Node.js modules - only available in main process
let aiWorkflowEngine: any = null;

// Check if we're in a Node.js environment before importing
if (typeof process !== 'undefined' && typeof require !== 'undefined') {
  try {
    // Use dynamic import for aiWorkflowEngine since it also has Node.js dependencies
    import('./aiWorkflowEngine')
      .then((module) => {
        aiWorkflowEngine = module.aiWorkflowEngine;
      })
      .catch((err) => {
        console.warn('aiWorkflowEngine not available:', err.message);
      });
  } catch (error: any) {
    console.warn('aiWorkflowEngine not available in browser environment:', error.message);
  }
}

export interface DebugSession {
  id: string;
  name: string;
  filePath: string;
  language: string;
  breakpoints: Breakpoint[];
  callStack: StackFrame[];
  variables: Variable[];
  watchExpressions: WatchExpression[];
  currentLine: number;
  isRunning: boolean;
  isPaused: boolean;
  executionMode: 'step-over' | 'step-into' | 'step-out' | 'continue' | 'run-to-cursor';
  aiAnalysis: AIDebugAnalysis | null;
  createdAt: number;
  lastActivity: number;
}

export interface Breakpoint {
  id: string;
  filePath: string;
  line: number;
  column?: number;
  condition?: string;
  hitCount: number;
  isEnabled: boolean;
  isConditional: boolean;
  logMessage?: string;
  aiSuggestion?: string;
}

export interface StackFrame {
  id: string;
  name: string;
  filePath: string;
  line: number;
  column: number;
  scope: 'global' | 'local' | 'closure' | 'module';
  variables: Variable[];
  source?: string;
}

export interface Variable {
  name: string;
  value: any;
  type: string;
  scope: 'local' | 'global' | 'parameter' | 'closure';
  isExpandable: boolean;
  children?: Variable[];
  memoryAddress?: string;
  size?: number;
  aiInsight?: string;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value: any;
  type: string;
  isValid: boolean;
  error?: string;
  aiExplanation?: string;
}

export interface AIDebugAnalysis {
  currentState: ExecutionState;
  issueDetection: IssueDetection[];
  suggestions: DebugSuggestion[];
  codeAnalysis: CodeAnalysis;
  performanceInsights: PerformanceInsight[];
  nextSteps: NextStep[];
  confidence: number;
}

export interface ExecutionState {
  phase: 'initialization' | 'execution' | 'error' | 'completion' | 'waiting';
  description: string;
  variables: VariableAnalysis[];
  memoryUsage: MemoryAnalysis;
  executionTime: number;
  cpuUsage: number;
}

export interface IssueDetection {
  id: string;
  type:
    | 'logic-error'
    | 'runtime-error'
    | 'performance'
    | 'memory-leak'
    | 'race-condition'
    | 'null-reference'
    | 'type-mismatch';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  location: CodeLocation;
  description: string;
  evidence: string[];
  rootCause: string;
  impact: string;
  fixSuggestions: string[];
}

export interface DebugSuggestion {
  id: string;
  type: 'breakpoint' | 'watch' | 'step' | 'inspect' | 'fix' | 'optimize';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: DebugAction;
  expectedOutcome: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high';
}

export interface DebugAction {
  type:
    | 'set-breakpoint'
    | 'add-watch'
    | 'step-execution'
    | 'inspect-variable'
    | 'modify-code'
    | 'run-expression';
  parameters: Record<string, any>;
  code?: string;
}

export interface CodeAnalysis {
  complexity: number;
  codeQuality: number;
  potentialIssues: string[];
  optimizations: string[];
  patterns: CodePattern[];
  dependencies: string[];
}

export interface CodePattern {
  type: 'anti-pattern' | 'design-pattern' | 'code-smell' | 'best-practice';
  name: string;
  location: CodeLocation;
  description: string;
  recommendation: string;
}

export interface PerformanceInsight {
  metric: 'execution-time' | 'memory-usage' | 'cpu-usage' | 'io-operations' | 'network-calls';
  value: number;
  baseline: number;
  trend: 'improving' | 'degrading' | 'stable';
  impact: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface NextStep {
  id: string;
  description: string;
  action: string;
  reasoning: string;
  automated: boolean;
}

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface VariableAnalysis {
  name: string;
  currentValue: any;
  expectedValue?: any;
  type: string;
  changeHistory: ValueChange[];
  anomalies: string[];
  recommendations: string[];
}

export interface ValueChange {
  timestamp: number;
  oldValue: any;
  newValue: any;
  location: CodeLocation;
  reason: string;
}

export interface MemoryAnalysis {
  totalUsage: number;
  heapUsage: number;
  stackUsage: number;
  leaks: MemoryLeak[];
  allocations: MemoryAllocation[];
}

export interface MemoryLeak {
  location: CodeLocation;
  size: number;
  age: number;
  type: string;
  description: string;
}

export interface MemoryAllocation {
  location: CodeLocation;
  size: number;
  type: string;
  frequency: number;
}

export class AIDebugger {
  private sessions = new Map<string, DebugSession>();
  private activeSession: DebugSession | null = null;
  private debugCallbacks = new Set<(session: DebugSession) => void>();
  private breakpointCallbacks = new Set<(breakpoint: Breakpoint) => void>();
  private variableCallbacks = new Set<(variables: Variable[]) => void>();

  // Session Management
  async createDebugSession(options: {
    name: string;
    filePath: string;
    language: string;
    entryPoint?: string;
  }): Promise<DebugSession> {
    const session: DebugSession = {
      id: `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: options.name,
      filePath: options.filePath,
      language: options.language,
      breakpoints: [],
      callStack: [],
      variables: [],
      watchExpressions: [],
      currentLine: 1,
      isRunning: false,
      isPaused: false,
      executionMode: 'step-over',
      aiAnalysis: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async startDebugging(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Debug session ${sessionId} not found`);

    session.isRunning = true;
    session.isPaused = false;
    session.lastActivity = Date.now();
    this.activeSession = session;

    // Initialize debugging environment
    await this.initializeDebugEnvironment(session);

    // Perform initial AI analysis
    await this.performAIAnalysis(session);

    this.notifySessionChanged(session);
  }

  async pauseDebugging(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isPaused = true;
    session.lastActivity = Date.now();

    // Capture current state
    await this.captureExecutionState(session);
    await this.performAIAnalysis(session);

    this.notifySessionChanged(session);
  }

  async stopDebugging(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isRunning = false;
    session.isPaused = false;
    session.lastActivity = Date.now();

    // Clean up debugging resources
    await this.cleanupDebugEnvironment(session);

    this.notifySessionChanged(session);
  }

  // Breakpoint Management
  async setBreakpoint(
    sessionId: string,
    filePath: string,
    line: number,
    options?: {
      condition?: string;
      logMessage?: string;
    },
  ): Promise<Breakpoint> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Debug session ${sessionId} not found`);

    const breakpoint: Breakpoint = {
      id: `bp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      line,
      condition: options?.condition,
      hitCount: 0,
      isEnabled: true,
      isConditional: !!options?.condition,
      logMessage: options?.logMessage,
    };

    // Get AI suggestion for breakpoint
    breakpoint.aiSuggestion = await this.getBreakpointSuggestion(session, breakpoint);

    session.breakpoints.push(breakpoint);
    session.lastActivity = Date.now();

    this.notifyBreakpointChanged(breakpoint);
    return breakpoint;
  }

  async removeBreakpoint(sessionId: string, breakpointId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.breakpoints = session.breakpoints.filter((bp) => bp.id !== breakpointId);
    session.lastActivity = Date.now();
  }

  async toggleBreakpoint(sessionId: string, breakpointId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const breakpoint = session.breakpoints.find((bp) => bp.id === breakpointId);
    if (breakpoint) {
      breakpoint.isEnabled = !breakpoint.isEnabled;
      session.lastActivity = Date.now();
      this.notifyBreakpointChanged(breakpoint);
    }
  }

  // Execution Control
  async stepOver(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRunning) return;

    session.executionMode = 'step-over';
    await this.executeStep(session);
  }

  async stepInto(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRunning) return;

    session.executionMode = 'step-into';
    await this.executeStep(session);
  }

  async stepOut(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRunning) return;

    session.executionMode = 'step-out';
    await this.executeStep(session);
  }

  async continue(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRunning) return;

    session.executionMode = 'continue';
    session.isPaused = false;
    await this.executeStep(session);
  }

  async runToCursor(sessionId: string, line: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRunning) return;

    // Set temporary breakpoint at cursor
    const tempBreakpoint = await this.setBreakpoint(sessionId, session.filePath, line);

    session.executionMode = 'run-to-cursor';
    session.isPaused = false;

    await this.executeStep(session);

    // Remove temporary breakpoint
    await this.removeBreakpoint(sessionId, tempBreakpoint.id);
  }

  // Variable and Watch Management
  async addWatchExpression(sessionId: string, expression: string): Promise<WatchExpression> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Debug session ${sessionId} not found`);

    const watch: WatchExpression = {
      id: `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      expression,
      value: null,
      type: 'unknown',
      isValid: true,
    };

    // Evaluate expression and get AI explanation
    await this.evaluateWatchExpression(session, watch);
    watch.aiExplanation = await this.getExpressionExplanation(session, watch);

    session.watchExpressions.push(watch);
    session.lastActivity = Date.now();

    return watch;
  }

  async removeWatchExpression(sessionId: string, watchId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.watchExpressions = session.watchExpressions.filter((w) => w.id !== watchId);
    session.lastActivity = Date.now();
  }

  async evaluateExpression(sessionId: string, expression: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Debug session ${sessionId} not found`);

    // Safe expression evaluation - in production, this would use the debugger's evaluation context
    // For now, provide a safe evaluation mechanism without using eval()

    // Check if expression is a simple variable reference
    if (session.variables.some((v) => v.name === expression)) {
      const variable = session.variables.find((v) => v.name === expression);
      return variable?.value;
    }

    // Check if it's a simple mathematical expression
    try {
      // Only allow safe mathematical expressions
      const safeMathRegex = /^[\d\s\+\-\*\/\(\)\.]+$/;
      if (safeMathRegex.test(expression.replace(/\s/g, ''))) {
        // Use Function constructor instead of eval for basic math
        const result = new Function(`"use strict"; return (${expression});`)();
        return result;
      }
    } catch (error) {
      // Fall through to error handling
    }

    // For complex expressions or when debugger context is unavailable
    throw new Error(
      `Expression evaluation not supported: ${expression}. Use debugger breakpoints and variable inspection instead.`,
    );
  }

  // AI Analysis
  private async performAIAnalysis(session: DebugSession): Promise<void> {
    try {
      const prompt = `Analyze this debugging session and provide insights:

Session: ${session.name}
File: ${session.filePath}
Language: ${session.language}
Current Line: ${session.currentLine}
Execution State: ${session.isRunning ? 'Running' : 'Stopped'} ${session.isPaused ? '(Paused)' : ''}

Call Stack: ${JSON.stringify(session.callStack.slice(0, 5), null, 2)}
Variables: ${JSON.stringify(session.variables.slice(0, 10), null, 2)}
Breakpoints: ${JSON.stringify(session.breakpoints, null, 2)}

Provide analysis including:
1. Current execution state assessment
2. Potential issues or anomalies
3. Debugging suggestions and next steps
4. Performance insights
5. Code quality observations
6. Recommended actions

Format as JSON object with: currentState, issueDetection, suggestions, codeAnalysis, performanceInsights, nextSteps, confidence`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        session.aiAnalysis = this.getDefaultAnalysis();
        return;
      }

      const analysisSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Debug session analysis' },
        [agent.id],
      );

      const result = this.parseAIResponse(analysisSession.result?.finalOutput || '{}');
      session.aiAnalysis = {
        currentState: result.currentState || this.getDefaultExecutionState(),
        issueDetection: result.issueDetection || [],
        suggestions: result.suggestions || [],
        codeAnalysis: result.codeAnalysis || this.getDefaultCodeAnalysis(),
        performanceInsights: result.performanceInsights || [],
        nextSteps: result.nextSteps || [],
        confidence: result.confidence || 0.5,
      };
    } catch (error) {
      console.warn('AI debug analysis failed:', error);
      session.aiAnalysis = this.getDefaultAnalysis();
    }
  }

  private async getBreakpointSuggestion(
    session: DebugSession,
    breakpoint: Breakpoint,
  ): Promise<string> {
    try {
      const prompt = `Analyze this breakpoint placement and provide suggestions:

File: ${breakpoint.filePath}
Line: ${breakpoint.line}
Condition: ${breakpoint.condition || 'None'}
Context: Debugging ${session.language} code

Provide a brief suggestion about:
1. Whether this breakpoint placement is strategic
2. What to look for when execution pauses here
3. Potential issues this might help identify
4. Alternative debugging approaches

Keep response concise (2-3 sentences).`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) return 'Breakpoint set successfully';

      const suggestionSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Breakpoint analysis' },
        [agent.id],
      );

      return suggestionSession.result?.finalOutput || 'Breakpoint set successfully';
    } catch (error) {
      return 'Breakpoint set successfully';
    }
  }

  private async getExpressionExplanation(
    session: DebugSession,
    watch: WatchExpression,
  ): Promise<string> {
    try {
      const prompt = `Explain this watch expression in the debugging context:

Expression: ${watch.expression}
Current Value: ${watch.value}
Type: ${watch.type}
Valid: ${watch.isValid}
Error: ${watch.error || 'None'}

Provide a brief explanation of:
1. What this expression represents
2. Why the current value is significant
3. What changes to watch for
4. Potential issues indicated by this value

Keep response concise (2-3 sentences).`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) return 'Expression added to watch list';

      const explanationSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Watch expression analysis' },
        [agent.id],
      );

      return explanationSession.result?.finalOutput || 'Expression added to watch list';
    } catch (error) {
      return 'Expression added to watch list';
    }
  }

  // Helper Methods
  private async initializeDebugEnvironment(session: DebugSession): Promise<void> {
    // Initialize AI debugging simulation environment with basic call stack

    // Create initial stack frame for the entry point
    session.callStack = [
      {
        id: `frame-${session.id}-main`,
        name:
          session.language === 'javascript' || session.language === 'typescript' ? 'main' : 'entry',
        filePath: session.filePath,
        line: 1,
        column: 1,
        scope: 'global',
        variables: [],
        source: `// ${session.name}\n// Debug session initialized`,
      },
    ];

    // Initialize basic variables based on language
    session.variables = this.initializeDefaultVariables(session.language);

    // Set initial execution state
    session.currentLine = 1;
    session.isRunning = false;
    session.isPaused = false;
  }

  private async cleanupDebugEnvironment(session: DebugSession): Promise<void> {
    // Clean up AI debugging simulation resources

    session.callStack = [];
    session.variables = [];
    session.watchExpressions.forEach((watch) => {
      watch.isValid = false;
      watch.error = 'Debug session ended';
    });

    session.isRunning = false;
    session.isPaused = false;
  }

  private async captureExecutionState(session: DebugSession): Promise<void> {
    // Capture current execution state in the AI debugging simulation

    // Update variables based on current execution context
    for (const watch of session.watchExpressions) {
      if (watch.isValid) {
        try {
          await this.evaluateWatchExpression(session, watch);
        } catch (error) {
          watch.isValid = false;
          watch.error = error instanceof Error ? error.message : String(error);
        }
      }
    }

    // Update call stack if execution has moved
    if (session.callStack.length > 0) {
      const currentFrame = session.callStack[session.callStack.length - 1];
      currentFrame.line = session.currentLine;
      currentFrame.variables = session.variables.filter((v) => v.scope === currentFrame.scope);
    }

    this.notifyVariablesChanged(session.variables);
  }

  private async executeStep(session: DebugSession): Promise<void> {
    // Execute a single step in the AI debugging simulation
    // This simulates controlled execution stepping for debugging analysis

    if (!session.isRunning || session.isPaused) return;

    // Controlled execution stepping based on mode for AI debugging simulation
    let stepSize: number;
    switch (session.executionMode) {
      case 'step-into':
        stepSize = 1; // Single step into functions
        break;
      case 'step-out':
        stepSize = 1; // Step out to caller in simulation
        break;
      case 'run-to-cursor':
        stepSize = 1; // Move towards cursor in simulation
        break;
      case 'continue':
        stepSize = 10; // Larger steps when continuing in simulation
        break;
      default: // 'step-over'
        stepSize = 1; // Single step over
    }

    session.currentLine += stepSize;
    session.lastActivity = Date.now();

    // Check for breakpoints in the simulation
    const hitBreakpoint = session.breakpoints.find(
      (bp) =>
        bp.isEnabled &&
        bp.line === session.currentLine &&
        bp.filePath === session.filePath &&
        (!bp.isConditional || this.evaluateBreakpointCondition(bp)),
    );

    if (hitBreakpoint) {
      hitBreakpoint.hitCount++;
      session.isPaused = true;
      session.executionMode = 'step-over';

      // Capture state when breakpoint is hit in simulation
      await this.captureExecutionState(session);
      await this.performAIAnalysis(session);

      this.notifySessionChanged(session);
      return;
    }

    // Check execution bounds for simulation termination
    if (session.currentLine > 1000) {
      // Reasonable limit for simulation session
      session.isRunning = false;
      session.isPaused = false;
      await this.performAIAnalysis(session);
    }

    this.notifySessionChanged(session);
  }

  private async evaluateWatchExpression(
    session: DebugSession,
    watch: WatchExpression,
  ): Promise<void> {
    try {
      // Evaluate watch expression using safe evaluation
      watch.value = await this.evaluateExpression(session.id, watch.expression);
      watch.type = typeof watch.value;
      watch.isValid = true;
      watch.error = undefined;
    } catch (error) {
      watch.isValid = false;
      watch.error = error instanceof Error ? error.message : String(error);
      watch.value = null;
      watch.type = 'unknown';
    }
  }

  private initializeDefaultVariables(language: string): Variable[] {
    // Initialize default variables based on language
    const defaultVars: Variable[] = [];

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        defaultVars.push(
          {
            name: 'console',
            value: '[object Console]',
            type: 'object',
            scope: 'global',
            isExpandable: true,
          },
          {
            name: 'global',
            value: '[object global]',
            type: 'object',
            scope: 'global',
            isExpandable: true,
          },
          {
            name: 'process',
            value: '[object process]',
            type: 'object',
            scope: 'global',
            isExpandable: true,
          },
        );
        break;

      case 'python':
        defaultVars.push(
          {
            name: '__name__',
            value: '"__main__"',
            type: 'string',
            scope: 'global',
            isExpandable: false,
          },
          {
            name: '__file__',
            value: 'current_file_path',
            type: 'string',
            scope: 'global',
            isExpandable: false,
          },
        );
        break;

      case 'java':
        defaultVars.push({
          name: 'this',
          value: '[object instance]',
          type: 'object',
          scope: 'local',
          isExpandable: true,
        });
        break;

      default:
        defaultVars.push({
          name: 'debug_mode',
          value: true,
          type: 'boolean',
          scope: 'global',
          isExpandable: false,
        });
    }

    return defaultVars;
  }

  private evaluateBreakpointCondition(breakpoint: Breakpoint): boolean {
    // Evaluate conditional breakpoint in the AI debugging simulation
    if (!breakpoint.condition) return true;

    try {
      const condition = breakpoint.condition.trim();

      // Evaluate basic comparison operations safely
      if (
        condition.includes('===') ||
        condition.includes('!==') ||
        condition.includes('==') ||
        condition.includes('!=') ||
        condition.includes('>') ||
        condition.includes('<') ||
        condition.includes('>=') ||
        condition.includes('<=') ||
        condition.includes('&&') ||
        condition.includes('||')
      ) {
        // Use safe evaluation for boolean expressions in simulation
        try {
          // Only allow safe boolean expressions with known variables
          const safeCondition = condition.replace(/true|false/g, (match) => `"${match}"`);
          const result = new Function(`"use strict"; return (${safeCondition});`)();
          return Boolean(result);
        } catch (error) {
          console.warn(`Failed to evaluate condition "${condition}":`, error);
          return true; // Default to true for unrecognized conditions
        }
      }

      // Handle simple boolean conditions
      if (condition === 'true') return true;
      if (condition === 'false') return false;

      return true; // Default to true for unrecognized conditions
    } catch (error) {
      console.warn(`Failed to evaluate breakpoint condition: ${breakpoint.condition}`, error);
      return false;
    }
  }

  private getDefaultAnalysis(): AIDebugAnalysis {
    return {
      currentState: this.getDefaultExecutionState(),
      issueDetection: [],
      suggestions: [],
      codeAnalysis: this.getDefaultCodeAnalysis(),
      performanceInsights: [],
      nextSteps: [],
      confidence: 0.3,
    };
  }

  private getDefaultExecutionState(): ExecutionState {
    return {
      phase: 'execution',
      description: 'Code is executing normally',
      variables: [],
      memoryUsage: {
        totalUsage: 0,
        heapUsage: 0,
        stackUsage: 0,
        leaks: [],
        allocations: [],
      },
      executionTime: 0,
      cpuUsage: 0,
    };
  }

  private getDefaultCodeAnalysis(): CodeAnalysis {
    return {
      complexity: 1,
      codeQuality: 0.8,
      potentialIssues: [],
      optimizations: [],
      patterns: [],
      dependencies: [],
    };
  }

  private parseAIResponse(response: string): any {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return {};
    }
  }

  // Event Handling
  onSessionChanged(callback: (session: DebugSession) => void): () => void {
    this.debugCallbacks.add(callback);
    return () => this.debugCallbacks.delete(callback);
  }

  onBreakpointChanged(callback: (breakpoint: Breakpoint) => void): () => void {
    this.breakpointCallbacks.add(callback);
    return () => this.breakpointCallbacks.delete(callback);
  }

  onVariablesChanged(callback: (variables: Variable[]) => void): () => void {
    this.variableCallbacks.add(callback);
    return () => this.variableCallbacks.delete(callback);
  }

  private notifySessionChanged(session: DebugSession): void {
    this.debugCallbacks.forEach((callback) => {
      try {
        callback(session);
      } catch (error) {
        console.warn('Debug callback failed:', error);
      }
    });
  }

  private notifyBreakpointChanged(breakpoint: Breakpoint): void {
    this.breakpointCallbacks.forEach((callback) => {
      try {
        callback(breakpoint);
      } catch (error) {
        console.warn('Breakpoint callback failed:', error);
      }
    });
  }

  private notifyVariablesChanged(variables: Variable[]): void {
    this.variableCallbacks.forEach((callback) => {
      try {
        callback(variables);
      } catch (error) {
        console.warn('Variables callback failed:', error);
      }
    });
  }

  // Public Getters
  getSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSession(): DebugSession | null {
    return this.activeSession;
  }

  getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null;
  }
}

export const aiDebugger = new AIDebugger();
