import React from 'react';
import { LanguageIcon } from './icons/LanguageIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { detectLanguage } from '../utils/languageDetector';
import { AppFile } from '../utils/sessionManager';

interface FileTreeProps {
  files: AppFile[];
  activeFileIdentifier: string | null; // The file currently in the editor
  selectedFileIdentifiers: Set<string>; // All selected files
  onFileClick: (index: number, isCtrlClick: boolean, isShiftClick: boolean) => void;
  refactoredFiles: Set<string>;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFileIdentifier,
  selectedFileIdentifiers,
  onFileClick,
  refactoredFiles,
}) => {
  if (files.length === 0) {
    return null;
  }

  const handleClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    onFileClick(index, e.ctrlKey || e.metaKey, e.shiftKey);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-80 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 text-gray-200">Uploaded Files</h3>
      <ul className="space-y-1">
        {files.map((file, index) => {
          const isActive = activeFileIdentifier === file.identifier;
          const isSelected = selectedFileIdentifiers.has(file.identifier);
          const isRefactored = refactoredFiles.has(file.identifier);

          let bgClass = 'text-gray-400 hover:bg-gray-700 hover:text-gray-200';
          if (isActive) {
            bgClass = 'bg-brand-blue/30 text-white font-semibold';
          } else if (isSelected) {
            bgClass = 'bg-gray-700/60 text-gray-200';
          }

          return (
            <li key={`${file.identifier}-${index}`}>
              <button
                onClick={(e) => handleClick(e, index)}
                className={`w-full text-left flex items-center p-2 rounded-md text-sm transition-colors ${bgClass}`}
                aria-current={isActive ? 'true' : 'false'}
              >
                <LanguageIcon
                  language={detectLanguage(file.name)}
                  className="w-4 h-4 mr-2 flex-shrink-0"
                />
                <span className="truncate flex-grow" title={file.identifier}>
                  {file.identifier}
                </span>
                {isRefactored && (
                  <SparklesIcon className="w-4 h-4 ml-2 flex-shrink-0 text-yellow-400" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
