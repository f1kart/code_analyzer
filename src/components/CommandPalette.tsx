import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: string;
  keywords: string[];
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void | Promise<void>;
  condition?: () => boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  recentCommands?: string[];
  onCommandExecute?: (commandId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  recentCommands = [],
  onCommandExecute,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);

  // Filter and sort commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first when no query
      const recentCommandObjects = recentCommands
        .map((id) => commands.find((cmd) => cmd.id === id))
        .filter(Boolean) as Command[];

      const otherCommands = commands.filter(
        (cmd) => !recentCommands.includes(cmd.id) && (!cmd.condition || cmd.condition()),
      );

      return [...recentCommandObjects, ...otherCommands].slice(0, 50);
    }

    const queryLower = query.toLowerCase();

    return commands
      .filter((cmd) => {
        if (cmd.condition && !cmd.condition()) return false;

        const titleMatch = cmd.title.toLowerCase().includes(queryLower);
        const descriptionMatch = cmd.description?.toLowerCase().includes(queryLower);
        const categoryMatch = cmd.category.toLowerCase().includes(queryLower);
        const keywordMatch = cmd.keywords.some((keyword) =>
          keyword.toLowerCase().includes(queryLower),
        );

        return titleMatch || descriptionMatch || categoryMatch || keywordMatch;
      })
      .sort((a, b) => {
        // Prioritize exact title matches
        const aExactTitle = a.title.toLowerCase() === queryLower;
        const bExactTitle = b.title.toLowerCase() === queryLower;
        if (aExactTitle && !bExactTitle) return -1;
        if (!aExactTitle && bExactTitle) return 1;

        // Prioritize title starts with query
        const aTitleStarts = a.title.toLowerCase().startsWith(queryLower);
        const bTitleStarts = b.title.toLowerCase().startsWith(queryLower);
        if (aTitleStarts && !bTitleStarts) return -1;
        if (!aTitleStarts && bTitleStarts) return 1;

        // Prioritize recent commands
        const aRecent = recentCommands.indexOf(a.id);
        const bRecent = recentCommands.indexOf(b.id);
        if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
        if (aRecent !== -1 && bRecent === -1) return -1;
        if (aRecent === -1 && bRecent !== -1) return 1;

        // Sort by category, then title
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.title.localeCompare(b.title);
      })
      .slice(0, 50);
  }, [query, commands, recentCommands]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex] && !isExecuting) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
          } else {
            setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, isExecuting, onClose]);

  const executeCommand = useCallback(
    async (command: Command) => {
      if (isExecuting) return;

      setIsExecuting(true);
      try {
        await command.action();
        if (onCommandExecute) {
          onCommandExecute(command.id);
        }
        onClose();
      } catch (error) {
        console.error('Command execution failed:', error);
      } finally {
        setIsExecuting(false);
      }
    },
    [isExecuting, onCommandExecute, onClose],
  );

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setIsExecuting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const commandPalette = (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-panel border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center p-4 border-b border-border">
          <svg
            className="w-5 h-5 text-text-tertiary mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-text-primary placeholder-text-tertiary outline-none text-lg"
            autoFocus
          />
          {isExecuting && (
            <div className="ml-3">
              <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Command List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              <div className="text-4xl mb-2">🔍</div>
              <p className="text-lg font-medium mb-1">No commands found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredCommands.map((command, index) => {
                const isSelected = index === selectedIndex;
                const isRecent = recentCommands.includes(command.id);

                return (
                  <button
                    key={command.id}
                    onClick={() => executeCommand(command)}
                    disabled={isExecuting}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                      ${
                        isSelected
                          ? 'bg-brand-blue/20 text-text-primary'
                          : 'text-text-secondary hover:bg-panel-light hover:text-text-primary'
                      }
                      ${isExecuting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {/* Command Icon */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                      {command.icon || (
                        <div className="w-6 h-6 rounded bg-panel-light flex items-center justify-center text-xs font-medium">
                          {command.category.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Command Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{command.title}</span>
                        {isRecent && (
                          <span className="text-xs px-1.5 py-0.5 bg-brand-blue/20 text-brand-blue rounded-full">
                            Recent
                          </span>
                        )}
                      </div>
                      {command.description && (
                        <p className="text-sm text-text-tertiary truncate mt-1">
                          {command.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-tertiary bg-panel-light px-2 py-0.5 rounded">
                          {command.category}
                        </span>
                        {command.shortcut && (
                          <span className="text-xs text-text-tertiary">{command.shortcut}</span>
                        )}
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-brand-blue"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-panel-light">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-panel rounded border text-xs">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-panel rounded border text-xs">Enter</kbd> Execute
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-panel rounded border text-xs">Esc</kbd> Close
              </span>
            </div>
            <span>{filteredCommands.length} commands</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(commandPalette, document.body);
};

// Hook for managing command palette state
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const addRecentCommand = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      const filtered = prev.filter((id) => id !== commandId);
      return [commandId, ...filtered].slice(0, 10); // Keep last 10
    });
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
    recentCommands,
    addRecentCommand,
  };
};
