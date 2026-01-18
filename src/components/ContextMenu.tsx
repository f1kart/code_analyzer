import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  // Close menu on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Adjust menu position to stay within viewport
  const getAdjustedPosition = useCallback(() => {
    if (!menuRef.current) return position;

    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    if (x < 10) {
      x = 10;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }
    if (y < 10) {
      y = 10;
    }

    return { x, y };
  }, [position]);

  const handleItemClick = useCallback(
    async (item: ContextMenuItem) => {
      if (item.disabled || item.separator) return;

      if (item.submenu) {
        // Handle submenu
        return;
      }

      try {
        await item.action();
      } catch (error) {
        console.error('Context menu action failed:', error);
      } finally {
        onClose();
      }
    },
    [onClose],
  );

  const handleSubmenuHover = useCallback((item: ContextMenuItem, event: React.MouseEvent) => {
    if (!item.submenu) {
      setSubmenuOpen(null);
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setSubmenuPosition({
      x: rect.right + 5,
      y: rect.top,
    });
    setSubmenuOpen(item.id);
  }, []);

  if (!isOpen) return null;

  const adjustedPosition = getAdjustedPosition();

  const contextMenu = (
    <div
      ref={menuRef}
      className="fixed z-50 bg-panel border border-border rounded-lg shadow-2xl py-1 min-w-48 max-w-64"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`separator-${index}`} className="h-px bg-border my-1 mx-2" />;
        }

        return (
          <div
            key={item.id}
            className={`
              relative flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors
              ${
                item.disabled
                  ? 'text-text-tertiary cursor-not-allowed'
                  : item.danger
                    ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                    : 'text-text-secondary hover:bg-interactive hover:text-text-primary'
              }
            `}
            onClick={() => handleItemClick(item)}
            onMouseEnter={(e) => handleSubmenuHover(item, e)}
            onMouseLeave={() => {
              if (!item.submenu) setSubmenuOpen(null);
            }}
          >
            {/* Icon */}
            <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              {item.icon}
            </div>

            {/* Label */}
            <span className="flex-1 truncate">{item.label}</span>

            {/* Shortcut or Submenu Indicator */}
            <div className="flex-shrink-0 text-xs text-text-tertiary">
              {item.submenu ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              ) : item.shortcut ? (
                <span>{item.shortcut}</span>
              ) : null}
            </div>

            {/* Submenu */}
            {item.submenu && submenuOpen === item.id && (
              <ContextMenu
                isOpen={true}
                position={submenuPosition}
                items={item.submenu}
                onClose={() => setSubmenuOpen(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return createPortal(contextMenu, document.body);
};

// Hook for managing context menu state
export const useContextMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  const open = useCallback((event: React.MouseEvent, menuItems: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();

    setPosition({ x: event.clientX, y: event.clientY });
    setItems(menuItems);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setItems([]);
  }, []);

  return {
    isOpen,
    position,
    items,
    open,
    close,
  };
};

// Predefined context menu configurations
export const createFileContextMenu = (
  filePath: string,
  isDirectory: boolean,
  callbacks: {
    onOpen?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onCopy?: () => void;
    onCut?: () => void;
    onDuplicate?: () => void;
    onNewFile?: () => void;
    onNewFolder?: () => void;
    onRevealInExplorer?: () => void;
    onCopyPath?: () => void;
    onAIAnalyze?: () => void;
    onAIRefactor?: () => void;
    onAIExplain?: () => void;
    onAITest?: () => void;
    onAIDocument?: () => void;
  },
): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  if (!isDirectory) {
    items.push({
      id: 'open',
      label: 'Open',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      ),
      action: callbacks.onOpen || (() => {}),
      shortcut: 'Enter',
    });
  }

  items.push(
    { id: 'sep1', separator: true, label: '', action: () => {} },
    {
      id: 'rename',
      label: 'Rename',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
      action: callbacks.onRename || (() => {}),
      shortcut: 'F2',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      action: callbacks.onDuplicate || (() => {}),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      action: callbacks.onDelete || (() => {}),
      danger: true,
      shortcut: 'Del',
    },
  );

  if (isDirectory) {
    items.push(
      { id: 'sep2', separator: true, label: '', action: () => {} },
      {
        id: 'newFile',
        label: 'New File',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
        action: callbacks.onNewFile || (() => {}),
      },
      {
        id: 'newFolder',
        label: 'New Folder',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        ),
        action: callbacks.onNewFolder || (() => {}),
      },
    );
  }

  // AI Tools submenu for files
  if (!isDirectory) {
    const aiItems: ContextMenuItem[] = [
      {
        id: 'ai-analyze',
        label: 'Analyze Code',
        icon: <span className="text-purple-400">🔍</span>,
        action: callbacks.onAIAnalyze || (() => {}),
      },
      {
        id: 'ai-explain',
        label: 'Explain Code',
        icon: <span className="text-blue-400">💡</span>,
        action: callbacks.onAIExplain || (() => {}),
      },
      {
        id: 'ai-refactor',
        label: 'Refactor Code',
        icon: <span className="text-green-400">⚡</span>,
        action: callbacks.onAIRefactor || (() => {}),
      },
      {
        id: 'ai-test',
        label: 'Generate Tests',
        icon: <span className="text-orange-400">🧪</span>,
        action: callbacks.onAITest || (() => {}),
      },
      {
        id: 'ai-document',
        label: 'Add Documentation',
        icon: <span className="text-yellow-400">📝</span>,
        action: callbacks.onAIDocument || (() => {}),
      },
    ];

    items.push(
      { id: 'sep3', separator: true, label: '', action: () => {} },
      {
        id: 'ai-tools',
        label: 'AI Tools',
        icon: <span className="text-brand-purple">🤖</span>,
        action: () => {},
        submenu: aiItems,
      },
    );
  }

  items.push(
    { id: 'sep4', separator: true, label: '', action: () => {} },
    {
      id: 'copy',
      label: 'Copy',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      action: callbacks.onCopy || (() => {}),
      shortcut: 'Ctrl+C',
    },
    {
      id: 'cut',
      label: 'Cut',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-5-9V3m0 0V1m0 2h2m-2 0H8"
          />
        </svg>
      ),
      action: callbacks.onCut || (() => {}),
      shortcut: 'Ctrl+X',
    },
    {
      id: 'copyPath',
      label: 'Copy Path',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      action: callbacks.onCopyPath || (() => {}),
    },
    {
      id: 'reveal',
      label: 'Reveal in Explorer',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      ),
      action: callbacks.onRevealInExplorer || (() => {}),
    },
  );

  return items;
};

export const createTextSelectionContextMenu = (
  selectedText: string,
  callbacks: {
    onCopy?: () => void;
    onCut?: () => void;
    onPaste?: () => void;
    onSelectAll?: () => void;
    onAIExplain?: () => void;
    onAIRefactor?: () => void;
    onAIComment?: () => void;
    onAIOptimize?: () => void;
    onSearch?: () => void;
  },
): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  if (selectedText) {
    items.push(
      {
        id: 'copy',
        label: 'Copy',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        ),
        action: callbacks.onCopy || (() => {}),
        shortcut: 'Ctrl+C',
      },
      {
        id: 'cut',
        label: 'Cut',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-5-9V3m0 0V1m0 2h2m-2 0H8"
            />
          </svg>
        ),
        action: callbacks.onCut || (() => {}),
        shortcut: 'Ctrl+X',
      },
    );

    // AI Tools for selected text
    const aiItems: ContextMenuItem[] = [
      {
        id: 'ai-explain',
        label: 'Explain Selection',
        icon: <span className="text-blue-400">💡</span>,
        action: callbacks.onAIExplain || (() => {}),
      },
      {
        id: 'ai-refactor',
        label: 'Refactor Selection',
        icon: <span className="text-green-400">⚡</span>,
        action: callbacks.onAIRefactor || (() => {}),
      },
      {
        id: 'ai-comment',
        label: 'Add Comments',
        icon: <span className="text-yellow-400">💬</span>,
        action: callbacks.onAIComment || (() => {}),
      },
      {
        id: 'ai-optimize',
        label: 'Optimize Code',
        icon: <span className="text-purple-400">🚀</span>,
        action: callbacks.onAIOptimize || (() => {}),
      },
    ];

    items.push(
      { id: 'sep1', separator: true, label: '', action: () => {} },
      {
        id: 'ai-tools',
        label: 'AI Tools',
        icon: <span className="text-brand-purple">🤖</span>,
        action: () => {},
        submenu: aiItems,
      },
      { id: 'sep2', separator: true, label: '', action: () => {} },
      {
        id: 'search',
        label: 'Search in Project',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        ),
        action: callbacks.onSearch || (() => {}),
        shortcut: 'Ctrl+Shift+F',
      },
    );
  }

  items.push(
    {
      id: 'paste',
      label: 'Paste',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      action: callbacks.onPaste || (() => {}),
      shortcut: 'Ctrl+V',
    },
    {
      id: 'selectAll',
      label: 'Select All',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      ),
      action: callbacks.onSelectAll || (() => {}),
      shortcut: 'Ctrl+A',
    },
  );

  return items;
};
