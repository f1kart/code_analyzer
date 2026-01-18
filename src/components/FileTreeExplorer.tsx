import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { FileIcon } from './icons/FileIcon';
import {
  readDirectory,
  createFile,
  createDirectory,
  deleteFile,
  deleteDirectory,
  renameFile,
  getFileStats,
  watchDirectory,
  unwatchDirectory,
  getFileName,
  formatFileSize,
  revealInExplorer,
  openInDefaultApp,
  type FileSystemEntry,
  type FileWatchEvent,
} from '../services/fileSystemService';
import { useContextMenu } from './ContextMenu';
import { useNotifications } from './NotificationSystem';

interface TreeNode extends FileSystemEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  level: number;
  parentPath: string;
  isDirectory: boolean;
}

interface FileTreeExplorerProps {
  rootPath?: string;
  onFileSelect?: (file: TreeNode) => void;
  onFileOpen?: (file: TreeNode) => void;
  selectedFile?: string;
  className?: string;
  showHiddenFiles?: boolean;
  allowMultiSelect?: boolean;
  readOnly?: boolean;
}

interface DragState {
  isDragging: boolean;
  draggedNode: TreeNode | null;
  dropTarget: TreeNode | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

// File tree explorer component with drag & drop, context menu, and inline editing
// Note: Inline styles are used where necessary for:
// 1. Dynamic tree indentation based on node level (paddingLeft)
export const FileTreeExplorer: React.FC<FileTreeExplorerProps> = ({
  rootPath,
  onFileSelect,
  onFileOpen,
  selectedFile: _selectedFile,
  className = '',
  showHiddenFiles = false,
  allowMultiSelect = false,
  readOnly = false,
}) => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNode: null,
    dropTarget: null,
    dropPosition: null,
  });
  const [watchIds, setWatchIds] = useState<Map<string, string>>(new Map());
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const treeRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const contextMenu = useContextMenu();
  const { addNotification } = useNotifications();

  // File type icon mapping
  const getFileIcon = useCallback(
    (node: TreeNode) => {
      if (node.isDirectory) {
        return expandedNodes.has(node.path) ? FolderOpenIcon : FolderIcon;
      }
      return null; // Will use FileIcon component instead
    },
    [expandedNodes],
  );

  // Load directory contents
  const loadDirectory = useCallback(
    async (dirPath: string, level: number = 0, parentPath: string = ''): Promise<TreeNode[]> => {
      try {
        const entries = await readDirectory(dirPath);
        const filteredEntries = showHiddenFiles
          ? entries
          : entries.filter((entry) => !getFileName(entry.path).startsWith('.'));

        const nodes: TreeNode[] = await Promise.all(
          filteredEntries.map(async (entry): Promise<TreeNode> => {
            const stats = await getFileStats(entry.path);
            return {
              name: entry.name,
              path: entry.path,
              relativePath: entry.relativePath,
              type: entry.type,
              isHidden: entry.isHidden,
              extension: entry.extension,
              level,
              parentPath,
              size: stats?.size || 0,
              lastModified: stats?.lastModified || Date.now(),
              isExpanded: false,
              isLoading: false,
              isDirectory: entry.type === 'directory',
            };
          }),
        );

        // Sort: directories first, then files, both alphabetically
        return nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return getFileName(a.path).localeCompare(getFileName(b.path), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        });
      } catch (err) {
        console.error('Failed to load directory:', err);
        addNotification('error', 'Directory Load Error', {
          message: `Failed to load directory: ${dirPath}`,
          duration: 5000,
        });
        return [];
      }
    },
    [showHiddenFiles, addNotification],
  );

  // Update tree nodes helper
  const updateTreeNodes = useCallback(
    (nodes: TreeNode[], targetPath: string, newChildren: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.path === targetPath) {
          return { ...node, children: newChildren };
        }
        if (node.children) {
          return { ...node, children: updateTreeNodes(node.children, targetPath, newChildren) };
        }
        return node;
      });
    },
    [],
  );

  // Update node in tree helper
  const updateNodeInTree = useCallback(
    (nodes: TreeNode[], targetPath: string, updatedNode: TreeNode): TreeNode[] => {
      return nodes.map((node) => {
        if (node.path === targetPath) {
          return updatedNode;
        }
        if (node.children) {
          return { ...node, children: updateNodeInTree(node.children, targetPath, updatedNode) };
        }
        return node;
      });
    },
    [],
  );

  // Handle file system changes
  const handleFileSystemChange = useCallback(
    (event: FileWatchEvent) => {
      // Refresh the affected directory
      const refreshDirectory = async () => {
        if (event.type === 'created' || event.type === 'deleted' || event.type === 'renamed') {
          // Find the parent directory and refresh it
          const parentDir = event.path.substring(0, event.path.lastIndexOf('/'));
          if (expandedNodes.has(parentDir)) {
            const newNodes = await loadDirectory(parentDir);
            setTreeData((prev) => updateTreeNodes(prev, parentDir, newNodes));
          }
        }
      };

      refreshDirectory();
    },
    [expandedNodes, loadDirectory, updateTreeNodes],
  );

  // Initialize tree data
  useEffect(() => {
    if (!rootPath) return;

    const initializeTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const nodes = await loadDirectory(rootPath);
        setTreeData(nodes);

        // Setup directory watching
        try {
          const watchId = await watchDirectory(rootPath, handleFileSystemChange);
          if (watchId && rootPath && watchId.watchId) {
            const id = watchId.watchId;
            setWatchIds((prev) => new Map(prev).set(rootPath, id));
          }
        } catch (err) {
          console.warn('Failed to setup directory watching:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load directory');
      } finally {
        setLoading(false);
      }
    };

    initializeTree();

    return () => {
      // Cleanup watchers
      watchIds.forEach(async (watchId) => {
        await unwatchDirectory(watchId);
      });
    };
  }, [rootPath, loadDirectory, handleFileSystemChange, watchIds]);

  // Toggle node expansion
  const toggleNode = useCallback(
    async (node: TreeNode) => {
      if (!node.isDirectory) return;

      const isExpanded = expandedNodes.has(node.path);

      if (isExpanded) {
        setExpandedNodes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(node.path);
          return newSet;
        });
      } else {
        setExpandedNodes((prev) => new Set(prev).add(node.path));

        // Load children if not already loaded
        if (!node.children) {
          setTreeData((prev) => updateNodeInTree(prev, node.path, { ...node, isLoading: true }));

          try {
            const children = await loadDirectory(node.path, node.level + 1, node.path);
            setTreeData((prev) =>
              updateNodeInTree(prev, node.path, {
                ...node,
                children,
                isLoading: false,
              }),
            );

            // Setup watching for this directory
            try {
              const watchId = await watchDirectory(node.path, handleFileSystemChange);
              if (watchId && node.path && watchId.watchId) {
                const id = watchId.watchId;
                setWatchIds((prev) => new Map(prev).set(node.path, id));
              }
            } catch (err) {
              console.warn('Failed to setup directory watching:', err);
            }
          } catch (err) {
            setTreeData((prev) => updateNodeInTree(prev, node.path, { ...node, isLoading: false }));
            addNotification('error', 'Directory Load Error', {
              message: `Failed to load directory: ${node.path}`,
              duration: 5000,
            });
          }
        }
      }
    },
    [expandedNodes, loadDirectory, updateNodeInTree, handleFileSystemChange, addNotification],
  );

  // Flatten tree for operations
  const flattenTree = useCallback(
    (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      const traverse = (nodeList: TreeNode[]) => {
        nodeList.forEach((node) => {
          result.push(node);
          if (node.children && expandedNodes.has(node.path)) {
            traverse(node.children);
          }
        });
      };
      traverse(nodes);
      return result;
    },
    [expandedNodes],
  );

  // Handle node selection
  const handleNodeSelect = useCallback(
    (node: TreeNode, event: React.MouseEvent) => {
      if (allowMultiSelect && (event.ctrlKey || event.metaKey)) {
        setSelectedNodes((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(node.path)) {
            newSet.delete(node.path);
          } else {
            newSet.add(node.path);
          }
          return newSet;
        });
      } else if (allowMultiSelect && event.shiftKey && selectedNodes.size > 0) {
        // Implement range selection
        const flatNodes = flattenTree(treeData);
        const lastSelected = Array.from(selectedNodes).pop();
        const startIndex = flatNodes.findIndex((n) => n.path === lastSelected);
        const endIndex = flatNodes.findIndex((n) => n.path === node.path);

        if (startIndex !== -1 && endIndex !== -1) {
          const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
          const rangeNodes = flatNodes.slice(start, end + 1);
          setSelectedNodes(new Set(rangeNodes.map((n) => n.path)));
        }
      } else {
        setSelectedNodes(new Set([node.path]));
      }

      onFileSelect?.(node);
    },
    [allowMultiSelect, selectedNodes, treeData, onFileSelect, flattenTree],
  );

  // Handle double click
  const handleNodeDoubleClick = useCallback(
    (node: TreeNode) => {
      if (node.isDirectory) {
        toggleNode(node);
      } else {
        onFileOpen?.(node);
      }
    },
    [toggleNode, onFileOpen],
  );

  // Helper functions
  const refreshDirectory = useCallback(
    async (dirPath: string) => {
      if (dirPath === rootPath) {
        const nodes = await loadDirectory(dirPath);
        setTreeData(nodes);
      } else {
        const newNodes = await loadDirectory(dirPath);
        setTreeData((prev) => updateTreeNodes(prev, dirPath, newNodes));
      }
    },
    [rootPath, loadDirectory, updateTreeNodes],
  );

  // File operations
  const createNewFile = useCallback(
    async (parentPath: string) => {
      const fileName = prompt('Enter file name:');
      if (!fileName) return;

      try {
        const result = await createFile(`${parentPath}/${fileName}`);
        if (result) {
          await refreshDirectory(parentPath);
          addNotification('success', 'File Created', {
            message: `Created file: ${fileName}`,
            duration: 3000,
          });
        }
      } catch (err) {
        addNotification('error', 'Create File Error', {
          message: `Failed to create file: ${fileName}`,
          duration: 5000,
        });
      }
    },
    [addNotification, refreshDirectory],
  );

  const createNewFolder = useCallback(
    async (parentPath: string) => {
      const folderName = prompt('Enter folder name:');
      if (!folderName) return;

      try {
        const result = await createDirectory(`${parentPath}/${folderName}`);
        if (result.success) {
          await refreshDirectory(parentPath);
          addNotification('success', 'Folder Created', {
            message: `Created folder: ${folderName}`,
            duration: 3000,
          });
        }
      } catch (err) {
        addNotification('error', 'Create Folder Error', {
          message: `Failed to create folder: ${folderName}`,
          duration: 5000,
        });
      }
    },
    [addNotification, refreshDirectory],
  );

  const copyNode = useCallback(
    async (node: TreeNode) => {
      // Store in clipboard-like state for paste operation
      // This is a simplified implementation
      addNotification('info', 'Copied', {
        message: `Copied: ${getFileName(node.path)}`,
        duration: 2000,
      });
    },
    [addNotification],
  );

  const deleteNode = useCallback(
    async (node: TreeNode) => {
      const confirmed = confirm(`Are you sure you want to delete ${getFileName(node.path)}?`);
      if (!confirmed) return;

      try {
        const result = node.isDirectory
          ? await deleteDirectory(node.path, true)
          : await deleteFile(node.parentPath, getFileName(node.path));

        if (result.success) {
          await refreshDirectory(node.parentPath || rootPath || '');
          addNotification('success', 'Deleted', {
            message: `Deleted: ${getFileName(node.path)}`,
            duration: 3000,
          });
        }
      } catch (err) {
        addNotification('error', 'Delete Error', {
          message: `Failed to delete: ${getFileName(node.path)}`,
          duration: 5000,
        });
      }
    },
    [addNotification, rootPath, refreshDirectory],
  );

  const startRename = useCallback((node: TreeNode) => {
    setEditingNode(node.path);
    setEditingValue(getFileName(node.path));
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  // Context menu actions
  const getContextMenuItems = useCallback(
    (node: TreeNode) => {
      const items = [];

      if (!readOnly) {
        if (node.isDirectory) {
          items.push(
            {
              id: 'new-file',
              label: 'New File',
              icon: <PlusIcon className="w-4 h-4" />,
              action: () => createNewFile(node.path),
            },
            {
              id: 'new-folder',
              label: 'New Folder',
              icon: <FolderIcon className="w-4 h-4" />,
              action: () => createNewFolder(node.path),
            },
            { id: 'sep1', separator: true, label: '', action: () => {} },
          );
        }

        items.push(
          {
            id: 'rename',
            label: 'Rename',
            icon: <PencilIcon className="w-4 h-4" />,
            action: () => startRename(node),
          },
          {
            id: 'copy',
            label: 'Copy',
            icon: <DocumentDuplicateIcon className="w-4 h-4" />,
            action: () => copyNode(node),
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: <TrashIcon className="w-4 h-4" />,
            action: () => deleteNode(node),
            className: 'text-red-600 hover:text-red-700',
          },
          { id: 'sep2', separator: true, label: '', action: () => {} },
        );
      }

      items.push({
        id: 'reveal',
        label: 'Reveal in Explorer',
        icon: <EyeIcon className="w-4 h-4" />,
        action: () => revealInExplorer(node.path),
      });

      if (!node.isDirectory) {
        items.push({
          id: 'open-default',
          label: 'Open with Default App',
          icon: <ArrowPathIcon className="w-4 h-4" />,
          action: () => openInDefaultApp(node.path),
        });
      }

      return items;
    },
    [readOnly, createNewFile, createNewFolder, copyNode, deleteNode, startRename],
  );

  // Helper functions
  const findNodeByPath = useCallback((nodes: TreeNode[], path: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const finishRename = useCallback(async () => {
    if (!editingNode || !editingValue.trim()) {
      setEditingNode(null);
      return;
    }

    const node = findNodeByPath(treeData, editingNode);
    if (!node) return;

    const newPath = `${node.parentPath}/${editingValue.trim()}`;

    try {
      const result = await renameFile(node.path, newPath);
      if (result.success) {
        await refreshDirectory(node.parentPath || rootPath || '');
        addNotification('success', 'Renamed', {
          message: `Renamed to: ${editingValue}`,
          duration: 3000,
        });
      }
    } catch (err) {
      addNotification('error', 'Rename Error', {
        message: `Failed to rename: ${getFileName(node.path)}`,
        duration: 5000,
      });
    }

    setEditingNode(null);
    setEditingValue('');
  }, [
    editingNode,
    editingValue,
    treeData,
    rootPath,
    addNotification,
    refreshDirectory,
    findNodeByPath,
  ]);

  // Render tree node
  const renderNode = (node: TreeNode): React.ReactNode => {
    const isSelected = selectedNodes.has(node.path);
    const isExpanded = expandedNodes.has(node.path);
    const IconComponent = getFileIcon(node);
    const isEditing = editingNode === node.path;

    return (
      <div key={node.path} className="select-none">
        <div
          className={`
                        flex items-center py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer
                        ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''}
                        ${dragState.dropTarget?.path === node.path ? 'bg-blue-200 dark:bg-blue-800' : ''}
                    `}
          style={{ paddingLeft: `${node.level * 16 + 8}px` }} // eslint-disable-line react/style-prop-object
          onClick={(e) => handleNodeSelect(node, e)}
          onDoubleClick={() => handleNodeDoubleClick(node)}
          onContextMenu={(e) => {
            e.preventDefault();
            contextMenu.open(e, getContextMenuItems(node));
          }}
          draggable={!readOnly}
          onDragStart={(e) => {
            setDragState((prev) => ({ ...prev, isDragging: true, draggedNode: node }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {
            setDragState({
              isDragging: false,
              draggedNode: null,
              dropTarget: null,
              dropPosition: null,
            });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (node.isDirectory && dragState.draggedNode?.path !== node.path) {
              setDragState((prev) => ({ ...prev, dropTarget: node, dropPosition: 'inside' }));
            }
          }}
          onDrop={async (e) => {
            e.preventDefault();
            if (
              dragState.draggedNode &&
              node.isDirectory &&
              dragState.draggedNode.path !== node.path
            ) {
              // Handle file move operation
              const sourcePath = dragState.draggedNode.path;
              const destPath = `${node.path}/${getFileName(sourcePath)}`;

              try {
                const result = await renameFile(sourcePath, destPath);
                if (result.success) {
                  await refreshDirectory(dragState.draggedNode.parentPath);
                  await refreshDirectory(node.path);
                  addNotification('success', 'Moved', {
                    message: `Moved ${getFileName(sourcePath)} to ${getFileName(node.path)}`,
                    duration: 3000,
                  });
                }
              } catch (err) {
                addNotification('error', 'Move Error', {
                  message: `Failed to move ${getFileName(sourcePath)}`,
                  duration: 5000,
                });
              }
            }
          }}
        >
          {node.isDirectory && (
            <button
              className="mr-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node);
              }}
            >
              {node.isLoading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
          )}

          {node.isDirectory ? (
            IconComponent && <IconComponent className="w-4 h-4 mr-2 text-blue-600" />
          ) : (
            <FileIcon filePath={node.path} className="mr-2" size="sm" />
          )}

          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishRename();
                if (e.key === 'Escape') {
                  setEditingNode(null);
                  setEditingValue('');
                }
              }}
              className="flex-1 px-1 py-0 text-sm border border-blue-500 rounded focus:outline-none"
              aria-label="Rename file"
              placeholder="Enter new name"
            />
          ) : (
            <span className="flex-1 text-sm truncate" title={getFileName(node.path)}>
              {getFileName(node.path)}
            </span>
          )}

          {!node.isDirectory && (
            <span className="text-xs text-gray-500 ml-2">{formatFileSize(node.size || 0)}</span>
          )}
        </div>

        {node.children && isExpanded && (
          <div>{node.children.map((child) => renderNode(child))}</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <ArrowPathIcon className="w-6 h-6 animate-spin mr-2" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-red-600 ${className}`}>
        <p>Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={treeRef}
      className={`h-full overflow-auto bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <h3
          className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
          title={rootPath}
        >
          {rootPath ? getFileName(rootPath) || rootPath : 'File Explorer'}
        </h3>
      </div>

      <div className="py-1">
        {treeData.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">No files found</div>
        ) : (
          treeData.map((node) => renderNode(node))
        )}
      </div>
    </div>
  );
};

export default FileTreeExplorer;
