// import { useNotifications } from '../contexts/NotificationsContext';

// Core AI Agent Types
export interface AIAgent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  model: string;
  provider: 'gemini' | 'openai' | 'anthropic';
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowSession {
  id: string;
  type: 'debate' | 'sequential';
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: WorkflowStep[];
  context: {
    projectPath?: string;
    selectedCode?: string;
    filePath?: string;
    userGoal?: string;
    additionalContext?: string;
  };
  result?: {
    finalOutput: string;
    confidence: number;
    recommendations: string[];
    changes: Array<{
      filePath: string;
      originalCode: string;
      modifiedCode: string;
      explanation: string;
    }>;
  };
  createdAt: number;
  updatedAt: number;
}

// Predefined AI Agents
export const DEFAULT_AI_AGENTS: AIAgent[] = [
  {
    id: 'primary-coder',
    name: 'Primary Coder',
    role: 'Code Generation and Refactoring',
    systemPrompt: `You are an expert software engineer specializing in code generation, refactoring, and optimization. 
        Your role is to analyze code and propose improvements focusing on:
        - Clean, maintainable code structure
        - Performance optimizations
        - Best practices and design patterns
        - Security considerations
        - Readability and documentation
        
        Always provide detailed explanations for your changes and consider the broader codebase context.`,
    temperature: 0.3,
    maxTokens: 4000,
    model: 'gemini-flash-latest',
    provider: 'gemini',
  },
  {
    id: 'critic-reviewer',
    name: 'Code Critic',
    role: 'Code Review and Quality Assurance',
    systemPrompt: `You are a senior code reviewer and quality assurance expert. Your role is to:
        - Critically analyze proposed code changes
        - Identify potential bugs, security vulnerabilities, and performance issues
        - Suggest alternative approaches and improvements
        - Ensure adherence to coding standards and best practices
        - Provide constructive feedback with specific examples
        
        Be thorough but constructive in your criticism. Focus on actionable improvements.`,
    temperature: 0.2,
    maxTokens: 3000,
    model: 'gemini-flash-latest',
    provider: 'gemini',
  },
  {
    id: 'planner-architect',
    name: 'System Architect',
    role: 'Planning and Architecture',
    systemPrompt: `You are a system architect responsible for high-level planning and design decisions. Your role is to:
        - Analyze requirements and create implementation plans
        - Design system architecture and component interactions
        - Identify dependencies and potential challenges
        - Ensure scalability and maintainability
        - Create step-by-step execution plans
        
        Focus on the big picture while considering implementation details.`,
    temperature: 0.4,
    maxTokens: 3500,
    model: 'gemini-flash-latest',
    provider: 'gemini',
  },
  {
    id: 'integrator-finalizer',
    name: 'Code Integrator',
    role: 'Integration and Finalization',
    systemPrompt: `You are responsible for integrating code changes and finalizing implementations. Your role is to:
        - Merge different code contributions into cohesive solutions
        - Resolve conflicts and inconsistencies
        - Ensure all components work together properly
        - Add necessary imports, dependencies, and configurations
        - Perform final quality checks and optimizations
        
        Focus on creating production-ready, integrated solutions.`,
    temperature: 0.2,
    maxTokens: 4000,
    model: 'gemini-flash-latest',
    provider: 'gemini',
  },
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    role: 'Security Analysis and Hardening',
    systemPrompt: `You are a cybersecurity expert specializing in code security analysis. Your role is to:
        - Identify security vulnerabilities and attack vectors
        - Suggest security hardening measures
        - Ensure secure coding practices
        - Analyze data flow and access controls
        - Recommend security testing strategies
        
        Prioritize security without compromising functionality.`,
    temperature: 0.1,
    maxTokens: 2500,
    model: 'gemini-flash-latest',
    provider: 'gemini',
  },
];

// AI Workflow Engine Class
export class AIWorkflowEngine {
  private sessions: Map<string, WorkflowSession> = new Map();
  private agents: Map<string, AIAgent> = new Map();
  private apiKeys: Record<string, string> = {};
  private addNotification: any;

  constructor() {
    // Initialize default agents
    DEFAULT_AI_AGENTS.forEach((agent) => {
      this.agents.set(agent.id, agent);
    });

    // Load API keys from environment or storage
    this.loadAPIKeys();
  }

  private loadAPIKeys() {
    // Load from environment variables or secure storage
    // Check if we're in a Node.js environment before accessing process.env
    const isNodeEnv = typeof process !== 'undefined' && process.env;

    this.apiKeys = {
      gemini:
        (isNodeEnv ? process.env.GEMINI_API_KEY : null) ||
        localStorage.getItem('gemini_api_key') ||
        '',
      openai:
        (isNodeEnv ? process.env.OPENAI_API_KEY : null) ||
        localStorage.getItem('openai_api_key') ||
        '',
      anthropic:
        (isNodeEnv ? process.env.ANTHROPIC_API_KEY : null) ||
        localStorage.getItem('anthropic_api_key') ||
        '',
    };
  }

  // Agent Debate Room Workflow
  async runDebateWorkflow(
    context: WorkflowSession['context'],
    primaryAgentId: string = 'primary-coder',
    criticAgentId: string = 'critic-reviewer',
    rounds: number = 5,
  ): Promise<WorkflowSession> {
    const sessionId = `debate-${Date.now()}`;
    const session: WorkflowSession = {
      id: sessionId,
      type: 'debate',
      title: `AI Debate: ${context.filePath || 'Code Analysis'}`,
      description: `${rounds}-round debate between ${primaryAgentId} and ${criticAgentId}`,
      status: 'running',
      steps: [],
      context,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);

    try {
      let currentProposal = context.selectedCode || '';
      let debateHistory = '';

      for (let round = 1; round <= rounds; round++) {
        // Primary agent proposes changes
        const proposalStep = await this.executeAgentStep(
          primaryAgentId,
          this.buildPrompt('proposal', {
            round,
            currentCode: currentProposal,
            userGoal: context.userGoal,
            debateHistory,
            context: context.additionalContext,
          }),
          session,
        );

        if (proposalStep.status === 'failed') {
          throw new Error(`Proposal step failed: ${proposalStep.output}`);
        }

        currentProposal = proposalStep.output || currentProposal;

        // Critic reviews and provides feedback
        const reviewStep = await this.executeAgentStep(
          criticAgentId,
          this.buildPrompt('review', {
            round,
            proposedCode: currentProposal,
            userGoal: context.userGoal,
            debateHistory,
            context: context.additionalContext,
          }),
          session,
        );

        if (reviewStep.status === 'failed') {
          throw new Error(`Review step failed: ${reviewStep.output}`);
        }

        // Update debate history
        debateHistory += `\n--- Round ${round} ---\nProposal: ${proposalStep.output}\nReview: ${reviewStep.output}\n`;

        // If it's the final round, integrate feedback
        if (round === rounds) {
          const finalStep = await this.executeAgentStep(
            'integrator-finalizer',
            this.buildPrompt('finalize', {
              finalProposal: currentProposal,
              finalReview: reviewStep.output,
              debateHistory,
              userGoal: context.userGoal,
            }),
            session,
          );

          currentProposal = finalStep.output || currentProposal;
        }
      }

      // Generate final result
      session.result = {
        finalOutput: currentProposal,
        confidence: this.calculateConfidence(session.steps),
        recommendations: this.extractRecommendations(session.steps),
        changes: this.extractChanges(currentProposal, context.selectedCode || ''),
      };

      session.status = 'completed';
      session.updatedAt = Date.now();
    } catch (error) {
      session.status = 'failed';
      session.updatedAt = Date.now();
      console.error('Debate workflow failed:', error);
      throw error;
    }

    return session;
  }

  // Sequential AI Team Workflow
  async runSequentialWorkflow(
    context: WorkflowSession['context'],
    agentSequence: string[] = [
      'planner-architect',
      'primary-coder',
      'critic-reviewer',
      'security-auditor',
      'integrator-finalizer',
    ],
  ): Promise<WorkflowSession> {
    const sessionId = `sequential-${Date.now()}`;
    const session: WorkflowSession = {
      id: sessionId,
      type: 'sequential',
      title: `AI Team: ${context.filePath || 'Code Analysis'}`,
      description: `Sequential workflow with ${agentSequence.length} agents`,
      status: 'running',
      steps: [],
      context,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);

    try {
      let currentOutput = context.selectedCode || '';
      let workflowContext = '';

      for (let i = 0; i < agentSequence.length; i++) {
        const agentId = agentSequence[i];
        const agent = this.agents.get(agentId);

        if (!agent) {
          throw new Error(`Agent not found: ${agentId}`);
        }

        const prompt = this.buildPrompt('sequential', {
          stepNumber: i + 1,
          totalSteps: agentSequence.length,
          agentRole: agent.role,
          currentCode: currentOutput,
          userGoal: context.userGoal,
          workflowContext,
          previousSteps: session.steps.map((s) => ({
            agent: s.agentId,
            output: s.output,
          })),
        });

        const step = await this.executeAgentStep(agentId, prompt, session);

        if (step.status === 'failed') {
          throw new Error(`Sequential step failed at ${agentId}: ${step.output}`);
        }

        currentOutput = step.output || currentOutput;
        workflowContext += `\n${agent.name}: ${step.output}\n`;
      }

      // Generate final result
      session.result = {
        finalOutput: currentOutput,
        confidence: this.calculateConfidence(session.steps),
        recommendations: this.extractRecommendations(session.steps),
        changes: this.extractChanges(currentOutput, context.selectedCode || ''),
      };

      session.status = 'completed';
      session.updatedAt = Date.now();
    } catch (error) {
      session.status = 'failed';
      session.updatedAt = Date.now();
      console.error('Sequential workflow failed:', error);
      throw error;
    }

    return session;
  }

  // Execute individual agent step
  private async executeAgentStep(
    agentId: string,
    prompt: string,
    session: WorkflowSession,
  ): Promise<WorkflowStep> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const step: WorkflowStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      input: prompt,
      status: 'running',
      timestamp: Date.now(),
    };

    session.steps.push(step);
    const startTime = Date.now();

    try {
      const response = await this.callAIProvider(agent, prompt);

      step.output = response;
      step.status = 'completed';
      step.duration = Date.now() - startTime;
    } catch (error) {
      step.output = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      step.status = 'failed';
      step.duration = Date.now() - startTime;
    }

    session.updatedAt = Date.now();
    return step;
  }

  // Call AI Provider API
  private async callAIProvider(agent: AIAgent, prompt: string): Promise<string> {
    const apiKey = this.apiKeys[agent.provider];
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${agent.provider}`);
    }

    const fullPrompt = `${agent.systemPrompt}\n\nUser Request:\n${prompt}`;

    switch (agent.provider) {
      case 'gemini':
        return await this.callGeminiAPI(agent, fullPrompt, apiKey);
      case 'openai':
        return await this.callOpenAIAPI(agent, fullPrompt, apiKey);
      case 'anthropic':
        return await this.callAnthropicAPI(agent, fullPrompt, apiKey);
      default:
        throw new Error(`Unsupported provider: ${agent.provider}`);
    }
  }

  private async callGeminiAPI(agent: AIAgent, prompt: string, apiKey: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${agent.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: agent.temperature,
            maxOutputTokens: agent.maxTokens,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
  }

  private async callOpenAIAPI(agent: AIAgent, prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response generated';
  }

  private async callAnthropicAPI(agent: AIAgent, prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'No response generated';
  }

  // Build contextual prompts
  private buildPrompt(type: string, params: any): string {
    switch (type) {
      case 'proposal':
        return `Round ${params.round} - Code Analysis and Improvement Proposal

Current Code:
\`\`\`
${params.currentCode}
\`\`\`

User Goal: ${params.userGoal}

Previous Debate History:
${params.debateHistory}

Additional Context: ${params.context}

Please analyze the current code and propose specific improvements. Focus on:
1. Code quality and maintainability
2. Performance optimizations
3. Security considerations
4. Best practices adherence

Provide the improved code with detailed explanations for each change.`;

      case 'review':
        return `Round ${params.round} - Code Review and Feedback

Proposed Code:
\`\`\`
${params.proposedCode}
\`\`\`

User Goal: ${params.userGoal}

Previous Debate History:
${params.debateHistory}

Additional Context: ${params.context}

Please provide a thorough review of the proposed code. Identify:
1. Potential issues or bugs
2. Areas for improvement
3. Alternative approaches
4. Compliance with best practices

Be constructive and specific in your feedback.`;

      case 'finalize':
        return `Final Integration - Code Finalization

Final Proposal:
\`\`\`
${params.finalProposal}
\`\`\`

Final Review Feedback:
${params.finalReview}

Complete Debate History:
${params.debateHistory}

User Goal: ${params.userGoal}

Please integrate the feedback and produce the final, production-ready code. Ensure all concerns are addressed and the code meets the user's goals.`;

      case 'sequential':
        return `Sequential Workflow Step ${params.stepNumber}/${params.totalSteps}

Your Role: ${params.agentRole}

Current Code:
\`\`\`
${params.currentCode}
\`\`\`

User Goal: ${params.userGoal}

Workflow Context:
${params.workflowContext}

Previous Steps:
${params.previousSteps.map((step: any, i: number) => `${i + 1}. ${step.agent}: ${step.output}`).join('\n')}

Please perform your specialized analysis and provide improvements based on your role. Build upon the previous work while focusing on your area of expertise.`;

      default:
        return params.prompt || 'Please analyze the provided code and suggest improvements.';
    }
  }

  // Helper methods
  private calculateConfidence(steps: WorkflowStep[]): number {
    const completedSteps = steps.filter((s) => s.status === 'completed').length;
    const totalSteps = steps.length;
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  private extractRecommendations(steps: WorkflowStep[]): string[] {
    const recommendations: string[] = [];
    steps.forEach((step) => {
      if (step.output && step.status === 'completed') {
        // Extract recommendations from step output
        const matches = step.output.match(/(?:recommend|suggest|should|consider)([^.!?]*[.!?])/gi);
        if (matches) {
          recommendations.push(...matches.map((m) => m.trim()));
        }
      }
    });
    return [...new Set(recommendations)].slice(0, 10); // Dedupe and limit
  }

  private extractChanges(
    finalCode: string,
    originalCode: string,
  ): Array<{
    filePath: string;
    originalCode: string;
    modifiedCode: string;
    explanation: string;
  }> {
    if (!originalCode || !finalCode) return [];

    return [
      {
        filePath: 'modified_code',
        originalCode,
        modifiedCode: finalCode,
        explanation: 'AI-generated improvements based on workflow analysis',
      },
    ];
  }

  // Public API methods
  getSession(sessionId: string): WorkflowSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): WorkflowSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getAgent(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }

  addAgent(agent: AIAgent): void {
    this.agents.set(agent.id, agent);
  }

  updateAgent(agentId: string, updates: Partial<AIAgent>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.agents.set(agentId, { ...agent, ...updates });
    return true;
  }

  deleteAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  updateAPIKey(provider: string, apiKey: string): void {
    this.apiKeys[provider] = apiKey;
    localStorage.setItem(`${provider}_api_key`, apiKey);
  }
}

// Global instance
export const aiWorkflowEngine = new AIWorkflowEngine();
