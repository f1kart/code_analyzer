import React, { useCallback, useEffect, useState } from 'react';
import * as git from '../services/gitService';

interface SourceControlPanelProps {
  repoPath: string | null;
  onDiffRequest: (file: string) => void;
  onGenerateCommitMessage?: () => Promise<string>;
}

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({
  repoPath,
  onDiffRequest,
  onGenerateCommitMessage,
}) => {
  const [status, setStatus] = useState<git.GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async function refresh() {
      if (!repoPath) return;
      try {
        setLoading(true);
        const s = await git.status(repoPath);
        setStatus(s);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Failed to get git status');
      } finally {
        setLoading(false);
      }
    },
    [repoPath],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function stage(files: string[]) {
    if (!repoPath || files.length === 0) return;
    await git.stage(repoPath, files);
    await refresh();
  }

  async function unstage(files: string[]) {
    if (!repoPath || files.length === 0) return;
    await git.unstage(repoPath, files);
    await refresh();
  }

  async function commit() {
    if (!repoPath || !commitMessage.trim()) return;
    await git.commit(repoPath, commitMessage.trim());
    setCommitMessage('');
    await refresh();
  }
  async function genMessage() {
    if (!onGenerateCommitMessage) return;
    try {
      const msg = await onGenerateCommitMessage();
      if (msg) setCommitMessage(msg);
    } catch (e) {
      setError((e as any)?.message || 'Failed to generate AI commit message');
    }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Source Control</h2>
        <button
          className="text-sm px-2 py-1 rounded bg-interactive hover:bg-border"
          onClick={refresh}
          disabled={loading || !repoPath}
        >
          Refresh
        </button>
      </div>
      {!repoPath && (
        <p className="text-sm text-text-secondary">Open a folder to enable Git features.</p>
      )}
      {error && <p className="text-sm text-brand-red">{error}</p>}
      {repoPath && status && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-text-secondary">
            Branch: <span className="text-text-primary">{status.branch}</span> • ↑{status.ahead} ↓
            {status.behind}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Changes</h3>
            <div className="space-y-1">
              {status.modified.map((f) => (
                <div
                  key={`m-${f}`}
                  className="flex items-center justify-between bg-panel-light border border-border rounded p-2 text-sm"
                >
                  <span className="text-yellow-300">M</span>
                  <span className="flex-1 ml-2 truncate" title={f}>
                    {f}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-xs bg-interactive hover:bg-border rounded"
                      onClick={() => stage([f])}
                    >
                      Stage
                    </button>
                    <button
                      className="px-2 py-0.5 text-xs hover:bg-panel"
                      onClick={() => onDiffRequest(f)}
                    >
                      Diff
                    </button>
                  </div>
                </div>
              ))}
              {status.created.map((f) => (
                <div
                  key={`a-${f}`}
                  className="flex items-center justify-between bg-panel-light border border-border rounded p-2 text-sm"
                >
                  <span className="text-green-400">A</span>
                  <span className="flex-1 ml-2 truncate" title={f}>
                    {f}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-xs bg-interactive hover:bg-border rounded"
                      onClick={() => stage([f])}
                    >
                      Stage
                    </button>
                    <button
                      className="px-2 py-0.5 text-xs hover:bg-panel"
                      onClick={() => onDiffRequest(f)}
                    >
                      Diff
                    </button>
                  </div>
                </div>
              ))}
              {status.deleted.map((f) => (
                <div
                  key={`d-${f}`}
                  className="flex items-center justify-between bg-panel-light border border-border rounded p-2 text-sm"
                >
                  <span className="text-brand-red">D</span>
                  <span className="flex-1 ml-2 truncate" title={f}>
                    {f}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-xs bg-interactive hover:bg-border rounded"
                      onClick={() => stage([f])}
                    >
                      Stage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Staged</h3>
            <div className="space-y-1">
              {status.staged.map((f) => (
                <div
                  key={`s-${f}`}
                  className="flex items-center justify-between bg-panel-light border border-border rounded p-2 text-sm"
                >
                  <span className="text-blue-300">S</span>
                  <span className="flex-1 ml-2 truncate" title={f}>
                    {f}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-xs hover:bg-panel"
                      onClick={() => unstage([f])}
                    >
                      Unstage
                    </button>
                    <button
                      className="px-2 py-0.5 text-xs hover:bg-panel"
                      onClick={() => onDiffRequest(f)}
                    >
                      Diff
                    </button>
                  </div>
                </div>
              ))}
              {status.renamed.map((r) => (
                <div
                  key={`r-${r.from}->${r.to}`}
                  className="flex items-center justify-between bg-panel-light border border-border rounded p-2 text-sm"
                >
                  <span className="text-purple-300">R</span>
                  <span className="flex-1 ml-2 truncate" title={`${r.from} -> ${r.to}`}>
                    {r.from} → {r.to}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="px-2 py-0.5 text-xs hover:bg-panel"
                      onClick={() => unstage([r.to])}
                    >
                      Unstage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message"
                rows={2}
                className="flex-1 bg-panel-light border border-border rounded p-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              {onGenerateCommitMessage && (
                <button
                  onClick={genMessage}
                  className="px-3 py-2 text-sm bg-interactive hover:bg-border rounded"
                >
                  AI Generate Message
                </button>
              )}
              <button
                disabled={!commitMessage.trim()}
                onClick={commit}
                className="px-3 py-2 text-sm bg-brand-blue hover:bg-blue-600 rounded disabled:opacity-50"
              >
                Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
