import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export interface Tab {
  id: string;
  title: string;
  content: React.ReactNode;
  isDirty?: boolean;
  isClosable?: boolean;
  icon?: React.ReactNode;
  type: 'file' | 'report' | 'terminal' | 'search' | 'diff' | 'welcome' | 'testing' | 'auth';
  filePath?: string;
  metadata?: Record<string, any>;
}

interface TabbedMainViewProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder: (tabs: Tab[]) => void;
  onTabSave?: (tabId: string) => void;
  className?: string;
}

export const TabbedMainView: React.FC<TabbedMainViewProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabReorder,
  onTabSave,
  className = '',
}) => {
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const tabRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const resolvedActiveId = activeTabId ?? tabs[0]?.id ?? null;

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setDraggedTab(null);

      if (!result.destination) return;

      const items = Array.from(tabs);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      onTabReorder(items);
    },
    [tabs, onTabReorder],
  );

  const handleDragStart = useCallback((result: any) => {
    setDraggedTab(result.draggableId);
  }, []);

  const handleTabClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      onTabClose(tabId);
    },
    [onTabClose],
  );

  const handleTabSave = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      if (onTabSave) {
        onTabSave(tabId);
      }
    },
    [onTabSave],
  );

  const getTabIcon = (tab: Tab) => {
    if (tab.icon) return tab.icon;

    switch (tab.type) {
      case 'file': {
        const ext = tab.filePath?.split('.').pop()?.toLowerCase();
        switch (ext) {
          case 'js':
          case 'jsx':
          case 'ts':
          case 'tsx':
            return <span className="text-yellow-400">JS</span>;
          case 'css':
          case 'scss':
          case 'sass':
            return <span className="text-blue-400">CSS</span>;
          case 'html':
            return <span className="text-orange-400">HTML</span>;
          case 'json':
            return <span className="text-green-400">JSON</span>;
          case 'md':
            return <span className="text-gray-400">MD</span>;
          default:
            return <span className="text-gray-400">📄</span>;
        }
      }
      case 'report':
        return <span className="text-purple-400">📊</span>;
      case 'terminal':
        return <span className="text-green-400">⚡</span>;
      case 'search':
        return <span className="text-blue-400">🔍</span>;
      case 'diff':
        return <span className="text-orange-400">📋</span>;
      case 'welcome':
        return <span className="text-blue-400">🏠</span>;
      default:
        return <span className="text-gray-400">📄</span>;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'w') {
          e.preventDefault();
          if (activeTabId) {
            onTabClose(activeTabId);
          }
        } else if (e.key === 's') {
          e.preventDefault();
          if (activeTabId && onTabSave) {
            onTabSave(activeTabId);
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;
          if (tabs[nextIndex]) {
            onTabChange(tabs[nextIndex].id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, onTabClose, onTabChange, onTabSave]);

  if (tabs.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center bg-slate-950 ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-4">📁</div>
          <h2 className="text-2xl font-bold mb-3 text-white">No files open</h2>
          <p className="text-base text-gray-400">Open a file or folder to get started</p>
          <div className="mt-6 text-sm text-gray-500">
            <kbd className="px-3 py-2 bg-slate-800 border-2 border-slate-700 rounded-lg text-white font-bold shadow">Ctrl+O</kbd> to open file
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-slate-950 ${className}`}>
      {/* Tab Bar */}
      <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <Droppable droppableId="tabs" direction="horizontal">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              role="tablist"
              className={`flex bg-slate-900 border-b-2 border-slate-800 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent min-h-[40px] ${
                snapshot.isDraggingOver ? 'bg-slate-800' : ''
              }`}
            >
              {tabs.map((tab, index) => (
                <Draggable key={tab.id} draggableId={tab.id} index={index}>
                  {(provided, snapshot) => {
                    const isActive = resolvedActiveId === tab.id;
                    return (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        role="tab"
                        aria-selected={isActive ? 'true' : 'false'}
                        tabIndex={0}
                        onClick={() => onTabChange(tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onTabChange(tab.id);
                          }
                        }}
                        id={`tab-${tab.id}`}
                        aria-controls={`panel-${tab.id}`}
                        className={`
                          flex items-center gap-2 px-4 py-3 text-sm font-bold border-r border-slate-800
                          min-w-0 max-w-64 group relative whitespace-nowrap cursor-pointer transition-all
                          ${
                            isActive
                              ? 'bg-slate-800 text-white border-b-4 border-violet-500'
                              : 'bg-slate-900 text-gray-400 hover:bg-slate-800 hover:text-white'
                          }
                          ${snapshot.isDragging ? 'opacity-50 shadow-2xl z-50' : ''}
                          ${draggedTab === tab.id ? 'bg-slate-800' : ''}
                        `}
                        title={tab.filePath || tab.title}
                      >
                        <span className="flex-shrink-0 text-xs">{getTabIcon(tab)}</span>
                        <span className="truncate flex-1 text-left">
                          {tab.title}
                          {tab.isDirty && <span className="text-orange-400 ml-1">●</span>}
                        </span>
                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {tab.isDirty && onTabSave && (
                            <button
                              onClick={(e) => handleTabSave(e, tab.id)}
                              className="p-1 rounded hover:bg-interactive text-text-tertiary hover:text-text-primary"
                              title="Save file"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </button>
                          )}
                          {tab.isClosable !== false && (
                            <button
                              onClick={(e) => handleTabClose(e, tab.id)}
                              className="p-1 rounded hover:bg-interactive text-text-tertiary hover:text-text-primary"
                              title="Close tab"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => {
          const isActive = resolvedActiveId === tab.id;
          return (
            <div
              key={tab.id}
              id={`panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              aria-hidden={isActive ? 'false' : 'true'}
              className={`h-full ${isActive ? 'block' : 'hidden'}`}
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
};
