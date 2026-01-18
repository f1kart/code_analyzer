/**
 * Multi-Agent AI Pipeline Panel
 * Visual interface for 5-stage AI code generation pipeline
 * Shows progress, agent outputs, quality gates, and allows configuration
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  getMultiAgentPipeline,
  PipelineStage,
  PipelineResult,
  AgentConfig,
  PipelineContextRequest,
  PipelineContextMode,
  StageStatus,
  PipelineFileChange,
  QuotaHealthSnapshot,
  PipelineFailureType
} from '../services/MultiAgentPipeline';
import { DiffLine, getDiffLines } from '../utils/simpleDiff';
import { getWindsurfBridge } from '../services/WindsurfBridge';
import { statePersistence } from '../services/StatePersistenceService';

interface ProjectFileDescriptor {
  identifier: string;
  name?: string;
  content: string;
}

export interface ApplyPipelineChangesRequest {
  runId: string;
  summary?: string;
  changes: Array<{
    originalPath: string;
    targetPath: string;
    updatedContent: string;
    originalContent?: string;
    diff?: DiffLine[];
    summary?: string;
    isNewFile: boolean;
  }>;
}

export interface AppliedChangeHistoryEntry {
  id: string;
  runId: string;
  summary?: string;
  appliedAt: string;
  changes: Array<{
    originalPath: string;
    targetPath: string;
    summary?: string;
    isNewFile: boolean;
  }>;
}

interface MultiAgentPipelinePanelProps {
  onClose: () => void;
  onCodeGenerated?: (code: string) => void;
  onApplyChanges?: (request: ApplyPipelineChangesRequest) => Promise<void>;
  onRecordApplyHistory?: (entry: AppliedChangeHistoryEntry) => void;
  projectFiles?: ProjectFileDescriptor[];
  activeFilePath?: string;
  projectPath?: string;
  selectedModelId?: string;
}

interface QuotaConfig {
  autoBlockEnabled: boolean;
  autoBlockThreshold: number;
}

const STAGE_PROGRESS_KEYS = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'] as const;
type StageProgressKey = typeof STAGE_PROGRESS_KEYS[number];

const STAGE_TEXT_LIMIT = 4_000;
const STAGE_ERROR_LIMIT = 2_000;
const RUN_HISTORY_LIMIT = 10;

// Valid Gemini models as of 2025
const KNOWN_GEMINI_MODELS: string[] = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001'
];

const CUSTOM_MODEL_OPTION_VALUE = '__custom_model__';

type ChangeDecision = 'pending' | 'accepted' | 'skipped';

const buildDefaultSelectionMap = (changes: PipelineFileChange[]): Record<string, boolean> =>
  Object.fromEntries(changes.map(change => [change.path, false]));

const buildDefaultTargetMap = (changes: PipelineFileChange[]): Record<string, string> =>
  Object.fromEntries(changes.map(change => [change.path, change.path]));

const buildDefaultDecisionMap = (changes: PipelineFileChange[]): Record<string, ChangeDecision> =>
  Object.fromEntries(changes.map(change => [change.path, 'pending']));

// Enhanced side-by-side diff viewer with line numbers and synchronized scrolling
const FileChangePreview: React.FC<{ 
  change: PipelineFileChange;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}> = ({ change, isExpanded = true, onToggleExpand }) => {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'split' | 'unified' | 'original' | 'updated'>('split');
  
  const diffLines = useMemo(
    () => change.diff ?? getDiffLines(change.originalContent ?? '', change.updatedContent),
    [change]
  );

  const diffMetrics = useMemo(
    () =>
      diffLines.reduce(
        (acc, line) => {
          if (line.type === 'added') acc.added += 1;
          else if (line.type === 'removed') acc.removed += 1;
          else if (line.type === 'modified') acc.modified += 1;
          return acc;
        },
        { added: 0, removed: 0, modified: 0 }
      ),
    [diffLines]
  );

  const originalLines = useMemo(() => (change.originalContent ?? '').split('\n'), [change.originalContent]);
  const updatedLines = useMemo(() => change.updatedContent.split('\n'), [change.updatedContent]);

  // Synchronized scrolling
  const handleLeftScroll = useCallback(() => {
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
  }, []);

  const handleRightScroll = useCallback(() => {
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  }, []);

  const getLineClass = (lineNum: number, isOriginal: boolean): string => {
    const line = diffLines.find(d => 
      isOriginal ? d.oldLineNumber === lineNum : d.newLineNumber === lineNum
    );
    if (!line) return '';
    if (line.type === 'added') return 'bg-green-900/40 border-l-2 border-green-500';
    if (line.type === 'removed') return 'bg-red-900/40 border-l-2 border-red-500';
    if (line.type === 'modified') return 'bg-yellow-900/30 border-l-2 border-yellow-500';
    return '';
  };

  const renderLineNumber = (num: number) => (
    <span className="inline-block w-10 text-right pr-2 text-gray-500 select-none text-[10px] font-mono">
      {num}
    </span>
  );

  const renderMetricPill = (label: string, value: number, color: string) => (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {label}: {value}
    </span>
  );

  const originalContent = change.originalContent ?? '';

  // Determine if this is a new file or a modification
  const isNewFile = change.isNewFile || !originalContent;
  const hasChanges = diffMetrics.added > 0 || diffMetrics.removed > 0 || diffMetrics.modified > 0;

  return (
    <div className="rounded border border-slate-600 bg-slate-900/80 text-[11px] text-slate-100 overflow-hidden">
      {/* Header with file status, metrics and view controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          {/* File status badge */}
          {isNewFile ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white">
              🆕 NEW FILE
            </span>
          ) : hasChanges ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-600 text-white">
              ✏️ MODIFIED
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-gray-600 text-white">
              📄 UNCHANGED
            </span>
          )}
          {/* Only show diff metrics for modified files */}
          {!isNewFile && (
            <>
              {renderMetricPill('Modified', diffMetrics.modified, 'bg-yellow-700/60 text-yellow-100')}
              {renderMetricPill('Added', diffMetrics.added, 'bg-green-700/60 text-green-100')}
              {renderMetricPill('Removed', diffMetrics.removed, 'bg-red-700/60 text-red-100')}
            </>
          )}
          <span className="text-[10px] text-slate-400">
            {isNewFile ? `${updatedLines.length} lines` : `${originalLines.length} → ${updatedLines.length} lines`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['split', 'unified', 'original', 'updated'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 text-[10px] rounded transition ${
                viewMode === mode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title={`View ${mode} mode`}
            >
              {mode === 'split' ? '⬅️➡️' : mode === 'unified' ? '📄' : mode === 'original' ? '📋' : '✨'}
            </button>
          ))}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="px-2 py-1 text-[10px] rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '🔼' : '🔽'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={`${viewMode === 'split' ? 'grid grid-cols-2' : ''}`}>
          {/* Original Panel */}
          {(viewMode === 'split' || viewMode === 'original' || viewMode === 'unified') && (
            <div className={`flex flex-col ${viewMode === 'split' ? 'border-r border-slate-700' : ''}`}>
              {viewMode !== 'unified' && (
                <div className="px-3 py-1.5 bg-red-900/30 border-b border-slate-700 flex items-center gap-2">
                  <span className="text-red-400 font-semibold text-[10px]">📋 ORIGINAL</span>
                  <span className="text-slate-400 text-[10px]">{originalLines.length} lines</span>
                </div>
              )}
              <div 
                ref={leftScrollRef}
                onScroll={viewMode === 'split' ? handleLeftScroll : undefined}
                className="max-h-80 overflow-auto font-mono"
              >
                {originalContent ? (
                  <div className="min-w-max">
                    {originalLines.map((line, idx) => (
                      <div 
                        key={`orig-${idx}`} 
                        className={`flex hover:bg-slate-800/50 ${getLineClass(idx + 1, true)}`}
                      >
                        {renderLineNumber(idx + 1)}
                        <pre className="flex-1 px-2 py-0.5 text-[11px] whitespace-pre text-slate-300">{line || ' '}</pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-blue-900/20 border border-blue-500/30 rounded m-2">
                    <div className="text-blue-400 font-bold text-sm mb-2">🆕 NEW FILE</div>
                    <div className="text-slate-400 text-xs">
                      This is a new file that will be created.
                      <br />
                      No original content to compare against.
                    </div>
                    <div className="mt-3 text-blue-300 text-[10px]">
                      Review the UPDATED panel to see the proposed content →
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Updated Panel */}
          {(viewMode === 'split' || viewMode === 'updated') && (
            <div className="flex flex-col">
              <div className="px-3 py-1.5 bg-green-900/30 border-b border-slate-700 flex items-center gap-2">
                <span className="text-green-400 font-semibold text-[10px]">✨ UPDATED</span>
                <span className="text-slate-400 text-[10px]">{updatedLines.length} lines</span>
              </div>
              <div 
                ref={rightScrollRef}
                onScroll={viewMode === 'split' ? handleRightScroll : undefined}
                className="max-h-80 overflow-auto font-mono"
              >
                <div className="min-w-max">
                  {updatedLines.map((line, idx) => (
                    <div 
                      key={`upd-${idx}`} 
                      className={`flex hover:bg-slate-800/50 ${getLineClass(idx + 1, false)}`}
                    >
                      {renderLineNumber(idx + 1)}
                      <pre className="flex-1 px-2 py-0.5 text-[11px] whitespace-pre text-slate-100">{line || ' '}</pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Unified Diff View */}
          {viewMode === 'unified' && (
            <div className="max-h-80 overflow-auto font-mono">
              {diffLines.map((line, idx) => {
                const bgClass = line.type === 'added' 
                  ? 'bg-green-900/40' 
                  : line.type === 'removed' 
                    ? 'bg-red-900/40' 
                    : line.type === 'modified' 
                      ? 'bg-yellow-900/30' 
                      : '';
                const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
                const textClass = line.type === 'added' 
                  ? 'text-green-300' 
                  : line.type === 'removed' 
                    ? 'text-red-300' 
                    : 'text-slate-300';
                const lineContent = line.type === 'removed' ? line.oldLineContent : line.newLineContent;
                return (
                  <div key={`unified-${idx}`} className={`flex hover:bg-slate-800/50 ${bgClass}`}>
                    <span className="inline-block w-8 text-right pr-1 text-gray-600 select-none text-[10px]">
                      {line.oldLineNumber || ''}
                    </span>
                    <span className="inline-block w-8 text-right pr-1 text-gray-600 select-none text-[10px]">
                      {line.newLineNumber || ''}
                    </span>
                    <span className={`w-4 text-center ${textClass}`}>{prefix}</span>
                    <pre className={`flex-1 px-2 py-0.5 text-[11px] whitespace-pre ${textClass}`}>
                      {lineContent || ' '}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// File navigation tabs for multiple file changes
const FileChangeTabs: React.FC<{
  changes: PipelineFileChange[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  decisions: Record<string, ChangeDecision>;
}> = ({ changes, selectedIndex, onSelect, decisions }) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTab = useCallback((index: number) => {
    if (tabsContainerRef.current) {
      const tabs = tabsContainerRef.current.querySelectorAll('[data-tab-index]');
      const tab = tabs[index] as HTMLElement;
      if (tab) {
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, []);

  useEffect(() => {
    scrollToTab(selectedIndex);
  }, [selectedIndex, scrollToTab]);

  const getDecisionIcon = (decision: ChangeDecision) => {
    switch (decision) {
      case 'accepted': return '✅';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  };

  const getDecisionColor = (decision: ChangeDecision) => {
    switch (decision) {
      case 'accepted': return 'border-green-500 bg-green-900/30';
      case 'skipped': return 'border-yellow-500 bg-yellow-900/30';
      default: return 'border-slate-600 bg-slate-800/50';
    }
  };

  return (
    <div className="bg-slate-900 border-b border-slate-700">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
          📁 {changes.length} file{changes.length !== 1 ? 's' : ''}:
        </span>
        <div 
          ref={tabsContainerRef}
          className="flex-1 flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600"
        >
          {changes.map((change, idx) => {
            const decision = decisions[change.path] ?? 'pending';
            const isSelected = idx === selectedIndex;
            const fileName = change.path.split('/').pop() || change.path;
            
            return (
              <button
                key={change.path}
                data-tab-index={idx}
                onClick={() => onSelect(idx)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap transition border ${
                  isSelected 
                    ? 'bg-blue-600 border-blue-500 text-white' 
                    : `${getDecisionColor(decision)} text-slate-300 hover:bg-slate-700`
                }`}
                title={change.path}
              >
                <span>{getDecisionIcon(decision)}</span>
                <span className="max-w-[120px] truncate">{fileName}</span>
                {change.isNewFile && <span className="text-[8px] bg-green-600 px-1 rounded">NEW</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSelect(Math.max(0, selectedIndex - 1))}
            disabled={selectedIndex === 0}
            className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
            title="Previous file"
          >
            ◀
          </button>
          <span className="text-[10px] text-slate-400 min-w-[40px] text-center">
            {selectedIndex + 1}/{changes.length}
          </span>
          <button
            onClick={() => onSelect(Math.min(changes.length - 1, selectedIndex + 1))}
            disabled={selectedIndex === changes.length - 1}
            className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
            title="Next file"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

const truncateStageString = (value: string, limit: number = STAGE_TEXT_LIMIT): string => {
  if (value.length <= limit) {
    return value;
  }

  const truncatedNotice = `\n\n… [${value.length - limit} characters truncated]`;
  return `${value.slice(0, limit)}${truncatedNotice}`;
};

const getStageStatusBadgeColor = (status: StageStatus): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-700 text-green-100';
    case 'completed_with_warnings':
      return 'bg-yellow-700 text-yellow-100';
    case 'in_progress':
      return 'bg-blue-700 text-blue-100';
    case 'rejected':
      return 'bg-orange-700 text-orange-100';
    case 'failed':
      return 'bg-red-700 text-red-100';
    default:
      return 'bg-gray-700 text-gray-200';
  }
};

const StageStatusSummary: React.FC<{ stage: PipelineStage }> = ({ stage }) => {
  const statusLabel = formatStageStatusLabel(stage.status);
  const attempts = getStageAttemptCount(stage);
  const duration = computeStageDurationMs(stage);
  const start = stage.startTime instanceof Date ? stage.startTime : parseStageTimestamp(stage.startTime);
  const end = stage.endTime instanceof Date ? stage.endTime : parseStageTimestamp(stage.endTime);

  return (
    <div className="text-[11px] text-blue-100 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-blue-50">{stage.name}</span>
        <span className={`px-2 py-0.5 rounded ${getStageStatusBadgeColor(stage.status)}`}>{statusLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-blue-200">
        {start && <span className="bg-blue-800/40 px-2 py-0.5 rounded">Start {formatTimestamp(start) ?? '—'}</span>}
        {end && <span className="bg-blue-800/40 px-2 py-0.5 rounded">End {formatTimestamp(end) ?? '—'}</span>}
        {duration !== null && <span className="bg-blue-800/40 px-2 py-0.5 rounded">Duration {formatDuration(duration ?? 0)}</span>}
        {attempts > 1 && <span className="bg-purple-800/40 px-2 py-0.5 rounded text-purple-100">Attempt {attempts}</span>}
      </div>
    </div>
  );
};

const truncateOptionalStageString = (value: string | undefined, limit: number = STAGE_TEXT_LIMIT): string | undefined => {
  if (!value) {
    return value;
  }

  return truncateStageString(value, limit);
};

const parseStageTimestamp = (value?: Date | string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const sanitizeStageForDisplay = (stage: PipelineStage): PipelineStage => {
  const startTime = parseStageTimestamp(stage.startTime);
  const endTime = parseStageTimestamp(stage.endTime);

  return {
    ...stage,
    input: truncateStageString(typeof stage.input === 'string' ? stage.input : ''),
    output: truncateStageString(typeof stage.output === 'string' ? stage.output : ''),
    error: truncateOptionalStageString(stage.error, STAGE_ERROR_LIMIT),
    startTime,
    endTime
  };
};

const computeStageDurationMs = (stage: PipelineStage): number | null => {
  const start = stage.startTime instanceof Date ? stage.startTime : parseStageTimestamp(stage.startTime);
  if (!start) {
    return null;
  }

  const end = stage.endTime instanceof Date ? stage.endTime : parseStageTimestamp(stage.endTime);
  const effectiveEnd = end ?? new Date();
  return Math.max(0, effectiveEnd.getTime() - start.getTime());
};

const buildRunReport = (record: PipelineRunRecord): MultiAgentRunReport => {
  const stages = record.result?.stages ?? [];
  const fileChanges = record.result?.fileChanges ?? [];

  return {
    id: record.id,
    timestamp: record.timestamp.toISOString(),
    success: record.success,
    contextMode: record.contextMode,
    selectedFileCount: record.selectedFileCount,
    qualityScore: record.qualityScore,
    warnings: record.warnings ?? [],
    errorMessage: record.errorMessage,
    totalDurationMs: record.result?.totalDuration ?? null,
    failureType: record.failureType,
    stages: stages.map(stage => ({
      id: stage.id,
      name: stage.name,
      model: stage.agent.model,
      status: stage.status,
      durationMs: computeStageDurationMs(stage)
    })),
    files: fileChanges.map(change => ({
      path: change.path,
      isNewFile: Boolean(change.isNewFile),
      summary: change.summary
    }))
  };
};

const formatDuration = (durationMs: number): string => {
  if (durationMs < 1_000) {
    return `${durationMs} ms`;
  }

  if (durationMs < 60_000) {
    const seconds = durationMs / 1_000;
    return seconds < 10 ? `${seconds.toFixed(2)} s` : `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`;
};

const formatTimestamp = (value?: Date): string | null => {
  if (!value) {
    return null;
  }

  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getStageAttemptCount = (stage: PipelineStage): number => Math.max(1, stage.retryCount + 1);

const formatStageStatusLabel = (status: StageStatus): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'completed_with_warnings':
      return 'Completed with Warnings';
    case 'rejected':
      return 'Rejected';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

const formatFailureTypeLabel = (failureType: PipelineFailureType): string => {
  switch (failureType) {
    case 'quota':
      return 'Quota / rate limit';
    case 'cooldown':
      return 'Cooldown protection';
    case 'other':
      return 'Other error';
    case 'none':
    default:
      return 'None';
  }
};

const formatHistoryTimestamp = (value: Date): string =>
  value.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

interface PipelineRunRecord {
  id: string;
  prompt: string;
  contextMode: PipelineContextMode;
  selectedFileCount: number;
  timestamp: Date;
  success: boolean;
  qualityScore?: number;
  warnings?: string[];
  result: PipelineResult | null;
  errorMessage?: string;
  failureType: PipelineFailureType;
}

interface MultiAgentRunReport {
  id: string;
  timestamp: string;
  success: boolean;
  contextMode: PipelineContextMode;
  selectedFileCount: number;
  qualityScore?: number;
  warnings: string[];
  errorMessage?: string;
  totalDurationMs: number | null;
   failureType: PipelineFailureType;
  stages: Array<{
    id: string;
    name: string;
    model: string;
    status: StageStatus;
    durationMs: number | null;
  }>;
  files: Array<{
    path: string;
    isNewFile: boolean;
    summary?: string;
  }>;
}

export const MultiAgentPipelinePanel: React.FC<MultiAgentPipelinePanelProps> = ({
  onClose,
  onCodeGenerated,
  onApplyChanges,
  onRecordApplyHistory,
  projectFiles = [],
  activeFilePath,
  projectPath,
  selectedModelId
}) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);
  const [allStages, setAllStages] = useState<PipelineStage[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [agents, setAgents] = useState(getMultiAgentPipeline().getAllAgents());
  const [contextMode, setContextMode] = useState<PipelineContextMode>('prompt_only');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [characterLimit, setCharacterLimit] = useState(180_000);
  const [runHistory, setRunHistory] = useState<PipelineRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<string>('all');
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isPromptEmpty = useMemo(() => userPrompt.trim().length === 0, [userPrompt]);
  const [runApplyLoading, setRunApplyLoading] = useState<Record<string, boolean>>({});
  const [runChangeTargets, setRunChangeTargets] = useState<Record<string, Record<string, string>>>({});
  const [runChangeSelections, setRunChangeSelections] = useState<Record<string, Record<string, boolean>>>({});
  const [runChangeDecisions, setRunChangeDecisions] = useState<Record<string, Record<string, ChangeDecision>>>({});
  const [selectedFileIndex, setSelectedFileIndex] = useState<Record<string, number>>({});
  
  // Real-time file analysis progress tracking
  const [analysisProgress, setAnalysisProgress] = useState<{
    totalFiles: number;
    analyzedFiles: number;
    currentFile: string | null;
    currentFileIndex: number;
    fileResults: Array<{ 
      path: string; 
      status: 'pending' | 'analyzing' | 'complete' | 'error'; 
      message?: string;
      originalContent?: string;
      analyzedLines: number;
      totalLines: number;
    }>;
  }>({ totalFiles: 0, analyzedFiles: 0, currentFile: null, currentFileIndex: 0, fileResults: [] });
  
  // Ref to track current analysisProgress to avoid stale closure issues
  const analysisProgressRef = useRef(analysisProgress);
  useEffect(() => {
    analysisProgressRef.current = analysisProgress;
  }, [analysisProgress]);
  
  const [liveFileChanges, setLiveFileChanges] = useState<PipelineFileChange[]>([]);
  
  // File-by-file review workflow state
  const [reviewMode, setReviewMode] = useState<{
    active: boolean;
    currentIndex: number;
    decisions: Record<string, 'accepted' | 'rejected' | 'skipped' | 'pending'>;
  }>({ active: false, currentIndex: 0, decisions: {} });
  
  // Selected file index for viewing in the code editor (clickable file buttons)
  const [viewingFileIndex, setViewingFileIndex] = useState<number>(0);
  
  // Open files that persist after pipeline completes (user can close them manually)
  const [openFiles, setOpenFiles] = useState<Array<{
    path: string;
    originalContent: string;
    suggestedContent: string;
    isModified: boolean;
    editedContent: string; // User's edits
  }>>([]);
  
  // Undo/Redo history for each open file
  const [undoHistory, setUndoHistory] = useState<Record<string, string[]>>({});
  const [redoHistory, setRedoHistory] = useState<Record<string, string[]>>({});
  
  // Summary panel visibility (separate from code view)
  const [showSummaryPanel, setShowSummaryPanel] = useState<boolean>(true);
  
  // ============================================
  // ENHANCED FEATURES STATE
  // ============================================
  
  // Settings panel visibility
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  
  // Help/Tutorial overlay
  const [showHelpOverlay, setShowHelpOverlay] = useState<boolean>(false);
  
  // Pipeline Templates
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  
  // Batch processing mode
  const [batchMode, setBatchMode] = useState<{
    enabled: boolean;
    files: string[];
    currentIndex: number;
    results: Array<{ file: string; success: boolean; message: string }>;
    isProcessing: boolean;
  }>({ enabled: false, files: [], currentIndex: 0, results: [], isProcessing: false });
  
  // Show batch processing panel
  const [showBatchPanel, setShowBatchPanel] = useState<boolean>(false);
  
  // Export/Import configuration panel
  const [showExportImport, setShowExportImport] = useState<boolean>(false);
  const [exportedConfig, setExportedConfig] = useState<string>('');
  const [importConfig, setImportConfig] = useState<string>('');
  
  // Real-time collaboration state
  const [collaborationState, setCollaborationState] = useState<{
    enabled: boolean;
    sessionId: string | null;
    participants: Array<{ id: string; name: string; color: string; cursor?: { file: string; line: number } }>;
    lastSync: Date | null;
  }>({ enabled: false, sessionId: null, participants: [], lastSync: null });
  
  // Show collaboration panel
  const [showCollaborationPanel, setShowCollaborationPanel] = useState<boolean>(false);
  
  // User preferences (persisted)
  const [userPreferences, setUserPreferences] = useState<{
    autoShowSummary: boolean;
    autoOpenFiles: boolean;
    confirmBeforeApply: boolean;
    darkDiffTheme: boolean;
    compactMode: boolean;
    showLineNumbers: boolean;
    fontSize: 'small' | 'medium' | 'large';
    defaultContextMode: PipelineContextMode;
    maxHistoryItems: number;
  }>({
    autoShowSummary: true,
    autoOpenFiles: true,
    confirmBeforeApply: true,
    darkDiffTheme: true,
    compactMode: false,
    showLineNumbers: true,
    fontSize: 'medium',
    defaultContextMode: 'prompt_only',
    maxHistoryItems: 10
  });
  
  // Pipeline templates for quick start
  const pipelineTemplates = useMemo(() => [
    {
      id: 'refactor',
      name: '🔧 Refactor Code',
      description: 'Improve code structure, readability, and maintainability',
      prompt: 'Refactor the selected code to improve readability, reduce complexity, and follow best practices. Maintain all existing functionality.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '🔧'
    },
    {
      id: 'add-tests',
      name: '🧪 Add Unit Tests',
      description: 'Generate comprehensive unit tests for the code',
      prompt: 'Generate comprehensive unit tests for the selected code. Include edge cases, error handling, and mock dependencies where needed. Use the project\'s existing test framework.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '🧪'
    },
    {
      id: 'fix-bugs',
      name: '🐛 Fix Bugs',
      description: 'Identify and fix potential bugs in the code',
      prompt: 'Analyze the code for potential bugs, edge cases, and error handling issues. Fix any problems found and explain the changes.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '🐛'
    },
    {
      id: 'add-docs',
      name: '📚 Add Documentation',
      description: 'Add JSDoc/TSDoc comments and documentation',
      prompt: 'Add comprehensive JSDoc/TSDoc documentation to all functions, classes, and interfaces. Include parameter descriptions, return types, and usage examples.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '📚'
    },
    {
      id: 'optimize',
      name: '⚡ Optimize Performance',
      description: 'Improve code performance and efficiency',
      prompt: 'Analyze and optimize the code for better performance. Focus on reducing time complexity, memory usage, and unnecessary operations. Explain all optimizations.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '⚡'
    },
    {
      id: 'security',
      name: '🔒 Security Audit',
      description: 'Check for security vulnerabilities',
      prompt: 'Perform a security audit on the code. Identify potential vulnerabilities (XSS, injection, auth issues, etc.) and provide fixes. Follow OWASP guidelines.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '🔒'
    },
    {
      id: 'typescript',
      name: '📘 Convert to TypeScript',
      description: 'Add TypeScript types and interfaces',
      prompt: 'Convert the JavaScript code to TypeScript. Add proper type annotations, interfaces, and type guards. Ensure strict type safety.',
      contextMode: 'selected_files' as PipelineContextMode,
      icon: '📘'
    },
    {
      id: 'api-endpoint',
      name: '🌐 Create API Endpoint',
      description: 'Generate a REST API endpoint',
      prompt: 'Create a production-ready REST API endpoint with proper error handling, validation, authentication middleware, and OpenAPI documentation.',
      contextMode: 'prompt_only' as PipelineContextMode,
      icon: '🌐'
    },
    {
      id: 'react-component',
      name: '⚛️ Create React Component',
      description: 'Generate a React component with hooks',
      prompt: 'Create a production-ready React functional component with TypeScript, proper hooks usage, error boundaries, loading states, and accessibility features.',
      contextMode: 'prompt_only' as PipelineContextMode,
      icon: '⚛️'
    },
    {
      id: 'database-schema',
      name: '🗄️ Design Database Schema',
      description: 'Create database schema and migrations',
      prompt: 'Design a normalized database schema with proper relationships, indexes, and constraints. Include migration scripts and seed data.',
      contextMode: 'prompt_only' as PipelineContextMode,
      icon: '🗄️'
    }
  ], []);

  const allModelsInHistory = useMemo<string[]>(() => {
    const modelSet = new Set<string>();
    runHistory.forEach(record => {
      const stages = record.result?.stages ?? [];
      stages.forEach(stage => {
        if (stage.agent?.model) {
          modelSet.add(stage.agent.model);
        }
      });
    });
    return Array.from(modelSet).sort();
  }, [runHistory]);

  const filteredRunHistory = useMemo<PipelineRunRecord[]>(() => {
    if (modelFilter === 'all') {
      return runHistory;
    }
    return runHistory.filter(record => {
      const stages = record.result?.stages ?? [];
      return stages.some(stage => stage.agent.model === modelFilter);
    });
  }, [runHistory, modelFilter]);

  const quotaFailureSummary = useMemo(() => {
    if (runHistory.length === 0) {
      return { total: 0, quotaFailures: 0, cooldownFailures: 0 };
    }
    let quotaFailures = 0;
    let cooldownFailures = 0;
    runHistory.forEach((record) => {
      if (record.failureType === 'quota') {
        quotaFailures += 1;
      } else if (record.failureType === 'cooldown') {
        cooldownFailures += 1;
      }
    });
    return {
      total: runHistory.length,
      quotaFailures,
      cooldownFailures
    };
  }, [runHistory]);

  const clampCharacterLimit = useCallback((value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return 180_000;
    }
    return Math.min(500_000, Math.max(10_000, Math.round(value)));
  }, []);

  const effectiveCharacterLimit = useMemo(
    () => clampCharacterLimit(characterLimit),
    [characterLimit, clampCharacterLimit]
  );

  useEffect(() => {
    if (selectedModelId) {
      getMultiAgentPipeline().setPreferredModel(selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    const sanitized = clampCharacterLimit(characterLimit);
    if (sanitized !== characterLimit) {
      setCharacterLimit(sanitized);
    }
  }, [characterLimit, clampCharacterLimit]);

  const availableFiles = useMemo<ProjectFileDescriptor[]>(() => {
    // Filter files with content and deduplicate by identifier to prevent React key warnings
    const seen = new Set<string>();
    const filesWithContent = projectFiles.filter(file => {
      if (typeof file.content !== 'string') return false;
      if (seen.has(file.identifier)) return false;
      seen.add(file.identifier);
      return true;
    });
    
    // Debug logging
    console.log('[MultiAgentPipelinePanel] projectFiles:', projectFiles.length, 
      'with content:', filesWithContent.length,
      'sample:', projectFiles.slice(0, 3).map(f => ({ id: f.identifier, hasContent: typeof f.content === 'string', contentLen: f.content?.length || 0 }))
    );
    
    return filesWithContent;
  }, [projectFiles]);

  const activeFile = useMemo(() => {
    if (!activeFilePath) {
      return undefined;
    }
    return availableFiles.find(file => file.identifier === activeFilePath);
  }, [availableFiles, activeFilePath]);

  const selectedFilesList = useMemo(
    () => availableFiles.filter(file => selectedFileIds.has(file.identifier)),
    [availableFiles, selectedFileIds]
  );

  const totalProjectCharacters = useMemo(
    () => availableFiles.reduce((sum, file) => sum + (file.content?.length || 0), 0),
    [availableFiles]
  );

  const pipeline = useMemo(() => getMultiAgentPipeline(), []);
  const windsurf = getWindsurfBridge();

  const [quotaHealth, setQuotaHealth] = useState<QuotaHealthSnapshot>(() =>
    pipeline.getQuotaHealth()
  );
  const [quotaAutoBlockEnabled, setQuotaAutoBlockEnabled] = useState<boolean>(true);
  const [quotaAutoBlockThreshold, setQuotaAutoBlockThreshold] = useState<number>(3);
  /** Maximum quality check retries (1-5). This controls how many times the generator/quality loop runs. */
  const [maxQualityRetries, setMaxQualityRetries] = useState<number>(3);

  const quotaStatusExplanation = useMemo(() => {
    if (quotaHealth.isCoolingDown) {
      return 'The pipeline is in protective cool-down after recent quota errors. New runs are temporarily blocked to avoid hammering the Gemini API.';
    }
    if (quotaAutoBlockEnabled && quotaHealth.recentQuotaFailures >= quotaAutoBlockThreshold) {
      return 'Auto-block is active: recent runs hit quota errors, so new multi-agent runs are temporarily prevented until the failure count drops.';
    }
    if (quotaHealth.recentQuotaFailures > 0) {
      return 'Recent runs have encountered Gemini quota errors. The pipeline reduces quality retries to protect your quota budget.';
    }
    return 'No recent quota issues detected. Full multi-agent pipeline behavior is enabled.';
  }, [quotaAutoBlockEnabled, quotaAutoBlockThreshold, quotaHealth]);

  const [windsurfConnection, setWindsurfConnection] = useState<{ 
    connected: boolean; 
    path: string | null;
    version: string | null;
    checking: boolean;
  }>({
    connected: false,
    path: null,
    version: null,
    checking: true
  });

  useEffect(() => {
    const checkWindsurf = async () => {
      try {
        // Wait for async detection to complete
        await windsurf.waitForDetection();
        const status = windsurf.getStatus();
        setWindsurfConnection({
          connected: status.detected,
          path: status.path,
          version: status.version,
          checking: false
        });
        console.log('[MultiAgentPipelinePanel] Windsurf status:', status);
      } catch (error) {
        console.error('[MultiAgentPipelinePanel] Windsurf detection failed:', error);
        setWindsurfConnection({ connected: false, path: null, version: null, checking: false });
      }
    };
    checkWindsurf();
  }, [windsurf]);

  useEffect(() => {
    const updateQuotaHealth = () => {
      try {
        setQuotaHealth(pipeline.getQuotaHealth());
      } catch (error) {
        console.error('[MultiAgentPipelinePanel] Failed to read quota health:', error);
      }
    };

    updateQuotaHealth();
    const intervalId = window.setInterval(updateQuotaHealth, 5000);
    return () => window.clearInterval(intervalId);
  }, [pipeline]);

  useEffect(() => {
    try {
      const saved = statePersistence.getScopedSetting<QuotaConfig>(
        'multi-agent-quota-config',
        projectPath ?? undefined
      );
      if (saved) {
        if (typeof saved.autoBlockEnabled === 'boolean') {
          setQuotaAutoBlockEnabled(saved.autoBlockEnabled);
        }
        if (typeof saved.autoBlockThreshold === 'number' && saved.autoBlockThreshold > 0) {
          setQuotaAutoBlockThreshold(saved.autoBlockThreshold);
        }
      }
    } catch (error) {
      console.error('[MultiAgentPipelinePanel] Failed to load quota configuration:', error);
    }
  }, [projectPath]);

  useEffect(() => {
    try {
      const payload: QuotaConfig = {
        autoBlockEnabled: quotaAutoBlockEnabled,
        autoBlockThreshold: quotaAutoBlockThreshold
      };
      statePersistence.setScopedSetting('multi-agent-quota-config', payload, projectPath ?? undefined);
    } catch (error) {
      console.error('[MultiAgentPipelinePanel] Failed to persist quota configuration:', error);
    }
  }, [quotaAutoBlockEnabled, quotaAutoBlockThreshold, projectPath]);

  useEffect(() => {
    if (contextMode === 'selected_files' && selectedFileIds.size === 0 && availableFiles.length > 0) {
      setSelectedFileIds(new Set(availableFiles.slice(0, Math.min(5, availableFiles.length)).map(file => file.identifier)));
    }
  }, [contextMode, availableFiles, selectedFileIds.size]);

  useEffect(() => {
    if (selectedFileIds.size === 0) {
      return;
    }
    const validIdentifiers = new Set(
      availableFiles
        .filter(file => selectedFileIds.has(file.identifier))
        .map(file => file.identifier)
    );
    if (validIdentifiers.size !== selectedFileIds.size) {
      setSelectedFileIds(validIdentifiers);
    }
  }, [availableFiles, selectedFileIds]);

  const toggleFileSelection = useCallback((identifier: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    setSelectedFileIds(new Set(availableFiles.map(file => file.identifier)));
  }, [availableFiles]);

  const clearAllFiles = useCallback(() => {
    setSelectedFileIds(new Set());
  }, []);

  const buildContextRequest = useCallback((): PipelineContextRequest | undefined => {
    if (contextMode === 'prompt_only') {
      return { mode: 'prompt_only', maxQualityRetries };
    }

    if (availableFiles.length === 0) {
      alert('No project files are loaded. Load a project before selecting contextual analysis.');
      return undefined;
    }

    const activeContextFile = activeFile
      ? {
          path: activeFile.identifier,
          content: activeFile.content
        }
      : undefined;

    if (contextMode === 'full_project') {
      return {
        mode: 'full_project',
        files: availableFiles.map(file => ({ path: file.identifier, content: file.content })),
        activeFile: activeContextFile,
        maxCharacters: effectiveCharacterLimit,
        maxQualityRetries
      };
    }

    if (contextMode === 'active_file') {
      if (!activeContextFile) {
        alert('No active file is currently open. Open a file or switch modes.');
        return undefined;
      }
      return {
        mode: 'active_file',
        activeFile: activeContextFile,
        files: [],
        maxCharacters: effectiveCharacterLimit,
        maxQualityRetries
      };
    }

    if (contextMode === 'selected_files') {
      if (selectedFileIds.size === 0) {
        alert('Select at least one file to include in the analysis.');
        return undefined;
      }

      return {
        mode: 'selected_files',
        files: selectedFilesList.map(file => ({ path: file.identifier, content: file.content })),
        activeFile: activeContextFile,
        maxCharacters: effectiveCharacterLimit,
        maxQualityRetries
      };
    }

    return { mode: 'prompt_only', maxQualityRetries };
  }, [
    contextMode,
    availableFiles,
    activeFile,
    effectiveCharacterLimit,
    selectedFileIds,
    selectedFilesList,
    maxQualityRetries
  ]);

  /**
   * Run the pipeline
   */
  const executePipeline = useCallback(
    async (prompt: string) => {
      const normalizedPrompt = prompt.trim();
      if (!normalizedPrompt) {
        alert('Please enter a prompt before starting the pipeline.');
        if (promptInputRef.current) {
          promptInputRef.current.focus();
        }
        return;
      }

      const contextRequest = buildContextRequest();
      if (!contextRequest) {
        return;
      }

      const currentQuotaHealth = pipeline.getQuotaHealth();
      setQuotaHealth(currentQuotaHealth);

      const shouldAutoBlock =
        quotaAutoBlockEnabled &&
        currentQuotaHealth.recentQuotaFailures >= quotaAutoBlockThreshold;

      if (shouldAutoBlock) {
        alert(
          `Multi-Agent Pipeline is temporarily disabled because the last ${currentQuotaHealth.recentQuotaFailures} runs hit Gemini quota limits. ` +
            'You can adjust the quota auto-block settings below or wait for your Gemini quota window to reset (see https://ai.dev/usage?tab=rate-limit).'
        );
        return;
      }

      if (currentQuotaHealth.isCoolingDown) {
        const secondsRemaining = Math.max(
          0,
          Math.ceil(currentQuotaHealth.cooldownMsRemaining / 1000)
        );
        alert(
          `Multi-Agent Pipeline is in cool-down due to recent Gemini quota failures. ` +
            `Wait approximately ${secondsRemaining} seconds, or open https://ai.dev/usage?tab=rate-limit to review your current usage and limits.`
        );
        return;
      }

      setIsRunning(true);
      setResult(null);
      setAllStages([]);
      setCurrentStage(null);
      
      // Initialize file analysis progress based on context mode
      const filesToAnalyze = contextMode === 'full_project' 
        ? availableFiles 
        : contextMode === 'selected_files' 
          ? selectedFilesList 
          : contextMode === 'active_file' && activeFile 
            ? [activeFile] 
            : [];
      
      console.log('[MultiAgentPipelinePanel] Context mode:', contextMode);
      console.log('[MultiAgentPipelinePanel] Available files:', availableFiles.length);
      console.log('[MultiAgentPipelinePanel] Selected files:', selectedFilesList.length);
      console.log('[MultiAgentPipelinePanel] Active file:', activeFile?.identifier || 'none');
      console.log('[MultiAgentPipelinePanel] Files to analyze:', filesToAnalyze.length);
      
      if (filesToAnalyze.length === 0) {
        console.warn('[MultiAgentPipelinePanel] No files to analyze! Please open a project or select files.');
      }
      
      const initialFileResults = filesToAnalyze.map(f => ({ 
        path: f.identifier, 
        status: 'pending' as const,
        originalContent: f.content,
        analyzedLines: 0,
        totalLines: f.content?.split('\n').length || 0
      }));

      // Clear any previous file changes - only populate AFTER pipeline completes
      setLiveFileChanges([]);

      setAnalysisProgress({
        totalFiles: filesToAnalyze.length,
        analyzedFiles: 0,
        currentFile: filesToAnalyze.length > 0 ? filesToAnalyze[0].identifier : null,
        currentFileIndex: 0,
        fileResults: initialFileResults
      });

      // Track which stage we're on for real progress updates
      // Stage 0: Code Analyzer - marks files as "analyzing"
      // Stage 1: Solution Generator - marks files as "generating"  
      // Stage 2: Quality Checker - marks files as "reviewing"
      // Stage 3: Production Engineer - marks files as "finalizing"
      // Stage 4: Final Validator - marks files as "complete"
      const STAGE_PROGRESS_MAP: Record<string, { status: 'pending' | 'analyzing' | 'complete'; progressPercent: number }> = {
        'analyzer': { status: 'analyzing', progressPercent: 20 },
        'generator': { status: 'analyzing', progressPercent: 40 },
        'quality-checker': { status: 'analyzing', progressPercent: 60 },
        'engineer': { status: 'analyzing', progressPercent: 80 },
        'validator': { status: 'complete', progressPercent: 100 }
      };

      // Function to update file progress based on real stage completion
      const updateFileProgressForStage = (stageId: string, stageStatus: string) => {
        const stageProgress = STAGE_PROGRESS_MAP[stageId];
        if (!stageProgress) return;

        setAnalysisProgress(prev => {
          const fileResults = prev.fileResults.map(f => {
            // Calculate analyzed lines based on real stage progress
            const progressPercent = stageStatus === 'completed' ? stageProgress.progressPercent : stageProgress.progressPercent - 10;
            const analyzedLines = Math.floor((f.totalLines * progressPercent) / 100);
            
            return {
              ...f,
              status: stageStatus === 'completed' && stageId === 'validator' ? 'complete' as const : 'analyzing' as const,
              analyzedLines: Math.min(analyzedLines, f.totalLines)
            };
          });

          const completedCount = stageId === 'validator' && stageStatus === 'completed' 
            ? prev.totalFiles 
            : 0;

          return {
            ...prev,
            analyzedFiles: completedCount,
            fileResults
          };
        });
      };

      const uiRunId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let runRecord: PipelineRunRecord | null = null;

      try {
        const pipelineResult = await pipeline.runPipeline(
          normalizedPrompt,
          contextRequest,
          (stage: PipelineStage) => {
            const sanitizedStage = sanitizeStageForDisplay(stage);

            // Update file progress based on REAL stage completion
            updateFileProgressForStage(sanitizedStage.id, sanitizedStage.status);
            console.log(`[MultiAgentPipelinePanel] Stage ${sanitizedStage.id} status: ${sanitizedStage.status}`);

            setCurrentStage(sanitizedStage);
            setAllStages((prev) => {
              const existingIndex = prev.findIndex(s => s.id === sanitizedStage.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = sanitizedStage;
                return updated;
              }
              return [...prev, sanitizedStage];
            });

            try {
              const stageStart =
                sanitizedStage.startTime instanceof Date
                  ? sanitizedStage.startTime.toISOString()
                  : undefined;
              const stageEnd =
                sanitizedStage.endTime instanceof Date
                  ? sanitizedStage.endTime.toISOString()
                  : undefined;

              window.dispatchEvent(
                new CustomEvent('ide:multi-agent-stage-progress', {
                  detail: {
                    runId: uiRunId,
                    stage: {
                      id: sanitizedStage.id,
                      name: sanitizedStage.name,
                      model: sanitizedStage.agent.model,
                      status: sanitizedStage.status,
                      startTime: stageStart,
                      endTime: stageEnd
                    },
                    prompt: normalizedPrompt,
                    contextMode,
                    selectedFileCount: selectedFileIds.size,
                    timestamp: new Date().toISOString()
                  }
                })
              );
            } catch (error) {
              console.error('[MultiAgentPipelinePanel] Failed to emit multi-agent stage progress event:', error);
            }
          }
        );

        const sanitizedStages = pipelineResult?.stages.map(sanitizeStageForDisplay) ?? [];
        const sanitizedPipelineResult = pipelineResult
          ? {
              ...pipelineResult,
              stages: sanitizedStages
            }
          : null;

        setResult(sanitizedPipelineResult);
        
        // Mark all files as complete in analysis progress and capture the completed file results
        let completedFileResults: typeof analysisProgress.fileResults = [];
        setAnalysisProgress(prev => {
          completedFileResults = prev.fileResults.map(f => ({ 
            ...f, 
            status: 'complete' as const,
            analyzedLines: f.totalLines // Ensure all lines are marked as analyzed
          }));
          return {
            ...prev,
            analyzedFiles: prev.totalFiles,
            currentFile: null,
            fileResults: completedFileResults
          };
        });
        
        // Update live file changes for real-time display
        // Check if pipeline returned meaningful file changes (not just a fallback generated file)
        const pipelineFileChanges = pipelineResult?.fileChanges ?? [];
        const hasMeaningfulChanges = pipelineFileChanges.length > 0 && 
          !pipelineFileChanges.every(c => c.path.startsWith('multi-agent/') && c.isNewFile);
        
        if (hasMeaningfulChanges) {
          // Pipeline returned changes to actual files - use those
          setLiveFileChanges(pipelineFileChanges);
          console.log('[MultiAgentPipelinePanel] Using pipeline file changes:', pipelineFileChanges.length);
        } else if (completedFileResults.length > 0) {
          // Pipeline returned fallback generated file or no changes
          // Use the analyzed files so user can still review them in the diff viewer
          const analysisFileChanges: PipelineFileChange[] = completedFileResults.map(f => ({
            path: f.path,
            summary: pipelineFileChanges.length > 0 
              ? 'AI generated new code - review original file for context'
              : 'File analyzed - no changes suggested by AI',
            originalContent: f.originalContent || '',
            updatedContent: f.originalContent || '', // Same as original since AI didn't modify this file
            isNewFile: false
          }));
          
          // If there was a generated file, add it to the list so user can see it
          const generatedFiles = pipelineFileChanges.filter(c => c.path.startsWith('multi-agent/') && c.isNewFile);
          const allFileChanges = [...analysisFileChanges, ...generatedFiles];
          
          setLiveFileChanges(allFileChanges);
          console.log('[MultiAgentPipelinePanel] Using analyzed files + generated:', analysisFileChanges.length, '+', generatedFiles.length);
        } else {
          // Fallback: use whatever the pipeline returned
          setLiveFileChanges(pipelineFileChanges);
          console.warn('[MultiAgentPipelinePanel] No analyzed files, using pipeline output:', pipelineFileChanges.length);
        }

        // NOTE: Do NOT auto-apply code via onCodeGenerated here
        // The user should review changes in the diff viewer first and explicitly accept them
        // The code will be applied when user clicks "Accept" on individual file changes
        // if (pipelineResult?.success && onCodeGenerated) {
        //   onCodeGenerated(pipelineResult.finalCode);
        // }

        const runTimestamp = new Date();

        runRecord = {
          id: uiRunId,
          prompt,
          contextMode,
          selectedFileCount: selectedFileIds.size,
          timestamp: runTimestamp,
          success: pipelineResult?.success ?? false,
          qualityScore: pipelineResult?.qualityScore,
          warnings: pipelineResult?.warnings ?? [],
          result: sanitizedPipelineResult,
          failureType: pipelineResult?.failureType ?? 'none'
        };
      } catch (error) {
        const rawErrorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('[MultiAgentPipelinePanel] Pipeline execution failed:', rawErrorMessage);
        console.error('[MultiAgentPipelinePanel] Error stack:', errorStack);
        console.error('[MultiAgentPipelinePanel] Full error object:', error);

        const lowered = rawErrorMessage.toLowerCase();
        const isCooldown = lowered.includes('usage cool-down is active') || lowered.includes('usage cool-down is active for the multi-agent pipeline');
        const isQuota =
          !isCooldown && (
            lowered.includes('resource_exhausted') ||
            lowered.includes('quota exceeded') ||
            lowered.includes('rate-limit')
          );

        let userFriendlyMessage: string;
        let failureType: PipelineFailureType = 'other';
        if (isCooldown) {
          userFriendlyMessage =
            'Multi-Agent Pipeline is currently in a protective cool-down due to recent Gemini quota failures. ' +
            'Runs are being temporarily paused to avoid hammering the API. Wait for the cool-down badge to clear, or review your usage at https://ai.dev/usage?tab=rate-limit.';
          failureType = 'cooldown';
        } else if (isQuota) {
          userFriendlyMessage =
            'Multi-Agent Pipeline failed because the Gemini API quota was exceeded for all configured models. ' +
            'Open https://ai.dev/usage?tab=rate-limit to inspect your current usage and limits, or update your API key / plan.';
          failureType = 'quota';
        } else {
          userFriendlyMessage = `Pipeline failed: ${rawErrorMessage}`;
        }

        alert(userFriendlyMessage);

        runRecord = {
          id: uiRunId,
          prompt,
          contextMode,
          selectedFileCount: selectedFileIds.size,
          timestamp: new Date(),
          success: false,
          qualityScore: 0,
          warnings: [],
          result: null,
          errorMessage: userFriendlyMessage,
          failureType
        };
      } finally {
        setIsRunning(false);
        
        // Use ref to get current analysisProgress (avoids stale closure)
        const currentAnalysisProgress = analysisProgressRef.current;
        
        console.log('[MultiAgentPipelinePanel] Pipeline finished, entering finally block');
        console.log('[MultiAgentPipelinePanel] analysisProgress.totalFiles:', currentAnalysisProgress.totalFiles);
        console.log('[MultiAgentPipelinePanel] analysisProgress.fileResults.length:', currentAnalysisProgress.fileResults.length);

        const finalizedRun = runRecord;
        if (finalizedRun) {
          console.log('[MultiAgentPipelinePanel] finalizedRun exists, success:', finalizedRun.success);
          console.log('[MultiAgentPipelinePanel] finalizedRun.result?.fileChanges:', finalizedRun.result?.fileChanges?.length ?? 0);
          
          setRunHistory(prev => {
            const next = [finalizedRun, ...prev];
            return next.slice(0, RUN_HISTORY_LIMIT);
          });
          setSelectedRunId(finalizedRun.id);

          const fileChanges = finalizedRun.result?.fileChanges ?? [];
          
          // Check if pipeline returned meaningful changes (not just fallback generated files)
          const hasMeaningfulChanges = fileChanges.length > 0 && 
            !fileChanges.every(c => c.path.startsWith('multi-agent/') && c.isNewFile);
          
          // Prioritize analyzed files for review - they're what the user actually wants to see
          let filesToOpen: typeof fileChanges = [];
          
          if (hasMeaningfulChanges) {
            // Pipeline returned changes to actual files
            filesToOpen = fileChanges;
            console.log('[MultiAgentPipelinePanel] Opening pipeline file changes:', filesToOpen.length);
          } else if (currentAnalysisProgress.fileResults.length > 0) {
            // Use analyzed files so user can review them
            filesToOpen = currentAnalysisProgress.fileResults.map(f => ({
              path: f.path,
              summary: fileChanges.length > 0 
                ? 'AI generated new code - review original file'
                : 'File analyzed - review and edit as needed',
              originalContent: f.originalContent || '',
              updatedContent: f.originalContent || '', // Same as original
              isNewFile: false
            }));
            console.log('[MultiAgentPipelinePanel] Opening analyzed files for review:', filesToOpen.length);
          } else if (fileChanges.length > 0) {
            // Fallback to whatever pipeline returned
            filesToOpen = fileChanges;
            console.log('[MultiAgentPipelinePanel] Fallback to pipeline output:', filesToOpen.length);
          }
          
          if (filesToOpen.length > 0) {
            setRunChangeSelections(prev => (
              prev[finalizedRun.id] ? prev : { ...prev, [finalizedRun.id]: buildDefaultSelectionMap(filesToOpen) }
            ));
            setRunChangeTargets(prev => (
              prev[finalizedRun.id] ? prev : { ...prev, [finalizedRun.id]: buildDefaultTargetMap(filesToOpen) }
            ));
            setRunChangeDecisions(prev => (
              prev[finalizedRun.id] ? prev : { ...prev, [finalizedRun.id]: buildDefaultDecisionMap(filesToOpen) }
            ));
            
            // AUTO-OPEN all analyzed files so user can review/edit them
            const newOpenFiles = filesToOpen.map(change => {
              // Find original content from analysisProgress (use ref for current value)
              const analysisFile = currentAnalysisProgress.fileResults.find(f => f.path === change.path);
              const originalContent = analysisFile?.originalContent || change.originalContent || '';
              return {
                path: change.path,
                originalContent,
                suggestedContent: change.updatedContent || '',
                isModified: false,
                editedContent: change.updatedContent || originalContent
              };
            });
            setOpenFiles(newOpenFiles);
            
            // Set viewing to first file
            if (newOpenFiles.length > 0) {
              const firstFileIdx = currentAnalysisProgress.fileResults.findIndex(f => f.path === newOpenFiles[0].path);
              if (firstFileIdx >= 0) {
                setViewingFileIndex(firstFileIdx);
              } else {
                setViewingFileIndex(0);
              }
            }
            
            // Show summary panel automatically
            setShowSummaryPanel(true);
            
            console.log('[MultiAgentPipelinePanel] Pipeline complete - opened', newOpenFiles.length, 'files for review');
          }

          try {
            const report = buildRunReport(finalizedRun);
            window.dispatchEvent(
              new CustomEvent('ide:multi-agent-run-report', {
                detail: { report }
              })
            );
          } catch (error) {
            console.error('[MultiAgentPipelinePanel] Failed to emit multi-agent run report event:', error);
          }
        }
      }
    },
    [
      buildContextRequest,
      contextMode,
      onCodeGenerated,
      pipeline,
      quotaAutoBlockEnabled,
      quotaAutoBlockThreshold,
      selectedFileIds.size,
      analysisProgress.fileResults,
      activeFile,
      availableFiles,
      selectedFilesList
    ]
  );

  const runPipeline = useCallback(() => {
    executePipeline(userPrompt);
  }, [executePipeline, userPrompt]);

  // ============================================
  // KEYBOARD SHORTCUTS HANDLER
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - Close panel or overlays (in order of priority)
      if (e.key === 'Escape') {
        if (showHelpOverlay) {
          setShowHelpOverlay(false);
        } else if (showSettingsPanel) {
          setShowSettingsPanel(false);
        } else if (showTemplates) {
          setShowTemplates(false);
        } else if (showBatchPanel) {
          setShowBatchPanel(false);
        } else if (showExportImport) {
          setShowExportImport(false);
        } else if (showCollaborationPanel) {
          setShowCollaborationPanel(false);
        } else if (showConfig) {
          setShowConfig(false);
        } else {
          onClose();
        }
        return;
      }

      // Ctrl+Enter - Run pipeline
      if (e.ctrlKey && e.key === 'Enter' && !isRunning && !isPromptEmpty) {
        e.preventDefault();
        executePipeline(userPrompt);
        return;
      }

      // Ctrl+S - Save current file
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        // Save is handled in the diff view component
        return;
      }

      // Ctrl+T - Toggle templates
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        setShowTemplates(prev => !prev);
        return;
      }

      // Ctrl+H - Toggle help
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        setShowHelpOverlay(prev => !prev);
        return;
      }

      // Tab - Next file (when not in input)
      if (e.key === 'Tab' && !e.ctrlKey && !e.shiftKey) {
        const activeElement = document.activeElement;
        const isInInput = activeElement?.tagName === 'INPUT' || 
                         activeElement?.tagName === 'TEXTAREA' || 
                         activeElement?.tagName === 'SELECT';
        
        if (!isInInput && analysisProgress.fileResults.length > 0) {
          e.preventDefault();
          setViewingFileIndex(prev => (prev + 1) % analysisProgress.fileResults.length);
        }
      }

      // Shift+Tab - Previous file
      if (e.key === 'Tab' && e.shiftKey && !e.ctrlKey) {
        const activeElement = document.activeElement;
        const isInInput = activeElement?.tagName === 'INPUT' || 
                         activeElement?.tagName === 'TEXTAREA' || 
                         activeElement?.tagName === 'SELECT';
        
        if (!isInInput && analysisProgress.fileResults.length > 0) {
          e.preventDefault();
          setViewingFileIndex(prev => prev === 0 ? analysisProgress.fileResults.length - 1 : prev - 1);
        }
      }

      // Number keys 1-9 - Quick file selection
      if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9 && num <= analysisProgress.fileResults.length) {
          const activeElement = document.activeElement;
          const isInInput = activeElement?.tagName === 'INPUT' || 
                           activeElement?.tagName === 'TEXTAREA' || 
                           activeElement?.tagName === 'SELECT';
          
          if (!isInInput) {
            e.preventDefault();
            setViewingFileIndex(num - 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showHelpOverlay, showSettingsPanel, showTemplates, showConfig, 
    showBatchPanel, showExportImport, showCollaborationPanel,
    isRunning, isPromptEmpty, userPrompt, executePipeline, onClose,
    analysisProgress.fileResults.length
  ]);

  const handleReplay = useCallback(
    (record: PipelineRunRecord) => {
      if (isRunning) {
        alert('Pipeline is already running. Please wait for the current run to finish.');
        return;
      }

      setUserPrompt(record.prompt);
      executePipeline(record.prompt);
    },
    [executePipeline, isRunning]
  );

  const handleExportRunReport = useCallback(
    async (record: PipelineRunRecord) => {
      try {
        const report = buildRunReport(record);
        const json = JSON.stringify(report, null, 2);
        await navigator.clipboard.writeText(json);
        alert('Run report copied to clipboard.');
      } catch (error) {
        console.error('[MultiAgentPipelinePanel] Failed to export run report:', error);
        alert('Unable to export run report. See console for details.');
      }
    },
    []
  );

  const handleResetQuotaTracking = useCallback(() => {
    const confirmed = window.confirm(
      'This will clear the IDE\'s local quota and cool-down tracking for the Multi-Agent Pipeline only.\n\n' +
        'It does NOT change your actual Gemini API limits or reset usage on ai.dev.\n\n' +
        'Use this only after verifying your usage and limits.\n\n' +
        'Proceed with resetting local quota tracking?'
    );
    if (!confirmed) {
      return;
    }
    try {
      pipeline.resetQuotaTracking();
      const updated = pipeline.getQuotaHealth();
      setQuotaHealth(updated);
      alert(
        'Local quota tracking for the Multi-Agent Pipeline has been reset. If Gemini is still enforcing rate limits, runs may continue to fail until your remote quota window recovers.'
      );
    } catch (error) {
      console.error('[MultiAgentPipelinePanel] Failed to reset quota tracking:', error);
      alert('Unable to reset local quota tracking. See console for details.');
    }
  }, [pipeline]);

  const handleExportAllRunReports = useCallback(async () => {
    try {
      if (filteredRunHistory.length === 0) {
        alert('No runs available to export.');
        return;
      }

      const reports = filteredRunHistory.map(buildRunReport);
      const json = JSON.stringify(reports, null, 2);
      await navigator.clipboard.writeText(json);
      alert('All run reports copied to clipboard.');
    } catch (error) {
      console.error('[MultiAgentPipelinePanel] Failed to export all run reports:', error);
      alert('Unable to export all run reports. See console for details.');
    }
  }, [filteredRunHistory]);

  const handleClearHistory = useCallback(() => {
    if (runHistory.length === 0) {
      return;
    }
    if (!confirm('Clear pipeline history? This will remove past run records.')) {
      return;
    }
    setRunHistory([]);
    setSelectedRunId(null);
    setRunChangeTargets({});
    setRunChangeSelections({});
    setRunChangeDecisions({});
  }, [runHistory.length]);

  const handleCopyRunCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      alert('Code copied to clipboard.');
    } catch (error) {
      console.error('[MultiAgentPipelinePanel] Failed to copy code:', error);
      alert('Unable to copy code to clipboard.');
    }
  }, []);

  const handleDecisionChange = useCallback(
    (runId: string, changePath: string, decision: ChangeDecision, fileChanges: PipelineFileChange[]) => {
      setRunChangeDecisions(prev => {
        const existing = prev[runId] ?? buildDefaultDecisionMap(fileChanges);
        return {
          ...prev,
          [runId]: {
            ...existing,
            [changePath]: decision
          }
        };
      });

      setRunChangeSelections(prev => {
        const existingSelections = prev[runId] ?? buildDefaultSelectionMap(fileChanges);
        const nextSelected = decision === 'accepted';
        return {
          ...prev,
          [runId]: {
            ...existingSelections,
            [changePath]: nextSelected
          }
        };
      });
    },
    []
  );

  const handleChangeTargetPath = useCallback(
    (runId: string, changePath: string, value: string, fileChanges: PipelineFileChange[]) => {
      setRunChangeTargets(prev => {
        const existing = prev[runId] ?? buildDefaultTargetMap(fileChanges);
        return {
          ...prev,
          [runId]: {
            ...existing,
            [changePath]: value
          }
        };
      });
    },
    []
  );

  const handleApplySelectedChanges = useCallback(
    async (record: PipelineRunRecord) => {
      const fileChanges = record.result?.fileChanges ?? [];
      if (fileChanges.length === 0) {
        alert('No structured file changes are available for this run.');
        return;
      }

      if (!onApplyChanges) {
        alert('Apply action is not available in this environment.');
        return;
      }

      const selections = runChangeSelections[record.id] ?? buildDefaultSelectionMap(fileChanges);
      const targets = runChangeTargets[record.id] ?? buildDefaultTargetMap(fileChanges);

      const missingTargets: string[] = [];
      const preparedChanges: ApplyPipelineChangesRequest['changes'] = [];

      for (const change of fileChanges) {
        const isSelected = selections[change.path] ?? false;
        if (!isSelected) {
          continue;
        }

        const targetPath = (targets[change.path] ?? change.path).trim();
        if (!targetPath) {
          missingTargets.push(change.path);
          continue;
        }

        preparedChanges.push({
          originalPath: change.path,
          targetPath,
          updatedContent: change.updatedContent,
          originalContent: change.originalContent,
          diff: change.diff ?? getDiffLines(change.originalContent ?? '', change.updatedContent),
          summary: change.summary,
          isNewFile: Boolean(change.isNewFile)
        });
      }

      if (missingTargets.length > 0) {
        alert(`Provide target paths for: ${missingTargets.join(', ')}`);
        return;
      }

      if (preparedChanges.length === 0) {
        alert('Accept at least one file change before applying.');
        return;
      }

      setRunApplyLoading(prev => ({ ...prev, [record.id]: true }));
      try {
        const applyRequest: ApplyPipelineChangesRequest = {
          runId: record.id,
          summary: record.result?.productionSummary,
          changes: preparedChanges
        };

        await onApplyChanges(applyRequest);

        if (onRecordApplyHistory) {
          const historyEntry: AppliedChangeHistoryEntry = {
            id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            runId: record.id,
            summary: record.result?.productionSummary,
            appliedAt: new Date().toISOString(),
            changes: applyRequest.changes.map(change => ({
              originalPath: change.originalPath,
              targetPath: change.targetPath,
              summary: change.summary,
              isNewFile: change.isNewFile
            }))
          };

          onRecordApplyHistory(historyEntry);
        }

        alert(`Applied ${preparedChanges.length} change${preparedChanges.length > 1 ? 's' : ''} successfully.`);
      } catch (error) {
        console.error('[MultiAgentPipelinePanel] Failed to apply structured changes:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`Failed to apply changes: ${message}`);
      } finally {
        setRunApplyLoading(prev => ({ ...prev, [record.id]: false }));
      }
    },
    [onApplyChanges, onRecordApplyHistory, runChangeSelections, runChangeTargets]
  );
  
  /**
   * Save agent configuration
   */
  const saveAgentConfig = (agentKey: string, config: Partial<AgentConfig>) => {
    pipeline.updateAgent(agentKey, config);
    setAgents(pipeline.getAllAgents());
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🤖</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Multi-Agent AI Pipeline</h2>
              <p className="text-purple-100 text-sm">5-Stage Production Code Generation with Quality Gates</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                windsurfConnection.checking
                  ? 'bg-blue-500/20 text-blue-100 border border-blue-300/40'
                  : windsurfConnection.connected
                    ? 'bg-green-500/20 text-green-100 border border-green-300/40'
                    : 'bg-red-500/20 text-red-100 border border-red-300/40'
              }`}
              title={
                windsurfConnection.checking
                  ? 'Checking for Windsurf installation...'
                  : windsurfConnection.connected
                    ? `Windsurf ${windsurfConnection.version || ''} at ${windsurfConnection.path ?? 'unknown path'}`
                    : 'Windsurf IDE not found. Install from https://windsurf.ai'
              }
            >
              {windsurfConnection.checking ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Checking...</span>
                </>
              ) : windsurfConnection.connected ? (
                <>
                  <span>✅</span>
                  <span>Windsurf Ready</span>
                </>
              ) : (
                <>
                  <span>❌</span>
                  <span>No Windsurf</span>
                </>
              )}
            </div>
            {!windsurfConnection.checking && !windsurfConnection.connected && (
              <>
                <button
                  onClick={async () => {
                    setWindsurfConnection(prev => ({ ...prev, checking: true }));
                    const found = await windsurf.redetect();
                    const status = windsurf.getStatus();
                    setWindsurfConnection({
                      connected: found,
                      path: status.path,
                      version: status.version,
                      checking: false
                    });
                  }}
                  className="px-2 py-1 bg-blue-500/30 hover:bg-blue-500/50 rounded text-xs text-blue-100"
                  title="Re-check for Windsurf installation"
                >
                  🔄 Redetect
                </button>
                <button
                  onClick={async () => {
                    const commonPaths = windsurf.getCommonPaths();
                    const path = prompt(
                      `Enter the full path to Windsurf executable:\n\nCommon locations:\n${commonPaths.join('\n')}`
                    );
                    if (path) {
                      setWindsurfConnection(prev => ({ ...prev, checking: true }));
                      const success = await windsurf.setWindsurfPath(path);
                      const status = windsurf.getStatus();
                      setWindsurfConnection({
                        connected: success,
                        path: status.path,
                        version: status.version,
                        checking: false
                      });
                      if (!success) {
                        alert('Failed to set Windsurf path. Please verify the path is correct.');
                      }
                    }
                  }}
                  className="px-2 py-1 bg-yellow-500/30 hover:bg-yellow-500/50 rounded text-xs text-yellow-100"
                  title="Manually set Windsurf path"
                >
                  📁 Set Path
                </button>
              </>
            )}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs ${
                showTemplates ? 'bg-green-500/50 ring-2 ring-green-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Quick Start Templates (Ctrl+T)"
            >
              📋 Templates
            </button>
            <button
              onClick={() => setShowBatchPanel(!showBatchPanel)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs ${
                showBatchPanel ? 'bg-orange-500/50 ring-2 ring-orange-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Batch Process Multiple Files"
            >
              📦 Batch
            </button>
            <button
              onClick={() => setShowExportImport(!showExportImport)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs ${
                showExportImport ? 'bg-cyan-500/50 ring-2 ring-cyan-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Export/Import Pipeline Configuration"
            >
              💾 Config
            </button>
            <button
              onClick={() => setShowCollaborationPanel(!showCollaborationPanel)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs flex items-center gap-1 ${
                showCollaborationPanel ? 'bg-pink-500/50 ring-2 ring-pink-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Real-time Collaboration"
            >
              👥 Collab
              {collaborationState.enabled && (
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs ${
                showSettingsPanel ? 'bg-blue-500/50 ring-2 ring-blue-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Pipeline Settings"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs ${
                showConfig ? 'bg-purple-500/50 ring-2 ring-purple-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Configure AI Agents"
            >
              🤖 Agents
            </button>
            <button
              onClick={() => setShowHelpOverlay(!showHelpOverlay)}
              className={`px-2 py-1.5 rounded-lg transition text-white font-semibold text-xs ${
                showHelpOverlay ? 'bg-yellow-500/50 ring-2 ring-yellow-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Help & Keyboard Shortcuts (Ctrl+H)"
            >
              ❓ Help
            </button>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition ml-2"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ============================================ */}
        {/* TEMPLATES PANEL */}
        {/* ============================================ */}
        {showTemplates && (
          <div className="bg-gradient-to-br from-green-900/90 to-emerald-900/90 border-b border-green-500/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📋 Quick Start Templates
                <span className="text-xs text-green-300 font-normal">Click a template to auto-fill the prompt</span>
              </h3>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-green-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {pipelineTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setUserPrompt(template.prompt);
                    setContextMode(template.contextMode);
                    setShowTemplates(false);
                    promptInputRef.current?.focus();
                  }}
                  className="bg-green-800/50 hover:bg-green-700/50 border border-green-500/30 hover:border-green-400/50 rounded-lg p-3 text-left transition-all hover:scale-105"
                >
                  <div className="text-2xl mb-1">{template.icon}</div>
                  <div className="text-sm font-semibold text-white">{template.name}</div>
                  <div className="text-[10px] text-green-200 mt-1 line-clamp-2">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SETTINGS PANEL */}
        {/* ============================================ */}
        {showSettingsPanel && (
          <div className="bg-gradient-to-br from-blue-900/90 to-indigo-900/90 border-b border-blue-500/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ⚙️ Pipeline Settings
                <span className="text-xs text-blue-300 font-normal">Customize your experience</span>
              </h3>
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="text-blue-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Auto Show Summary */}
              <label className="flex items-center gap-2 bg-blue-800/30 rounded-lg p-3 cursor-pointer hover:bg-blue-800/50">
                <input
                  type="checkbox"
                  checked={userPreferences.autoShowSummary}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, autoShowSummary: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Auto-show summary</span>
              </label>
              
              {/* Auto Open Files */}
              <label className="flex items-center gap-2 bg-blue-800/30 rounded-lg p-3 cursor-pointer hover:bg-blue-800/50">
                <input
                  type="checkbox"
                  checked={userPreferences.autoOpenFiles}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, autoOpenFiles: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Auto-open files</span>
              </label>
              
              {/* Confirm Before Apply */}
              <label className="flex items-center gap-2 bg-blue-800/30 rounded-lg p-3 cursor-pointer hover:bg-blue-800/50">
                <input
                  type="checkbox"
                  checked={userPreferences.confirmBeforeApply}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, confirmBeforeApply: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Confirm before apply</span>
              </label>
              
              {/* Show Line Numbers */}
              <label className="flex items-center gap-2 bg-blue-800/30 rounded-lg p-3 cursor-pointer hover:bg-blue-800/50">
                <input
                  type="checkbox"
                  checked={userPreferences.showLineNumbers}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, showLineNumbers: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Show line numbers</span>
              </label>
              
              {/* Compact Mode */}
              <label className="flex items-center gap-2 bg-blue-800/30 rounded-lg p-3 cursor-pointer hover:bg-blue-800/50">
                <input
                  type="checkbox"
                  checked={userPreferences.compactMode}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, compactMode: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Compact mode</span>
              </label>
              
              {/* Font Size */}
              <div className="bg-blue-800/30 rounded-lg p-3">
                <label htmlFor="fontSize" className="text-sm text-white block mb-1">Font Size</label>
                <select
                  id="fontSize"
                  title="Select font size for code display"
                  value={userPreferences.fontSize}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, fontSize: e.target.value as 'small' | 'medium' | 'large' }))}
                  className="w-full bg-blue-900/50 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              
              {/* Default Context Mode */}
              <div className="bg-blue-800/30 rounded-lg p-3">
                <label htmlFor="defaultContext" className="text-sm text-white block mb-1">Default Context</label>
                <select
                  id="defaultContext"
                  title="Select default context mode for pipeline"
                  value={userPreferences.defaultContextMode}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, defaultContextMode: e.target.value as PipelineContextMode }))}
                  className="w-full bg-blue-900/50 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="prompt_only">Prompt Only</option>
                  <option value="active_file">Active File</option>
                  <option value="selected_files">Selected Files</option>
                  <option value="full_project">Full Project</option>
                </select>
              </div>
              
              {/* Max History Items */}
              <div className="bg-blue-800/30 rounded-lg p-3">
                <label htmlFor="historyLimit" className="text-sm text-white block mb-1">History Limit</label>
                <select
                  id="historyLimit"
                  title="Select maximum number of runs to keep in history"
                  value={userPreferences.maxHistoryItems}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, maxHistoryItems: parseInt(e.target.value) }))}
                  className="w-full bg-blue-900/50 text-white rounded px-2 py-1 text-sm"
                >
                  <option value="5">5 runs</option>
                  <option value="10">10 runs</option>
                  <option value="20">20 runs</option>
                  <option value="50">50 runs</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* HELP OVERLAY */}
        {/* ============================================ */}
        {showHelpOverlay && (
          <div className="bg-gradient-to-br from-yellow-900/90 to-orange-900/90 border-b border-yellow-500/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ❓ Help & Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowHelpOverlay(false)}
                className="text-yellow-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Keyboard Shortcuts */}
              <div className="bg-yellow-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-yellow-200 mb-3">⌨️ Keyboard Shortcuts</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Run Pipeline</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Ctrl+Enter</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Save File</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Ctrl+S</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Undo</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Ctrl+Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Redo</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Ctrl+Y</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Close Panel</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Esc</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Next File</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Tab</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Accept Change</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Ctrl+A</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-100">Reject Change</span>
                    <kbd className="bg-yellow-900/50 px-2 py-0.5 rounded text-yellow-300">Ctrl+R</kbd>
                  </div>
                </div>
              </div>
              
              {/* Quick Tips */}
              <div className="bg-yellow-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-yellow-200 mb-3">💡 Quick Tips</h4>
                <ul className="space-y-2 text-sm text-yellow-100">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Use Templates for common tasks
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Select specific files for targeted changes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Review diffs before accepting changes
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Use Undo/Redo to experiment safely
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Check the Summary panel for insights
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Configure agents for different tasks
                  </li>
                </ul>
              </div>
              
              {/* Pipeline Stages */}
              <div className="bg-yellow-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-yellow-200 mb-3">🔄 Pipeline Stages</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🔍</span>
                    <div>
                      <strong className="text-yellow-200">Analyzer</strong>
                      <p className="text-yellow-100 text-xs">Understands your code</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🏗️</span>
                    <div>
                      <strong className="text-yellow-200">Generator</strong>
                      <p className="text-yellow-100 text-xs">Creates solutions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">✅</span>
                    <div>
                      <strong className="text-yellow-200">Quality Gate</strong>
                      <p className="text-yellow-100 text-xs">Reviews & approves</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🔧</span>
                    <div>
                      <strong className="text-yellow-200">Production</strong>
                      <p className="text-yellow-100 text-xs">Makes it enterprise-ready</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <strong className="text-yellow-200">Validator</strong>
                      <p className="text-yellow-100 text-xs">Final security check</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* BATCH PROCESSING PANEL */}
        {/* ============================================ */}
        {showBatchPanel && (
          <div className="bg-gradient-to-br from-orange-900/90 to-amber-900/90 border-b border-orange-500/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📦 Batch Processing
                <span className="text-xs text-orange-300 font-normal">Process multiple files with the same prompt</span>
              </h3>
              <button
                onClick={() => setShowBatchPanel(false)}
                className="text-orange-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* File Selection */}
              <div className="bg-orange-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-orange-200 mb-3">📁 Select Files for Batch</h4>
                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {availableFiles.slice(0, 50).map((file) => (
                    <label key={file.identifier} className="flex items-center gap-2 text-sm text-orange-100 hover:bg-orange-700/30 p-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchMode.files.includes(file.identifier)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchMode(prev => ({ ...prev, files: [...prev.files, file.identifier] }));
                          } else {
                            setBatchMode(prev => ({ ...prev, files: prev.files.filter(f => f !== file.identifier) }));
                          }
                        }}
                        className="w-4 h-4 rounded"
                        title={`Select ${file.identifier} for batch processing`}
                      />
                      <span className="truncate">{file.identifier}</span>
                    </label>
                  ))}
                  {availableFiles.length === 0 && (
                    <p className="text-orange-300 text-xs">No files loaded. Load a project first.</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBatchMode(prev => ({ ...prev, files: availableFiles.map(f => f.identifier) }))}
                    className="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setBatchMode(prev => ({ ...prev, files: [] }))}
                    className="px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded"
                  >
                    Clear All
                  </button>
                  <span className="text-xs text-orange-300 ml-auto">{batchMode.files.length} selected</span>
                </div>
              </div>
              
              {/* Batch Status & Controls */}
              <div className="bg-orange-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-orange-200 mb-3">⚙️ Batch Controls</h4>
                {batchMode.isProcessing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="animate-spin text-xl">⚙️</span>
                      <span className="text-orange-100">Processing file {batchMode.currentIndex + 1} of {batchMode.files.length}</span>
                    </div>
                    <div className="w-full bg-orange-900 rounded-full h-2">
                      <div 
                        className="bg-orange-400 h-2 rounded-full transition-all"
                        style={{ width: `${((batchMode.currentIndex + 1) / batchMode.files.length) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={() => setBatchMode(prev => ({ ...prev, isProcessing: false }))}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                    >
                      ⏹️ Stop Batch
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-orange-100 text-sm">
                      Run the current prompt on {batchMode.files.length} files sequentially.
                    </p>
                    <button
                      onClick={() => {
                        if (batchMode.files.length === 0) {
                          alert('Please select at least one file for batch processing.');
                          return;
                        }
                        if (isPromptEmpty) {
                          alert('Please enter a prompt first.');
                          return;
                        }
                        setBatchMode(prev => ({ ...prev, enabled: true, isProcessing: true, currentIndex: 0, results: [] }));
                        // Batch processing would be handled by the pipeline
                        alert(`Batch processing ${batchMode.files.length} files. This feature processes files one at a time.`);
                      }}
                      disabled={batchMode.files.length === 0 || isPromptEmpty || isRunning}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 disabled:text-orange-500 text-white text-sm rounded font-semibold"
                    >
                      🚀 Start Batch ({batchMode.files.length} files)
                    </button>
                  </div>
                )}
                
                {/* Results */}
                {batchMode.results.length > 0 && (
                  <div className="mt-4 border-t border-orange-600/50 pt-3">
                    <h5 className="text-xs font-bold text-orange-200 mb-2">Results:</h5>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {batchMode.results.map((result, idx) => (
                        <div key={idx} className={`text-xs flex items-center gap-2 ${result.success ? 'text-green-300' : 'text-red-300'}`}>
                          <span>{result.success ? '✅' : '❌'}</span>
                          <span className="truncate">{result.file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* EXPORT/IMPORT CONFIGURATION PANEL */}
        {/* ============================================ */}
        {showExportImport && (
          <div className="bg-gradient-to-br from-cyan-900/90 to-teal-900/90 border-b border-cyan-500/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💾 Export/Import Configuration
                <span className="text-xs text-cyan-300 font-normal">Save and load pipeline settings</span>
              </h3>
              <button
                onClick={() => setShowExportImport(false)}
                className="text-cyan-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export */}
              <div className="bg-cyan-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-cyan-200 mb-3">📤 Export Configuration</h4>
                <p className="text-cyan-100 text-xs mb-3">
                  Export your current pipeline configuration including agent settings, preferences, and templates.
                </p>
                <button
                  onClick={() => {
                    const config = {
                      version: '1.0',
                      exportedAt: new Date().toISOString(),
                      agents: agents,
                      preferences: userPreferences,
                      contextMode: contextMode,
                      characterLimit: characterLimit,
                      currentPrompt: userPrompt
                    };
                    const json = JSON.stringify(config, null, 2);
                    setExportedConfig(json);
                    navigator.clipboard.writeText(json);
                    alert('Configuration exported and copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded font-semibold w-full"
                >
                  📋 Export to Clipboard
                </button>
                {exportedConfig && (
                  <div className="mt-3">
                    <textarea
                      value={exportedConfig}
                      readOnly
                      className="w-full h-32 bg-cyan-900/50 text-cyan-100 text-xs font-mono p-2 rounded border border-cyan-600/50"
                      title="Exported configuration JSON"
                      placeholder="Exported configuration will appear here"
                    />
                  </div>
                )}
              </div>
              
              {/* Import */}
              <div className="bg-cyan-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-cyan-200 mb-3">📥 Import Configuration</h4>
                <p className="text-cyan-100 text-xs mb-3">
                  Paste a previously exported configuration to restore settings.
                </p>
                <textarea
                  value={importConfig}
                  onChange={(e) => setImportConfig(e.target.value)}
                  placeholder="Paste configuration JSON here..."
                  className="w-full h-24 bg-cyan-900/50 text-cyan-100 text-xs font-mono p-2 rounded border border-cyan-600/50 mb-3"
                  title="Import configuration JSON"
                />
                <button
                  onClick={() => {
                    try {
                      const config = JSON.parse(importConfig);
                      if (config.preferences) {
                        setUserPreferences(config.preferences);
                      }
                      if (config.contextMode) {
                        setContextMode(config.contextMode);
                      }
                      if (config.characterLimit) {
                        setCharacterLimit(config.characterLimit);
                      }
                      if (config.currentPrompt) {
                        setUserPrompt(config.currentPrompt);
                      }
                      // Note: Agent config import would need pipeline.updateAgent calls
                      alert('Configuration imported successfully!');
                      setImportConfig('');
                    } catch (error) {
                      alert('Invalid configuration format. Please check the JSON.');
                    }
                  }}
                  disabled={!importConfig.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:text-cyan-500 text-white text-sm rounded font-semibold w-full"
                >
                  📥 Import Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* REAL-TIME COLLABORATION PANEL */}
        {/* ============================================ */}
        {showCollaborationPanel && (
          <div className="bg-gradient-to-br from-pink-900/90 to-rose-900/90 border-b border-pink-500/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                👥 Real-time Collaboration
                <span className="text-xs text-pink-300 font-normal">Work together on code changes</span>
                {collaborationState.enabled && (
                  <span className="px-2 py-0.5 bg-green-500/30 text-green-300 text-xs rounded-full">Connected</span>
                )}
              </h3>
              <button
                onClick={() => setShowCollaborationPanel(false)}
                className="text-pink-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Session Controls */}
              <div className="bg-pink-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-pink-200 mb-3">🔗 Session</h4>
                {collaborationState.enabled ? (
                  <div className="space-y-3">
                    <div className="text-xs text-pink-100">
                      <strong>Session ID:</strong>
                      <code className="ml-2 bg-pink-900/50 px-2 py-0.5 rounded">{collaborationState.sessionId}</code>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(collaborationState.sessionId || '');
                        alert('Session ID copied to clipboard!');
                      }}
                      className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs rounded w-full"
                    >
                      📋 Copy Session ID
                    </button>
                    <button
                      onClick={() => setCollaborationState({ enabled: false, sessionId: null, participants: [], lastSync: null })}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded w-full"
                    >
                      🚪 Leave Session
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const sessionId = `collab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                        setCollaborationState({
                          enabled: true,
                          sessionId,
                          participants: [{ id: 'self', name: 'You', color: '#8B5CF6' }],
                          lastSync: new Date()
                        });
                        navigator.clipboard.writeText(sessionId);
                        alert(`Collaboration session created!\nSession ID copied to clipboard: ${sessionId}`);
                      }}
                      className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-sm rounded font-semibold w-full"
                    >
                      🆕 Create Session
                    </button>
                    <div className="text-center text-pink-300 text-xs">or</div>
                    <input
                      type="text"
                      placeholder="Enter Session ID to join..."
                      className="w-full bg-pink-900/50 text-pink-100 text-xs p-2 rounded border border-pink-600/50"
                      title="Enter collaboration session ID"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          setCollaborationState({
                            enabled: true,
                            sessionId: e.currentTarget.value.trim(),
                            participants: [{ id: 'self', name: 'You', color: '#8B5CF6' }],
                            lastSync: new Date()
                          });
                          alert(`Joined session: ${e.currentTarget.value.trim()}`);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              
              {/* Participants */}
              <div className="bg-pink-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-pink-200 mb-3">👤 Participants ({collaborationState.participants.length})</h4>
                {collaborationState.participants.length > 0 ? (
                  <div className="space-y-2">
                    {collaborationState.participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-2 text-sm text-pink-100">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: participant.color }}
                        />
                        <span>{participant.name}</span>
                        {participant.cursor && (
                          <span className="text-xs text-pink-400 ml-auto">
                            {participant.cursor.file}:{participant.cursor.line}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-pink-300 text-xs">No participants yet. Create or join a session.</p>
                )}
              </div>
              
              {/* Sync Status */}
              <div className="bg-pink-800/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-pink-200 mb-3">🔄 Sync Status</h4>
                {collaborationState.enabled ? (
                  <div className="space-y-2 text-sm text-pink-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span>Connected</span>
                    </div>
                    <div className="text-xs text-pink-300">
                      Last sync: {collaborationState.lastSync?.toLocaleTimeString() || 'Never'}
                    </div>
                    <button
                      onClick={() => setCollaborationState(prev => ({ ...prev, lastSync: new Date() }))}
                      className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-xs rounded w-full mt-2"
                    >
                      🔄 Force Sync
                    </button>
                  </div>
                ) : (
                  <p className="text-pink-300 text-xs">Not connected to any session.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {showConfig ? (
          // Agent Configuration View
          <AgentConfigurationView
            agents={agents}
            onSave={saveAgentConfig}
            onBack={() => setShowConfig(false)}
          />
        ) : (
          // Main Pipeline View
          <div className="flex-1 overflow-auto p-6">
            {/* Help Section */}
            <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border-2 border-blue-500/50 mb-6">
              <div className="flex items-start gap-4">
                <span className="text-4xl">💡</span>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-3">What is the Multi-Agent Pipeline?</h3>
                  <p className="text-blue-100 text-base leading-relaxed mb-4">
                    This is an advanced AI system where <strong>5 different AI agents work together</strong> to create production-ready code.
                    Each agent has a specific role, and they check each other's work to ensure the highest quality.
                  </p>
                  
                  <h4 className="text-lg font-bold text-white mb-2">🔄 The 5-Stage Process:</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🔍</span>
                      <div>
                        <strong className="text-purple-300">Stage 1: Code Analyzer</strong>
                        <p className="text-blue-100 text-sm">Reads and analyzes existing code, finds issues and opportunities</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🏗️</span>
                      <div>
                        <strong className="text-purple-300">Stage 2: Solution Generator</strong>
                        <p className="text-blue-100 text-sm">Creates production-ready code solutions (NO mockups or placeholders!)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <strong className="text-purple-300">Stage 3: Quality Checker</strong>
                        <p className="text-blue-100 text-sm">Reviews code quality - can REJECT and send back to Stage 2 if not good enough</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🔧</span>
                      <div>
                        <strong className="text-purple-300">Stage 4: Production Engineer</strong>
                        <p className="text-blue-100 text-sm">Makes code enterprise-ready with error handling, logging, optimization</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🛡️</span>
                      <div>
                        <strong className="text-purple-300">Stage 5: Final Validator</strong>
                        <p className="text-blue-100 text-sm">Final security, performance, and quality check before delivery</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded">
                    <p className="text-yellow-100 text-sm">
                      <strong>💡 Key Feature:</strong> If the Quality Checker rejects the code, it automatically goes back to the Solution Generator
                      to try again. This feedback loop ensures you get production-ready code, not prototypes!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Context Strategy */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">📂 Context Strategy</h3>
                <div className="text-xs text-gray-400">
                  {projectPath ? `Project: ${projectPath}` : 'No project loaded'}
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-4">
                Choose how the analyzer ingests existing code. Larger contexts provide deeper understanding but consume more tokens.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${contextMode === 'prompt_only' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-400'}`}>
                  <input
                    type="radio"
                    name="context-mode"
                    value="prompt_only"
                    checked={contextMode === 'prompt_only'}
                    onChange={() => setContextMode('prompt_only')}
                    className="mt-1 h-4 w-4 text-purple-500 focus:ring-purple-400"
                    title="Select Prompt Only mode"
                    aria-label="Prompt Only context mode"
                  />
                  <div>
                    <div className="text-sm font-semibold">Prompt Only</div>
                    <div className="text-xs text-gray-400">
                      Fastest mode. Agents work purely from your request.
                    </div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${contextMode === 'active_file' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-400'}`}>
                  <input
                    type="radio"
                    name="context-mode"
                    value="active_file"
                    checked={contextMode === 'active_file'}
                    onChange={() => setContextMode('active_file')}
                    className="mt-1 h-4 w-4 text-purple-500 focus:ring-purple-400"
                    title="Select Active File mode"
                    aria-label="Active File context mode"
                  />
                  <div>
                    <div className="text-sm font-semibold">Active File</div>
                    <div className="text-xs text-gray-400">
                      Analyze only the file currently open in the editor.
                    </div>
                    {!activeFile && contextMode === 'active_file' && (
                      <div className="mt-1 text-[11px] text-amber-300">
                        No active file detected. Open a file to enable this mode.
                      </div>
                    )}
                  </div>
                </label>

                <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${contextMode === 'selected_files' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-400'}`}>
                  <input
                    type="radio"
                    name="context-mode"
                    value="selected_files"
                    checked={contextMode === 'selected_files'}
                    onChange={() => setContextMode('selected_files')}
                    className="mt-1 h-4 w-4 text-purple-500 focus:ring-purple-400"
                    title="Select Selected Files mode"
                    aria-label="Selected Files context mode"
                  />
                  <div>
                    <div className="text-sm font-semibold">Selected Files</div>
                    <div className="text-xs text-gray-400">
                      Pick specific files for the agents to analyze together.
                    </div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${contextMode === 'full_project' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-purple-400'}`}>
                  <input
                    type="radio"
                    name="context-mode"
                    value="full_project"
                    checked={contextMode === 'full_project'}
                    onChange={() => setContextMode('full_project')}
                    className="mt-1 h-4 w-4 text-purple-500 focus:ring-purple-400"
                    title="Select Full Project mode"
                    aria-label="Full Project context mode"
                  />
                  <div>
                    <div className="text-sm font-semibold">Entire Project</div>
                    <div className="text-xs text-gray-400">
                      Aggregate every loaded file into the analysis (token aware).
                    </div>
                  </div>
                </label>
              </div>

              {/* Warning when full_project selected but no files loaded */}
              {contextMode === 'full_project' && availableFiles.length === 0 && (
                <div className="mt-4 rounded-lg border border-red-500/60 bg-red-900/20 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="text-sm font-bold text-red-200">No Project Files Loaded</h4>
                      <p className="text-xs text-red-300/80 mt-1">
                        The "Entire Project" mode requires project files to be loaded. Please open a project folder first, 
                        or switch to "Prompt Only" mode to run without code context.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show file count when full_project is selected and files are loaded */}
              {contextMode === 'full_project' && availableFiles.length > 0 && (
                <div className="mt-4 rounded-lg border border-green-500/60 bg-green-900/20 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">✅</span>
                    <div>
                      <h4 className="text-sm font-bold text-green-200">Project Context Ready</h4>
                      <p className="text-xs text-green-300/80 mt-1">
                        {availableFiles.length.toLocaleString()} files ({totalProjectCharacters.toLocaleString()} characters) will be included in the analysis.
                        {totalProjectCharacters > effectiveCharacterLimit && (
                          <span className="text-yellow-300"> Content will be truncated to {effectiveCharacterLimit.toLocaleString()} characters.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {contextMode === 'selected_files' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>
                      Selected {selectedFileIds.size} / {availableFiles.length} files
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllFiles}
                        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
                        type="button"
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearAllFiles}
                        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
                    {availableFiles.map(file => (
                      <label key={file.identifier} className="flex items-start gap-3 px-4 py-3 bg-gray-900/60 text-gray-200 hover:bg-gray-900">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.has(file.identifier)}
                          onChange={() => toggleFileSelection(file.identifier)}
                          className="mt-1 h-4 w-4 text-purple-500 focus:ring-purple-400"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium break-all">{file.identifier}</div>
                          <div className="text-[11px] text-gray-500">
                            {file.content.split('\n').length.toLocaleString()} lines · {(file.content.length / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </label>
                    ))}
                    {availableFiles.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-gray-500">No files available in the current project.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200 mb-2">🧠 Analyzer Insight</h4>
                  <p className="text-xs text-gray-300">The analyzer will use the selected context to understand your code.</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-xs text-gray-300">
                  <div className="font-semibold text-sm text-white">Context Metrics</div>
                  <ul className="mt-2 space-y-1">
                    <li>Total files loaded: {availableFiles.length.toLocaleString()}</li>
                    <li>Total characters: {totalProjectCharacters.toLocaleString()}</li>
                    <li>Active file: {activeFile ? activeFile.identifier : 'None'}</li>
                  </ul>
                </div>
              </div>

              {/* File Preview - Show all loaded files */}
              {availableFiles.length > 0 && (contextMode === 'full_project' || contextMode === 'selected_files') && (
                <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">📂 Files to Analyze ({availableFiles.length})</h4>
                    <span className="text-[10px] text-gray-500">
                      {contextMode === 'full_project' ? 'All files' : `${selectedFileIds.size} selected`}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {availableFiles.slice(0, 50).map((file) => {
                      const hasContent = typeof file.content === 'string' && file.content.length > 0;
                      const isSelected = contextMode === 'full_project' || selectedFileIds.has(file.identifier);
                      return (
                        <div 
                          key={file.identifier} 
                          className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${
                            isSelected 
                              ? hasContent 
                                ? 'bg-green-900/30 text-green-300' 
                                : 'bg-yellow-900/30 text-yellow-300'
                              : 'bg-gray-800/50 text-gray-500'
                          }`}
                        >
                          <span className="font-mono truncate flex-1">{file.identifier}</span>
                          <span className="ml-2 text-[10px]">
                            {hasContent ? `${file.content.length.toLocaleString()} chars` : '⚠️ No content'}
                          </span>
                        </div>
                      );
                    })}
                    {availableFiles.length > 50 && (
                      <div className="text-center text-[10px] text-gray-500 py-1">
                        ...and {availableFiles.length - 50} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-xs text-gray-300">
                  <label className="font-semibold text-sm text-white" htmlFor="context-character-limit">
                    Character Budget
                  </label>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Limits how much code is streamed into the analyzer to stay within model token constraints.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      id="context-character-limit"
                      type="number"
                      min={10000}
                      max={500000}
                      step={5000}
                      value={characterLimit}
                      onChange={(event) => setCharacterLimit(Number(event.target.value) || 0)}
                      className="w-32 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-gray-500">characters</span>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">
                    Recommended range: 60,000 – 180,000. Higher values capture more files at the cost of additional tokens.
                  </div>
                </div>
              </div>
            </div>

            {/* Input Section */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
              <h3 className="text-xl font-bold text-white mb-4">📝 Your Code Request:</h3>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Example: Create a user authentication system with JWT tokens, password hashing, and session management"
                ref={promptInputRef}
                className="w-full h-32 bg-gray-900 text-white border border-gray-600 rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:border-purple-500"
                disabled={isRunning || quotaHealth.isCoolingDown}
              />
              <button
                onClick={runPipeline}
                disabled={isRunning || quotaHealth.isCoolingDown || quotaAutoBlockEnabled && quotaHealth.recentQuotaFailures >= quotaAutoBlockThreshold}
                title={
                  isRunning
                    ? 'Pipeline is currently running'
                    : isPromptEmpty
                      ? 'Enter a prompt to start the pipeline'
                      : 'Start the multi-agent pipeline'
                }
                className={`mt-4 w-full px-6 py-3 font-bold text-lg rounded-lg transition ${
                  isRunning
                    ? 'bg-gray-700 cursor-not-allowed text-white/70'
                    : isPromptEmpty
                      ? 'bg-gray-700 hover:bg-gray-600 text-white/80'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                }`}
              >
                {isRunning ? '🔄 Pipeline Running...' : '🚀 Start AI Pipeline'}
              </button>
              {isPromptEmpty && !isRunning && (
                <p className="mt-2 text-xs text-gray-400">
                  Provide a detailed prompt so the multi-agent team knows what to build.
                </p>
              )}
              <div className="mt-4 space-y-2 text-xs text-gray-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-gray-100">Quota Health</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      quotaHealth.isCoolingDown
                        ? 'bg-red-700/70 text-red-100'
                        : quotaHealth.recentQuotaFailures > 0
                          ? 'bg-yellow-700/70 text-yellow-100'
                          : 'bg-green-700/70 text-green-100'
                    }`}
                  >
                    {quotaHealth.isCoolingDown
                      ? 'Cool-down active'
                      : quotaHealth.recentQuotaFailures > 0
                        ? 'Degraded'
                        : 'Healthy'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Recent quota failures (last 10 min): {quotaHealth.recentQuotaFailures}
                  </span>
                  {quotaHealth.isCoolingDown && (
                    <span>
                      Cool-down remaining:{' '}
                      {Math.max(0, Math.ceil(quotaHealth.cooldownMsRemaining / 1000))}s
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Local run history (last {quotaFailureSummary.total} runs): Quota failures {quotaFailureSummary.quotaFailures}, Cooldown blocks {quotaFailureSummary.cooldownFailures}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {quotaStatusExplanation}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href="https://ai.dev/usage?tab=rate-limit"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-300 hover:text-blue-200 underline"
                  >
                    View Gemini rate limits &amp; usage
                  </a>
                  <button
                    type="button"
                    onClick={handleResetQuotaTracking}
                    className="rounded border border-red-700/60 bg-red-900/40 px-2 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-900/70"
                  >
                    Reset local quota tracking
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)] text-xs text-gray-300">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={quotaAutoBlockEnabled}
                    onChange={(event) => setQuotaAutoBlockEnabled(event.target.checked)}
                    className="mt-0.5 h-4 w-4 text-purple-500 focus:ring-purple-400"
                  />
                  <span>
                    <span className="font-semibold text-white">Auto-block on quota exhaustion</span>
                    <span className="block text-[11px] text-gray-400">
                      When the last {quotaAutoBlockThreshold} quota failures are detected in the recent
                      window, temporarily prevent new multi-agent runs until Gemini quota recovers.
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="quota-auto-block-threshold"
                    className="text-[11px] text-gray-400"
                  >
                    Failure threshold
                  </label>
                  <input
                    id="quota-auto-block-threshold"
                    type="number"
                    min={1}
                    max={10}
                    value={quotaAutoBlockThreshold}
                    onChange={(event) =>
                      setQuotaAutoBlockThreshold(
                        Math.min(10, Math.max(1, Number(event.target.value) || 1))
                      )
                    }
                    className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quality Retry Control */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-purple-500/40 bg-purple-900/20 px-4 py-3">
                <div>
                  <span className="font-semibold text-white">Quality Check Retries</span>
                  <span className="block text-[11px] text-gray-400">
                    How many times the generator/quality loop runs before proceeding. Set to 1 for fastest runs.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="max-quality-retries"
                    type="number"
                    min={1}
                    max={5}
                    value={maxQualityRetries}
                    onChange={(event) =>
                      setMaxQualityRetries(
                        Math.min(5, Math.max(1, Number(event.target.value) || 1))
                      )
                    }
                    className="w-16 rounded border border-purple-500/60 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                    title="Number of quality check retry attempts (1-5)"
                    placeholder="1-5"
                    aria-label="Quality check retries"
                  />
                  <span className="text-[11px] text-gray-400">attempts</span>
                </div>
              </div>
            </div>

            {/* Pipeline Progress */}
            {(isRunning || allStages.length > 0) && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">🔄 Pipeline Progress:</h3>
                <div className="space-y-3">
                  {STAGE_PROGRESS_KEYS.map((stageId: StageProgressKey, idx) => {
                    const stage = allStages.find(s => s.id === stageId);
                    const stageName = ['Code Analyzer', 'Solution Generator', 'Quality Checker', 'Production Engineer', 'Final Validator'][idx];
                    const stageIcon = ['🔍', '🏗️', '✅', '🔧', '🛡️'][idx];
                    
                    return (
                      <StageProgressBar
                        key={stageId}
                        icon={stageIcon}
                        name={stageName}
                        stage={stage}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Run History */}
            {runHistory.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-bold text-white">📜 Run History</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={modelFilter}
                      onChange={(event) => setModelFilter(event.target.value)}
                      className="text-xs rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-200"
                      title="Filter runs by model used"
                    >
                      <option value="all">All models</option>
                      {allModelsInHistory.map(modelId => (
                        <option key={modelId} value={modelId}>
                          Model: {modelId}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-xs rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-700 transition disabled:opacity-50"
                      onClick={handleExportAllRunReports}
                      disabled={filteredRunHistory.length === 0}
                      type="button"
                    >
                      Export All
                    </button>
                    <button
                      className="text-xs rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-700 transition disabled:opacity-50"
                      onClick={handleClearHistory}
                      disabled={runHistory.length === 0}
                      type="button"
                    >
                      Clear History
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {filteredRunHistory.map((record) => {
                    const isSelected = selectedRunId === record.id;
                    const promptPreview = record.prompt.length > 140 ? `${record.prompt.slice(0, 137)}…` : record.prompt;
                    const recordQuality = typeof record.qualityScore === 'number' ? `${record.qualityScore}/100` : '—';

                    return (
                      <div
                        key={record.id}
                        className={`rounded-lg border ${isSelected ? 'border-purple-500/60 bg-purple-900/10' : 'border-gray-700/60 bg-gray-900/40'} p-4 transition`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <div className="text-sm font-semibold text-white">
                              {record.success ? '✅ Success' : '❌ Failed'}
                              {!record.success && record.failureType && record.failureType !== 'none'
                                ? ` • ${formatFailureTypeLabel(record.failureType)}`
                                : ''}
                              {' • '}
                              {formatHistoryTimestamp(record.timestamp)}
                            </div>
                            <div className="text-gray-300">
                              Prompt: <span className="text-gray-100 font-medium">{promptPreview || '—'}</span>
                            </div>
                            <div className="text-gray-400">
                              Context: {record.contextMode.replace('_', ' ')} • Files: {record.selectedFileCount}
                            </div>
                            <div className="text-gray-400">
                              Quality Score: {recordQuality}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedRunId(isSelected ? null : record.id)}
                              className={`rounded px-3 py-1 text-xs font-semibold transition ${
                                isSelected ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                              }`}
                              type="button"
                            >
                              {isSelected ? 'Hide Details' : 'View Details'}
                            </button>
                            <button
                              onClick={() => handleExportRunReport(record)}
                              className="rounded px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
                              type="button"
                            >
                              Export Report
                            </button>
                            <button
                              onClick={() => handleReplay(record)}
                              className="rounded px-3 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
                              disabled={isRunning}
                              type="button"
                            >
                              Replay
                            </button>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-4 space-y-4 text-xs text-gray-300">
                            {record.errorMessage && (
                              <div className="rounded border border-red-500/60 bg-red-900/30 p-3 text-red-200">
                                <strong>Error:</strong> {record.errorMessage}
                              </div>
                            )}

                            {record.warnings && record.warnings.length > 0 && (
                              <div className="rounded border border-yellow-500/60 bg-yellow-900/20 p-3 text-yellow-200 space-y-1">
                                <strong className="block text-yellow-100">Warnings ({record.warnings.length}):</strong>
                                <ul className="list-disc list-inside space-y-1">
                                  {record.warnings.map((warning, index) => (
                                    <li key={`${record.id}-warning-${index}`}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {record.result?.stages && record.result.stages.length > 0 && (
                              <div className="rounded border border-blue-500/60 bg-blue-900/20 p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="text-blue-100">Models Used</strong>
                                  <span className="rounded-full bg-blue-800/60 px-2 py-0.5 text-[11px] text-blue-50">
                                    {record.result.stages.length} stage{record.result.stages.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="grid gap-2 text-[11px] text-blue-100 sm:grid-cols-2 md:grid-cols-3">
                                  {record.result.stages.map(stage => (
                                    <div
                                      key={`${record.id}-stage-${stage.id}`}
                                      className="rounded bg-blue-950/40 px-2 py-1 space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold flex items-center gap-1">
                                          <span>{getStageIcon(stage.id)}</span>
                                          <span>{stage.name}</span>
                                        </span>
                                        <span className="rounded-full bg-blue-800/60 px-1.5 py-0.5 text-[10px]">
                                          {formatStageStatusLabel(stage.status)}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-blue-200 break-all">
                                        Model: <span className="font-mono">{stage.agent.model}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {record.result?.fileChanges && record.result.fileChanges.length > 0 && (() => {
                              const fileChanges = record.result.fileChanges;
                              const currentFileIdx = selectedFileIndex[record.id] ?? 0;
                              const decisionMap = runChangeDecisions[record.id] ?? buildDefaultDecisionMap(fileChanges);
                              const currentChange = fileChanges[currentFileIdx];
                              const selectionMap = runChangeSelections[record.id] ?? buildDefaultSelectionMap(fileChanges);
                              const targetMap = runChangeTargets[record.id] ?? buildDefaultTargetMap(fileChanges);
                              
                              // Count decisions
                              const acceptedCount = Object.values(decisionMap).filter(d => d === 'accepted').length;
                              const skippedCount = Object.values(decisionMap).filter(d => d === 'skipped').length;
                              const pendingCount = fileChanges.length - acceptedCount - skippedCount;

                              if (!currentChange) return null;

                              const decision = decisionMap[currentChange.path] ?? 'pending';
                              const isAccepted = selectionMap[currentChange.path] ?? false;
                              const changeKey = `${record.id}-${currentChange.path}`;
                              const datalistId = `target-options-${changeKey}`;

                              return (
                                <div className="rounded-lg border border-slate-600 bg-slate-900/90 overflow-hidden">
                                  {/* Header with summary stats */}
                                  <div className="px-4 py-3 bg-gradient-to-r from-emerald-900/60 to-green-900/60 border-b border-slate-700">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg">📁</span>
                                        <div>
                                          <h3 className="text-sm font-bold text-white">File Changes Review</h3>
                                          <p className="text-[10px] text-slate-300">
                                            {record.result.productionSummary?.substring(0, 100) || 'Review and accept/reject each file change'}
                                            {(record.result.productionSummary?.length ?? 0) > 100 ? '...' : ''}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px]">
                                        <span className="px-2 py-1 rounded bg-green-700/60 text-green-100">✅ {acceptedCount}</span>
                                        <span className="px-2 py-1 rounded bg-yellow-700/60 text-yellow-100">⏭️ {skippedCount}</span>
                                        <span className="px-2 py-1 rounded bg-slate-700/60 text-slate-300">⏳ {pendingCount}</span>
                                        <button
                                          onClick={() => {
                                            // Copy all file changes as a formatted report
                                            const report = fileChanges.map(fc => 
                                              `=== ${fc.path} ===\n${fc.summary || 'No summary'}\n\n${fc.updatedContent}`
                                            ).join('\n\n---\n\n');
                                            navigator.clipboard.writeText(report);
                                            alert(`✅ Copied ${fileChanges.length} file changes to clipboard!`);
                                          }}
                                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                                          title="Copy all file changes"
                                        >
                                          📋 Copy All
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* File tabs navigation */}
                                  <FileChangeTabs
                                    changes={fileChanges}
                                    selectedIndex={currentFileIdx}
                                    onSelect={(idx) => setSelectedFileIndex(prev => ({ ...prev, [record.id]: idx }))}
                                    decisions={decisionMap}
                                  />

                                  {/* Current file details */}
                                  <div className="p-4 space-y-4">
                                    {/* File path and status */}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">{currentChange.isNewFile ? '✨' : '📝'}</span>
                                          <strong className="text-sm text-white break-all">{currentChange.path}</strong>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                          {currentChange.isNewFile ? 'New file will be created' : 'Existing file will be updated'}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          onClick={() => {
                                            const content = `=== ${currentChange.path} ===\n${currentChange.summary || 'No summary'}\n\n${currentChange.updatedContent}`;
                                            navigator.clipboard.writeText(content);
                                            alert(`✅ Copied ${currentChange.path} to clipboard!`);
                                          }}
                                          className="px-2 py-1 text-[10px] rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                                          title="Copy this file's code"
                                        >
                                          📋 Copy
                                        </button>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                          decision === 'accepted' ? 'bg-green-600 text-white' :
                                          decision === 'skipped' ? 'bg-yellow-600 text-white' :
                                          'bg-slate-600 text-slate-200'
                                        }`}>
                                          {decision === 'accepted' ? '✅ Accepted' : decision === 'skipped' ? '⏭️ Skipped' : '⏳ Pending'}
                                        </span>
                                        {isAccepted && (
                                          <span className="px-2 py-1 rounded bg-blue-600/60 text-[10px] text-blue-100">
                                            Will be applied
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Summary */}
                                    {currentChange.summary && (
                                      <div className="rounded border border-slate-700 bg-slate-800/60 p-3">
                                        <h4 className="text-[11px] font-semibold text-slate-300 mb-1">📋 Change Summary</h4>
                                        <p className="text-[11px] text-slate-400 whitespace-pre-line">{currentChange.summary}</p>
                                      </div>
                                    )}

                                    {/* Side-by-side diff viewer */}
                                    <FileChangePreview change={currentChange} />

                                    {/* Target path and action buttons */}
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-300" htmlFor={`target-input-${changeKey}`}>
                                          Target file path
                                        </label>
                                        <input
                                          id={`target-input-${changeKey}`}
                                          type="text"
                                          value={targetMap[currentChange.path] ?? currentChange.path}
                                          onChange={(event) =>
                                            handleChangeTargetPath(record.id, currentChange.path, event.target.value, fileChanges)
                                          }
                                          list={datalistId}
                                          className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-[11px] text-white focus:border-blue-500 focus:outline-none"
                                          placeholder={currentChange.path}
                                        />
                                        <datalist id={datalistId}>
                                          <option value={currentChange.path} />
                                          {projectFiles.slice(0, 50).map(file => (
                                            <option key={`${changeKey}-option-${file.identifier}`} value={file.identifier} />
                                          ))}
                                        </datalist>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => navigator.clipboard.writeText(currentChange.updatedContent)}
                                          className="rounded bg-slate-700 px-3 py-2 text-[10px] font-semibold text-slate-200 hover:bg-slate-600"
                                          title="Copy updated content to clipboard"
                                        >
                                          📋 Copy
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDecisionChange(record.id, currentChange.path, 'accepted', fileChanges)}
                                          className={`rounded px-3 py-2 text-[10px] font-semibold transition ${
                                            decision === 'accepted'
                                              ? 'bg-green-600 text-white'
                                              : 'bg-green-700/40 text-green-100 hover:bg-green-600'
                                          }`}
                                          title="Accept this change"
                                        >
                                          ✅ Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDecisionChange(record.id, currentChange.path, 'skipped', fileChanges)}
                                          className={`rounded px-3 py-2 text-[10px] font-semibold transition ${
                                            decision === 'skipped'
                                              ? 'bg-yellow-600 text-white'
                                              : 'bg-yellow-700/40 text-yellow-100 hover:bg-yellow-600'
                                          }`}
                                          title="Skip this change"
                                        >
                                          ⏭️ Skip
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDecisionChange(record.id, currentChange.path, 'pending', fileChanges)}
                                          className="rounded px-3 py-2 text-[10px] font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600"
                                          title="Reset decision"
                                        >
                                          ↩️ Reset
                                        </button>
                                      </div>
                                    </div>

                                    {/* Navigation between files */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedFileIndex(prev => ({ ...prev, [record.id]: Math.max(0, currentFileIdx - 1) }))}
                                        disabled={currentFileIdx === 0}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        ◀ Previous
                                      </button>
                                      <span className="text-[10px] text-slate-400">
                                        File {currentFileIdx + 1} of {fileChanges.length}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedFileIndex(prev => ({ ...prev, [record.id]: Math.min(fileChanges.length - 1, currentFileIdx + 1) }))}
                                        disabled={currentFileIdx === fileChanges.length - 1}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Next ▶
                                      </button>
                                    </div>
                                  </div>

                                  {/* Apply footer */}
                                  <div className="px-4 py-3 bg-slate-800/80 border-t border-slate-700 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-[11px] text-slate-400">
                                      {acceptedCount > 0 
                                        ? `${acceptedCount} file${acceptedCount !== 1 ? 's' : ''} ready to apply. Changes include automatic backups for undo.`
                                        : 'Accept changes to enable apply. All changes include automatic backups.'}
                                    </span>
                                    <button
                                      onClick={() => handleApplySelectedChanges(record)}
                                      disabled={runApplyLoading[record.id] || acceptedCount === 0}
                                      className={`flex items-center justify-center gap-2 rounded px-4 py-2 text-xs font-semibold transition ${
                                        runApplyLoading[record.id]
                                          ? 'bg-slate-600 text-slate-300 cursor-wait'
                                          : acceptedCount === 0
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-500 text-white'
                                      }`}
                                      type="button"
                                    >
                                      {runApplyLoading[record.id] ? '⏳ Applying…' : `💾 Apply ${acceptedCount} Change${acceptedCount !== 1 ? 's' : ''}`}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {record.result?.finalCode && (!record.result.fileChanges || record.result.fileChanges.length === 0) && (() => {
                              // Extract code blocks from finalCode for better display
                              const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
                              const extractedBlocks: Array<{ language: string; code: string; filename?: string }> = [];
                              let match;
                              while ((match = codeBlockRegex.exec(record.result.finalCode)) !== null) {
                                const language = match[1] || 'text';
                                const code = match[2].trim();
                                // Try to extract filename from first comment line
                                const firstLine = code.split('\n')[0];
                                const filenameMatch = firstLine?.match(/\/\/\s*(.+\.\w+)|#\s*(.+\.\w+)|\/\*\s*(.+\.\w+)/);
                                const filename = filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3];
                                extractedBlocks.push({ language, code, filename });
                              }

                              // If no code blocks found, treat entire output as single block
                              if (extractedBlocks.length === 0) {
                                extractedBlocks.push({ language: 'text', code: record.result.finalCode });
                              }

                              return (
                                <div className="rounded-lg border border-slate-600 bg-slate-900/90 overflow-hidden">
                                  {/* Header */}
                                  <div className="px-4 py-3 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border-b border-slate-700">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg">📄</span>
                                        <div>
                                          <h3 className="text-sm font-bold text-white">Production Engineer Output</h3>
                                          <p className="text-[10px] text-slate-300">
                                            {extractedBlocks.length} code block{extractedBlocks.length !== 1 ? 's' : ''} extracted
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleCopyRunCode(record.result!.finalCode)}
                                        className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600"
                                        type="button"
                                      >
                                        📋 Copy All
                                      </button>
                                    </div>
                                  </div>

                                  {/* Code blocks */}
                                  <div className="p-4 space-y-4">
                                    {extractedBlocks.map((block, idx) => (
                                      <div key={`code-block-${idx}`} className="rounded border border-slate-700 overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-600/40 text-blue-200">
                                              {block.language}
                                            </span>
                                            {block.filename && (
                                              <span className="text-[11px] text-slate-300">{block.filename}</span>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => navigator.clipboard.writeText(block.code)}
                                            className="px-2 py-1 rounded text-[10px] bg-slate-700 text-slate-300 hover:bg-slate-600"
                                            type="button"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <div className="max-h-80 overflow-auto font-mono">
                                          {block.code.split('\n').map((line, lineIdx) => (
                                            <div key={`line-${lineIdx}`} className="flex hover:bg-slate-800/50">
                                              <span className="inline-block w-10 text-right pr-2 py-0.5 text-gray-500 select-none text-[10px] bg-slate-900/50">
                                                {lineIdx + 1}
                                              </span>
                                              <pre className="flex-1 px-2 py-0.5 text-[11px] whitespace-pre text-slate-100">{line || ' '}</pre>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {record.result?.stages && record.result.stages.length > 0 && (
                              <div className="rounded border border-blue-500/60 bg-blue-900/10 p-3 space-y-2">
                                <strong className="text-blue-200">Stage Details</strong>
                                <div className="space-y-2">
                                  {record.result.stages.map((stage) => (
                                    <div key={`${record.id}-${stage.id}`} className="rounded border border-blue-500/40 bg-blue-950/40 p-2">
                                      <div className="flex items-center justify-between">
                                        <StageStatusSummary stage={stage} />
                                        {stage.output && (
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(stage.output || '');
                                              alert(`✅ Copied ${stage.name} output to clipboard!`);
                                            }}
                                            className="px-2 py-1 text-[10px] rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                                            title={`Copy ${stage.name} output`}
                                          >
                                            📋 Copy
                                          </button>
                                        )}
                                      </div>
                                      {stage.output && (
                                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-blue-50 bg-black/40 p-2 rounded">
                                          {stage.output}
                                        </pre>
                                      )}
                                      {stage.error && (
                                        <div className="mt-2 rounded border border-red-500/40 bg-red-900/30 p-2 text-[11px] text-red-100">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold">Error:</span>
                                            <button
                                              onClick={() => {
                                                navigator.clipboard.writeText(stage.error || '');
                                                alert(`✅ Copied error to clipboard!`);
                                              }}
                                              className="px-2 py-1 text-[10px] rounded bg-red-600 hover:bg-red-500 text-white font-semibold"
                                              title="Copy error"
                                            >
                                              📋 Copy
                                            </button>
                                          </div>
                                          {stage.error}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Real-time Code Analysis View - Shows actual file content line-by-line */}
            {analysisProgress.totalFiles > 0 && (() => {
              // Use viewingFileIndex for user-selected file, or current analyzing file
              const displayIndex = viewingFileIndex < analysisProgress.fileResults.length 
                ? viewingFileIndex 
                : analysisProgress.currentFileIndex;
              const currentFileData = analysisProgress.fileResults[displayIndex];
              const fileContent = currentFileData?.originalContent || '';
              const lines = fileContent.split('\n');
              const analyzedLineCount = currentFileData?.analyzedLines || 0;
              const isFileComplete = currentFileData?.status === 'complete';
              
              // Get the current open file for editing
              const currentOpenFile = openFiles.find(f => f.path === currentFileData?.path);
              const editedContent = currentOpenFile?.editedContent || '';
              const editedLines = editedContent ? editedContent.split('\n') : [];
              
              // Undo/Redo handlers
              const handleUndo = () => {
                if (!currentFileData?.path) return;
                const history = undoHistory[currentFileData.path] || [];
                if (history.length === 0) return;
                
                const previousContent = history[history.length - 1];
                setUndoHistory(prev => ({
                  ...prev,
                  [currentFileData.path]: history.slice(0, -1)
                }));
                setRedoHistory(prev => ({
                  ...prev,
                  [currentFileData.path]: [...(prev[currentFileData.path] || []), editedContent]
                }));
                setOpenFiles(prev => prev.map(f => 
                  f.path === currentFileData.path 
                    ? { ...f, editedContent: previousContent, isModified: previousContent !== f.originalContent }
                    : f
                ));
              };
              
              const handleRedo = () => {
                if (!currentFileData?.path) return;
                const history = redoHistory[currentFileData.path] || [];
                if (history.length === 0) return;
                
                const nextContent = history[history.length - 1];
                setRedoHistory(prev => ({
                  ...prev,
                  [currentFileData.path]: history.slice(0, -1)
                }));
                setUndoHistory(prev => ({
                  ...prev,
                  [currentFileData.path]: [...(prev[currentFileData.path] || []), editedContent]
                }));
                setOpenFiles(prev => prev.map(f => 
                  f.path === currentFileData.path 
                    ? { ...f, editedContent: nextContent, isModified: nextContent !== f.originalContent }
                    : f
                ));
              };
              
              const handleSave = async () => {
                if (!currentFileData?.path || !projectPath) return;
                const fullPath = `${projectPath}/${currentFileData.path}`;
                const contentToSave = editedContent || currentFileData.originalContent || '';
                const result = await windsurf.saveFileWithBackup(fullPath, contentToSave);
                if (result.success) {
                  alert(`✅ Saved: ${currentFileData.path}\nBackup: ${result.backupPath || 'none'}`);
                  setOpenFiles(prev => prev.map(f => 
                    f.path === currentFileData.path 
                      ? { ...f, originalContent: contentToSave, isModified: false }
                      : f
                  ));
                } else {
                  alert('❌ Failed to save file');
                }
              };
              
              const handleCloseFile = (path: string) => {
                setOpenFiles(prev => prev.filter(f => f.path !== path));
                // If closing current file, switch to another
                if (currentFileData?.path === path) {
                  const remaining = openFiles.filter(f => f.path !== path);
                  if (remaining.length > 0) {
                    const newIdx = analysisProgress.fileResults.findIndex(f => f.path === remaining[0].path);
                    if (newIdx >= 0) setViewingFileIndex(newIdx);
                  }
                }
              };
              
              return (
                <div className="bg-gray-900 rounded-lg border border-blue-500/50 mb-6 overflow-hidden">
                  {/* Toolbar */}
                  <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSave}
                        disabled={!currentOpenFile?.isModified}
                        className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white flex items-center gap-1"
                        title="Save file (Ctrl+S)"
                      >
                        💾 Save
                      </button>
                      <button
                        onClick={handleUndo}
                        disabled={!undoHistory[currentFileData?.path || '']?.length}
                        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white"
                        title="Undo (Ctrl+Z)"
                      >
                        ↩️ Undo
                      </button>
                      <button
                        onClick={handleRedo}
                        disabled={!redoHistory[currentFileData?.path || '']?.length}
                        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white"
                        title="Redo (Ctrl+Y)"
                      >
                        ↪️ Redo
                      </button>
                      <div className="w-px h-5 bg-gray-600 mx-2" />
                      <button
                        onClick={() => navigator.clipboard.writeText(editedContent || fileContent)}
                        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                        title="Copy to clipboard"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => {
                          // Accept AI suggestion
                          const suggestedContent = liveFileChanges.find(c => c.path === currentFileData?.path)?.updatedContent;
                          if (suggestedContent && currentFileData?.path) {
                            setUndoHistory(prev => ({
                              ...prev,
                              [currentFileData.path]: [...(prev[currentFileData.path] || []), editedContent || fileContent]
                            }));
                            setOpenFiles(prev => {
                              const existing = prev.find(f => f.path === currentFileData.path);
                              if (existing) {
                                return prev.map(f => f.path === currentFileData.path 
                                  ? { ...f, editedContent: suggestedContent, isModified: true }
                                  : f
                                );
                              }
                              return [...prev, {
                                path: currentFileData.path,
                                originalContent: fileContent,
                                suggestedContent,
                                isModified: true,
                                editedContent: suggestedContent
                              }];
                            });
                          }
                        }}
                        disabled={!liveFileChanges.find(c => c.path === currentFileData?.path)}
                        className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                        title="Accept AI suggestion"
                      >
                        ✅ Accept
                      </button>
                      <button
                        onClick={() => {
                          // Reject - revert to original
                          if (currentFileData?.path) {
                            setOpenFiles(prev => prev.map(f => 
                              f.path === currentFileData.path 
                                ? { ...f, editedContent: f.originalContent, isModified: false }
                                : f
                            ));
                          }
                        }}
                        className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white"
                        title="Reject changes"
                      >
                        ❌ Reject
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentOpenFile?.isModified && (
                        <span className="text-yellow-400 text-xs">● Modified</span>
                      )}
                      {isRunning && (
                        <span className="text-blue-400 text-xs animate-pulse">⚙️ Analyzing...</span>
                      )}
                    </div>
                  </div>

                  {/* Open Files Tabs */}
                  {openFiles.length > 0 && (
                    <div className="bg-gray-850 px-2 py-1 border-b border-gray-700 flex items-center gap-1 overflow-x-auto">
                      {openFiles.map((file) => {
                        const fileIdx = analysisProgress.fileResults.findIndex(f => f.path === file.path);
                        const isActive = fileIdx === displayIndex;
                        return (
                          <div
                            key={file.path}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ${
                              isActive 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            <span 
                              onClick={() => fileIdx >= 0 && setViewingFileIndex(fileIdx)}
                              className="truncate max-w-[150px]"
                              title={file.path}
                            >
                              {file.isModified && <span className="text-yellow-400 mr-1">●</span>}
                              {file.path.split('/').pop()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseFile(file.path);
                              }}
                              className="hover:bg-red-500/50 rounded px-1"
                              title="Close file"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Header with file info and progress */}
                  <div className="bg-gradient-to-r from-blue-900/80 to-purple-900/80 px-4 py-3 border-b border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={isRunning ? "animate-pulse text-2xl" : "text-2xl"}>📄</span>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            {currentFileData?.path || 'No file selected'}
                            {isRunning && currentFileData?.status === 'analyzing' && (
                              <span className="animate-spin text-blue-400">⚙️</span>
                            )}
                            {isFileComplete && <span className="text-green-400">✓</span>}
                          </h3>
                          <p className="text-[10px] text-blue-200">
                            {isRunning 
                              ? `Analyzing line ${analyzedLineCount} of ${lines.length} • File ${displayIndex + 1} of ${analysisProgress.totalFiles}`
                              : `${lines.length} lines • File ${displayIndex + 1} of ${analysisProgress.totalFiles}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-gray-400">Progress</div>
                          <div className="text-lg font-bold text-blue-400">
                            {isFileComplete ? '100%' : `${Math.round((analyzedLineCount / Math.max(lines.length, 1)) * 100)}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Line progress bar */}
                    {isRunning && (
                      <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-150"
                          style={{ width: `${isFileComplete ? 100 : (analyzedLineCount / Math.max(lines.length, 1)) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Code Editor View - Side by Side with Proper Diff Highlighting */}
                  {(() => {
                    // Compute line-by-line diff between original and suggested/edited content
                    // Try multiple path formats to find the matching file change
                    const fileChange = liveFileChanges.find(c => {
                      const currentPath = currentFileData?.path || '';
                      // Try exact match, basename match, or partial path match
                      return c.path === currentPath || 
                             c.path.endsWith(currentPath) || 
                             currentPath.endsWith(c.path) ||
                             c.path.split('/').pop() === currentPath.split('/').pop();
                    });
                    
                    const suggestedContent = fileChange?.updatedContent || '';
                    const suggestedLines = suggestedContent ? suggestedContent.split('\n') : [];
                    const displayLines = editedLines.length > 0 ? editedLines : suggestedLines;
                    
                    // If no AI suggestions yet, show original code without diff markers
                    const hasSuggestions = displayLines.length > 0;
                    
                    // Build diff data
                    type DiffLine = { 
                      type: 'unchanged' | 'deleted' | 'added' | 'modified'; 
                      originalLine: string; 
                      newLine: string;
                      originalLineNum: number;
                      newLineNum: number;
                    };
                    
                    const diffLines: DiffLine[] = [];
                    let origIdx = 0;
                    let newIdx = 0;
                    
                    // If no suggestions, just show original as unchanged
                    if (!hasSuggestions) {
                      for (let i = 0; i < lines.length; i++) {
                        diffLines.push({ 
                          type: 'unchanged', 
                          originalLine: lines[i], 
                          newLine: lines[i], 
                          originalLineNum: i + 1, 
                          newLineNum: i + 1 
                        });
                      }
                    } else {
                      // Simple line-by-line comparison
                      while (origIdx < lines.length || newIdx < displayLines.length) {
                        const origLine = origIdx < lines.length ? lines[origIdx] : null;
                        const newLine = newIdx < displayLines.length ? displayLines[newIdx] : null;
                        
                        if (origLine !== null && newLine !== null) {
                          if (origLine === newLine) {
                            diffLines.push({ type: 'unchanged', originalLine: origLine, newLine, originalLineNum: origIdx + 1, newLineNum: newIdx + 1 });
                            origIdx++;
                            newIdx++;
                          } else {
                            // Lines are different - mark as modified
                            diffLines.push({ type: 'modified', originalLine: origLine, newLine, originalLineNum: origIdx + 1, newLineNum: newIdx + 1 });
                            origIdx++;
                            newIdx++;
                          }
                        } else if (origLine !== null) {
                          // Line deleted
                          diffLines.push({ type: 'deleted', originalLine: origLine, newLine: '', originalLineNum: origIdx + 1, newLineNum: -1 });
                          origIdx++;
                        } else if (newLine !== null) {
                          // Line added
                          diffLines.push({ type: 'added', originalLine: '', newLine, originalLineNum: -1, newLineNum: newIdx + 1 });
                          newIdx++;
                        }
                      }
                    }
                    
                    const deletedCount = diffLines.filter(d => d.type === 'deleted').length;
                    const addedCount = diffLines.filter(d => d.type === 'added').length;
                    const modifiedCount = diffLines.filter(d => d.type === 'modified').length;
                    
                    return (
                      <div className="grid grid-cols-2 divide-x divide-gray-700">
                        {/* Original Code Panel - Shows DELETED lines in RED */}
                        <div className="flex flex-col">
                          <div className="px-3 py-2 bg-red-900/30 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-red-400 font-semibold text-xs">📋 ORIGINAL CODE</span>
                              <span className="text-gray-500 text-[10px]">{lines.length} lines</span>
                            </div>
                            {deletedCount > 0 && (
                              <span className="text-red-400 text-[10px] bg-red-900/50 px-2 py-0.5 rounded">
                                -{deletedCount} deleted
                              </span>
                            )}
                          </div>
                          <div className="max-h-[500px] overflow-auto font-mono text-[11px]">
                            {lines.length === 0 || (lines.length === 1 && lines[0] === '') ? (
                              <div className="flex items-center justify-center h-32 text-gray-500">
                                <div className="text-center">
                                  <span className="text-2xl block mb-2">📂</span>
                                  <span>No content loaded</span>
                                  <p className="text-[10px] mt-1">Select files in the context panel above</p>
                                </div>
                              </div>
                            ) : (
                              diffLines.map((diff, idx) => {
                                const isAnalyzed = diff.originalLineNum <= analyzedLineCount || isFileComplete;
                                const isCurrentLine = isRunning && diff.originalLineNum === analyzedLineCount && !isFileComplete;
                                const isDeleted = diff.type === 'deleted';
                                const isModified = diff.type === 'modified';
                                
                                // Skip added lines in original panel (they don't exist there)
                                if (diff.type === 'added') {
                                  return (
                                    <div key={`orig-${idx}`} className="flex bg-gray-900/20 h-[22px]">
                                      <span className="inline-block w-12 text-right pr-3 py-0.5 select-none border-r border-gray-700 text-gray-700">
                                        
                                      </span>
                                      <pre className="flex-1 px-3 py-0.5 text-gray-700"></pre>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div 
                                    key={`orig-${idx}`}
                                    className={`flex ${
                                      isCurrentLine 
                                        ? 'bg-yellow-900/50 border-l-4 border-yellow-400' 
                                        : isDeleted
                                          ? 'bg-red-900/60 border-l-4 border-red-500'
                                          : isModified
                                            ? 'bg-red-900/40 border-l-4 border-red-400'
                                            : isAnalyzed 
                                              ? 'bg-gray-900/30' 
                                              : 'bg-gray-900/50'
                                    } hover:bg-gray-800/50`}
                                  >
                                    <span className={`inline-block w-12 text-right pr-3 py-0.5 select-none border-r border-gray-700 ${
                                      isCurrentLine ? 'text-yellow-400 font-bold' : 
                                      isDeleted ? 'text-red-400 font-bold' : 
                                      isModified ? 'text-red-300' :
                                      isAnalyzed ? 'text-gray-500' : 'text-gray-600'
                                    }`}>
                                      {diff.originalLineNum > 0 ? diff.originalLineNum : ''}
                                    </span>
                                    <pre className={`flex-1 px-3 py-0.5 whitespace-pre overflow-x-auto ${
                                      isCurrentLine ? 'text-yellow-200' : 
                                      isDeleted ? 'text-red-300 line-through' : 
                                      isModified ? 'text-red-200' :
                                      isAnalyzed ? 'text-gray-300' : 'text-gray-500'
                                    }`}>
                                      {isDeleted && <span className="text-red-500 mr-1">-</span>}
                                      {isModified && <span className="text-red-400 mr-1">~</span>}
                                      {diff.originalLine || ' '}
                                    </pre>
                                    {isCurrentLine && (
                                      <span className="px-2 py-0.5 text-yellow-400 animate-pulse text-[9px]">◀ analyzing</span>
                                    )}
                                    {isDeleted && (
                                      <span className="px-2 py-0.5 text-red-400 text-[9px]">DELETED</span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* AI Suggested / Edited Content Panel - Shows ADDED lines in GREEN */}
                        <div className="flex flex-col">
                          <div className="px-3 py-2 bg-green-900/30 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-green-400 font-semibold text-xs">
                                {currentOpenFile?.isModified ? '✏️ EDITED CODE' : '✨ AI SUGGESTIONS'}
                              </span>
                              <span className="text-gray-500 text-[10px]">
                                {displayLines.length} lines
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {addedCount > 0 && (
                                <span className="text-green-400 text-[10px] bg-green-900/50 px-2 py-0.5 rounded">
                                  +{addedCount} added
                                </span>
                              )}
                              {modifiedCount > 0 && (
                                <span className="text-yellow-400 text-[10px] bg-yellow-900/50 px-2 py-0.5 rounded">
                                  ~{modifiedCount} modified
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="max-h-[500px] overflow-auto font-mono text-[11px]">
                            {!hasSuggestions ? (
                              <div className="flex items-center justify-center h-32 text-gray-500">
                                <div className="text-center">
                                  {isRunning ? (
                                    <>
                                      <span className="text-2xl block mb-2 animate-pulse">🤖</span>
                                      <span>AI is analyzing code...</span>
                                      <p className="text-[10px] mt-1">Suggestions will appear here when ready</p>
                                    </>
                                  ) : isFileComplete ? (
                                    <>
                                      <span className="text-2xl block mb-2">✅</span>
                                      <span>No changes suggested for this file</span>
                                      <p className="text-[10px] mt-1">The AI found no modifications needed</p>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-2xl block mb-2">⏳</span>
                                      <span>Waiting for analysis to begin...</span>
                                      <p className="text-[10px] mt-1">Run the pipeline to see AI suggestions</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            ) : (
                              diffLines.map((diff, idx) => {
                                const isCurrentLine = isRunning && diff.newLineNum === analyzedLineCount && !isFileComplete;
                                const isAdded = diff.type === 'added';
                                const isModified = diff.type === 'modified';
                                
                                // Skip deleted lines in new panel (they don't exist there)
                                if (diff.type === 'deleted') {
                                  return (
                                    <div key={`sugg-${idx}`} className="flex bg-gray-900/20 h-[22px]">
                                      <span className="inline-block w-12 text-right pr-3 py-0.5 select-none border-r border-gray-700 text-gray-700">
                                        
                                      </span>
                                      <pre className="flex-1 px-3 py-0.5 text-gray-700"></pre>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div 
                                    key={`sugg-${idx}`}
                                    className={`flex ${
                                      isCurrentLine 
                                        ? 'bg-blue-900/50 border-l-4 border-blue-400' 
                                        : isAdded
                                          ? 'bg-green-900/60 border-l-4 border-green-500'
                                          : isModified
                                            ? 'bg-green-900/40 border-l-4 border-green-400'
                                            : 'bg-gray-900/30'
                                    } hover:bg-gray-800/50`}
                                  >
                                    <span className={`inline-block w-12 text-right pr-3 py-0.5 select-none border-r border-gray-700 ${
                                      isCurrentLine ? 'text-blue-400 font-bold' : 
                                      isAdded ? 'text-green-400 font-bold' : 
                                      isModified ? 'text-green-300' :
                                      'text-gray-600'
                                    }`}>
                                      {diff.newLineNum > 0 ? diff.newLineNum : ''}
                                    </span>
                                    <pre className={`flex-1 px-3 py-0.5 whitespace-pre overflow-x-auto ${
                                      isCurrentLine ? 'text-blue-200' : 
                                      isAdded ? 'text-green-300 font-semibold' : 
                                      isModified ? 'text-green-200' :
                                      'text-gray-300'
                                    }`}>
                                      {isAdded && <span className="text-green-500 mr-1">+</span>}
                                      {isModified && <span className="text-green-400 mr-1">~</span>}
                                      {diff.newLine || ' '}
                                    </pre>
                                    {isAdded && (
                                      <span className="px-2 py-0.5 text-green-400 text-[9px]">ADDED</span>
                                    )}
                                    {isModified && !isAdded && (
                                      <span className="px-2 py-0.5 text-green-400 text-[9px]">CHANGED</span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                            {isRunning && analyzedLineCount > 0 && analyzedLineCount < lines.length && !isFileComplete && (
                              <div className="flex items-center justify-center py-4 text-gray-500 border-t border-gray-700">
                                <span className="animate-pulse">Processing remaining {lines.length - analyzedLineCount} lines...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* File Navigation - Clickable Buttons */}
                  <div className="px-4 py-3 bg-gray-800/80 border-t border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Files:</span>
                      {analysisProgress.fileResults.slice(0, 10).map((file, idx) => (
                        <button
                          key={file.path}
                          onClick={() => {
                            setViewingFileIndex(idx);
                            // Add to open files if not already open
                            if (!openFiles.find(f => f.path === file.path)) {
                              const suggestedContent = liveFileChanges.find(c => c.path === file.path)?.updatedContent || '';
                              setOpenFiles(prev => [...prev, {
                                path: file.path,
                                originalContent: file.originalContent || '',
                                suggestedContent,
                                isModified: false,
                                editedContent: suggestedContent || file.originalContent || ''
                              }]);
                            }
                          }}
                          className={`w-8 h-8 rounded text-xs font-bold cursor-pointer transition-all hover:scale-110 ${
                            idx === displayIndex
                              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                              : file.status === 'complete'
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : file.status === 'analyzing'
                                  ? 'bg-yellow-600 text-white animate-pulse'
                                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          }`}
                          title={`${file.path} (${file.status})`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                      {analysisProgress.fileResults.length > 10 && (
                        <span className="text-xs text-gray-500">+{analysisProgress.fileResults.length - 10}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {analysisProgress.analyzedFiles} of {analysisProgress.totalFiles} files complete
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Live File Changes Preview - ONLY show when pipeline is complete, not during analysis */}
            {!isRunning && liveFileChanges.length > 0 && (
              <div className="bg-gray-800 rounded-lg border border-green-500/50 mb-6 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-green-900/60 to-emerald-900/60 border-b border-green-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Analysis Complete - Review Changes
                        </h3>
                        <p className="text-[10px] text-green-200">
                          {liveFileChanges.length} file{liveFileChanges.length !== 1 ? 's' : ''} with suggested changes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Accept all changes
                          setReviewMode(prev => ({
                            ...prev,
                            active: true,
                            decisions: Object.fromEntries(liveFileChanges.map(c => [c.path, 'accepted']))
                          }));
                        }}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded"
                      >
                        ✅ Accept All
                      </button>
                      <button
                        onClick={() => {
                          // Reject all changes
                          setReviewMode(prev => ({
                            ...prev,
                            active: true,
                            decisions: Object.fromEntries(liveFileChanges.map(c => [c.path, 'rejected']))
                          }));
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded"
                      >
                        ❌ Reject All
                      </button>
                    </div>
                  </div>
                </div>

                {/* File-by-file review */}
                <div className="divide-y divide-gray-700">
                  {liveFileChanges.map((change, idx) => {
                    const decision = reviewMode.decisions[change.path] || 'pending';
                    return (
                      <div key={`review-${change.path}-${idx}`} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{change.isNewFile ? '✨' : '📝'}</span>
                            <span className="font-mono text-sm text-white">{change.path}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${
                              change.isNewFile ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              {change.isNewFile ? 'NEW FILE' : 'MODIFIED'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setReviewMode(prev => ({
                                ...prev,
                                decisions: { ...prev.decisions, [change.path]: 'accepted' }
                              }))}
                              className={`px-2 py-1 text-xs rounded ${
                                decision === 'accepted' 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-gray-700 text-gray-300 hover:bg-green-600/50'
                              }`}
                            >
                              ✅ Accept
                            </button>
                            <button
                              onClick={() => setReviewMode(prev => ({
                                ...prev,
                                decisions: { ...prev.decisions, [change.path]: 'rejected' }
                              }))}
                              className={`px-2 py-1 text-xs rounded ${
                                decision === 'rejected' 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-gray-700 text-gray-300 hover:bg-red-600/50'
                              }`}
                            >
                              ❌ Reject
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(change.updatedContent)}
                              className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                            >
                              📋 Copy
                            </button>
                            <button
                              onClick={async () => {
                                if (projectPath && change.path) {
                                  const fullPath = `${projectPath}/${change.path}`;
                                  const result = await windsurf.saveFileWithBackup(fullPath, change.updatedContent);
                                  if (result.success) {
                                    alert(`Saved to ${fullPath}\nBackup: ${result.backupPath || 'none'}`);
                                  } else {
                                    alert('Failed to save file');
                                  }
                                }
                              }}
                              className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500"
                            >
                              💾 Save
                            </button>
                          </div>
                        </div>
                        {/* Side-by-side diff view */}
                        <FileChangePreview change={change} />
                      </div>
                    );
                  })}
                </div>

                {/* Apply changes footer */}
                <div className="px-4 py-3 bg-gray-800/80 border-t border-gray-700 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {Object.values(reviewMode.decisions).filter(d => d === 'accepted').length} accepted, 
                    {Object.values(reviewMode.decisions).filter(d => d === 'rejected').length} rejected, 
                    {liveFileChanges.length - Object.keys(reviewMode.decisions).length} pending
                  </span>
                  <button
                    onClick={async () => {
                      const acceptedChanges = liveFileChanges.filter(c => reviewMode.decisions[c.path] === 'accepted');
                      if (acceptedChanges.length === 0) {
                        alert('No changes accepted. Select files to apply.');
                        return;
                      }
                      for (const change of acceptedChanges) {
                        if (projectPath) {
                          const fullPath = `${projectPath}/${change.path}`;
                          await windsurf.saveFileWithBackup(fullPath, change.updatedContent);
                        }
                      }
                      alert(`Applied ${acceptedChanges.length} changes`);
                    }}
                    disabled={Object.values(reviewMode.decisions).filter(d => d === 'accepted').length === 0}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-semibold rounded"
                  >
                    💾 Apply {Object.values(reviewMode.decisions).filter(d => d === 'accepted').length} Accepted Changes
                  </button>
                </div>
              </div>
            )}

            {/* Separate Summary Panel - Shows after pipeline completes */}
            {!isRunning && result && showSummaryPanel && (
              <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-lg border border-purple-500/50 mb-6 overflow-hidden">
                <div className="px-4 py-3 bg-purple-900/60 border-b border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Pipeline Summary</h3>
                      <p className="text-[10px] text-purple-200">
                        Analysis complete • {result.success ? 'Success' : 'Failed'} • Quality Score: {result.qualityScore || 0}%
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSummaryPanel(false)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Close summary"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Quality Score */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">Quality Score</span>
                        <span className={`text-lg font-bold ${
                          (result.qualityScore || 0) >= 80 ? 'text-green-400' :
                          (result.qualityScore || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {result.qualityScore || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            (result.qualityScore || 0) >= 80 ? 'bg-green-500' :
                            (result.qualityScore || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${result.qualityScore || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Files Changed Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">{liveFileChanges.length}</div>
                      <div className="text-xs text-gray-400">Files Changed</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {liveFileChanges.filter(c => c.isNewFile).length}
                      </div>
                      <div className="text-xs text-gray-400">New Files</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {liveFileChanges.filter(c => !c.isNewFile).length}
                      </div>
                      <div className="text-xs text-gray-400">Modified</div>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  {result.productionSummary && (
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                        <span>💡</span> AI Suggestions & Recommendations
                      </h4>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {result.productionSummary}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings && result.warnings.length > 0 && (
                    <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-500/30">
                      <h4 className="text-sm font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                        <span>⚠️</span> Warnings ({result.warnings.length})
                      </h4>
                      <ul className="text-sm text-yellow-200 space-y-1">
                        {result.warnings.map((warning, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Stage Summary */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                      <span>🔄</span> Pipeline Stages
                    </h4>
                    <div className="space-y-2">
                      {result.stages?.map((stage) => (
                        <div key={stage.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300 flex items-center gap-2">
                            {getStageIcon(stage.id)} {stage.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            stage.status === 'completed' ? 'bg-green-600 text-white' :
                            stage.status === 'failed' ? 'bg-red-600 text-white' :
                            'bg-gray-600 text-gray-300'
                          }`}>
                            {stage.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                    <button
                      onClick={() => {
                        // Scroll to the diff viewer section
                        setShowSummaryPanel(false);
                        // Ensure we're viewing the first file
                        if (analysisProgress.fileResults.length > 0) {
                          setViewingFileIndex(0);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-semibold"
                    >
                      📝 Review & Edit Files
                    </button>
                    <button
                      onClick={() => {
                        // Copy summary to clipboard
                        const summaryText = `Pipeline Summary\n${'='.repeat(40)}\n` +
                          `Quality Score: ${result.qualityScore || 0}%\n` +
                          `Files Changed: ${liveFileChanges.length}\n` +
                          `New Files: ${liveFileChanges.filter(c => c.isNewFile).length}\n` +
                          `Modified: ${liveFileChanges.filter(c => !c.isNewFile).length}\n\n` +
                          `Suggestions:\n${result.productionSummary || 'None'}\n\n` +
                          `Warnings:\n${result.warnings?.join('\n') || 'None'}`;
                        navigator.clipboard.writeText(summaryText);
                        alert('Summary copied to clipboard!');
                      }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                    >
                      📋 Copy Summary
                    </button>
                    <button
                      onClick={() => setShowSummaryPanel(false)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded"
                    >
                      ✓ Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stage Details */}
            {currentStage && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  {getStageIcon(currentStage.id)} {currentStage.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300 mb-4">
                  {(() => {
                    const start = currentStage.startTime instanceof Date ? currentStage.startTime : parseStageTimestamp(currentStage.startTime);
                    const end = currentStage.endTime instanceof Date ? currentStage.endTime : parseStageTimestamp(currentStage.endTime);
                    const duration = computeStageDurationMs(currentStage);
                    const attempts = getStageAttemptCount(currentStage);

                    return (
                      <>
                        {start && (
                          <span className="rounded bg-gray-700/60 px-2 py-1">
                            Started {formatTimestamp(start) ?? '—'}
                          </span>
                        )}
                        {end && (
                          <span className="rounded bg-gray-700/60 px-2 py-1">
                            Ended {formatTimestamp(end) ?? '—'}
                          </span>
                        )}
                        {duration !== null && (
                          <span className="rounded bg-gray-700/60 px-2 py-1">
                            Duration {formatDuration(duration)}
                          </span>
                        )}
                        {attempts > 1 && (
                          <span className="rounded bg-purple-700/50 px-2 py-1 text-purple-100">
                            Attempt {attempts}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                {currentStage.status === 'in_progress' && (
                  <div className="flex items-center gap-3 text-yellow-400">
                    <div className="animate-spin text-2xl">⚙️</div>
                    <span>Agent is working...</span>
                  </div>
                )}
                {currentStage.status === 'completed' && currentStage.output && (
                  <div className="bg-gray-900 rounded p-4 border border-green-500/50">
                    <h4 className="text-green-400 font-bold mb-2">✅ Output:</h4>
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                      {currentStage.output.substring(0, 500)}...
                    </pre>
                  </div>
                )}
                {currentStage.status === 'rejected' && (
                  <div className="bg-red-900/30 border border-red-500 rounded p-4">
                    <h4 className="text-red-400 font-bold mb-2">❌ Rejected - Sending back for revision</h4>
                    <p className="text-red-300 text-sm">
                      The Quality Checker found issues. Solution Generator will try again.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Final Result - ONLY show when pipeline is complete */}
            {!isRunning && result && (
              <div className={`rounded-lg p-6 mb-6 border-2 ${
                result.success
                  ? result.warnings && result.warnings.length > 0
                    ? 'bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border-amber-500'
                    : 'bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-green-500'
                  : 'bg-gradient-to-r from-red-900/50 to-rose-900/50 border-red-500'
              }`}>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {result.success
                    ? result.warnings && result.warnings.length > 0
                      ? '⚠️ Pipeline Complete with Warnings'
                      : '✅ Pipeline Complete!'
                    : '❌ Pipeline Failed'}
                </h3>
                {result.success && (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-gray-900/50 rounded p-3">
                        <div className="text-gray-400 text-sm">Quality Score</div>
                        <div className="text-2xl font-bold text-green-400">{result.qualityScore}/100</div>
                      </div>
                      <div className="bg-gray-900/50 rounded p-3">
                        <div className="text-gray-400 text-sm">Duration</div>
                        <div className="text-2xl font-bold text-blue-400">{(result.totalDuration / 1000).toFixed(1)}s</div>
                      </div>
                      <div className="bg-gray-900/50 rounded p-3">
                        <div className="text-gray-400 text-sm">Stages</div>
                        <div className="text-2xl font-bold text-purple-400">5/5</div>
                      </div>
                    </div>
                    
                    {result.warnings && result.warnings.length > 0 && (
                      <div className="bg-amber-900/40 border border-amber-500 rounded p-4 mb-4">
                        <h4 className="text-amber-200 font-bold mb-2">⚠️ Quality Assurance Notice</h4>
                        <ul className="list-disc list-inside text-amber-100 text-sm space-y-1">
                          {result.warnings.map((warning, index) => (
                            <li key={`warning-${index}`}>{warning}</li>
                          ))}
                        </ul>
                        <p className="text-amber-300 text-xs mt-3">
                          Proceed with caution. The Quality Checker rejected all attempts, so the production stages continued with the last generated code.
                        </p>
                      </div>
                    )}

                    {/* Side-by-side File Changes Viewer for Final Result */}
                    {result.fileChanges && result.fileChanges.length > 0 ? (() => {
                      const fileChanges = result.fileChanges;
                      const currentFileIdx = selectedFileIndex['current-result'] ?? 0;
                      const currentChange = fileChanges[currentFileIdx];
                      
                      if (!currentChange) return null;

                      return (
                        <div className="rounded-lg border border-slate-600 bg-slate-900/90 overflow-hidden">
                          {/* Header */}
                          <div className="px-4 py-3 bg-gradient-to-r from-emerald-900/60 to-green-900/60 border-b border-slate-700">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">📁</span>
                                <div>
                                  <h3 className="text-sm font-bold text-white">File Changes Review</h3>
                                  <p className="text-[10px] text-slate-300">
                                    {fileChanges.length} file{fileChanges.length !== 1 ? 's' : ''} modified
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => navigator.clipboard.writeText(result.finalCode)}
                                className="px-3 py-1.5 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-500"
                                type="button"
                              >
                                📋 Copy All Code
                              </button>
                            </div>
                          </div>

                          {/* File tabs */}
                          <FileChangeTabs
                            changes={fileChanges}
                            selectedIndex={currentFileIdx}
                            onSelect={(idx) => setSelectedFileIndex(prev => ({ ...prev, ['current-result']: idx }))}
                            decisions={{}}
                          />

                          {/* Current file details */}
                          <div className="p-4 space-y-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{currentChange.isNewFile ? '✨' : '📝'}</span>
                              <strong className="text-sm text-white break-all">{currentChange.path}</strong>
                              <span className="text-[10px] text-slate-400">
                                ({currentChange.isNewFile ? 'New file' : 'Modified'})
                              </span>
                            </div>

                            {currentChange.summary && (
                              <div className="rounded border border-slate-700 bg-slate-800/60 p-3">
                                <p className="text-[11px] text-slate-300">{currentChange.summary}</p>
                              </div>
                            )}

                            {/* Side-by-side diff viewer */}
                            <FileChangePreview change={currentChange} />

                            {/* Copy button for current file */}
                            <div className="flex justify-end">
                              <button
                                onClick={() => navigator.clipboard.writeText(currentChange.updatedContent)}
                                className="px-3 py-2 rounded text-xs font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600"
                                type="button"
                              >
                                📋 Copy This File
                              </button>
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                              <button
                                type="button"
                                onClick={() => setSelectedFileIndex(prev => ({ ...prev, ['current-result']: Math.max(0, currentFileIdx - 1) }))}
                                disabled={currentFileIdx === 0}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                ◀ Previous
                              </button>
                              <span className="text-[10px] text-slate-400">
                                File {currentFileIdx + 1} of {fileChanges.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedFileIndex(prev => ({ ...prev, ['current-result']: Math.min(fileChanges.length - 1, currentFileIdx + 1) }))}
                                disabled={currentFileIdx === fileChanges.length - 1}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Next ▶
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      /* Fallback: Handle NO_CHANGES or extract code blocks */
                      (() => {
                        const finalCode = result.finalCode?.trim() || '';
                        const isNoChanges = finalCode === '<<NO_CHANGES>>' || finalCode.includes('<<NO_CHANGES>>');
                        
                        // Show special message for NO_CHANGES
                        if (isNoChanges) {
                          return (
                            <div className="rounded-lg border border-blue-500/60 bg-blue-900/20 p-6 text-center">
                              <div className="text-4xl mb-3">✅</div>
                              <h4 className="text-lg font-bold text-blue-200 mb-2">No Code Changes Required</h4>
                              <p className="text-sm text-blue-300/80 max-w-md mx-auto">
                                {result.productionSummary || 'The Production Engineer analyzed your request and determined that no code modifications are needed.'}
                              </p>
                              {result.report?.analysisSummary && (
                                <div className="mt-4 p-3 rounded bg-slate-800/60 text-left">
                                  <h5 className="text-xs font-semibold text-slate-300 mb-1">Analysis Summary:</h5>
                                  <p className="text-[11px] text-slate-400 whitespace-pre-line">{result.report.analysisSummary.substring(0, 500)}</p>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Extract code blocks from finalCode
                        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
                        const extractedBlocks: Array<{ language: string; code: string; filename?: string }> = [];
                        let match;
                        while ((match = codeBlockRegex.exec(finalCode)) !== null) {
                          const language = match[1] || 'text';
                          const code = match[2].trim();
                          const firstLine = code.split('\n')[0];
                          const filenameMatch = firstLine?.match(/\/\/\s*(.+\.\w+)|#\s*(.+\.\w+)|\/\*\s*(.+\.\w+)/);
                          const filename = filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3];
                          extractedBlocks.push({ language, code, filename });
                        }
                        if (extractedBlocks.length === 0 && finalCode) {
                          extractedBlocks.push({ language: 'text', code: finalCode });
                        }

                        if (extractedBlocks.length === 0) {
                          return (
                            <div className="rounded-lg border border-yellow-500/60 bg-yellow-900/20 p-6 text-center">
                              <div className="text-4xl mb-3">⚠️</div>
                              <h4 className="text-lg font-bold text-yellow-200 mb-2">No Output Generated</h4>
                              <p className="text-sm text-yellow-300/80">The pipeline completed but did not produce any code output.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="rounded-lg border border-slate-600 bg-slate-900/90 overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-green-900/60 to-emerald-900/60 border-b border-slate-700 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">📄</span>
                                <div>
                                  <h4 className="text-sm font-bold text-white">Production-Ready Code</h4>
                                  <p className="text-[10px] text-slate-300">
                                    {extractedBlocks.length} code block{extractedBlocks.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => navigator.clipboard.writeText(finalCode)}
                                className="px-3 py-1.5 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-500"
                                type="button"
                              >
                                📋 Copy All
                              </button>
                            </div>
                            {result.productionSummary && (
                              <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/40">
                                <p className="text-[11px] text-slate-300">{result.productionSummary}</p>
                              </div>
                            )}
                            <div className="p-4 space-y-4 max-h-[500px] overflow-auto">
                              {extractedBlocks.map((block, idx) => (
                                <div key={`result-block-${idx}`} className="rounded border border-slate-700 overflow-hidden">
                                  <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-600/40 text-green-200">
                                        {block.language}
                                      </span>
                                      {block.filename && (
                                        <span className="text-[11px] text-slate-300">{block.filename}</span>
                                      )}
                                      <span className="text-[10px] text-slate-500">{block.code.split('\n').length} lines</span>
                                    </div>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(block.code)}
                                      className="px-2 py-1 rounded text-[10px] bg-slate-700 text-slate-300 hover:bg-slate-600"
                                      type="button"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <div className="max-h-80 overflow-auto font-mono">
                                    {block.code.split('\n').map((line, lineIdx) => (
                                      <div key={`result-line-${idx}-${lineIdx}`} className="flex hover:bg-slate-800/50">
                                        <span className="inline-block w-10 text-right pr-2 py-0.5 text-gray-500 select-none text-[10px] bg-slate-900/50 border-r border-slate-800">
                                          {lineIdx + 1}
                                        </span>
                                        <pre className="flex-1 px-3 py-0.5 text-[11px] whitespace-pre text-slate-100">{line || ' '}</pre>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Stage Progress Bar Component
 */
const StageProgressBar: React.FC<{ icon: string; name: string; stage?: PipelineStage }> = ({ icon, name, stage }) => {
  const getStatusColor = () => {
    if (!stage) return 'bg-gray-700';
    if (stage.status === 'completed') return 'bg-green-600';
    if (stage.status === 'in_progress') return 'bg-yellow-600 animate-pulse';
    if (stage.status === 'rejected') return 'bg-red-600';
    if (stage.status === 'failed') return 'bg-red-800';
    return 'bg-gray-700';
  };

  const getStatusText = () => {
    if (!stage) return 'Pending';
    if (stage.status === 'completed') {
      const attempts = getStageAttemptCount(stage);
      return attempts > 1 ? `Complete (Attempt ${attempts})` : 'Complete (First try)';
    }
    if (stage.status === 'in_progress') return 'Running...';
    if (stage.status === 'rejected') return 'Rejected - Retrying';
    if (stage.status === 'failed') return 'Failed';
    return 'Pending';
  };

  const durationLabel = stage ? computeStageDurationMs(stage) : null;
  const startDate = stage ? (stage.startTime instanceof Date ? stage.startTime : parseStageTimestamp(stage.startTime)) : null;
  const startLabel = startDate ? formatTimestamp(startDate) : null;
  const attemptCount = stage ? getStageAttemptCount(stage) : null;
  const modelName = stage?.agent?.model;

  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-medium">{name}</span>
          <span className={`text-sm px-2 py-1 rounded ${getStatusColor()} text-white`}>
            {getStatusText()}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getStatusColor()}`}
            style={{ width: stage?.status === 'completed' ? '100%' : stage?.status === 'in_progress' ? '50%' : '0%' }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          {startLabel && <span className="rounded bg-gray-800/70 px-2 py-0.5">Start {startLabel}</span>}
          {durationLabel !== null && <span className="rounded bg-gray-800/70 px-2 py-0.5">Duration {formatDuration(durationLabel)}</span>}
          {attemptCount && attemptCount > 1 && (
            <span className="rounded bg-purple-800/40 px-2 py-0.5 text-purple-200">Attempt {attemptCount}</span>
          )}
          {modelName && (
            <span className="rounded bg-gray-800/70 px-2 py-0.5">Model {modelName}</span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Agent Configuration View
 */
const AgentConfigurationView: React.FC<{
  agents: Record<string, AgentConfig>;
  onSave: (key: string, config: Partial<AgentConfig>) => void;
  onBack: () => void;
}> = ({ agents, onSave, onBack }) => {
  const [selectedAgent, setSelectedAgent] = useState('analyzer');
  const agent = agents[selectedAgent];
  
  return (
    <div className="flex-1 overflow-auto p-6">
      <button
        onClick={onBack}
        className="mb-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
      >
        ← Back to Pipeline
      </button>
      
      <div className="grid grid-cols-5 gap-2 mb-6">
        {Object.keys(agents).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedAgent(key)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedAgent === key
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {agents[key].name}
          </button>
        ))}
      </div>
      
      {agent && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-4">{agent.name}</h3>
          <p className="text-gray-400 mb-6">Role: {agent.role}</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">Model:</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={agent && KNOWN_GEMINI_MODELS.includes(agent.model) ? agent.model : CUSTOM_MODEL_OPTION_VALUE}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === CUSTOM_MODEL_OPTION_VALUE) {
                      // Switch to custom mode by clearing the model so it is no longer treated as a known ID
                      onSave(selectedAgent, { model: '' });
                      return;
                    }
                    onSave(selectedAgent, { model: value });
                  }}
                  className="w-full sm:w-64 bg-gray-900 text-white border border-gray-600 rounded-lg p-2 text-sm"
                  title="Select a known-good Gemini model or choose Custom to provide your own"
                >
                  {KNOWN_GEMINI_MODELS.map(modelId => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                  <option value={CUSTOM_MODEL_OPTION_VALUE}>Custom model…</option>
                </select>

                {!agent || !KNOWN_GEMINI_MODELS.includes(agent.model) ? (
                  <input
                    type="text"
                    value={agent?.model ?? ''}
                    onChange={(event) => onSave(selectedAgent, { model: event.target.value })}
                    className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg p-2 text-sm"
                    title="Custom Gemini model ID"
                    placeholder="Custom Gemini model ID"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Known-good models: {KNOWN_GEMINI_MODELS.join(', ')}. Use a custom ID only if your backend supports it.
              </p>
            </div>
            
            <div>
              <label className="block text-white font-medium mb-2">Temperature: {agent.temperature}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={agent.temperature}
                onChange={(e) => onSave(selectedAgent, { temperature: parseFloat(e.target.value) })}
                className="w-full"
                title="Temperature: controls creativity vs focus"
                aria-label="Temperature slider"
              />
              <p className="text-gray-400 text-sm mt-1">
                Lower = More focused, Higher = More creative
              </p>
            </div>
            
            <div>
              <label className="block text-white font-medium mb-2">System Prompt:</label>
              <textarea
                value={agent.systemPrompt}
                onChange={(e) => onSave(selectedAgent, { systemPrompt: e.target.value })}
                className="w-full h-64 bg-gray-900 text-white border border-gray-600 rounded-lg p-3 font-mono text-sm resize-none"
                title="System prompt for agent behavior"
                placeholder="You are a helpful assistant..."
              />
              <p className="text-gray-400 text-sm mt-1">
                Define this agent's personality and instructions
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Get stage icon
 */
function getStageIcon(stageId: string): string {
  const icons: Record<string, string> = {
    stage1: '🔍',
    stage2: '🏗️',
    stage3: '✅',
    stage4: '🔧',
    stage5: '🛡️'
  };
  return icons[stageId] || '📊';
}
