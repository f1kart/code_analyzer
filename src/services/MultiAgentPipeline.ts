/**
 * Multi-Agent AI Code Generation Pipeline
 * 5-stage pipeline with quality gates and feedback loops
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

import { issueRegistry, IssueRegistrySnapshot } from './IssueRegistry';
import { ProjectAnalysis, ProjectIssue } from '../types/ProjectAnalysis';
import { getDiffLines, DiffLine } from '../utils/simpleDiff';
import { PerformanceMonitor } from './PerformanceMonitor';
import { logDebug } from '../utils/logging';
import {
  trackFeatureUsage,
  trackPerformance,
  trackError,
  trackAIInteraction
} from './UsageAnalyticsService';
import { getElectronAPI } from '../utils/electronBridge';
import { loadSession, type AppSettings } from '../utils/sessionManager';
import type { ChatMessage } from './geminiService';
import {
  callFreeAIWithFallback,
  isQuotaOrRateLimitError,
  getAvailableProviders
} from './FreeAIFallback';

/**
 * Pipeline stage status
 */
export type StageStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'completed_with_warnings'
  | 'rejected'
  | 'failed';

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  role: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  maxRetries?: number;
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  id: string;
  name: string;
  agent: AgentConfig;
  status: StageStatus;
  input: string;
  output: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  retryCount: number;
}

interface StageRunContext {
  runId: string;
  contextMode: string;
  attempt?: number;
  degraded?: boolean;
}

/**
 * Pipeline result
 */
export interface QualityAttemptReport {
  attempt: number;
  status: 'approved' | 'rejected';
  generatorModel: string;
  qualityModel: string;
  generatedCode: string;
  reviewerFeedback: string;
  previousGeneratedCode?: string;
  diff?: DiffLine[];
}

export interface PipelineReport {
  analysisSummary: string;
  qualityAttempts: QualityAttemptReport[];
  productionEngineerOutput: string;
  finalValidatorOutput: string;
  stageTranscripts: StageTranscript[];
  issueSnapshot?: IssueRegistryReport;
  missingFeatures?: string[];
  improvementRecommendations?: string[];
}

export interface StageTranscript {
  stageId: string;
  stageName: string;
  attempt?: number;
  model: string;
  input: string;
  output: string;
  startedAt?: string;
  endedAt?: string;
}

export interface IssueRegistryReport {
  projectAnalyzer?: ProjectAnalysis;
  combinedIssues: Array<{
    file: string;
    line: number;
    issues: ProjectIssue[];
  }>;
  lastUpdated: number;
}

export interface PipelineResult {
  success: boolean;
  finalCode: string;
  stages: PipelineStage[];
  totalDuration: number;
  qualityScore: number;
  fileChanges: PipelineFileChange[];
  productionSummary?: string;
  warnings?: string[];
  report?: PipelineReport;
  failureType: PipelineFailureType;
}

export type PipelineFailureType = 'none' | 'quota' | 'cooldown' | 'other';

export type PipelineContextMode = 'prompt_only' | 'active_file' | 'selected_files' | 'full_project';

export interface PipelineContextFile {
  path: string;
  content: string;
}

export interface PipelineContextRequest {
  mode: PipelineContextMode;
  files?: PipelineContextFile[];
  activeFile?: PipelineContextFile | null;
  maxCharacters?: number;
  /** Maximum number of quality check retries (1-5). Defaults to 3. */
  maxQualityRetries?: number;
}

export interface PersistedAgentConfig {
  agentKey: string;
  name: string;
  role: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  maxRetries?: number | null;
}

export type ProgressCallback = (stage: PipelineStage) => void;

export const MIN_CHAR_LIMIT = 10_000;
export const MAX_CHAR_LIMIT = 500_000;
export const DEFAULT_CHAR_LIMIT = 90_000;

let performanceMonitorInstance: PerformanceMonitor | null = null;

const getPipelinePerformanceMonitor = (): PerformanceMonitor => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
};

const generateRunId = (): string => `multi-agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const buildMetricTags = (tags: Record<string, unknown>): Record<string, string> =>
  Object.entries(tags).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = typeof value === 'string' ? value : String(value);
    return acc;
  }, {});

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error('Unknown error');
  }
};

const TRANSCRIPT_SNIPPET_LIMIT = 4_000;

const truncateTranscriptContent = (value: string): string => {
  if (!value) {
    return value;
  }
  if (value.length <= TRANSCRIPT_SNIPPET_LIMIT) {
    return value;
  }
  const truncatedNotice = `\n\n… [${value.length - TRANSCRIPT_SNIPPET_LIMIT} characters truncated]`;
  return `${value.slice(0, TRANSCRIPT_SNIPPET_LIMIT)}${truncatedNotice}`;
};

// Valid Gemini models as of 2025:
// - gemini-2.5-flash (stable, recommended for most tasks)
// - gemini-2.0-flash (stable)
// - gemini-2.0-flash-001 (stable)
const MODEL_FALLBACKS: Record<string, string> = {
  // Legacy / deprecated aliases -> current supported IDs
  'gemini-1.5-flash': 'gemini-2.0-flash',
  'gemini-1.5-flash-latest': 'gemini-2.0-flash',
  'gemini-flash-latest': 'gemini-2.0-flash',
  
  'gemini-1.5-pro': 'gemini-2.5-flash',
  'gemini-1.5-pro-latest': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-flash',
  'gemini-pro-latest': 'gemini-2.5-flash',

  'gemini-2.0-pro-exp-02-05': 'gemini-2.5-flash',
  'gemini-2.5-pro-preview-03-25': 'gemini-2.5-flash'
};

const DEFAULT_MODEL_FALLBACK = 'gemini-2.0-flash';

const FILE_BLOCK_START = '<<FILE:';
const FILE_BLOCK_END = '<<END_FILE>>';
const SUMMARY_BLOCK_START = '<<SUMMARY>>';
const SUMMARY_BLOCK_END = '<<END_SUMMARY>>';
const FILE_SUMMARY_START = '<<FILE_SUMMARY>>';
const FILE_SUMMARY_END = '<<END_FILE_SUMMARY>>';
const UPDATED_CONTENT_START = '<<UPDATED_CONTENT>>';
const UPDATED_CONTENT_END = '<<END_UPDATED_CONTENT>>';
const NO_CHANGES_TOKEN = '<<NO_CHANGES>>';

interface PreparedContextPayload {
  aggregatedCode: string;
  summary: string;
  files: Record<string, string>;
  activeFilePath?: string;
}

export interface PipelineFileChange {
  path: string;
  summary: string;
  updatedContent: string;
  originalContent?: string;
  diff?: DiffLine[];
  isNewFile: boolean;
}

const normalizeModel = (modelId: string | undefined | null): string => {
  const trimmed = (modelId || '').trim();
  if (!trimmed) {
    return DEFAULT_MODEL_FALLBACK;
  }
  const fallback = MODEL_FALLBACKS[trimmed];
  return fallback || trimmed;
};

const buildModelCandidates = (
  initialModel: string,
  preferFlashUnderDegrade: boolean
): string[] => {
  const normalized = normalizeModel(initialModel);

  // Primary model plus two safe, known-good fallbacks.
  // Valid models as of 2025: gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-001
  // Under degraded mode we bias toward flash-first usage to reduce quota impact.
  const baseCandidates = preferFlashUnderDegrade
    ? ['gemini-2.0-flash', normalized, 'gemini-2.5-flash']
    : [normalized, 'gemini-2.0-flash', 'gemini-2.5-flash'];

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const id of baseCandidates) {
    // Normalize each candidate through MODEL_FALLBACKS to ensure valid model names
    const normalizedCandidate = normalizeModel(id);
    if (!normalizedCandidate || seen.has(normalizedCandidate)) {
      continue;
    }
    seen.add(normalizedCandidate);
    candidates.push(normalizedCandidate);
  }

  return candidates;
};

const getAppSettingsForGemini = (): AppSettings => {
  try {
    const session = loadSession();
    return session.appSettings;
  } catch (error) {
    // Fallback to a minimal but structurally valid configuration if session loading fails
    console.warn('[MultiAgentPipeline] Failed to load AppSettings; using safe defaults.', error);
    return {
      aiPersona: '',
      customRules: '',
      explorerStyle: 'list',
      availableModels: [],
      desktopSettings: {
        fileSystem: false,
        database: false
      },
      aiTools: {
        webSearch: true,
        projectSearch: true,
        editFile: true,
        createFile: true,
        runTerminalCommand: true,
        visualSnapshot: true,
        autoRunTools: true,
        analyzeDependencies: true,
        projectWideRefactor: true,
        generateDocs: true
      },
      aiTeamConfiguration: [],
      logVerbosity: 'normal'
    };
  }
};

const isQuotaError = (error: unknown): boolean => {
  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
  if (!message) {
    return false;
  }
  const lowered = message.toLowerCase();
  return lowered.includes('resource_exhausted') || lowered.includes('quota');
};

export interface QuotaHealthSnapshot {
  isCoolingDown: boolean;
  cooldownUntil: number | null;
  lastQuotaFailureAt: number | null;
  recentQuotaFailures: number;
  cooldownMsRemaining: number;
}

export interface CooldownBlockEvent {
  timestamp: number;
  contextMode: string;
  runId: string;
  cooldownSeconds: number;
  recentQuotaFailures: number;
}

const QUOTA_COOLDOWN_MS = 3 * 60_000;
const QUOTA_FAILURE_WINDOW_MS = 10 * 60_000;
const COOLDOWN_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const QUOTA_DEGRADE_RECENT_FAILURES_THRESHOLD = 5;
const DEGRADE_MAX_CONTEXT_CHARACTERS = DEFAULT_CHAR_LIMIT;

let lastQuotaFailureAt: number | null = null;
let quotaFailureTimestamps: number[] = [];
let cooldownBlockEvents: CooldownBlockEvent[] = [];

const pruneQuotaFailureTimestamps = (now: number): void => {
  const cutoff = now - QUOTA_FAILURE_WINDOW_MS;
  quotaFailureTimestamps = quotaFailureTimestamps.filter((timestamp) => timestamp >= cutoff);
};

const registerQuotaFailure = (): void => {
  const now = Date.now();
  lastQuotaFailureAt = now;
  quotaFailureTimestamps.push(now);
  pruneQuotaFailureTimestamps(now);
};

const pruneCooldownBlocksHistory = (now: number): void => {
  const cutoff = now - COOLDOWN_HISTORY_WINDOW_MS;
  cooldownBlockEvents = cooldownBlockEvents.filter((event) => event.timestamp >= cutoff);
};

const registerCooldownBlockEvent = (payload: Omit<CooldownBlockEvent, 'timestamp'>): void => {
  const now = Date.now();
  pruneCooldownBlocksHistory(now);
  cooldownBlockEvents.push({
    timestamp: now,
    ...payload
  });
};

const getQuotaHealthSnapshotInternal = (now: number): QuotaHealthSnapshot => {
  pruneQuotaFailureTimestamps(now);
  const last = lastQuotaFailureAt;
  const cooldownUntil = last ? last + QUOTA_COOLDOWN_MS : null;
  const cooldownMsRemaining = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
  const isCoolingDown = cooldownUntil !== null && cooldownMsRemaining > 0;

  return {
    isCoolingDown,
    cooldownUntil,
    lastQuotaFailureAt: last ?? null,
    recentQuotaFailures: quotaFailureTimestamps.length,
    cooldownMsRemaining
  };
};

export const QUOTA_TESTING = {
  registerQuotaFailure,
  getQuotaHealthSnapshotInternal,
  resetQuotaState: (): void => {
    lastQuotaFailureAt = null;
    quotaFailureTimestamps = [];
    cooldownBlockEvents = [];
  },
  QUOTA_COOLDOWN_MS,
  QUOTA_FAILURE_WINDOW_MS
} as const;

/**
 * Default agent configurations
 */
const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  // ... (rest of the code remains the same)
  analyzer: {
    name: 'Code Analyzer',
    role: 'The Detective',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    systemPrompt: `You are the analysis stage of an enterprise multi-agent pipeline. Your responsibilities:
1. Read all supplied project context meticulously.
2. Summarize architecture, key components, and data flows.
3. Enumerate defects, risks, security gaps, and maintainability concerns.
4. Identify and FLAG ALL: placeholders, TODOs, mocks, simulations, stubs, "coming soon", incomplete implementations, or any non-production code.
5. Recommend concrete remediation steps prioritized by severity.

CRITICAL - NO PLACEHOLDERS POLICY:
- Any placeholder, mock, simulation, stub, TODO, or incomplete implementation is a BLOCKING DEFECT.
- File-based databases, simulated terminals, placeholder UI components are NOT acceptable.
- All code must be FULLY FUNCTIONAL and PRODUCTION-READY.
- If you find placeholders, they MUST be replaced with real implementations.

IMPORTANT: When referencing files, ALWAYS use the EXACT file paths as provided in the context.
List all files being analyzed at the start of your report so subsequent agents know which files exist.

Output a well-structured report with headings:
- Files Analyzed (list exact paths)
- System Overview
- BLOCKING DEFECTS: Placeholders/Mocks/Simulations Found (MUST BE FIXED)
- Risks & Defects (include exact file paths and line numbers)
- Improvement Opportunities (reference exact file paths)
- Production Gaps
- Immediate Next Actions (specify which existing files to modify)`,
    maxRetries: 2
  },
  generator: {
    name: 'Solution Architect',
    role: 'The Builder',
    model: 'gemini-2.5-flash',
    temperature: 0.45,
    systemPrompt: `You generate complete, production-ready implementations. Requirements:
1. Produce fully functional TypeScript/JavaScript code matching the user request and analyzer findings.
2. Enforce enterprise standards: strong typing, exhaustive error handling, security controls, telemetry hooks, and documentation.
3. ABSOLUTELY NO: placeholders, TODOs, mocks, simulations, stubs, "coming soon", comments indicating future work, or incomplete implementations.
4. Respect existing architecture, avoid regressions, and integrate with provided APIs.
5. Return ONLY the resulting code or explicit structured instructions when the request is non-code.

CRITICAL - PRODUCTION-READY ONLY:
- Replace ALL placeholders with REAL, WORKING implementations.
- Replace file-based databases with proper database connections (PostgreSQL, SQLite, etc.).
- Replace simulated terminals with real shell execution via Electron IPC.
- Replace placeholder UI components with fully functional implementations.
- Every function must be complete and operational - no stubs.
- If a feature cannot be fully implemented, DO NOT include it at all.

CRITICAL FILE HANDLING RULES:
- ALWAYS use the EXACT file paths provided in the context. Do NOT invent new file paths.
- If a file already exists in the context, MODIFY that file - do NOT create a new file with a different path.
- Only suggest creating a new file if it genuinely does not exist AND is absolutely necessary.
- When referencing files, use the exact paths from the context (e.g., "src/App.tsx" not just "App.tsx").
- Your changes will be shown in a diff viewer comparing original vs updated content.

CRITICAL IMPORT RULES - NEVER HALLUCINATE:
- ONLY import from files/modules that ALREADY EXIST in the provided context.
- NEVER invent new component names, file paths, or module imports.
- If a component doesn't exist in the context, DO NOT import it or reference it.
- Before adding ANY import statement, verify the file exists in the context provided.
- If you need functionality that doesn't exist, implement it INLINE or skip that feature entirely.
- FORBIDDEN: Creating imports like "./components/TabbedPanel" if TabbedPanel.tsx is not in the context.
- Check the "Files Analyzed" list from the analyzer - only those files exist.`,
    maxRetries: 2
  },
  qualityChecker: {
    name: 'Quality Inspector',
    role: 'The Reviewer',
    model: 'gemini-2.5-flash',
    temperature: 0.2,
    systemPrompt: `You review generated code for production acceptance. Evaluate:
- Functional correctness
- Security hardening and input validation
- Performance characteristics
- Maintainability, readability, and convention alignment
- Observability (logging, metrics, tracing)
- Test coverage expectations

AUTOMATIC REJECTION CRITERIA (any of these = immediate REJECT):
- ANY placeholder, TODO, mock, simulation, stub, or "coming soon" comment
- ANY file-based database or JSON file storage for production data
- ANY simulated functionality (e.g., simulated terminal, fake API responses)
- ANY incomplete UI component with comments like "would go here" or "in a real app"
- ANY function that returns hardcoded/dummy data instead of real implementation
- ANY import statement referencing a file/component that does NOT exist in the provided context
- ANY new component name that was not in the original file's imports (e.g., TabbedPanel, SettingsPanel if not originally imported)
- ANY modification that adds imports to non-existent modules - this breaks the build immediately
- Changes that alter the import structure without verifying the imported files exist

Respond STRICTLY with either:
APPROVE: <concise reasoning - confirm NO placeholders/mocks exist>
or
REJECT: <detailed blocking issues and actionable fixes>

If rejecting, list every blocking defect with bullet points, referencing files/lines when possible.`,
    maxRetries: 2
  },
  engineer: {
    name: 'Production Engineer',
    role: 'The Hardener',
    model: 'gemini-2.5-flash',
    temperature: 0.35,
    systemPrompt: `You transform approved code into an enterprise-grade solution. Duties:
1. Apply security best practices (validation, sanitization, least privilege).
2. Add instrumentation: structured logging, metrics, and tracing hooks aligned with OpenTelemetry conventions.
3. Ensure configuration uses environment variables (no secrets in code).
4. Optimize for performance and scalability; remove bottlenecks; enforce async safety.
5. Augment with documentation (docstrings/comments) when clarifying complex logic.
6. Preserve existing functionality and interface contracts.

CRITICAL - ELIMINATE ALL PLACEHOLDERS:
- Replace ANY placeholder, mock, simulation, or stub with REAL production code.
- File-based JSON databases MUST be replaced with real database connections.
- Simulated terminals MUST use real shell execution via child_process or Electron IPC.
- Placeholder UI components MUST be fully implemented with real functionality.
- Comments like "TODO", "FIXME", "would go here", "in a real app" are FORBIDDEN.
- Every line of code must be production-ready and fully operational.

CRITICAL FILE HANDLING RULES:
- ALWAYS use the EXACT file paths provided in the context. Do NOT invent new file paths.
- If a file already exists in the context, MODIFY that file - do NOT create a new file.
- Only create a new file if it genuinely does not exist AND is necessary for the improvement.
- When modifying existing files, include the COMPLETE updated file content, not just snippets.
- The file path must match exactly what was provided in the context (e.g., "src/App.tsx" not "App.tsx").

CRITICAL IMPORT RULES - NEVER HALLUCINATE:
- ONLY import from files/modules that ALREADY EXIST in the provided context.
- NEVER invent new component names, file paths, or module imports.
- If a component doesn't exist in the context, DO NOT import it or reference it.
- Before adding ANY import statement, verify the file exists in the context provided.
- If you need functionality that doesn't exist, implement it INLINE or skip that feature entirely.
- FORBIDDEN: Creating imports like "./components/TabbedPanel" if TabbedPanel.tsx is not in the context.
- Check the "Files Analyzed" list from the analyzer - only those files exist.
- If the original file has imports, PRESERVE them exactly unless removing unused ones.

Return the fully hardened code ready for deployment.

Respond strictly with the following structured format:

<<SUMMARY>>
<overall multi-file summary explaining improvements, risk mitigations, and validation steps>
<<END_SUMMARY>>

For each file you modify or create, emit exactly one block:
<<FILE:exact/path/from/context>>
<<FILE_SUMMARY>>
<clear explanation of why this file changed, key enhancements, and potential follow-up testing>
<<END_FILE_SUMMARY>>
<<UPDATED_CONTENT>>
<the complete updated file content, ready to write to disk>
<<END_UPDATED_CONTENT>>
<<END_FILE>>

If no files require edits, respond with <<NO_CHANGES>>.

Do NOT include any additional prose outside the structured tokens.
Do NOT create new files when you should be modifying existing ones.`,
    maxRetries: 1
  },
  validator: {
    name: 'Chief Auditor',
    role: 'The Gatekeeper',
    model: 'gemini-2.5-flash',
    temperature: 0.25,
    systemPrompt: `You are the final validation stage before production deployment. Tasks:
1. Re-run exhaustive checks across functionality, security, performance, observability, and maintainability.
2. Confirm requirements and policy compliance. Identify any remaining risks.
3. Provide a QUALITY SCORE (0-100) reflecting production readiness.
4. If any critical issues remain, explain them with remediation steps.

CRITICAL IMPORT VALIDATION (AUTOMATIC FAIL if violated):
- Compare the import statements in the proposed changes against the original file.
- If ANY new import is added that references a file NOT in the provided context, FAIL immediately.
- Hallucinated imports (e.g., "./components/TabbedPanel" when TabbedPanel.tsx doesn't exist) = AUTOMATIC FAIL.
- The code MUST compile and run - any missing module reference breaks the build.
- If imports were changed, verify EVERY imported file exists in the project context.

Respond with structured sections:
- Verdict: PASS or FAIL
- Quality Score: <number>
- Import Validation: PASS or FAIL (list any hallucinated imports found)
- Strengths
- Risks / Follow-ups
- Release Recommendation`,
    maxRetries: 1
  }
};

/**
 * Multi-Agent Pipeline Service
 */
export class MultiAgentPipeline {
  private agents: Record<string, AgentConfig>;

  constructor(customAgents?: Partial<Record<string, AgentConfig>>) {
    this.agents = { ...DEFAULT_AGENTS, ...customAgents } as Record<string, AgentConfig>;
    Object.keys(this.agents).forEach((key) => {
      this.agents[key].model = normalizeModel(this.agents[key].model);
    });
  }

  public getQuotaHealth(): QuotaHealthSnapshot {
    return getQuotaHealthSnapshotInternal(Date.now());
  }

  public getCooldownHistory(windowMs?: number): CooldownBlockEvent[] {
    const now = Date.now();
    pruneCooldownBlocksHistory(now);
    const effectiveWindowMs =
      typeof windowMs === 'number' && windowMs > 0 ? windowMs : COOLDOWN_HISTORY_WINDOW_MS;
    const cutoff = now - effectiveWindowMs;
    return cooldownBlockEvents.filter((event) => event.timestamp >= cutoff);
  }

  public resetQuotaTracking(): void {
    QUOTA_TESTING.resetQuotaState();
  }

  public setPreferredModel(modelId: string | undefined | null): void {
    const normalized = normalizeModel(modelId);
    if (!normalized) {
      return;
    }

    Object.keys(this.agents).forEach((key) => {
      const agent = this.agents[key];
      if (!agent.model) {
        agent.model = normalized;
      } else {
        agent.model = normalizeModel(agent.model);
      }
    });
  }

  /**
   * Run the complete 5-stage pipeline
   */
  public async runPipeline(
    userPrompt: string,
    contextOrLegacyCode?: string | PipelineContextRequest,
    onProgress?: ProgressCallback
  ): Promise<PipelineResult> {
    logDebug('[MultiAgentPipeline] Starting pipeline for:', userPrompt);
    const startTime = Date.now();
    const runId = generateRunId();
    const contextMode =
      typeof contextOrLegacyCode === 'object' && contextOrLegacyCode !== null && 'mode' in contextOrLegacyCode
        ? (contextOrLegacyCode as PipelineContextRequest).mode
        : typeof contextOrLegacyCode === 'string'
          ? 'legacy_string'
          : 'prompt_only';
    const pipelineMonitor = getPipelinePerformanceMonitor();
    const pipelineTags = buildMetricTags({ runId, contextMode });

    const quotaHealth = this.getQuotaHealth();
    const isDegradedMode =
      quotaHealth.recentQuotaFailures >= QUOTA_DEGRADE_RECENT_FAILURES_THRESHOLD;
    if (quotaHealth.isCoolingDown) {
      const cooldownSeconds = Math.max(
        0,
        Math.ceil(quotaHealth.cooldownMsRemaining / 1000)
      );
      const cooldownMessage =
        `Gemini usage cool-down is active for the multi-agent pipeline. ` +
        `Wait approximately ${cooldownSeconds} seconds before retrying. ` +
        'Visit https://ai.dev/usage?tab=rate-limit to inspect your current usage and limits.';
      console.warn('[MultiAgentPipeline] Blocking run due to active usage cool-down:', {
        runId,
        contextMode,
        cooldownSeconds
      });
      registerCooldownBlockEvent({
        runId,
        contextMode,
        cooldownSeconds,
        recentQuotaFailures: quotaHealth.recentQuotaFailures
      });
      pipelineMonitor.recordMetric('multi_agent_pipeline_cooldown_blocks', 1, 'count', pipelineTags);
      trackFeatureUsage('multi_agent_pipeline_cooldown_block', {
        runId,
        contextMode,
        cooldownSeconds,
        recentQuotaFailures: quotaHealth.recentQuotaFailures
      });
      throw new Error(cooldownMessage);
    }

    if (isDegradedMode) {
      pipelineMonitor.recordMetric('multi_agent_pipeline_runs_degraded', 1, 'count', pipelineTags);
      trackFeatureUsage('multi_agent_pipeline_degraded_run', {
        runId,
        contextMode,
        recentQuotaFailures: quotaHealth.recentQuotaFailures
      });
    }

    const stages: PipelineStage[] = [
      this.createStage('stage1', 'Code Analysis', this.agents.analyzer),
      this.createStage('stage2', 'Solution Generation', this.agents.generator),
      this.createStage('stage3', 'Quality Check', this.agents.qualityChecker),
      this.createStage('stage4', 'Production Engineering', this.agents.engineer),
      this.createStage('stage5', 'Final Validation', this.agents.validator)
    ];

    let effectiveContextInput = contextOrLegacyCode;
    if (
      isDegradedMode &&
      typeof contextOrLegacyCode === 'object' &&
      contextOrLegacyCode !== null &&
      'mode' in contextOrLegacyCode
    ) {
      const contextRequest = contextOrLegacyCode as PipelineContextRequest;
      const existingMax =
        typeof contextRequest.maxCharacters === 'number' &&
        Number.isFinite(contextRequest.maxCharacters)
          ? contextRequest.maxCharacters
          : DEFAULT_CHAR_LIMIT;
      const degradedMax = Math.min(existingMax, DEGRADE_MAX_CONTEXT_CHARACTERS);
      if (degradedMax !== existingMax) {
        effectiveContextInput = {
          ...contextRequest,
          maxCharacters: degradedMax
        };
      }
    }

    const contextPayload = this.prepareContext(effectiveContextInput);
    const issueSnapshot = issueRegistry.getSnapshot();
    const analyzerIssueSummary = this.composeIssueSummary(issueSnapshot);
    const stageTranscripts: StageTranscript[] = [];
    const aggregatedCharacters = contextPayload.aggregatedCode.length;
    const hasCodeContext = aggregatedCharacters > 0;

    trackFeatureUsage('multi_agent_pipeline_run', {
      runId,
      contextMode,
      promptLength: userPrompt.length,
      aggregatedCharacters,
      hasCodeContext,
      stageCount: stages.length
    });
    trackAIInteraction('multi_agent_pipeline_start', undefined, {
      runId,
      contextMode,
      promptLength: userPrompt.length,
      aggregatedCharacters
    });
    pipelineMonitor.recordMetric('multi_agent_pipeline_runs_started', 1, 'count', pipelineTags);
    pipelineMonitor.recordMetric('multi_agent_pipeline_prompt_length', userPrompt.length, 'count', pipelineTags);
    pipelineMonitor.recordMetric('multi_agent_pipeline_context_characters', aggregatedCharacters, 'count', pipelineTags);

    try {
      // Stage 1: Analyze
      await this.runStage(
        stages[0],
        this.composeAnalysisInput(
          userPrompt,
          contextPayload.summary,
          contextPayload.aggregatedCode,
          analyzerIssueSummary
        ),
        onProgress,
        { runId, contextMode, degraded: isDegradedMode }
      );

      stageTranscripts.push(this.createTranscript(stages[0]));

      // Stage 2: Generate (with potential retry loop from Stage 3)
      let generatedCode = '';
      let qualityApproved = false;
      const qualityWarnings: string[] = [];
      const qualityAttempts: QualityAttemptReport[] = [];
      let previousGeneratedCodeSnapshot = '';
      let attemptCount = 0;
      // Get user-configured max retries from context request, clamped to 1-5
      const userMaxRetries = typeof contextOrLegacyCode === 'object' && 
        contextOrLegacyCode !== null && 
        'maxQualityRetries' in contextOrLegacyCode &&
        typeof (contextOrLegacyCode as PipelineContextRequest).maxQualityRetries === 'number'
          ? Math.min(5, Math.max(1, (contextOrLegacyCode as PipelineContextRequest).maxQualityRetries!))
          : 3;
      
      const maxAttempts = isDegradedMode
        ? 1
        : quotaHealth.recentQuotaFailures > 0
          ? Math.min(userMaxRetries, 2)
          : userMaxRetries;

      while (!qualityApproved && attemptCount < maxAttempts) {
        attemptCount++;

        // Generate solution
        await this.runStage(
          stages[1],
          `Analysis Report:\n${stages[0].output}\n\nUser Request: ${userPrompt}\n\nGenerate production-ready code.`,
          onProgress,
          { runId, contextMode, attempt: attemptCount, degraded: isDegradedMode }
        );
        generatedCode = stages[1].output;
        stageTranscripts.push(this.createTranscript(stages[1], attemptCount));

        // Quality check
        await this.runStage(
          stages[2],
          `Review this code:\n\n${generatedCode}\n\nUser Request: ${userPrompt}`,
          onProgress,
          { runId, contextMode, attempt: attemptCount, degraded: isDegradedMode }
        );
        stageTranscripts.push(this.createTranscript(stages[2], attemptCount));

        // Check if approved
        if (stages[2].output.toUpperCase().startsWith('APPROVE')) {
          qualityApproved = true;
          stages[2].status = 'completed';
          qualityAttempts.push({
            attempt: attemptCount,
            status: 'approved',
            generatorModel: stages[1].agent.model,
            qualityModel: stages[2].agent.model,
            generatedCode,
            reviewerFeedback: stages[2].output,
            previousGeneratedCode: previousGeneratedCodeSnapshot || undefined,
            diff: previousGeneratedCodeSnapshot
              ? getDiffLines(previousGeneratedCodeSnapshot, generatedCode)
              : undefined
          });
        } else {
          // Rejected - loop back
          stages[2].status = 'rejected';
          stages[1].status = 'pending';
          stages[1].retryCount++;

          logDebug(
            `[MultiAgentPipeline] Quality check rejected (attempt ${attemptCount}/${maxAttempts})`
          );

          qualityAttempts.push({
            attempt: attemptCount,
            status: 'rejected',
            generatorModel: stages[1].agent.model,
            qualityModel: stages[2].agent.model,
            generatedCode,
            reviewerFeedback: stages[2].output,
            previousGeneratedCode: previousGeneratedCodeSnapshot || undefined,
            diff: previousGeneratedCodeSnapshot
              ? getDiffLines(previousGeneratedCodeSnapshot, generatedCode)
              : undefined
          });

          if (attemptCount >= maxAttempts) {
            qualityWarnings.push('Quality Checker rejected all attempts. Proceeding with latest generated code.');
            qualityWarnings.push(stages[2].output || 'Quality Checker did not provide feedback.');
            break;
          }
        }

        previousGeneratedCodeSnapshot = generatedCode;
      }

      if (!qualityApproved) {
        stages[2].status = 'completed_with_warnings';
      }

      // Stage 4: Make production-ready
      await this.runStage(
        stages[3],
        `Enhance this approved code to enterprise standards:\n\n${generatedCode}`,
        onProgress,
        { runId, contextMode, degraded: isDegradedMode }
      );
      stageTranscripts.push(this.createTranscript(stages[3]));

      // Stage 5: Final validation
      await this.runStage(
        stages[4],
        `Final validation of production code:\n\n${stages[3].output}`,
        onProgress,
        { runId, contextMode, degraded: isDegradedMode }
      );
      stageTranscripts.push(this.createTranscript(stages[4]));
      
      // Extract quality score from validator output
      const qualityScore = this.extractQualityScore(stages[4].output);
      
      const totalDuration = Date.now() - startTime;
      const parsedProduction = this.parseProductionOutputs(stages[3].output ?? '', contextPayload.files);

      logDebug('[MultiAgentPipeline] Pipeline completed successfully');

      const completionTags = {
        ...pipelineTags,
        qualityScore: String(qualityScore),
        warnings: String(qualityWarnings.length),
        attempts: String(qualityAttempts.length)
      };
      pipelineMonitor.recordMetric('multi_agent_pipeline_runs_completed', 1, 'count', completionTags);
      pipelineMonitor.recordMetric('multi_agent_pipeline_duration', totalDuration, 'ms', completionTags);
      trackPerformance('multi_agent_pipeline', totalDuration, {
        runId,
        contextMode,
        qualityScore,
        warnings: qualityWarnings.length,
        attempts: qualityAttempts.length
      });
      trackAIInteraction('multi_agent_pipeline_success', stages[4].agent.model, {
        runId,
        contextMode,
        qualityScore,
        warnings: qualityWarnings.length,
        attempts: qualityAttempts.length
      });

      const report: PipelineReport = {
        analysisSummary: stages[0].output,
        qualityAttempts,
        productionEngineerOutput: stages[3].output,
        finalValidatorOutput: stages[4].output,
        stageTranscripts,
        issueSnapshot: this.transformIssueSnapshot(issueSnapshot),
        missingFeatures: this.extractMissingFeatures(issueSnapshot),
        improvementRecommendations: this.extractImprovementRecommendations(
          qualityAttempts,
          stages[4].output,
          stages[0].output,
          issueSnapshot
        )
      };

      return {
        success: true,
        finalCode: stages[3].output,
        stages,
        totalDuration,
        qualityScore,
        fileChanges: parsedProduction.changes,
        productionSummary: parsedProduction.summary,
        warnings: qualityWarnings,
        report,
        failureType: 'none'
      };
      
    } catch (error: any) {
      console.error('[MultiAgentPipeline] Pipeline failed:', error);
      const failureStage = stages.find((stage) => stage.status === 'failed');
      const elapsed = Date.now() - startTime;
      const failureTags = {
        ...pipelineTags,
        failureStage: failureStage?.id ?? 'unknown'
      };
      const normalizedError = normalizeError(error);

      let failureType: PipelineFailureType = 'other';

      if (isQuotaError(normalizedError)) {
        registerQuotaFailure();
        pipelineMonitor.recordMetric('multi_agent_pipeline_quota_failures', 1, 'count', failureTags);
        failureType = 'quota';
      }

      pipelineMonitor.recordMetric('multi_agent_pipeline_runs_failed', 1, 'count', failureTags);
      pipelineMonitor.recordMetric('multi_agent_pipeline_duration', elapsed, 'ms', failureTags);
      trackPerformance('multi_agent_pipeline_failure', elapsed, {
        runId,
        contextMode,
        failureStage: failureStage?.id ?? 'unknown'
      });
      trackError('multi_agent_pipeline_failure', normalizedError, {
        runId,
        contextMode,
        failureStage: failureStage?.id ?? 'unknown'
      });
      trackAIInteraction('multi_agent_pipeline_failure', failureStage?.agent.model, {
        runId,
        contextMode,
        failureStage: failureStage?.id ?? 'unknown',
        error: normalizedError.message
      });
      
      return {
        success: false,
        finalCode: '',
        stages,
        totalDuration: elapsed,
        qualityScore: 0,
        fileChanges: [],
        productionSummary: undefined,
        report: {
          analysisSummary: stages[0]?.output ?? '',
          qualityAttempts: [],
          productionEngineerOutput: stages[3]?.output ?? '',
          finalValidatorOutput: stages[4]?.output ?? '',
          stageTranscripts,
          issueSnapshot: this.transformIssueSnapshot(issueSnapshot),
          missingFeatures: this.extractMissingFeatures(issueSnapshot),
          improvementRecommendations: this.extractImprovementRecommendations(
            [],
            stages[4]?.output ?? '',
            stages[0]?.output ?? '',
            issueSnapshot
          )
        },
        failureType
      };
    }
  }
  
  /**
   * Compose analysis stage input with prompt and context summary
   */
  private composeAnalysisInput(
    userPrompt: string,
    contextSummary: string,
    aggregatedCode: string,
    issueSummary?: string
  ): string {
    const hasCodeContext = aggregatedCode.trim().length > 0;
    const header = `USER PROMPT:\n${userPrompt}`;
    const summarySection = `CONTEXT SUMMARY:\n${contextSummary}`;
    const codeSection = hasCodeContext
      ? `===== PROJECT CODE CONTEXT START =====\n${aggregatedCode}\n===== PROJECT CODE CONTEXT END =====`
      : 'NO CODE CONTEXT PROVIDED';

    const issuesSection = issueSummary
      ? `PROJECT ISSUE SNAPSHOT:\n${issueSummary}`
      : 'PROJECT ISSUE SNAPSHOT:\nNo existing analyzer data available.';

    return [
      'You are the Code Analyzer stage of a multi-agent production pipeline.',
      'Perform comprehensive analysis of the supplied project context and user request.',
      header,
      summarySection,
      codeSection,
      issuesSection
    ].join('\n\n');
  }

  /**
   * Prepare structured context for the pipeline
   */
  private prepareContext(input?: string | PipelineContextRequest): PreparedContextPayload {
    if (!input) {
      return {
        aggregatedCode: '',
        summary: 'Mode: prompt_only. No existing code supplied. The pipeline must reason from the new prompt alone.',
        files: {}
      };
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      return {
        aggregatedCode: trimmed,
        summary: `Mode: legacy-string. Aggregated code length: ${trimmed.length.toLocaleString()} characters.`,
        files: {}
      };
    }

    const {
      mode,
      files = [],
      activeFile,
      maxCharacters = 180_000
    } = input;

    const uniqueFiles = new Map<string, string>();

    const addFile = (file?: PipelineContextFile | null) => {
      if (!file || !file.path || typeof file.content !== 'string') {
        return;
      }
      if (!uniqueFiles.has(file.path)) {
        uniqueFiles.set(file.path, file.content);
      }
    };

    if (mode === 'full_project' || mode === 'selected_files') {
      files.forEach(addFile);
    }

    addFile(activeFile);

    const orderedFiles = Array.from(uniqueFiles.entries());

    let aggregated = '';
    let charactersUsed = 0;
    let truncated = false;
    const maxChars = Math.max(10_000, maxCharacters); // enforce reasonable lower bound

    const parts: string[] = [];

    for (const [path, content] of orderedFiles) {
      const header = `// FILE: ${path}\n`;
      const sanitizedContent = typeof content === 'string' ? content : '';
      const snippet = `${header}${sanitizedContent.trim()}\n\n`;
      const projectedSize = charactersUsed + snippet.length;

      if (projectedSize > maxChars) {
        const remaining = maxChars - charactersUsed;
        if (remaining > header.length + 50) {
          const sliceLength = remaining - header.length;
          parts.push(`${header}${sanitizedContent.trim().slice(0, sliceLength)}\n// ... TRUNCATED ...\n\n`);
          charactersUsed = maxChars;
        }
        truncated = true;
        break;
      }

      parts.push(snippet);
      charactersUsed = projectedSize;
    }

    aggregated = parts.join('');

    const summaryLines = [
      `Mode: ${mode}`,
      `Files included: ${orderedFiles.length}`,
      `Characters included: ${charactersUsed.toLocaleString()} (limit ${maxChars.toLocaleString()})`,
      truncated ? 'Context truncated to respect model limits.' : 'Context fully included.'
    ];

    if (activeFile && uniqueFiles.has(activeFile.path)) {
      summaryLines.push(`Active file prioritized: ${activeFile.path}`);
    } else if (mode === 'active_file' && !activeFile) {
      summaryLines.push('Warning: Active file requested but not provided. Context is empty.');
    }

    return {
      aggregatedCode: aggregated,
      summary: summaryLines.join('\n'),
      files: Object.fromEntries(orderedFiles),
      activeFilePath: activeFile?.path
    };
  }

  private parseProductionOutputs(
    productionOutput: string,
    contextFiles: Record<string, string>
  ): { summary: string; changes: PipelineFileChange[] } {
    if (!productionOutput) {
      return {
        summary: 'Production engineer did not return any content.',
        changes: []
      };
    }

    const trimmed = productionOutput.trim();
    if (trimmed === NO_CHANGES_TOKEN) {
      return {
        summary: 'Production engineer reported no code changes required.',
        changes: []
      };
    }

    const summaryMatch = this.extractBlock(trimmed, SUMMARY_BLOCK_START, SUMMARY_BLOCK_END);
    const summary = summaryMatch?.trim() || 'Production engineer did not provide a summary block.';

    const fileSections = this.extractAllBlocks(trimmed, FILE_BLOCK_START, FILE_BLOCK_END);
    if (fileSections.length === 0) {
      // Try to extract code blocks from markdown-style output
      const codeBlockChanges = this.extractCodeBlocksAsChanges(trimmed, contextFiles);
      if (codeBlockChanges.length > 0) {
        logDebug('[MultiAgentPipeline] Extracted', codeBlockChanges.length, 'code blocks from unstructured output');
        return {
          summary,
          changes: codeBlockChanges
        };
      }

      // Final fallback: create single output file
      return {
        summary,
        changes: [
          {
            path: 'multi-agent/output.ts',
            summary: 'Production engineer did not emit structured file summaries. Entire output captured as new file.',
            updatedContent: trimmed,
            isNewFile: true
          }
        ]
      };
    }

    const changes: PipelineFileChange[] = fileSections
      .map(section => this.parseFileSection(section, contextFiles))
      .filter((change): change is PipelineFileChange => Boolean(change));

    logDebug('[MultiAgentPipeline] Parsed', changes.length, 'file changes from structured output');
    return {
      summary,
      changes
    };
  }

  /**
   * Extract code blocks from markdown-style output and match them to context files
   */
  private extractCodeBlocksAsChanges(
    content: string,
    contextFiles: Record<string, string>
  ): PipelineFileChange[] {
    const changes: PipelineFileChange[] = [];
    // Match ```language\n...``` or ```\n...``` blocks
    const codeBlockRegex = /```(\w+)?(?:\s*\/\/\s*([^\n]+\.[\w]+)|[^\n]*)\n([\s\S]*?)```/g;
    let match;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'typescript';
      const filenameHint = match[2]?.trim();
      const code = match[3].trim();

      if (!code) continue;

      // Try to find filename from hint, first comment, or context files
      let detectedPath: string | undefined = filenameHint;
      
      if (!detectedPath) {
        // Check first line for filename comment
        const firstLine = code.split('\n')[0];
        const filenameMatch = firstLine?.match(/\/\/\s*([^\s]+\.\w+)|#\s*([^\s]+\.\w+)|\/\*\s*([^\s]+\.\w+)/);
        detectedPath = filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3];
      }

      if (!detectedPath) {
        // Try to match against context files by content similarity
        for (const [path, originalContent] of Object.entries(contextFiles)) {
          // Simple heuristic: if the code contains significant portions of the original
          const originalLines = originalContent.split('\n').slice(0, 10);
          const matchingLines = originalLines.filter(line => 
            line.trim().length > 10 && code.includes(line.trim())
          );
          if (matchingLines.length >= 3) {
            detectedPath = path;
            break;
          }
        }
      }

      // Generate path if still not found
      const ext = language === 'typescript' || language === 'ts' ? 'ts' 
        : language === 'javascript' || language === 'js' ? 'js'
        : language === 'tsx' ? 'tsx'
        : language === 'jsx' ? 'jsx'
        : language === 'css' ? 'css'
        : language === 'html' ? 'html'
        : language === 'json' ? 'json'
        : 'ts';
      
      const path = detectedPath || `multi-agent/generated-${blockIndex}.${ext}`;
      const originalContent = contextFiles[path];
      const diff = originalContent ? getDiffLines(originalContent, code) : undefined;

      changes.push({
        path,
        summary: `Code block ${blockIndex + 1} (${language})${detectedPath ? ` - ${detectedPath}` : ''}`,
        updatedContent: code,
        originalContent,
        diff,
        isNewFile: originalContent === undefined
      });

      blockIndex++;
    }

    return changes;
  }

  private extractBlock(content: string, startToken: string, endToken: string): string | undefined {
    const startIndex = content.indexOf(startToken);
    if (startIndex === -1) {
      return undefined;
    }
    const normalizedStart = content.slice(startIndex + startToken.length);
    const endIndex = normalizedStart.indexOf(endToken);
    if (endIndex === -1) {
      return normalizedStart;
    }
    return normalizedStart.slice(0, endIndex);
  }

  private extractAllBlocks(content: string, startToken: string, endToken: string): string[] {
    const results: string[] = [];
    let remaining = content;
    while (remaining.length > 0) {
      const startIdx = remaining.indexOf(startToken);
      if (startIdx === -1) {
        break;
      }
      const afterStart = remaining.slice(startIdx + startToken.length);
      const endIdx = afterStart.indexOf(endToken);
      if (endIdx === -1) {
        results.push(afterStart.trim());
        break;
      }
      results.push(afterStart.slice(0, endIdx).trim());
      remaining = afterStart.slice(endIdx + endToken.length);
    }
    return results;
  }

  private parseFileSection(section: string, contextFiles: Record<string, string>): PipelineFileChange | undefined {
    const delimiterIndex = section.indexOf('>>');
    if (delimiterIndex === -1) {
      return undefined;
    }
    const rawPath = section.slice(0, delimiterIndex).trim();
    const normalizedPath = rawPath.replace(/^"|"$/g, '');
    const remainder = section.slice(delimiterIndex + 2).trim();

    if (!normalizedPath) {
      return undefined;
    }

    const summaryBlock = this.extractBlock(remainder, FILE_SUMMARY_START, FILE_SUMMARY_END);
    const summary = summaryBlock?.trim() || 'Production engineer did not include a per-file summary.';

    let contentContainer = remainder;
    if (summaryBlock) {
      contentContainer = this.removeBlock(contentContainer, FILE_SUMMARY_START, FILE_SUMMARY_END).trim();
    }

    const updatedContentBlock = this.extractBlock(contentContainer, UPDATED_CONTENT_START, UPDATED_CONTENT_END);
    let updatedContent = updatedContentBlock ?? contentContainer;
    if (updatedContentBlock) {
      updatedContent = updatedContentBlock.trim();
    }

    const originalContent = contextFiles[normalizedPath];
    const diff = originalContent ? getDiffLines(originalContent, updatedContent) : undefined;

    return {
      path: normalizedPath,
      summary,
      updatedContent,
      originalContent,
      diff,
      isNewFile: originalContent === undefined
    };
  }

  private removeBlock(content: string, startToken: string, endToken: string): string {
    const startIndex = content.indexOf(startToken);
    if (startIndex === -1) {
      return content;
    }
    const endIndex = content.indexOf(endToken, startIndex + startToken.length);
    if (endIndex === -1) {
      return content.slice(0, startIndex);
    }
    return `${content.slice(0, startIndex)}${content.slice(endIndex + endToken.length)}`;
  }
  
  /**
   * Create a pipeline stage
   */
  private createStage(id: string, name: string, agent: AgentConfig): PipelineStage {
    return {
      id,
      name,
      agent,
      status: 'pending',
      input: '',
      output: '',
      retryCount: 0
    };
  }
  
  /**
   * Run a single stage
   */
  private async runStage(
    stage: PipelineStage,
    input: string,
    onProgress?: ProgressCallback,
    context?: StageRunContext
  ): Promise<void> {
    stage.status = 'in_progress';
    stage.input = input;
    stage.startTime = new Date();
    const attemptNumber = context?.attempt ?? stage.retryCount + 1;
    const pipelineMonitor = getPipelinePerformanceMonitor();
    const metricTags = buildMetricTags({
      runId: context?.runId,
      stageId: stage.id,
      stageName: stage.name,
      contextMode: context?.contextMode,
      attempt: attemptNumber,
      model: stage.agent.model
    });

    trackAIInteraction('multi_agent_stage_start', stage.agent.model, {
      runId: context?.runId,
      stageId: stage.id,
      stageName: stage.name,
      attempt: attemptNumber
    });
    
    if (onProgress) {
      onProgress(stage);
    }
    
    try {
      // Get electronAPI for Gemini calls via environment-safe bridge
      const electronAPI = getElectronAPI();
      if (!electronAPI?.gemini?.chat) {
        throw new Error(
          'Gemini API is not available in this environment. This feature requires the desktop application.'
        );
      }

      // Convert to chat format with system prompt
      const systemPrompt = stage.agent.systemPrompt;
      const messages: ChatMessage[] = [
        {
          role: 'user',
          parts: [{ text: systemPrompt }]
        },
        { role: 'user', parts: [{ text: input }] }
      ];
      
      logDebug(`[MultiAgentPipeline] Calling Gemini for ${stage.name}`);
      
      // Call Gemini API with model fallback chain; in degraded mode we prefer flash-first usage
      const resolvedModelId = normalizeModel(stage.agent.model);
      stage.agent.model = resolvedModelId;
      const candidateModels = buildModelCandidates(
        resolvedModelId,
        context?.degraded === true
      );
      const appSettingsForStage = getAppSettingsForGemini();
      let lastError: any = null;
      let responded = false;

      for (const candidate of candidateModels) {
        try {
          logDebug(`[MultiAgentPipeline] Using model ${candidate} for ${stage.name}`);
          const response = await electronAPI.gemini.chat(
            messages,
            appSettingsForStage,
            candidate
          );

          stage.agent.model = candidate;
          stage.output = response;
          stage.status = 'completed';
          stage.endTime = new Date();
          const duration = stage.endTime.getTime() - stage.startTime.getTime();
          pipelineMonitor.recordMetric('multi_agent_stage_duration', duration, 'ms', metricTags);
          pipelineMonitor.recordMetric('multi_agent_stage_success', 1, 'count', metricTags);
          trackPerformance(`multi_agent_stage_${stage.id}`, duration, {
            runId: context?.runId,
            stageId: stage.id,
            stageName: stage.name,
            attempt: attemptNumber,
            model: stage.agent.model
          });
          trackAIInteraction('multi_agent_stage_complete', stage.agent.model, {
            runId: context?.runId,
            stageId: stage.id,
            stageName: stage.name,
            attempt: attemptNumber,
            duration
          });
          responded = true;
          break;
        } catch (modelError: any) {
          lastError = modelError;
          if (!isQuotaError(modelError)) {
            throw modelError;
          }
          console.warn(
            `[MultiAgentPipeline] Model ${candidate} hit quota limits. Treating as account-level exhaustion; skipping remaining fallbacks.`,
            modelError?.message || modelError
          );
          break;
        }
      }

      if (!responded) {
        // Try free AI fallback providers when Gemini fails
        if (isQuotaError(lastError) || isQuotaOrRateLimitError(lastError)) {
          const freeProviders = getAvailableProviders();
          
          if (freeProviders.length > 0) {
            logDebug(`[MultiAgentPipeline] Gemini quota exceeded, trying ${freeProviders.length} free fallback providers...`);
            console.log(`[MultiAgentPipeline] Gemini quota exceeded. Attempting free AI fallback (${freeProviders.map(p => p.name).join(', ')})...`);
            
            try {
              // Convert Gemini messages to standard format for free AI providers
              const standardMessages = messages.map((msg, index) => {
                const content = msg.parts.map(p => p.text || '').join('\n');
                // First message is often the system prompt
                if (index === 0 && msg.role === 'user') {
                  return { role: 'system' as const, content };
                }
                return {
                  role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
                  content
                };
              });
              
              const fallbackResult = await callFreeAIWithFallback(standardMessages, {
                temperature: stage.agent.temperature,
                maxTokens: 4096
              });
              
              stage.agent.model = `fallback:${fallbackResult.provider}`;
              stage.output = fallbackResult.response;
              stage.status = 'completed';
              stage.endTime = new Date();
              
              const duration = stage.endTime.getTime() - stage.startTime.getTime();
              pipelineMonitor.recordMetric('multi_agent_stage_duration', duration, 'ms', metricTags);
              pipelineMonitor.recordMetric('multi_agent_stage_fallback_success', 1, 'count', {
                ...metricTags,
                fallbackProvider: fallbackResult.provider
              });
              
              logDebug(`[MultiAgentPipeline] ${stage.name} completed via fallback: ${fallbackResult.provider}`);
              console.log(`[MultiAgentPipeline] ✓ Stage completed using free fallback: ${fallbackResult.provider}`);
              
              if (onProgress) {
                onProgress(stage);
              }
              return; // Success via fallback
            } catch (fallbackError) {
              console.warn('[MultiAgentPipeline] Free AI fallback also failed:', fallbackError);
              // Continue to throw the original quota error with fallback info
              const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
              const quotaErrorMessage =
                'Gemini API quota exceeded and free AI fallbacks also failed.\n\n' +
                'To fix this:\n' +
                '1. Wait for Gemini quota to reset (check https://ai.dev/usage?tab=rate-limit)\n' +
                '2. Or add a free API key in Settings for: Groq, Together AI, or OpenRouter\n\n' +
                `Fallback error: ${fallbackErrorMsg}`;
              throw new Error(quotaErrorMessage);
            }
          } else {
            // No fallback providers configured
            const quotaErrorMessage =
              'Gemini API quota exceeded for all configured models.\n\n' +
              'To continue working:\n' +
              '1. Wait for quota to reset (check https://ai.dev/usage?tab=rate-limit)\n' +
              '2. Or add a FREE API key in Settings for one of:\n' +
              '   - Groq (https://console.groq.com/keys) - Recommended, fastest\n' +
              '   - Together AI (https://api.together.xyz/settings/api-keys)\n' +
              '   - OpenRouter (https://openrouter.ai/keys) - Has free models';
            throw new Error(quotaErrorMessage);
          }
        }
        throw lastError || new Error('Gemini call failed without response.');
      }

      logDebug(`[MultiAgentPipeline] ${stage.name} completed`);

      if (onProgress) {
        onProgress(stage);
      }

    } catch (error: any) {
      stage.status = 'failed';
      stage.error = error?.message ?? String(error);
      stage.endTime = new Date();
      const normalizedStageError = normalizeError(error);
      const duration = stage.endTime.getTime() - (stage.startTime?.getTime() ?? stage.endTime.getTime());
      pipelineMonitor.recordMetric('multi_agent_stage_duration', duration, 'ms', metricTags);
      pipelineMonitor.recordMetric('multi_agent_stage_failures', 1, 'count', metricTags);
      trackPerformance(`multi_agent_stage_${stage.id}_failure`, duration, {
        runId: context?.runId,
        stageId: stage.id,
        stageName: stage.name,
        attempt: attemptNumber
      });
      trackError('multi_agent_stage_failure', normalizedStageError, {
        runId: context?.runId,
        stageId: stage.id,
        stageName: stage.name,
        attempt: attemptNumber
      });
      trackAIInteraction('multi_agent_stage_failure', stage.agent.model, {
        runId: context?.runId,
        stageId: stage.id,
        stageName: stage.name,
        attempt: attemptNumber,
        duration,
        error: normalizedStageError.message
      });
      
      console.error(`[MultiAgentPipeline] ${stage.name} failed:`, error);
      
      if (onProgress) {
        onProgress(stage);
      }
      
      throw error;
    }
  }
  
  /**
   * Extract quality score from validator output
   */
  private extractQualityScore(output: string): number {
    const match = output.match(/quality score[:\s]+(\d+)/i);
    return match ? parseInt(match[1], 10) : 75;
  }
  
  /**
   * Update agent configuration
   */
  public updateAgent(agentKey: string, config: Partial<AgentConfig>): void {
    if (this.agents[agentKey]) {
      this.agents[agentKey] = {
        ...this.agents[agentKey],
        ...config,
        model: normalizeModel(config.model ?? this.agents[agentKey].model)
      };
    }
  }

  /**
   * Replace entire agent configuration (used when loading from persistence)
   */
  public setAgent(agentKey: string, config: AgentConfig): void {
    this.agents[agentKey] = { ...config, model: normalizeModel(config.model) };
  }

  /**
   * Apply persisted configurations from database
   */
  public applyPersistedConfigs(configs: PersistedAgentConfig[]): void {
    configs.forEach((record) => {
      const { agentKey, ...rest } = record;
      const existing = this.agents[agentKey];
      if (!existing) {
        return;
      }

      this.agents[agentKey] = {
        ...existing,
        ...rest,
        model: normalizeModel(rest.model || existing.model),
        maxRetries: typeof rest.maxRetries === 'number' ? rest.maxRetries : existing.maxRetries
      };
    });
  }
  
  /**
   * Get agent configuration
   */
  public getAgent(agentKey: string): AgentConfig | undefined {
    return this.agents[agentKey];
  }
  
  /**
   * Get all agent configurations
   */
  public getAllAgents(): Record<string, AgentConfig> {
    return { ...this.agents };
  }

  private createTranscript(stage: PipelineStage, attempt?: number): StageTranscript {
    return {
      stageId: stage.id,
      stageName: stage.name,
      attempt,
      model: stage.agent.model,
      input: truncateTranscriptContent(stage.input),
      output: truncateTranscriptContent(stage.output),
      startedAt: stage.startTime?.toISOString(),
      endedAt: stage.endTime?.toISOString()
    };
  }

  private composeIssueSummary(snapshot: IssueRegistrySnapshot): string {
    const { sources, combinedIssues } = snapshot;
    const lines: string[] = [];

    if (sources['project-analyzer']) {
      const analysis = sources['project-analyzer'];
      lines.push(`Project Analyzer found ${analysis.issuesFound} issues across ${analysis.totalFiles} files.`);
      lines.push(
        `Breakdown -> TODO: ${analysis.categories.todos}, Placeholders: ${analysis.categories.placeholders}, Mocks: ${analysis.categories.mocks}, Incomplete: ${analysis.categories.incomplete}, Dependencies: ${analysis.categories.dependencies}, Features: ${analysis.categories.features}`
      );
    } else {
      lines.push('No Project Analyzer results available.');
    }

    const firstTen = Array.from(combinedIssues.entries()).slice(0, 10);
    if (firstTen.length > 0) {
      lines.push('Sample outstanding issues:');
      firstTen.forEach(([key, issues]) => {
        const [file, line] = key.split('#');
        const messages = issues.map((issue) => issue.message).join(' | ');
        lines.push(`- ${file}:${line} -> ${messages}`);
      });
      if (combinedIssues.size > firstTen.length) {
        lines.push(`... plus ${combinedIssues.size - firstTen.length} additional issue locations.`);
      }
    }

    return lines.join('\n');
  }

  private transformIssueSnapshot(snapshot: IssueRegistrySnapshot): IssueRegistryReport | undefined {
    if (!snapshot) {
      return undefined;
    }

    const combined = Array.from(snapshot.combinedIssues.entries()).map(([key, issues]) => {
      const [file, lineStr] = key.split('#');
      return {
        file,
        line: Number(lineStr) || 0,
        issues
      };
    });

    return {
      projectAnalyzer: snapshot.sources['project-analyzer'],
      combinedIssues: combined,
      lastUpdated: snapshot.lastUpdated
    };
  }

  private extractMissingFeatures(snapshot: IssueRegistrySnapshot): string[] {
    if (!snapshot) {
      return [];
    }

    const features = new Set<string>();
    const pushFeature = (value?: string) => {
      const trimmed = value?.trim();
      if (trimmed) {
        features.add(trimmed);
      }
    };

    const analyzer = snapshot.sources['project-analyzer'];
    if (analyzer) {
      analyzer.missingFeatures?.forEach(pushFeature);

      analyzer.issues
        ?.filter((issue) => issue.type === 'feature')
        .forEach((issue) => {
          pushFeature(issue.message);
          pushFeature(issue.suggestion);
          if (!issue.message && !issue.suggestion) {
            pushFeature(
              issue.codeSnippet
                ? `Feature gap: ${issue.codeSnippet}`
                : `Feature gap detected in ${issue.file}:${issue.line}`,
            );
          }
        });

      const outstandingFeatures = analyzer.categories?.features ?? 0;
      if (outstandingFeatures > 0 && features.size < outstandingFeatures) {
        pushFeature(
          `[Analyzer] ${outstandingFeatures} unresolved feature flag${
            outstandingFeatures === 1 ? '' : 's'
          } remain in the project analysis report.`,
        );
      }
    }

    Object.values(snapshot.sources).forEach((source) => {
      if (!source || source === analyzer) {
        return;
      }
      source.missingFeatures?.forEach(pushFeature);
      source.issues
        ?.filter((issue) => issue.type === 'feature')
        .forEach((issue) => {
          pushFeature(issue.message || issue.suggestion || issue.codeSnippet);
        });
    });

    snapshot.combinedIssues.forEach((issues, key) => {
      issues.forEach((issue) => {
        if (issue.type === 'feature') {
          const detail =
            issue.message ||
            issue.suggestion ||
            issue.codeSnippet ||
            `Feature gap flagged at ${key.replace('#', ':')}`;
          pushFeature(detail);
        }
      });
    });

    return Array.from(features).sort((a, b) => a.localeCompare(b));
  }

  private extractImprovementRecommendations(
    attempts: QualityAttemptReport[],
    validatorOutput: string,
    analysisSummary: string,
    snapshot: IssueRegistrySnapshot
  ): string[] {
    const recommendations = new Set<string>();

    const captureLines = (text: string | undefined, predicate?: (line: string) => boolean) => {
      if (!text) {
        return;
      }
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => (predicate ? predicate(line) : true))
        .forEach((line) => recommendations.add(line));
    };

    attempts.forEach((attempt) => {
      captureLines(attempt.reviewerFeedback, (line) => /^(APPROVE|REJECT)/i.test(line) === false);
    });

    captureLines(validatorOutput, (line) => /\b(pass|quality score)/i.test(line) === false);

    captureLines(analysisSummary, (line) => line.startsWith('-') || line.startsWith('*'));

    snapshot.combinedIssues.forEach((issues) => {
      issues.forEach((issue) => {
        if (issue.suggestion) {
          recommendations.add(issue.suggestion.trim());
        }
      });
    });

    return Array.from(recommendations).slice(0, 50);
  }
}

// Singleton instance
let pipelineInstance: MultiAgentPipeline | null = null;

/**
 * Get multi-agent pipeline instance
 */
export function getMultiAgentPipeline(): MultiAgentPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new MultiAgentPipeline();
  }
  return pipelineInstance;
}
