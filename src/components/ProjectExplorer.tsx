import React, { useRef, useMemo, useState } from 'react';
import { LanguageIcon } from './icons/LanguageIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { detectLanguage } from '../utils/languageDetector';
import { AppFile } from '../utils/sessionManager';
import { openFolderDialog } from '../services/fileSystemService';
import { TreeViewNode, FileTreeNode } from './TreeViewNode';
import { SearchIcon } from './icons/SearchIcon';
import { DocsIcon } from './icons/DocsIcon';
import { LayersIcon } from './icons/LayersIcon';

interface ProjectExplorerProps {
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;
  files: AppFile[];
  setFiles: (files: AppFile[]) => void;
  activeFileIdentifier: string | null;
  selectedFileIdentifiers: Set<string>;
  onFileSelection: (active: string | null, selected: Set<string>) => void;
  onFileContextMenu: (event: React.MouseEvent, fileIdentifier: string) => void;
  onCreateNewFile: () => void;
  refactoredFiles: Set<string>;
  desktopModeEnabled: boolean;
  explorerStyle: 'list' | 'tree';
  onSearch: (query: string) => void;
  onAnalyzeDependencies: () => void;
  onFindSimilarCode: () => void;
  openFolders: Set<string>;
  setOpenFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const buildFileTree = (files: AppFile[]): FileTreeNode => {
  const root: FileTreeNode = { name: 'root', type: 'folder', children: {} };
  files.forEach((file) => {
    const parts = file.identifier.split('/');
    let currentNode = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // It's a file
        currentNode.children[part] = { name: part, type: 'file', file, children: {} };
      } else {
        // It's a folder
        if (!currentNode.children[part]) {
          currentNode.children[part] = { name: part, type: 'folder', children: {} };
        }
        currentNode = currentNode.children[part];
      }
    });
  });
  return root;
};

export const ProjectExplorer: React.FC<ProjectExplorerProps> = (props) => {
  const {
    projectPath,
    setProjectPath,
    files,
    setFiles,
    activeFileIdentifier,
    selectedFileIdentifiers,
    onFileSelection,
    onFileContextMenu,
    onCreateNewFile,
    refactoredFiles,
    desktopModeEnabled,
    explorerStyle,
    onSearch,
    onAnalyzeDependencies,
    onFindSimilarCode,
    openFolders,
    setOpenFolders,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newAppFiles: AppFile[] = await Promise.all(
        Array.from(event.target.files).map(async (file) => ({
          name: file.name,
          content: await file.text(),
          identifier: (file as any).webkitRelativePath || file.name,
        })),
      );

      const fileMap = new Map(files.map((f) => [f.identifier, f]));
      newAppFiles.forEach((newFile) => {
        fileMap.set(newFile.identifier, newFile);
      });
      const mergedFiles = Array.from(fileMap.values());

      setFiles(mergedFiles);

      if (newAppFiles.length > 0) {
        if (
          !activeFileIdentifier ||
          !newAppFiles.some((f) => f.identifier === activeFileIdentifier)
        ) {
          onFileSelection(newAppFiles[0].identifier, new Set([newAppFiles[0].identifier]));
        }
      }
    }
    event.target.value = '';
  };

  const handleOpenLocalFolder = async () => {
    try {
      const result = await openFolderDialog();
      if (result) {
        console.log('[ProjectExplorer] Loaded folder:', result.folderPath, 'with', result.files.length, 'files');
        setProjectPath(result.folderPath);
        setFiles(result.files);
        console.log('[ProjectExplorer] Called setFiles with', result.files.length, 'files');
        if (result.files.length > 0) {
          onFileSelection(result.files[0].identifier, new Set([result.files[0].identifier]));
        } else {
          onFileSelection(null, new Set());
        }
      }
    } catch (error) {
      console.error('Error opening folder dialog:', error);
    }
  };

  const handleFileClick = (e: React.MouseEvent, clickedIdentifier: string) => {
    const clickedIndex = files.findIndex((f) => f.identifier === clickedIdentifier);
    if (clickedIndex === -1) return;

    const activeIndex = activeFileIdentifier
      ? files.findIndex((f) => f.identifier === activeFileIdentifier)
      : -1;

    let newSelected: Set<string>;
    let newActiveIdentifier: string | null;

    if (e.shiftKey && activeFileIdentifier && activeIndex > -1) {
      const start = Math.min(clickedIndex, activeIndex);
      const end = Math.max(clickedIndex, activeIndex);
      newSelected = new Set(files.slice(start, end + 1).map((f) => f.identifier));
      newActiveIdentifier = clickedIdentifier; // The clicked file becomes active
    } else if (e.ctrlKey || e.metaKey) {
      newSelected = new Set(selectedFileIdentifiers);
      if (newSelected.has(clickedIdentifier)) {
        newSelected.delete(clickedIdentifier);
        // If we deselected the active file, pick a new one. Otherwise, keep it.
        if (activeFileIdentifier === clickedIdentifier) {
          newActiveIdentifier = Array.from(newSelected).pop() || null;
        } else {
          newActiveIdentifier = activeFileIdentifier;
        }
      } else {
        newSelected.add(clickedIdentifier);
        newActiveIdentifier = clickedIdentifier; // The newly selected file becomes active
      }
    } else {
      newSelected = new Set([clickedIdentifier]);
      newActiveIdentifier = clickedIdentifier;
    }

    onFileSelection(newActiveIdentifier, newSelected);
  };

  const handleContextMenu = (e: React.MouseEvent, identifier: string) => {
    e.preventDefault();
    onFileContextMenu(e, identifier);
  };

  const renderFlatList = () => (
    <ul className="space-y-1">
      {files.map((file) => {
        const isActive = activeFileIdentifier === file.identifier;
        const isSelected = selectedFileIdentifiers.has(file.identifier);
        let bgClass = 'hover:bg-gray-700/50';
        if (isActive) bgClass = 'bg-brand-blue/30 text-white';
        else if (isSelected) bgClass = 'bg-gray-700/60';

        return (
          <li key={file.identifier}>
            <button
              onContextMenu={(e) => handleContextMenu(e, file.identifier)}
              onClick={(e) => handleFileClick(e, file.identifier)}
              className={`w-full text-left flex items-center p-1.5 rounded-md text-sm ${bgClass}`}
            >
              <LanguageIcon
                language={detectLanguage(file.name)}
                className="w-4 h-4 mr-2 flex-shrink-0"
              />
              <span className="truncate flex-grow" title={file.identifier}>
                {file.identifier}
              </span>
              {refactoredFiles.has(file.identifier) && (
                <SparklesIcon className="w-4 h-4 ml-2 flex-shrink-0 text-yellow-400" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      <h2 className="text-lg font-bold text-gray-200 flex-shrink-0">Project Explorer</h2>
      <div className="flex-shrink-0">
        {desktopModeEnabled ? (
          <div className="flex space-x-2">
            <button
              onClick={handleOpenLocalFolder}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            >
              Open Folder
            </button>
            <button
              onClick={onCreateNewFile}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            >
              New File
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              aria-label="Upload files"
            />
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFileChange}
              {...({ webkitdirectory: 'true' } as any)}
              multiple
              className="hidden"
              aria-label="Upload folder"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            >
              Upload File(s)
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            >
              Upload Folder
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-b border-gray-700 py-3">
        <div className="relative">
          <input
            type="search"
            placeholder="AI Semantic Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch(searchQuery);
            }}
            className="w-full bg-gray-700/60 border border-gray-600 rounded-md py-1.5 pl-3 pr-8 text-sm placeholder-gray-400"
            aria-label="AI Semantic Search"
          />
          <button
            onClick={() => onSearch(searchQuery)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            title="Run search"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onAnalyzeDependencies}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
        >
          <DocsIcon className="w-4 h-4" />
          Analyze Dependencies
        </button>
        <button
          onClick={onFindSimilarCode}
          disabled={files.length < 2}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LayersIcon className="w-4 h-4" />
          Find Similar Code
        </button>
      </div>

      {projectPath && (
        <div className="text-xs text-gray-400 font-mono truncate" title={projectPath}>
          {projectPath}
        </div>
      )}

      <div className="flex-grow overflow-y-auto pt-2">
        {files.length > 0 &&
          (explorerStyle === 'tree' ? (
            <TreeViewNode
              node={fileTree}
              path=""
              activeFileIdentifier={activeFileIdentifier}
              selectedFileIdentifiers={selectedFileIdentifiers}
              onFileClick={handleFileClick}
              onContextMenu={handleContextMenu}
              refactoredFiles={refactoredFiles}
              openFolders={openFolders}
              setOpenFolders={setOpenFolders}
            />
          ) : (
            renderFlatList()
          ))}
      </div>
    </div>
  );
};
