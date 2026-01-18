import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { isElectronAvailable } from '../utils/electronBridge';

interface FileNode {
  id: string;
  name: string;
  path: string;
  absolutePath?: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  children?: FileNode[];
  isExpanded?: boolean;
  depth: number;
  parentId?: string;
}

// --- Utility Functions (moved outside components) ---

// Utility function to format file sizes
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Utility function to get file icon
const getFileIcon = (fileName: string, isDir: boolean, isExpanded: boolean): string => {
  if (isDir) return isExpanded ? '📂' : '📁';

  const ext = fileName.split('.').pop()?.toLowerCase();
  const iconMap: { [key: string]: string } = {
    js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷', py: '🐍', java: '☕', cpp: '⚡', c: '⚡',
    html: '🌐', css: '🎨', scss: '🎨', json: '📋', md: '📝', txt: '📄', pdf: '📕',
    img: '🖼️', png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️', zip: '📦', tar: '📦', gz: '📦',
  };

  return iconMap[ext || ''] || '📄';
};

// Utility function to highlight text
const highlightText = (text: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm) return text;

  const parts = text.split(new RegExp(`(${searchTerm})` , 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === searchTerm.toLowerCase() ? (
      <mark key={i} className="bg-yellow-400 text-black">
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

// Flatten tree structure for display
const flattenTree = (nodes: FileNode[]): FileNode[] => {
  const flattened: FileNode[] = [];

  const traverse = (node: FileNode, depth: number = 0) => {
    flattened.push({ ...node, depth });
    if (node.type === 'directory' && node.children && node.isExpanded) {
      node.children.forEach((child) => traverse(child, depth + 1));
    }
  };

  nodes.forEach((node) => traverse(node));
  return flattened;
};

// Filter tree based on search term
const filterTree = (nodes: FileNode[], searchTerm: string): FileNode[] => {
  if (!searchTerm) return nodes;

  const filtered: FileNode[] = [];

  const matchesSearch = (node: FileNode): boolean => {
    return (
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Boolean(node.path && node.path.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const traverse = (node: FileNode): FileNode | null => {
    const nodeMatches = matchesSearch(node);
    let children = node.children;
    let hasMatchingChildren = false;

    if (children) {
      const filteredChildren = children.map(traverse).filter(Boolean) as FileNode[];
      if (filteredChildren.length > 0) {
        hasMatchingChildren = true;
        children = filteredChildren;
      } else {
        children = undefined; // No matching children
      }
    }

    if (nodeMatches || hasMatchingChildren) {
      // Auto-expand if the node or its children match, otherwise preserve existing state
      const shouldExpand = (nodeMatches && node.type === 'directory') || hasMatchingChildren || (node.isExpanded ?? false);
      return {
        ...node,
        children: children,
        isExpanded: shouldExpand,
      };
    }

    return null;
  };

  nodes.forEach((node) => {
    const filteredNode = traverse(node);
    if (filteredNode) filtered.push(filteredNode);
  });

  return filtered;
};


// --- React Components ---

interface OptimizedProjectExplorerProps {
  projectPath: string | null;
  onFileSelect: (filePath: string) => void;
  onFolderToggle?: (folderPath: string, isExpanded: boolean) => void;
  selectedFiles?: string[];
  openFolders?: string[];
  virtualizeThreshold?: number;
  // Web mode callbacks for file upload
  onFilesUploaded?: (files: Array<{ name: string; identifier: string; content: string }>) => void;
  onProjectPathSet?: (path: string) => void;
}

interface TreeItemData {
  items: FileNode[];
  onFileSelect: (filePath: string) => void;
  onFolderToggle: (folderPath: string, isExpanded: boolean) => void;
  selectedFiles: string[];
  searchTerm: string;
}

// Tree item component
const TreeItem: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: TreeItemData;
}> = ({ index, style, data }) => {
  const item = data.items[index];
  if (!item) return null; // Defensive check for out-of-bounds access if data changes

  const isSelected = data.selectedFiles.includes(item.path);
  const isDirectory = item.type === 'directory';
  const isExpanded = Boolean(item.isExpanded); // Ensure isExpanded is always boolean

  return (
    <div
      className={`flex items-center px-2 py-1 cursor-pointer select-none border-b border-border/20 hover:bg-panel-light ${
        isSelected ? 'bg-panel' : ''
      }`}
      draggable={!isDirectory}
      onDragStart={(e) => {
        if (!isDirectory) {
          try {
            e.dataTransfer.setData('application/x-ide-file', item.path);
            e.dataTransfer.effectAllowed = 'copy';
          } catch {
            /* ignore */
          }
        }
      }}
      style={style}
      role="treeitem"
      aria-expanded={isDirectory ? (isExpanded ? 'true' : 'false') : undefined}
      aria-level={1}
      aria-setsize={data.items.length}
      aria-posinset={index + 1}
      onClick={() => {
        if (isDirectory) {
          data.onFolderToggle(item.absolutePath || item.path, !isExpanded);
        } else {
          data.onFileSelect(item.absolutePath || item.path);
        }
      }}
      title={item.path}
    >
      <div
        className={`flex items-center space-x-2 flex-1 min-w-0 ${item.depth > 0 ? `pl-${Math.min(item.depth * 4, 16)}` : ''}`}
      >
        <span className="text-sm">{getFileIcon(item.name, isDirectory, isExpanded)}</span>
        <span className="text-sm text-text-primary truncate">
          {highlightText(item.name, data.searchTerm)}
        </span>
        {item.size && (
          <span className="text-xs text-text-secondary ml-auto">{formatFileSize(item.size)}</span>
        )}
      </div>
    </div>
  );
};


export const OptimizedProjectExplorer: React.FC<OptimizedProjectExplorerProps> = ({
  projectPath,
  onFileSelect,
  onFolderToggle: onFolderToggleProp, // Renamed to avoid collision
  selectedFiles = [], // Provide default empty array for props
  openFolders: _openFolders = [], // Prefix with _ to indicate intentionally unused
  virtualizeThreshold: _virtualizeThreshold = 100, // Prefix with _ to indicate intentionally unused
  onFilesUploaded,
  onProjectPathSet,
}) => {
  // Web file upload refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = isElectronAvailable();
  const [rawFileTree, setRawFileTree] = useState<FileNode[]>([]); // Stores the full tree as fetched
  const [fileTree, setFileTree] = useState<FileNode[]>([]); // Stores the tree with interactive states (e.g., isExpanded)
  const [searchTerm, setSearchTerm] = useState('');
  const pendingOpensRef = React.useRef<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'size' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showHidden, setShowHidden] = useState(false);

  // Default onFolderToggle if not provided
  const onFolderToggle = useMemo(() => onFolderToggleProp || (() => {}), [onFolderToggleProp]);

  // Debounced search to improve performance
  const debouncedSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  // Memoize `mapTree`  for `loadFileTree`  to apply initial `openFolders`  state
  // REMOVED openFolders dependency to prevent infinite loop
  const mapTree = useCallback((nodes: any[], depth = 0): FileNode[] => {
    return (nodes || []).map((n) => ({
      id: `${n.type}-${n.path}` ,
      name: n.name,
      path: n.path,
      absolutePath: n.absolutePath,
      type: n.type,
      depth,
      // Don't set isExpanded here - will be set later
      isExpanded: false,
      children: n.children ? mapTree(n.children, depth + 1) : undefined,
    }));
  }, []); // Empty deps - this function is stable

  // Load folder tree from main process via IPC (no Node APIs in renderer)
  const loadFileTree = useCallback(
    async (rootPath: string): Promise<FileNode[]> => {
      try {
        if (!rootPath) { // Check for empty path
          return [];
        }
        if (!(window as any).electronAPI?.getFolderTree) {
          console.error('[ProjectExplorer] electronAPI.getFolderTree not available!');
          return [];
        }
        
        const result = await (window as any).electronAPI.getFolderTree(rootPath);
        
        if (result?.error) {
          console.error('[ProjectExplorer] getFolderTree returned error:', result.error);
          return [];
        }
        
        if (!result?.tree) {
          console.warn('[ProjectExplorer] No tree in result, returning empty array');
          return [];
        }
        
        // Map raw tree without applying display filters (e.g., `showHidden` )
        const mapped = mapTree(result.tree || [], 0);
        return mapped;
      } catch (e) {
        console.error('[ProjectExplorer] loadFileTree exception:', e);
        return [];
      }
    },
    [mapTree],
  );

  // Effect to load file tree and update `rawFileTree`
  useEffect(() => {
    if (projectPath) { // Added null check
      setIsLoading(true);
      loadFileTree(projectPath)
        .then((tree) => {
          setRawFileTree(tree); // Store the initial raw tree
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('[ProjectExplorer] Failed to load file tree:', error);
          setIsLoading(false);
          // Don't crash - just show empty tree
          setRawFileTree([]);
        });
    } else {
      setRawFileTree([]); // Clear tree if projectPath is null
    }
  }, [projectPath, loadFileTree]);

  // Effect to initialize `fileTree`  from `rawFileTree`  or whenever `openFolders`  (for initial expansion) changes
  useEffect(() => {
    // This ensures `fileTree`  starts with the correct `isExpanded`  states based on `openFolders`
    setFileTree(rawFileTree);
  }, [rawFileTree]); // `fileTree`  is now the interactive state, rawFileTree is immutable base.

  // Internal handler for folder toggling, updates `isExpanded`  state in `fileTree`
  const handleFolderToggle = useCallback((folderPath: string, isExpanded: boolean) => {
    onFolderToggle(folderPath, isExpanded); // Call the external prop handler

    setFileTree((prevTree) => {
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === folderPath && node.type === 'directory') {
            return { ...node, isExpanded };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      return updateNode(prevTree);
    });
  }, [onFolderToggle]);

  // Sort tree nodes
  const sortNodes = useCallback(
    (nodes: FileNode[]): FileNode[] => {
      return [...nodes]
        .sort((a, b) => {
          let comparison = 0;

          // Always put directories first
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }

          switch (sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'size':
              comparison = (a.size || 0) - (b.size || 0);
              break;
            case 'modified':
              comparison = (a.lastModified?.getTime() || 0) - (b.lastModified?.getTime() || 0);
              break;
            default:
              comparison = a.name.localeCompare(b.name);
          }

          return sortOrder === 'asc' ? comparison : -comparison;
        })
        .map((node) => ({
          ...node,
          children: node.children ? sortNodes(node.children) : undefined,
        }));
    },
    [sortBy, sortOrder],
  );

  // Compute display items (filtered, sorted, flattened)
  const displayItems = useMemo(() => {
    let processedTree = [...fileTree]; // Start with the interactive tree state

    // Apply sorting
    processedTree = sortNodes(processedTree);
    if (searchTerm) {
      processedTree = filterTree(processedTree, searchTerm);
    }

    // Filter hidden files if needed
    if (!showHidden) {
      const filterHidden = (nodes: FileNode[]): FileNode[] => {
        return nodes
          .filter((node) => !node.name.startsWith('.'))
          .map((node) => ({
            ...node,
            children: node.children ? filterHidden(node.children) : undefined,
          }));
      };
      processedTree = filterHidden(processedTree);
    }

    // Flatten for virtualization using the `isExpanded`  state of nodes
    const flattened = flattenTree(processedTree);

    return flattened;
  }, [fileTree, searchTerm, sortNodes, showHidden]);

  // Virtualization disabled for now - can be re-enabled if needed
  // const shouldVirtualize = displayItems.length > virtualizeThreshold;
  const ITEM_HEIGHT = 28; // Define a constant for item height

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  // Handle web file upload
  const handleWebFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadedFiles: Array<{ name: string; identifier: string; content: string }> = [];
    let rootPath = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const content = await file.text();
        const relativePath = (file as any).webkitRelativePath || file.name;
        
        // Extract root folder name from first file
        if (i === 0 && relativePath.includes('/')) {
          rootPath = relativePath.split('/')[0];
        }

        uploadedFiles.push({
          name: file.name,
          identifier: relativePath,
          content,
        });
      } catch (error) {
        console.error(`[OptimizedProjectExplorer] Failed to read file ${file.name}:`, error);
      }
    }

    if (uploadedFiles.length > 0) {
      console.log(`[OptimizedProjectExplorer] Web upload: ${uploadedFiles.length} files from folder "${rootPath}"`);
      
      // Set project path for display
      if (onProjectPathSet && rootPath) {
        onProjectPathSet(`web-upload://${rootPath}`);
      }

      // Build file tree from uploaded files for display
      const treeNodes = buildTreeFromUploadedFiles(uploadedFiles);
      setRawFileTree(treeNodes);

      // Notify parent of uploaded files
      if (onFilesUploaded) {
        onFilesUploaded(uploadedFiles);
      }
    }

    // Reset input
    event.target.value = '';
  }, [onFilesUploaded, onProjectPathSet]);

  // Build tree structure from flat uploaded files
  const buildTreeFromUploadedFiles = (files: Array<{ name: string; identifier: string; content: string }>): FileNode[] => {
    const root: FileNode[] = [];
    const nodeMap = new Map<string, FileNode>();

    // Sort files to ensure directories are created before their children
    const sortedFiles = [...files].sort((a, b) => a.identifier.localeCompare(b.identifier));

    for (const file of sortedFiles) {
      const parts = file.identifier.split('/');
      let currentPath = '';
      let parentNode: FileNode | null = null;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!nodeMap.has(currentPath)) {
          const newNode: FileNode = {
            id: `${isLastPart ? 'file' : 'directory'}-${currentPath}`,
            name: part,
            path: currentPath,
            absolutePath: currentPath,
            type: isLastPart ? 'file' : 'directory',
            depth: i,
            isExpanded: i === 0, // Expand root folder by default
            children: isLastPart ? undefined : [],
            size: isLastPart ? file.content.length : undefined,
          };

          nodeMap.set(currentPath, newNode);

          if (parentNode && parentNode.children) {
            parentNode.children.push(newNode);
          } else if (i === 0) {
            root.push(newNode);
          }
        }

        parentNode = nodeMap.get(currentPath) || null;
      }
    }

    return root;
  };

  if (!projectPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-secondary p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">📁</div>
          <p className="font-semibold mb-2">No project selected</p>
          {isDesktop ? (
            <p className="text-sm">Open a folder to explore files</p>
          ) : (
            <>
              <p className="text-sm mb-4">Upload files to get started</p>
              {/* Hidden file inputs for web upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleWebFileUpload}
                multiple
                className="hidden"
                aria-label="Upload files"
              />
              <input
                type="file"
                ref={folderInputRef}
                onChange={handleWebFileUpload}
                {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                multiple
                className="hidden"
                aria-label="Upload folder"
              />
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-lg font-medium transition"
                  title="Upload a folder from your computer"
                >
                  📂 Upload Folder
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-panel-light hover:bg-panel text-text-primary border border-border rounded-lg font-medium transition"
                  title="Upload individual files"
                >
                  📄 Upload Files
                </button>
              </div>
              <p className="text-xs mt-3 text-text-secondary">
                💡 For full file system access, use the desktop app
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-panel">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary">Project Explorer</h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => { setShowHidden(!showHidden); }}
              className={`p-1 rounded text-xs transition-colors ${
                showHidden
                  ? 'bg-brand-blue text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
            >
              👁️
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search files..."
          onChange={(e) => debouncedSearch(e.target.value)}
          className="w-full bg-panel-light border border-border rounded px-2 py-1 text-sm text-text-primary"
          title="Search files and folders"
          aria-label="Search files and folders"
        />
      </div>

      {/* Sort Controls */}
      <div className="px-3 py-2 border-b border-border bg-panel-light">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-text-secondary">Sort:</span>
          {['name', 'type', 'size'].map((sort) => (
            <button
              key={sort}
              onClick={() => handleSort(sort as typeof sortBy)}
              className={`px-2 py-1 rounded transition-colors ${
                sortBy === sort
                  ? 'bg-brand-blue text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              title={`Sort by ${sort}` }
            >
              {sort}
              {sortBy === sort && <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-hidden relative"> {/* Added relative for List to take full height */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-6 h-6 animate-spin rounded-full border-2 border-brand-blue border-t-transparent mx-auto mb-2"></div>
              <p className="text-sm text-text-secondary">Loading files...</p>
            </div>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-secondary">
            <div className="text-center">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm">
                {searchTerm ? 'No files match your search' : 'No files found'}
              </p>
            </div>
          </div>
        ) : (
          // Non-virtualized list with proper ARIA tree structure
          <div className="overflow-y-auto h-full" role="tree" aria-label="File tree" aria-multiselectable="false">
            {displayItems.map((item, index) => (
              <TreeItem
                key={item.id}
                index={index}
                style={{ height: ITEM_HEIGHT }}
                data={{
                  items: displayItems,
                  onFileSelect: (fileIdentifier) => {
                    if (pendingOpensRef.current.has(fileIdentifier)) {
                      return;
                    }
                    pendingOpensRef.current.add(fileIdentifier);
                    try {
                      onFileSelect(fileIdentifier);
                    } finally {
                      pendingOpensRef.current.delete(fileIdentifier);
                    }
                  },
                  onFolderToggle: handleFolderToggle,
                  selectedFiles,
                  searchTerm,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-panel-light text-xs text-text-secondary">
        <div className="flex items-center justify-between">
          <span>{displayItems.length} items</span>
        </div>
      </div>
    </div>
  );
};

export default OptimizedProjectExplorer;
