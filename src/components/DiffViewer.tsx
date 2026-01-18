import React, { useMemo, useCallback } from 'react';
import { getDiffLines, DiffLine, DiffPart } from '../utils/simpleDiff';

interface DiffViewerProps {
  originalCode: string;
  refactoredCode: string;
  onRefactoredCodeChange: (newCode: string) => void;
  language: string;
}

// Helper to render line content with intra-line diff highlights
const renderLineParts = (parts?: DiffPart[], showType: 'added' | 'removed' = 'added') => {
  if (!parts) return null;
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'common') {
          return <span key={index}>{part.value}</span>;
        }
        if (part.type === showType) {
          const className =
            showType === 'added' ? 'bg-green-500/40 font-bold' : 'bg-red-500/40 font-bold';
          return (
            <span key={index} className={className}>
              {part.value}
            </span>
          );
        }
        return null;
      })}
    </>
  );
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalCode,
  refactoredCode,
  onRefactoredCodeChange,
  language,
}) => {
  const diffLines = useMemo(
    () => getDiffLines(originalCode, refactoredCode),
    [originalCode, refactoredCode],
  );

  const handleContentChange = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const lines: string[] = [];
      event.currentTarget.childNodes.forEach((child) => {
        // We only care about the editable line divs, identified by a data attribute
        if (child instanceof HTMLDivElement && child.dataset.editableLine) {
          lines.push(child.textContent || '');
        }
      });
      onRefactoredCodeChange(lines.join('\n'));
    },
    [onRefactoredCodeChange],
  );

  return (
    <div className="w-full h-full font-mono text-sm bg-gray-900 border border-gray-600 rounded-md shadow-inner overflow-auto">
      <div className="grid grid-cols-2">
        {/* Left Panel (Original Code) */}
        <div>
          {diffLines.map((line, i) => {
            const isModification = line.type === 'modified';
            const isRemoval = line.type === 'removed';
            const bgClass = isModification || isRemoval ? 'bg-red-900/30' : 'bg-transparent';

            return (
              <div key={`old-${i}`} className={`px-4 whitespace-pre-wrap break-all ${bgClass}`}>
                <span className="text-gray-600 select-none w-10 inline-block text-right pr-4">
                  {line.oldLineNumber}
                </span>
                <span>
                  {isModification
                    ? renderLineParts(line.oldLineParts, 'removed')
                    : line.oldLineContent}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Panel (Refactored Code) - This whole div is contentEditable */}
        <div
          contentEditable
          onInput={handleContentChange}
          suppressContentEditableWarning={true}
          className="border-l border-gray-600 focus:outline-none"
          spellCheck="false"
        >
          {diffLines.map((line, i) => {
            const isModification = line.type === 'modified';
            const isAddition = line.type === 'added';
            const bgClass = isModification || isAddition ? 'bg-green-900/30' : 'bg-transparent';

            return (
              <div
                key={`new-${i}`}
                data-editable-line="true" // Marker for our onInput handler
                className={`px-4 whitespace-pre-wrap break-all min-h-[20px] ${bgClass}`}
              >
                <span className="text-gray-600 select-none w-10 inline-block text-right pr-4">
                  {line.newLineNumber}
                </span>
                <span>
                  {isModification
                    ? renderLineParts(line.newLineParts, 'added')
                    : line.newLineContent}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
