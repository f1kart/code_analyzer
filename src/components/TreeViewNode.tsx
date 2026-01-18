import React, { useState } from 'react';
import { LanguageIcon } from './icons/LanguageIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { detectLanguage } from '../utils/languageDetector';
import { AppFile } from '../utils/sessionManager';

export interface FileTreeNode {
  name: string;
  type: 'folder' | 'file';
  file?: AppFile;
  children: { [key: string]: FileTreeNode };
}

interface TreeViewNodeProps {
  node: FileTreeNode;
  path: string;
  activeFileIdentifier: string | null;
  selectedFileIdentifiers: Set<string>;
  onFileClick: (e: React.MouseEvent, identifier: string) => void;
  onContextMenu: (e: React.MouseEvent, identifier: string) => void;
  refactoredFiles: Set<string>;
  openFolders: Set<string>;
  setOpenFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const FolderIcon: React.FC<{ isOpen: boolean } & React.SVGProps<SVGSVGElement>> = ({
  isOpen,
  ...props
}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    {isOpen ? (
      <>
        <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h13A1.5 1.5 0 0 1 18 6.5v.553a2 2 0 0 1-1.056 1.764l-6 3.001a2 2 0 0 1-1.888 0l-6-3.001A2 2 0 0 1 2 7.053V6.5Z" />
        <path d="M2 9.562a2 2 0 0 1 1.056-1.764l6-3.001a2 2 0 0 1 1.888 0l6 3.001A2 2 0 0 1 18 9.562V15.5A1.5 1.5 0 0 1 16.5 17h-13A1.5 1.5 0 0 1 2 15.5V9.562Z" />
      </>
    ) : (
      <path d="M3.5 4A1.5 1.5 0 0 1 5 2.5h2.879a1.5 1.5 0 0 1 1.06.44l.879.879A1.5 1.5 0 0 0 10.879 4H15a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 15 17.5H5A1.5 1.5 0 0 1 3.5 16V4Z" />
    )}
  </svg>
);

export const TreeViewNode: React.FC<TreeViewNodeProps> = ({
  node,
  path,
  openFolders,
  setOpenFolders,
  ...props
}) => {
  const currentPath = path ? `${path}/${node.name}` : node.name;
  const isOpen = openFolders.has(currentPath);

  const toggleOpen = () => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(currentPath)) {
        newSet.delete(currentPath);
      } else {
        newSet.add(currentPath);
      }
      return newSet;
    });
  };

  if (node.name === 'root') {
    return (
      <ul className="space-y-1">
        {Object.values(node.children)
          .sort((a, b) =>
            a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1,
          )
          .map((child) => (
            <TreeViewNode
              key={child.name}
              node={child}
              path=""
              openFolders={openFolders}
              setOpenFolders={setOpenFolders}
              {...props}
            />
          ))}
      </ul>
    );
  }

  if (node.type === 'folder') {
    return (
      <li>
        <button
          onClick={toggleOpen}
          className="w-full text-left flex items-center p-1.5 rounded-md text-sm hover:bg-gray-700/50"
        >
          <FolderIcon isOpen={isOpen} className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-500" />
          <span className="font-semibold">{node.name}</span>
        </button>
        {isOpen && (
          <ul className="pl-4 space-y-1 mt-1">
            {Object.values(node.children)
              .sort((a, b) =>
                a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1,
              )
              .map((child) => (
                <TreeViewNode
                  key={child.name}
                  node={child}
                  path={currentPath}
                  openFolders={openFolders}
                  setOpenFolders={setOpenFolders}
                  {...props}
                />
              ))}
          </ul>
        )}
      </li>
    );
  }

  // It's a file
  const file = node.file!;
  const isActive = props.activeFileIdentifier === file.identifier;
  const isSelected = props.selectedFileIdentifiers.has(file.identifier);
  let bgClass = 'hover:bg-gray-700/50';
  if (isActive) bgClass = 'bg-brand-blue/30 text-white';
  else if (isSelected) bgClass = 'bg-gray-700/60';

  return (
    <li>
      <button
        onClick={(e) => props.onFileClick(e, file.identifier)}
        onContextMenu={(e) => props.onContextMenu(e, file.identifier)}
        className={`w-full text-left flex items-center p-1.5 rounded-md text-sm ${bgClass}`}
      >
        <LanguageIcon language={detectLanguage(file.name)} className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="truncate flex-grow" title={file.identifier}>
          {file.name}
        </span>
        {props.refactoredFiles.has(file.identifier) && (
          <SparklesIcon className="w-4 h-4 ml-2 flex-shrink-0 text-yellow-400" />
        )}
      </button>
    </li>
  );
};
