import React, { useState } from 'react';
import { CodeSnippet } from '../utils/sessionManager';
import { LanguageIcon } from './icons/LanguageIcon';
import { SnippetIcon } from './icons/SnippetIcon';

interface SnippetsExplorerProps {
  snippets: CodeSnippet[];
  onInsertSnippet: (code: string) => void;
  onSaveSnippet: (snippet: Omit<CodeSnippet, 'id'>) => void;
  onDeleteSnippet: (id: string) => void;
  activeFileLanguage: string;
}

export const SnippetsExplorer: React.FC<SnippetsExplorerProps> = ({
  snippets,
  onInsertSnippet,
  onSaveSnippet,
  onDeleteSnippet,
  activeFileLanguage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newSnippet, setNewSnippet] = useState({
    title: '',
    code: '',
    tags: '',
    language: activeFileLanguage,
  });

  const filteredSnippets = snippets.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleSave = () => {
    if (!newSnippet.title || !newSnippet.code) return;
    onSaveSnippet({
      ...newSnippet,
      tags: newSnippet.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setNewSnippet({ title: '', code: '', tags: '', language: activeFileLanguage });
    setIsCreating(false);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <h2 className="text-lg font-bold text-text-primary flex-shrink-0">Code Snippets</h2>

      <input
        type="search"
        placeholder="Search snippets..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full bg-panel border border-border rounded-md py-1.5 px-3 text-sm placeholder-text-secondary"
      />

      <div className="flex-grow overflow-y-auto space-y-2">
        {filteredSnippets.length > 0 ? (
          filteredSnippets.map((snippet) => (
            <div key={snippet.id} className="bg-panel-light p-3 rounded-md border border-border">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-text-primary">{snippet.title}</h4>
                  <div className="flex items-center text-xs text-text-secondary mt-1">
                    <LanguageIcon language={snippet.language} className="w-3 h-3 mr-1.5" />
                    <span>{snippet.language}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onInsertSnippet(snippet.code)}
                    className="text-xs px-2 py-1 bg-interactive hover:bg-border rounded"
                  >
                    Insert
                  </button>
                  <button
                    onClick={() => onDeleteSnippet(snippet.id)}
                    className="text-xs px-2 py-1 text-brand-red hover:bg-brand-red/20 rounded"
                  >
                    &times;
                  </button>
                </div>
              </div>
              {snippet.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {snippet.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-600 px-1.5 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-text-secondary py-8">
            <p>
              {snippets.length === 0 ? 'No snippets saved yet.' : 'No snippets match your search.'}
            </p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border pt-4">
        {isCreating ? (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Snippet Title"
              value={newSnippet.title}
              onChange={(e) => setNewSnippet((s) => ({ ...s, title: e.target.value }))}
              className="w-full text-sm p-2 rounded bg-panel border-border border"
            />
            <textarea
              placeholder="Snippet Code"
              value={newSnippet.code}
              onChange={(e) => setNewSnippet((s) => ({ ...s, code: e.target.value }))}
              rows={4}
              className="w-full text-sm p-2 rounded bg-panel border-border border font-mono"
            />
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={newSnippet.tags}
              onChange={(e) => setNewSnippet((s) => ({ ...s, tags: e.target.value }))}
              className="w-full text-sm p-2 rounded bg-panel border-border border"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 text-sm p-2 rounded bg-brand-blue hover:bg-blue-600"
              >
                Save
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 text-sm p-2 rounded bg-interactive hover:bg-border"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 p-2 text-sm bg-interactive hover:bg-border rounded"
          >
            <SnippetIcon className="w-4 h-4" />
            Save New Snippet
          </button>
        )}
      </div>
    </div>
  );
};
