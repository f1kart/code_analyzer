// Renderer-safe: no Node.js modules. All execution via IPC (preload -> main).
let aiWorkflowEngine: any = null;
// Load lazily; do not break renderer if unavailable.
import('../services/aiWorkflowEngine')
  .then((m) => {
    aiWorkflowEngine = m.aiWorkflowEngine;
  })
  .catch(() => {});

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  shell: string;
  environment: Record<string, string>;
  history: TerminalCommand[];
  isActive: boolean;
  pid?: number;
  createdAt: number;
  lastActivity: number;
}

export interface TerminalCommand {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  timestamp: number;
  duration: number;
  exitCode: number;
  output: TerminalOutput[];
  error?: string;
  aiAnalysis?: AICommandAnalysis;
}

export interface TerminalOutput {
  type: 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: number;
  formatted?: boolean;
}

export interface AICommandAnalysis {
  intent: string;
  category: 'development' | 'system' | 'git' | 'build' | 'test' | 'deploy' | 'debug' | 'other';
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'dangerous';
  explanation: string;
  suggestions: string[];
  alternatives: string[];
  expectedOutcome: string;
  troubleshooting: string[];
}

export interface AIDebugSession {
  id: string;
  terminalId: string;
  context: DebugContext;
  analysis: DebugAnalysis;
  suggestions: DebugSuggestion[];
  isActive: boolean;
  createdAt: number;
}

export interface DebugContext {
  command: string;
  exitCode: number;
  output: string;
  error: string;
  environment: Record<string, string>;
  workingDirectory: string;
  relatedFiles: string[];
  systemInfo: SystemInfo;
}

export interface DebugAnalysis {
  errorType:
    | 'syntax'
    | 'runtime'
    | 'permission'
    | 'dependency'
    | 'configuration'
    | 'network'
    | 'system'
    | 'unknown';
  rootCause: string;
  impact: 'critical' | 'major' | 'minor' | 'informational';
  confidence: number;
  explanation: string;
  steps: DebugStep[];
}

export interface DebugStep {
  id: string;
  description: string;
  command?: string;
  expected: string;
  automated: boolean;
  completed: boolean;
  result?: string;
}

export interface DebugSuggestion {
  id: string;
  type: 'fix' | 'workaround' | 'investigation' | 'prevention';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  commands: string[];
  automated: boolean;
  riskLevel: 'safe' | 'low' | 'medium' | 'high';
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion?: string;
  npmVersion?: string;
  gitVersion?: string;
  pythonVersion?: string;
  javaVersion?: string;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  category: string;
  confidence: number;
  context: string[];
}

export class AITerminal {
  private sessions = new Map<string, TerminalSession>();
  private activeSession: TerminalSession | null = null;
  private debugSessions = new Map<string, AIDebugSession>();
  private commandHistory: string[] = [];
  private sessionCallbacks = new Set<(sessions: TerminalSession[]) => void>();
  private outputCallbacks = new Set<(sessionId: string, output: TerminalOutput) => void>();

  // Session Management
  async createSession(options?: {
    name?: string;
    cwd?: string;
    shell?: string;
    environment?: Record<string, string>;
  }): Promise<TerminalSession> {
    const session: TerminalSession = {
      id: `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: options?.name || `Terminal ${this.sessions.size + 1}`,
      // In the renderer, process may be undefined; default to empty and let main decide (defaults to home)
      cwd: options?.cwd || '',
      shell: options?.shell || this.getDefaultShell(),
      // Avoid using process.env in the renderer; pass only provided environment
      environment: options?.environment ? { ...options.environment } : {},
      history: [],
      isActive: false,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.notifySessionsChanged();
    return session;
  }

  async activateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Deactivate current session
    if (this.activeSession) {
      this.activeSession.isActive = false;
    }

    // Activate new session
    session.isActive = true;
    session.lastActivity = Date.now();
    this.activeSession = session;
    this.notifySessionsChanged();
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clean up any running processes
    // Only attempt to kill if running in a Node-enabled context
    if (
      session.pid &&
      typeof process !== 'undefined' &&
      typeof (process as any).kill === 'function'
    ) {
      try {
        (process as any).kill(session.pid);
      } catch (error) {
        console.warn(`Failed to kill process ${session.pid}:`, error);
      }
    }

    this.sessions.delete(sessionId);
    this.debugSessions.delete(sessionId);

    if (this.activeSession?.id === sessionId) {
      this.activeSession = null;
      // Activate another session if available
      const remainingSessions = Array.from(this.sessions.values());
      if (remainingSessions.length > 0) {
        await this.activateSession(remainingSessions[0].id);
      }
    }

    this.notifySessionsChanged();
  }

  // Command Execution
  async executeCommand(command: string, sessionId?: string): Promise<TerminalCommand> {
    const session = sessionId ? this.sessions.get(sessionId) : this.activeSession;
    if (!session) {
      throw new Error('No active terminal session');
    }

    const cmd: TerminalCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      command: command.trim(),
      args: this.parseCommandArgs(command.trim()),
      cwd: session.cwd,
      timestamp: Date.now(),
      duration: 0,
      exitCode: 0,
      output: [],
    };

    // Add to history
    session.history.push(cmd);
    this.commandHistory.push(command.trim());
    session.lastActivity = Date.now();

    try {
      // AI analysis before execution
      cmd.aiAnalysis = await this.analyzeCommand(cmd, session);

      // Execute command
      const startTime = Date.now();
      const result = await this.runCommand(cmd, session);
      cmd.duration = Date.now() - startTime;
      cmd.exitCode = result.exitCode;
      cmd.output = result.output;
      cmd.error = result.error;

      // Auto-debug on errors
      if (cmd.exitCode !== 0 && cmd.error) {
        await this.startDebugSession(cmd, session);
      }

      return cmd;
    } catch (error) {
      cmd.exitCode = 1;
      cmd.error = error instanceof Error ? error.message : String(error);
      cmd.duration = Date.now() - cmd.timestamp;

      // Start debug session for execution errors
      await this.startDebugSession(cmd, session);
      return cmd;
    }
  }

  async interruptCommand(sessionId?: string): Promise<void> {
    const session = sessionId ? this.sessions.get(sessionId) : this.activeSession;
    if (!session || !session.pid) return;

    try {
      if (typeof process !== 'undefined' && typeof (process as any).kill === 'function') {
        (process as any).kill(session.pid, 'SIGINT');
      }
    } catch (error) {
      console.warn(`Failed to interrupt process ${session.pid}:`, error);
    }
  }

  // AI Command Analysis
  private async analyzeCommand(
    cmd: TerminalCommand,
    session: TerminalSession,
  ): Promise<AICommandAnalysis> {
    try {
      // Skip AI analysis if AI is unavailable
      const aiOk = await this.isAIAvailable();
      if (!aiOk || !aiWorkflowEngine) {
        return this.getDefaultAnalysis(cmd);
      }
      const prompt = `Analyze this terminal command for safety and intent:

Command: ${cmd.command}
Working Directory: ${cmd.cwd}
Shell: ${session.shell}
Environment Context: ${Object.keys(session.environment).slice(0, 10).join(', ')}

Provide analysis including:
1. Command intent and purpose
2. Category (development, system, git, build, test, deploy, debug, other)
3. Risk level (safe, low, medium, high, dangerous)
4. Clear explanation of what it does
5. Potential issues or suggestions
6. Alternative approaches if applicable
7. Expected outcome
8. Troubleshooting tips

Format as JSON object with: intent, category, riskLevel, explanation, suggestions, alternatives, expectedOutcome, troubleshooting`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        return this.getDefaultAnalysis(cmd);
      }

      const analysisSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Terminal command analysis' },
        [agent.id],
      );

      const result = this.parseAIResponse(analysisSession.result?.finalOutput || '{}');
      return {
        intent: result.intent || 'Unknown command intent',
        category: result.category || 'other',
        riskLevel: result.riskLevel || 'medium',
        explanation: result.explanation || 'Command analysis unavailable',
        suggestions: result.suggestions || [],
        alternatives: result.alternatives || [],
        expectedOutcome: result.expectedOutcome || 'Outcome uncertain',
        troubleshooting: result.troubleshooting || [],
      };
    } catch (error) {
      console.warn('Command analysis failed:', error);
      return this.getDefaultAnalysis(cmd);
    }
  }

  // AI Debugging
  async startDebugSession(cmd: TerminalCommand, session: TerminalSession): Promise<AIDebugSession> {
    const debugContext: DebugContext = {
      command: cmd.command,
      exitCode: cmd.exitCode,
      output: cmd.output.map((o) => o.content).join('\n'),
      error: cmd.error || '',
      environment: session.environment,
      workingDirectory: cmd.cwd,
      relatedFiles: await this.findRelatedFiles(cmd, session),
      systemInfo: await this.getSystemInfo(),
    };

    const analysis = await this.analyzeError(debugContext);
    const suggestions = await this.generateDebugSuggestions(debugContext, analysis);

    const debugSession: AIDebugSession = {
      id: `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      terminalId: session.id,
      context: debugContext,
      analysis,
      suggestions,
      isActive: true,
      createdAt: Date.now(),
    };

    this.debugSessions.set(debugSession.id, debugSession);
    return debugSession;
  }

  private async analyzeError(context: DebugContext): Promise<DebugAnalysis> {
    try {
      const aiOk = await this.isAIAvailable();
      if (!aiOk || !aiWorkflowEngine) {
        return this.getDefaultDebugAnalysis(context);
      }
      const prompt = `Analyze this command error and provide debugging guidance:

Command: ${context.command}
Exit Code: ${context.exitCode}
Error Output: ${context.error}
Standard Output: ${context.output}
Working Directory: ${context.workingDirectory}
System: ${context.systemInfo.platform} ${context.systemInfo.arch}

Analyze:
1. Error type (syntax, runtime, permission, dependency, configuration, network, system, unknown)
2. Root cause identification
3. Impact assessment (critical, major, minor, informational)
4. Confidence level (0-1)
5. Clear explanation
6. Step-by-step debugging approach

Format as JSON with: errorType, rootCause, impact, confidence, explanation, steps (array of {description, command, expected, automated})`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        return this.getDefaultDebugAnalysis(context);
      }

      const analysisSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Error debugging analysis' },
        [agent.id],
      );

      const result = this.parseAIResponse(analysisSession.result?.finalOutput || '{}');
      return {
        errorType: result.errorType || 'unknown',
        rootCause: result.rootCause || 'Unable to determine root cause',
        impact: result.impact || 'minor',
        confidence: result.confidence || 0.5,
        explanation: result.explanation || 'Error analysis unavailable',
        steps: (result.steps || []).map((step: any, index: number) => ({
          id: `step-${index}`,
          description: step.description || '',
          command: step.command,
          expected: step.expected || '',
          automated: step.automated || false,
          completed: false,
        })),
      };
    } catch (error) {
      console.warn('Error analysis failed:', error);
      return this.getDefaultDebugAnalysis(context);
    }
  }

  private async generateDebugSuggestions(
    context: DebugContext,
    analysis: DebugAnalysis,
  ): Promise<DebugSuggestion[]> {
    try {
      const aiOk = await this.isAIAvailable();
      if (!aiOk || !aiWorkflowEngine) {
        return this.getDefaultSuggestions(context);
      }
      const prompt = `Generate debugging suggestions for this error:

Error Analysis: ${analysis.explanation}
Root Cause: ${analysis.rootCause}
Error Type: ${analysis.errorType}
Command: ${context.command}

Provide practical suggestions including:
1. Immediate fixes
2. Workarounds
3. Investigation steps
4. Prevention measures

For each suggestion provide:
- Type (fix, workaround, investigation, prevention)
- Priority (high, medium, low)
- Title and description
- Commands to execute
- Whether it can be automated
- Risk level

Format as JSON array of suggestion objects.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        return this.getDefaultSuggestions(context);
      }

      const suggestionSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Debug suggestions generation' },
        [agent.id],
      );

      const result = this.parseAIResponse(suggestionSession.result?.finalOutput || '[]');
      return (Array.isArray(result) ? result : [result]).map((suggestion: any, index: number) => ({
        id: `suggestion-${index}`,
        type: suggestion.type || 'investigation',
        priority: suggestion.priority || 'medium',
        title: suggestion.title || 'Debug suggestion',
        description: suggestion.description || '',
        commands: suggestion.commands || [],
        automated: suggestion.automated || false,
        riskLevel: suggestion.riskLevel || 'low',
      }));
    } catch (error) {
      console.warn('Debug suggestions generation failed:', error);
      return this.getDefaultSuggestions(context);
    }
  }

  async applySuggestion(suggestionId: string, debugSessionId: string): Promise<boolean> {
    const debugSession = this.debugSessions.get(debugSessionId);
    if (!debugSession) return false;

    const suggestion = debugSession.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion || !suggestion.automated) return false;

    const session = this.sessions.get(debugSession.terminalId);
    if (!session) return false;

    try {
      for (const command of suggestion.commands) {
        await this.executeCommand(command, session.id);
      }
      return true;
    } catch (error) {
      console.warn(`Failed to apply suggestion ${suggestionId}:`, error);
      return false;
    }
  }

  // Command Suggestions
  async getCommandSuggestions(
    partialCommand: string,
    sessionId?: string,
  ): Promise<CommandSuggestion[]> {
    const session = sessionId ? this.sessions.get(sessionId) : this.activeSession;
    if (!session) return [];

    try {
      const aiOk = await this.isAIAvailable();
      if (!aiOk || !aiWorkflowEngine) {
        return this.getBasicSuggestions(partialCommand);
      }
      const prompt = `Suggest terminal commands based on this partial input:

Partial Command: "${partialCommand}"
Working Directory: ${session.cwd}
Shell: ${session.shell}
Recent Commands: ${this.commandHistory.slice(-5).join(', ')}

Provide 5-10 relevant command suggestions with:
- Complete command
- Brief description
- Category
- Confidence level (0-1)
- Context where it's useful

Format as JSON array of suggestion objects.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        return this.getBasicSuggestions(partialCommand);
      }

      const suggestionSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Command suggestions' },
        [agent.id],
      );

      const result = this.parseAIResponse(suggestionSession.result?.finalOutput || '[]');
      return (Array.isArray(result) ? result : [result]).map((suggestion: any) => ({
        command: suggestion.command || partialCommand,
        description: suggestion.description || '',
        category: suggestion.category || 'general',
        confidence: suggestion.confidence || 0.5,
        context: suggestion.context || [],
      }));
    } catch (error) {
      console.warn('Command suggestions failed:', error);
      return this.getBasicSuggestions(partialCommand);
    }
  }

  // Utility Methods
  private async runCommand(
    cmd: TerminalCommand,
    _session: TerminalSession,
  ): Promise<{
    exitCode: number;
    output: TerminalOutput[];
    error?: string;
  }> {
    const output: TerminalOutput[] = [];
    try {
      const api = (window as any).electronAPI;
      if (!api?.runCommand) {
        return { exitCode: 1, output, error: 'IPC runCommand not available' };
      }
      const full = [cmd.command, ...cmd.args].join(' ').trim();
      const cwd = cmd.cwd && cmd.cwd.trim() ? cmd.cwd : '';
      const res = await api.runCommand({ command: full, cwd });
      if (res?.output) {
        const lines = String(res.output).split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          output.push({ type: 'stdout', content: line, timestamp: Date.now() });
          this.notifyOutput(_session.id, output[output.length - 1]);
        }
      }
      return {
        exitCode: res?.success ? 0 : 1,
        output,
        error: res?.success ? undefined : res?.output || 'Command failed',
      };
    } catch (e) {
      return { exitCode: 1, output, error: e instanceof Error ? e.message : 'Command failed' };
    }
  }

  private async isAIAvailable(): Promise<boolean> {
    try {
      const api = (window as any).electronAPI;
      const res = await api?.ipcInvoke?.('gemini:is-available');
      // If not exposed via generic invoker, use direct route
      if (!res) {
        const check = await api?.gemini?.isAvailable?.();
        return !!check?.available;
      }
      return !!res?.available;
    } catch {
      try {
        const api = (window as any).electronAPI;
        const check = await api?.gemini?.isAvailable?.();
        return !!check?.available;
      } catch {
        return false;
      }
    }
  }

  private parseCommandArgs(command: string): string[] {
    // Parse command arguments with proper shell-like parsing
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      const nextChar = command[i + 1];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
      } else if (char === '\\' && inQuotes && nextChar) {
        // Handle escaped characters in quotes
        current += nextChar;
        i++; // Skip next character
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      args.push(current);
    }

    return args;
  }

  private getDefaultShell(): string {
    // Browser-safe platform detection
    const isWin = typeof navigator !== 'undefined' ? /Win/i.test(navigator.platform) : false;
    if (isWin) return 'powershell.exe';
    // We cannot access process.env here safely; default to bash
    return '/bin/bash';
  }

  private async findRelatedFiles(
    cmd: TerminalCommand,
    _session: TerminalSession,
  ): Promise<string[]> {
    // Renderer-safe existence probing via IPC by attempting a read (without throwing hard errors)
    const relatedFiles: string[] = [];
    const api = (window as any).electronAPI;
    if (!api?.readFile) return relatedFiles;

    const configFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'tsconfig.json',
      'webpack.config.js',
      'vite.config.js',
      '.gitignore',
      '.env',
      '.env.local',
      'Dockerfile',
      'docker-compose.yml',
    ];

    for (const configFile of configFiles) {
      const candidate =
        cmd.cwd.endsWith('/') || cmd.cwd.endsWith('\\')
          ? `${cmd.cwd}${configFile}`
          : `${cmd.cwd}/${configFile}`;
      try {
        const res = await api.readFile(candidate);
        if (res && (res.success || res.content)) {
          relatedFiles.push(configFile);
        }
      } catch {
        // ignore
      }
    }
    return relatedFiles;
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    const api = (window as any).electronAPI;
    const run = async (cmd: string): Promise<string> => {
      try {
        if (!api?.runCommand) return 'unknown';
        const res = await api.runCommand(cmd);
        return String(res?.output || '').trim() || (res?.success ? 'installed' : 'unknown');
      } catch {
        return 'unknown';
      }
    };

    const nodeVersion =
      typeof process !== 'undefined' && (process as any).version
        ? (process as any).version
        : 'unknown';
    const npmVersion = await run('npm --version');
    const gitOut = await run('git --version');
    const gitMatch = gitOut.match(/git version (\S+)/);
    const gitVersion = gitMatch ? gitMatch[1] : gitOut || 'unknown';
    const pyOut = await run('python --version 2>&1');
    const pyMatch = pyOut.match(/Python (\S+)/);
    const pythonVersion = pyMatch ? pyMatch[1] : pyOut || 'unknown';
    const javaOut = await run('java -version 2>&1');
    const javaMatch = javaOut.match(/version "([^"]+)"/);
    const javaVersion = javaMatch ? javaMatch[1] : javaOut ? 'installed' : 'unknown';

    return {
      platform: typeof process !== 'undefined' ? (process as any).platform : 'browser',
      arch: typeof process !== 'undefined' ? (process as any).arch : 'unknown',
      nodeVersion,
      npmVersion,
      gitVersion,
      pythonVersion,
      javaVersion,
    };
  }

  private getDefaultAnalysis(cmd: TerminalCommand): AICommandAnalysis {
    return {
      intent: `Execute command: ${cmd.command}`,
      category: 'other',
      riskLevel: 'medium',
      explanation: 'Command analysis unavailable',
      suggestions: ['Verify command syntax before execution'],
      alternatives: [],
      expectedOutcome: 'Command execution result',
      troubleshooting: ['Check command spelling and syntax'],
    };
  }

  private getDefaultDebugAnalysis(context: DebugContext): DebugAnalysis {
    return {
      errorType: 'unknown',
      rootCause: 'Unable to determine root cause',
      impact: 'minor',
      confidence: 0.3,
      explanation: 'Error analysis unavailable',
      steps: [
        {
          id: 'step-1',
          description: 'Check command syntax',
          expected: 'Valid command format',
          automated: false,
          completed: false,
        },
      ],
    };
  }

  private getDefaultSuggestions(context: DebugContext): DebugSuggestion[] {
    return [
      {
        id: 'suggestion-1',
        type: 'investigation',
        priority: 'medium',
        title: 'Check Command Syntax',
        description: 'Verify the command syntax is correct',
        commands: [`man ${context.command.split(' ')[0]}`],
        automated: false,
        riskLevel: 'safe',
      },
    ];
  }

  private getBasicSuggestions(partialCommand: string): CommandSuggestion[] {
    const commonCommands = [
      { command: 'ls -la', description: 'List all files with details', category: 'file' },
      { command: 'cd ..', description: 'Go to parent directory', category: 'navigation' },
      { command: 'pwd', description: 'Print working directory', category: 'navigation' },
      { command: 'git status', description: 'Check git repository status', category: 'git' },
      { command: 'npm install', description: 'Install npm dependencies', category: 'package' },
      { command: 'npm run build', description: 'Build the project', category: 'build' },
    ];

    return commonCommands
      .filter((cmd) => cmd.command.toLowerCase().includes(partialCommand.toLowerCase()))
      .map((cmd) => ({
        ...cmd,
        confidence: 0.8,
        context: [cmd.category],
      }));
  }

  private parseAIResponse(response: string): any {
    try {
      const jsonMatch =
        response.match(/```json\n([\s\S]*?)\n```/) ||
        response.match(/\[[\s\S]*\]/) ||
        response.match(/\{[\s\S]*\}/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return {};
    }
  }

  // Event Handling
  onSessionsChanged(callback: (sessions: TerminalSession[]) => void): () => void {
    this.sessionCallbacks.add(callback);
    return () => this.sessionCallbacks.delete(callback);
  }

  onOutput(callback: (sessionId: string, output: TerminalOutput) => void): () => void {
    this.outputCallbacks.add(callback);
    return () => this.outputCallbacks.delete(callback);
  }

  private notifySessionsChanged(): void {
    const sessions = Array.from(this.sessions.values());
    this.sessionCallbacks.forEach((callback) => {
      try {
        callback(sessions);
      } catch (error) {
        console.warn('Session callback failed:', error);
      }
    });
  }

  private notifyOutput(sessionId: string, output: TerminalOutput): void {
    this.outputCallbacks.forEach((callback) => {
      try {
        callback(sessionId, output);
      } catch (error) {
        console.warn('Output callback failed:', error);
      }
    });
  }

  // Public Getters
  getSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSession(): TerminalSession | null {
    return this.activeSession;
  }

  getDebugSessions(): AIDebugSession[] {
    return Array.from(this.debugSessions.values());
  }

  getSession(sessionId: string): TerminalSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getDebugSession(debugSessionId: string): AIDebugSession | null {
    return this.debugSessions.get(debugSessionId) || null;
  }

  getCommandHistory(): string[] {
    return [...this.commandHistory];
  }

  clearHistory(): void {
    this.commandHistory = [];
  }
}

export const aiTerminal = new AITerminal();
