import React, { useState, useCallback } from 'react';
import { Message } from '../utils/sessionManager';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';

interface ChatCodeApplicationProps {
  chatHistory: Message[];
  onApplyCode: (code: string, fileName?: string) => void;
  onCreateFile: (fileName: string, content: string) => void;
  onUpdateFile: (identifier: string, content: string) => void;
  activeFileIdentifier: string | null;
  uploadedFiles: Array<{ identifier: string; name: string; content: string }>;
}

interface CodeBlock {
  language: string;
  code: string;
  fileName?: string;
  messageIndex: number;
  blockIndex: number;
}

export const ChatCodeApplication: React.FC<ChatCodeApplicationProps> = ({
  chatHistory,
  onApplyCode,
  onCreateFile,
  onUpdateFile,
  activeFileIdentifier,
  uploadedFiles,
}) => {
  const [selectedCodeBlocks, setSelectedCodeBlocks] = useState<Set<string>>(new Set());
  const [applicationMode, setApplicationMode] = useState<'replace' | 'append' | 'new'>('replace');
  const [targetFileName, setTargetFileName] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Extract code blocks from chat messages
  const extractCodeBlocks = useCallback((): CodeBlock[] => {
    const codeBlocks: CodeBlock[] = [];

    chatHistory.forEach((message, messageIndex) => {
      if (message.author === 'model' && message.content) {
        // Match code blocks with language specification
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        let blockIndex = 0;

        while ((match = codeBlockRegex.exec(message.content)) !== null) {
          const language = match[1] || 'plaintext';
          const code = match[2].trim();

          // Try to extract filename from comments or context
          const fileNameMatch = code.match(
            /\/\/\s*(?:File:|Filename:)\s*(.+)|#\s*(?:File:|Filename:)\s*(.+)|<!--\s*(?:File:|Filename:)\s*(.+)\s*-->/i,
          );
          const fileName = fileNameMatch
            ? (fileNameMatch[1] || fileNameMatch[2] || fileNameMatch[3]).trim()
            : undefined;

          if (code.length > 10) {
            // Only include substantial code blocks
            codeBlocks.push({
              language,
              code,
              fileName,
              messageIndex,
              blockIndex: blockIndex++,
            });
          }
        }
      }
    });

    return codeBlocks;
  }, [chatHistory]);

  const codeBlocks = extractCodeBlocks();

  const debouncedFileNameChange = useDebouncedCallback((value: string) => {
    setTargetFileName(value);
  }, 300);

  const getBlockId = (messageIndex: number, blockIndex: number): string => {
    return `${messageIndex}-${blockIndex}`;
  };

  const toggleCodeBlockSelection = (messageIndex: number, blockIndex: number) => {
    const blockId = getBlockId(messageIndex, blockIndex);
    const newSelection = new Set(selectedCodeBlocks);

    if (newSelection.has(blockId)) {
      newSelection.delete(blockId);
    } else {
      newSelection.add(blockId);
    }

    setSelectedCodeBlocks(newSelection);
  };

  const getSelectedCodeBlocks = (): CodeBlock[] => {
    return codeBlocks.filter((block) =>
      selectedCodeBlocks.has(getBlockId(block.messageIndex, block.blockIndex)),
    );
  };

  const combineSelectedCode = (): string => {
    const selected = getSelectedCodeBlocks();
    return selected.map((block) => block.code).join('\n\n');
  };

  const handleApplyCode = async () => {
    const selected = getSelectedCodeBlocks();
    if (selected.length === 0) return;

    setIsApplying(true);

    try {
      const combinedCode = combineSelectedCode();

      switch (applicationMode) {
        case 'replace':
          if (activeFileIdentifier) {
            onUpdateFile(activeFileIdentifier, combinedCode);
          } else {
            onApplyCode(combinedCode);
          }
          break;

        case 'append':
          if (activeFileIdentifier) {
            const currentFile = uploadedFiles.find((f) => f.identifier === activeFileIdentifier);
            if (currentFile) {
              const newContent = currentFile.content + '\n\n' + combinedCode;
              onUpdateFile(activeFileIdentifier, newContent);
            }
          } else {
            onApplyCode(combinedCode);
          }
          break;

        case 'new': {
          const fileName = targetFileName || selected[0]?.fileName || 'new-file.txt';
          onCreateFile(fileName, combinedCode);
          break;
        }
      }

      // Clear selection after successful application
      setSelectedCodeBlocks(new Set());
    } catch (error) {
      console.error('Error applying code:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const getLanguageIcon = (language: string): string => {
    const iconMap: { [key: string]: string } = {
      javascript: '🟨',
      typescript: '🔷',
      python: '🐍',
      java: '☕',
      cpp: '⚡',
      c: '⚡',
      rust: '🦀',
      go: '🐹',
      php: '🐘',
      ruby: '💎',
      swift: '🦉',
      kotlin: '🎯',
      html: '🌐',
      css: '🎨',
      scss: '🎨',
      json: '📋',
      xml: '📄',
      yaml: '⚙️',
      sql: '🗃️',
      bash: '💻',
      shell: '💻',
      powershell: '💻',
    };

    return iconMap[language.toLowerCase()] || '📝';
  };

  const getFileExtension = (language: string): string => {
    const extMap: { [key: string]: string } = {
      javascript: '.js',
      typescript: '.ts',
      python: '.py',
      java: '.java',
      cpp: '.cpp',
      c: '.c',
      rust: '.rs',
      go: '.go',
      php: '.php',
      ruby: '.rb',
      swift: '.swift',
      kotlin: '.kt',
      html: '.html',
      css: '.css',
      scss: '.scss',
      json: '.json',
      xml: '.xml',
      yaml: '.yml',
      sql: '.sql',
      bash: '.sh',
      shell: '.sh',
      powershell: '.ps1',
    };

    return extMap[language.toLowerCase()] || '.txt';
  };

  if (codeBlocks.length === 0) {
    return (
      <div className="p-4 text-center text-text-secondary">
        <div className="mb-2">💬</div>
        <p className="text-sm">No code blocks found in chat history</p>
        <p className="text-xs mt-1">
          Code blocks will appear here when the AI provides code examples
        </p>
      </div>
    );
  }

  return (
    <div className="bg-panel border-t border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Apply Code from Chat</h3>
          <div className="text-xs text-text-secondary">
            {codeBlocks.length} code block{codeBlocks.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* Application Mode Selection */}
        <div className="flex items-center space-x-4 mb-3">
          <label className="text-xs text-text-secondary">Mode:</label>
          <div className="flex items-center space-x-2">
            {[
              { value: 'replace', label: 'Replace', icon: '🔄' },
              { value: 'append', label: 'Append', icon: '➕' },
              { value: 'new', label: 'New File', icon: '📄' },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setApplicationMode(mode.value as any)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  applicationMode === mode.value
                    ? 'bg-brand-blue text-white'
                    : 'bg-panel-light text-text-secondary hover:text-text-primary'
                }`}
                title={`${mode.label} mode`}
              >
                <span>{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* New File Name Input */}
        {applicationMode === 'new' && (
          <div className="mb-3">
            <input
              type="text"
              placeholder="Enter filename..."
              onChange={(e) => debouncedFileNameChange(e.target.value)}
              className="w-full bg-panel-light border border-border rounded px-2 py-1 text-sm text-text-primary"
              title="New file name"
              aria-label="New file name"
            />
          </div>
        )}

        {/* Current Target Info */}
        {applicationMode !== 'new' && (
          <div className="text-xs text-text-secondary">
            Target:{' '}
            {activeFileIdentifier
              ? uploadedFiles.find((f) => f.identifier === activeFileIdentifier)?.name ||
                'Active file'
              : 'No file selected'}
          </div>
        )}
      </div>

      {/* Code Blocks List */}
      <div className="max-h-96 overflow-y-auto">
        {codeBlocks.map((block, index) => {
          const blockId = getBlockId(block.messageIndex, block.blockIndex);
          const isSelected = selectedCodeBlocks.has(blockId);

          return (
            <div
              key={blockId}
              className={`border-b border-border p-3 cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-brand-blue/10 border-l-4 border-l-brand-blue'
                  : 'hover:bg-panel-light'
              }`}
              onClick={() => toggleCodeBlockSelection(block.messageIndex, block.blockIndex)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCodeBlockSelection(block.messageIndex, block.blockIndex)}
                    className="rounded"
                    title={`Select code block ${index + 1}`}
                  />
                  <span className="text-sm">{getLanguageIcon(block.language)}</span>
                  <span className="text-xs font-medium text-text-primary">{block.language}</span>
                  {block.fileName && (
                    <span className="text-xs text-text-secondary bg-panel-light px-2 py-0.5 rounded">
                      {block.fileName}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary">
                  {block.code.split('\n').length} lines
                </div>
              </div>

              <pre className="bg-gray-900 p-2 rounded text-xs text-gray-300 overflow-x-auto max-h-32 overflow-y-auto">
                <code>
                  {block.code.length > 200 ? block.code.slice(0, 200) + '...' : block.code}
                </code>
              </pre>
            </div>
          );
        })}
      </div>

      {/* Apply Button */}
      {selectedCodeBlocks.size > 0 && (
        <div className="p-4 border-t border-border bg-panel-light">
          <button
            onClick={handleApplyCode}
            disabled={isApplying || (applicationMode === 'new' && !targetFileName)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-brand-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
            title={`Apply ${selectedCodeBlocks.size} selected code block${selectedCodeBlocks.size !== 1 ? 's' : ''}`}
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Applying...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>
                  Apply {selectedCodeBlocks.size} Code Block
                  {selectedCodeBlocks.size !== 1 ? 's' : ''}
                  {applicationMode === 'new' &&
                    targetFileName &&
                    ` to ${targetFileName}${getFileExtension(getSelectedCodeBlocks()[0]?.language || 'txt')}`}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatCodeApplication;
