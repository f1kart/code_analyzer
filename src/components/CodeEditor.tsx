import React, { useRef, useEffect, useState } from 'react';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  placeholder?: string;
  onContextMenu?: (event: React.MouseEvent, selectedText: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  readOnly = false,
  placeholder,
  onContextMenu,
}) => {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const langLabel = language.charAt(0).toUpperCase() + language.slice(1);
  const defaultPlaceholder = readOnly
    ? `Refactored ${langLabel} code will appear here...`
    : `Paste your ${langLabel} code here or upload a file...`;

  // Listen for scroll-to-line events
  useEffect(() => {
    const handleScrollToLine = (event: CustomEvent) => {
      const { lineNumber } = event.detail;
      if (editorRef.current && lineNumber) {
        // Calculate character position for the line
        const lines = value.split('\n');
        let charPosition = 0;
        for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
          charPosition += lines[i].length + 1; // +1 for newline
        }
        
        // Set cursor position to the start of the line
        editorRef.current.focus();
        editorRef.current.setSelectionRange(charPosition, charPosition + (lines[lineNumber - 1]?.length || 0));
        
        // Scroll to make the line visible
        const lineHeight = 20; // Approximate line height in pixels
        const scrollTop = (lineNumber - 1) * lineHeight;
        editorRef.current.scrollTop = scrollTop - 100; // Offset to show some context above
        
        // Highlight the line temporarily
        setHighlightedLine(lineNumber);
        setTimeout(() => setHighlightedLine(null), 3000); // Remove highlight after 3 seconds
      }
    };

    const handleAutoFix = (event: CustomEvent) => {
      const { lineNumber, issue } = event.detail;
      if (editorRef.current && lineNumber && onChange) {
        const lines = value.split('\n');
        const problematicLine = lines[lineNumber - 1];
        
        // Generate fix based on issue type
        let fixedLine = problematicLine;
        
        if (issue.type === 'mock' && problematicLine) {
          // Remove console statements
          if (problematicLine.includes('console.log') || problematicLine.includes('console.error') || problematicLine.includes('console.warn')) {
            fixedLine = ''; // Remove the line entirely
          }
        } else if (issue.type === 'todo') {
          // Remove TODO comments
          fixedLine = ''; // Remove TODO line
        } else if (issue.type === 'placeholder') {
          // Comment out placeholder code
          fixedLine = '// ' + problematicLine + ' // TODO: Implement this';
        }
        
        // Replace the line
        lines[lineNumber - 1] = fixedLine;
        const newValue = lines.join('\n');
        
        // Update the editor
        onChange(newValue);
        
        // Show confirmation
        alert(`✅ Auto-fixed line ${lineNumber}!\n\nOld: ${problematicLine}\nNew: ${fixedLine || '(removed)'}\n\nUse Ctrl+Z to undo if needed.`);
        
        // Highlight the fixed line
        setHighlightedLine(lineNumber);
        setTimeout(() => setHighlightedLine(null), 3000);
      }
    };

    window.addEventListener('ide:scroll-to-line', handleScrollToLine as EventListener);
    window.addEventListener('ide:auto-fix-line', handleAutoFix as EventListener);
    return () => {
      window.removeEventListener('ide:scroll-to-line', handleScrollToLine as EventListener);
      window.removeEventListener('ide:auto-fix-line', handleAutoFix as EventListener);
    };
  }, [value, onChange]);

  const handleContextMenu = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (onContextMenu && editorRef.current) {
      const start = editorRef.current.selectionStart;
      const end = editorRef.current.selectionEnd;
      const selectedText = start !== end ? editorRef.current.value.substring(start, end) : '';
      onContextMenu(event, selectedText);
    }
  };

  return (
    <div className="h-full relative">
      {highlightedLine && (
        <div 
          className="absolute left-0 right-0 bg-yellow-400 opacity-30 pointer-events-none z-10"
          style={{
            top: `${(highlightedLine - 1) * 20 + 16}px`, // Approximate line position
            height: '20px'
          }}
        />
      )}
      <textarea
        ref={editorRef}
        id={readOnly ? 'code-output' : 'code-input'}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onContextMenu={handleContextMenu}
        placeholder={placeholder || defaultPlaceholder}
        readOnly={readOnly}
        className={`w-full h-full p-4 font-mono text-sm bg-gray-900 border border-gray-600 rounded-md shadow-inner text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition resize-y ${readOnly ? 'bg-gray-900/50 cursor-default' : ''}`}
        spellCheck="false"
        aria-label={readOnly ? 'Refactored code output' : 'Original code input'}
        title={highlightedLine ? `Line ${highlightedLine} highlighted` : undefined}
      />
    </div>
  );
};
