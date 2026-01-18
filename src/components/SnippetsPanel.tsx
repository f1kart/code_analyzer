import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getElectronAPI } from '../utils/electronBridge';

interface SnippetItem {
  id: number | string;
  title: string;
  code: string;
  language: string;
  tags?: string[];
}

interface SnippetsPanelProps {
  projectPath?: string;
  onInsertIntoEditor?: (code: string) => void;
}

const localKey = 'ide.snippets.local-store.v1';

interface SnippetDatabaseBridge {
  listSnippets: () => Promise<{
    success: boolean;
    items?: Array<{ id: number | string; title: string; code: string; language: string; tags?: string[] }>;
    error?: string;
  }>;
  createSnippet: (
    data: { title: string; code: string; language: string; tags?: string[] },
  ) => Promise<{ success: boolean; error?: string }>;
  updateSnippet: (
    id: string,
    data: { title: string; code: string; language: string },
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSnippet: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const SnippetsPanel: React.FC<SnippetsPanelProps> = ({
  projectPath: _projectPath,
  onInsertIntoEditor,
}) => {
  const [items, setItems] = useState<SnippetItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(localKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setItems(parsed);
    } catch (e: any) {
      setError(e?.message || 'Failed to load local snippets');
    }
  }, []);

  const saveToLocal = useCallback((list: SnippetItem[]) => {
    try {
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getElectronAPI()?.db as SnippetDatabaseBridge | undefined;
      if (db?.listSnippets) {
        const res = await db.listSnippets();
        if (res?.success && Array.isArray(res.items)) {
          setItems(
            res.items.map((x: any) => ({
              id: x.id,
              title: x.title,
              code: x.code,
              language: x.language,
              tags: x.tags || [],
            })),
          );
        } else {
          loadFromLocal();
        }
      } else {
        loadFromLocal();
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load snippets');
      loadFromLocal();
    } finally {
      setLoading(false);
    }
  }, [loadFromLocal]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title?.toLowerCase().includes(q) ||
        it.code?.toLowerCase().includes(q) ||
        (it.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [items, query]);

  async function createSnippet() {
    const title = prompt('Snippet title:') || '';
    if (!title.trim()) return;
    const language = prompt('Language (e.g., javascript, typescript, python):') || 'plaintext';
    const code = prompt('Snippet code:') || '';
    const payload = { title, code, language, tags: [] as string[] };
    try {
      const db = getElectronAPI()?.db as SnippetDatabaseBridge | undefined;
      if (db?.createSnippet) {
        const res = await db.createSnippet(payload);
        if (res?.success) {
          await refresh();
          return;
        }
      }
      // Fallback local
      const local = [{ id: Date.now(), ...payload }, ...items];
      setItems(local);
      saveToLocal(local);
    } catch (e: any) {
      setError(e?.message || 'Failed to create snippet');
    }
  }

  async function updateSnippet(item: SnippetItem) {
    const title = prompt('New title:', item.title) ?? item.title;
    const code = prompt('New code:', item.code) ?? item.code;
    const language = prompt('Language:', item.language) ?? item.language;
    const payload = { title, code, language };
    try {
      const db = getElectronAPI()?.db as SnippetDatabaseBridge | undefined;
      if (db?.updateSnippet) {
        const res = await db.updateSnippet(String(item.id), payload);
        if (res?.success) {
          await refresh();
          return;
        }
      }
      // Fallback local
      const local = items.map((s) => (s.id === item.id ? { ...s, ...payload } : s));
      setItems(local);
      saveToLocal(local);
    } catch (e: any) {
      setError(e?.message || 'Failed to update snippet');
    }
  }

  async function deleteSnippet(item: SnippetItem) {
    if (!confirm(`Delete snippet: ${item.title}?`)) return;
    try {
      const db = getElectronAPI()?.db as SnippetDatabaseBridge | undefined;
      if (db?.deleteSnippet) {
        const res = await db.deleteSnippet(String(item.id));
        if (res?.success) {
          await refresh();
          return;
        }
      }
      // Fallback local
      const local = items.filter((s) => s.id !== item.id);
      setItems(local);
      saveToLocal(local);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete snippet');
    }
  }

  const insert = (code: string) => {
    onInsertIntoEditor?.(code);
  };

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Snippets</h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search snippets..."
            className="px-2 py-1 text-sm bg-panel-light border border-border rounded"
            aria-label="Search snippets"
            title="Search snippets"
          />
          <button
            className="text-sm px-2 py-1 rounded bg-interactive hover:bg-border"
            onClick={createSnippet}
            disabled={loading}
          >
            New
          </button>
          <button
            className="text-sm px-2 py-1 rounded bg-interactive hover:bg-border"
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>
      {error && <div className="text-brand-red text-sm">{error}</div>}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.map((item) => (
          <div key={String(item.id)} className="border border-border bg-panel-light rounded p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs px-1 py-0.5 rounded bg-gray-700 text-gray-100">
                  {item.language}
                </span>
                <div className="text-sm font-medium">{item.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-0.5 rounded bg-interactive hover:bg-border"
                  onClick={() => insert(item.code)}
                >
                  Insert
                </button>
                <button
                  className="text-xs px-2 py-0.5 rounded hover:bg-panel"
                  onClick={() => updateSnippet(item)}
                >
                  Edit
                </button>
                <button
                  className="text-xs px-2 py-0.5 rounded hover:bg-panel text-brand-red"
                  onClick={() => deleteSnippet(item)}
                >
                  Delete
                </button>
              </div>
            </div>
            <pre className="mt-2 text-xs bg-gray-900 text-gray-200 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
              {item.code}
            </pre>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="text-sm text-text-secondary">No snippets match your search.</div>
        )}
      </div>
    </div>
  );
};

export default SnippetsPanel;
