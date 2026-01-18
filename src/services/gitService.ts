// src/services/gitService.ts
import type { AppSettings } from '../utils/sessionManager';
import { getElectronAPI, isElectronAvailable } from '../utils/electronBridge';

type Renamed = { from: string; to: string };

export type GitStatus = {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Renamed[];
};

interface GitBridge {
  isEnabled?: () => Promise<{ success: boolean; enabled: boolean; error?: string }>;
  status: (repoPath: string) => Promise<{ success: boolean; status?: any; error?: string }>;
  stage: (repoPath: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  unstage: (repoPath: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  commit: (
    repoPath: string,
    message: string,
  ) => Promise<{ success: boolean; result?: any; error?: string }>;
  aiCommitMessage: (
    repoPath: string,
    settings: AppSettings,
    modelId: string,
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
}

const requireGitBridge = async (): Promise<GitBridge> => {
  if (!isElectronAvailable()) {
    throw new Error('Git features require the desktop application environment.');
  }

  const bridge = getElectronAPI()?.git;
  if (!bridge) {
    throw new Error('Git bridge not available. Ensure preload exposes git IPC handlers.');
  }

  if (bridge.isEnabled) {
    const status = await bridge.isEnabled();
    if (!status.success || !status.enabled) {
      throw new Error(status.error || 'Git bridge disabled. Verify Git integration in the desktop app.');
    }
  }

  return bridge as GitBridge;
};

const normalizeError = (msg: string) => new Error(`Git error: ${msg}`);

const mapStatus = (raw: any): GitStatus => {
  const staged = raw.staged || [];
  const created = raw.created || [];
  const modified = raw.modified || [];
  const deleted = raw.deleted || [];
  const renamed: Renamed[] = (raw.renamed || []).map((r: any) => ({
    from: (r && (r.from ?? r['from'])) || '',
    to: (r && (r.to ?? r['to'])) || '',
  }));

  return {
    branch: raw.current || raw.branch || '',
    ahead: raw.ahead ?? 0,
    behind: raw.behind ?? 0,
    staged,
    modified,
    created,
    deleted,
    renamed,
  };
};

export async function status(repoPath: string): Promise<GitStatus> {
  const bridge = await requireGitBridge();
  const res = await bridge.status(repoPath);
  if (!res.success || !res.status) throw normalizeError(res.error || 'Unknown status error');
  return mapStatus(res.status);
}

export async function stage(repoPath: string, files: string[]): Promise<void> {
  if (!files?.length) return;
  const bridge = await requireGitBridge();
  const res = await bridge.stage(repoPath, files);
  if (!res.success) throw normalizeError(res.error || 'Unknown stage error');
}

export async function unstage(repoPath: string, files: string[]): Promise<void> {
  if (!files?.length) return;
  const bridge = await requireGitBridge();
  const res = await bridge.unstage(repoPath, files);
  if (!res.success) throw normalizeError(res.error || 'Unknown unstage error');
}

export async function commit(repoPath: string, message: string): Promise<{ commitId?: string }> {
  if (!message?.trim()) throw new Error('Commit message is required');
  const bridge = await requireGitBridge();
  const res = await bridge.commit(repoPath, message);
  if (!res.success) throw normalizeError(res.error || 'Unknown commit error');
  return { commitId: res.result?.commit || res.result?.commit?.hash };
}

export async function aiCommitMessage(
  repoPath: string,
  settings: AppSettings,
  modelId: string,
): Promise<string> {
  const bridge = await requireGitBridge();
  const res = await bridge.aiCommitMessage(repoPath, settings, modelId);
  if (!res.success || !res.message)
    throw normalizeError(res.error || 'Unknown AI commit message error');
  return res.message;
}
