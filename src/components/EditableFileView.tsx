import React, { useCallback, useEffect, useRef, useState } from 'react';

interface EditableFileViewProps {
  filePath: string;
  content: string;
  onContentChange?: (next: string) => void;
  onSelectionChange?: (selectedText: string) => void;
  onSave?: (filePath: string, content: string) => Promise<void> | void;
}

export const EditableFileView: React.FC<EditableFileViewProps> = ({
  filePath,
  content,
  onContentChange,
  onSelectionChange,
  onSave,
}) => {
  // Defensive: ensure content is always a string
  const safeContent = content || '';
  const [value, setValue] = useState(safeContent);
  const [lineNumbers, setLineNumbers] = useState<number[]>([1]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Keep in sync when parent content prop updates
  useEffect(() => {
    setValue(content || '');
  }, [content]);

  // Update line numbers when content changes
  useEffect(() => {
    const lines = (value || '').split('\n');
    const lineCount = Math.max(lines.length, 1);
    setLineNumbers(Array.from({ length: lineCount }, (_, i) => i + 1));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    onContentChange?.(next);

    // Update line numbers
    const lines = (next || '').split('\n');
    const lineCount = Math.max(lines.length, 1);
    setLineNumbers(Array.from({ length: lineCount }, (_, i) => i + 1));
  };

  const handleSelect = () => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = start !== end ? el.value.slice(start, end) : '';
    onSelectionChange?.(selected);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const performFormat = useCallback(async () => {
    try {
      const api: any = (window as any).electronAPI;
      const res = await api?.formatContent?.(filePath, value);
      if (res?.success && typeof res.content === 'string') {
        setValue(res.content);
        onContentChange?.(res.content);
      }
    } catch {
      // ignore format errors; non-fatal
    }
  }, [filePath, value, onContentChange]);

  const performSave = useCallback(async () => {
    try {
      // Pre-format buffer locally so editor shows formatted content immediately
      await performFormat();
      await onSave?.(filePath, textRef.current ? textRef.current.value : value);
    } catch {
      // parent handles notifications
    }
  }, [filePath, value, onSave, performFormat]);

  // Ctrl/Cmd+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isAccel = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (isAccel && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        performSave();
      }
      // Shift+Alt+F format
      const isFormat = e.shiftKey && e.altKey && e.key.toLowerCase() === 'f';
      if (isFormat) {
        e.preventDefault();
        performFormat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performSave, performFormat]);

  // Auto-fix handler
  useEffect(() => {
    const handleAutoFix = (event: CustomEvent) => {
      const { filePath: targetFile, lineNumber, issue } = event.detail;
      
      console.log('[EditableFileView] Auto-fix event received:', { targetFile, lineNumber, currentFile: filePath });
      
      // Normalize file paths for comparison (handle both forward and back slashes)
      const normalizeFilePath = (path: string) => path.replace(/\\/g, '/').toLowerCase();
      const normalizedTarget = normalizeFilePath(targetFile);
      const normalizedCurrent = normalizeFilePath(filePath);
      
      // Check if this is the target file (match by filename if full path doesn't match)
      const isTargetFile = normalizedTarget === normalizedCurrent || 
                          normalizedTarget.endsWith(normalizedCurrent) ||
                          normalizedCurrent.endsWith(normalizedTarget.split('/').pop() || '');
      
      console.log('[EditableFileView] File match check:', { normalizedTarget, normalizedCurrent, isTargetFile });
      
      if (!isTargetFile) {
        console.log('[EditableFileView] Skipping - not the target file');
        return;
      }
      
      // Get current value from textarea directly to ensure we have the latest
      const currentValue = textRef.current?.value || value;
      const lines = currentValue.split('\n');
      
      console.log('[EditableFileView] Current content has', lines.length, 'lines');
      
      if (lineNumber < 1 || lineNumber > lines.length) {
        console.error('[EditableFileView] Line number out of range:', lineNumber, 'max:', lines.length);
        return;
      }
      
      const problematicLine = lines[lineNumber - 1];
      let fixedLine = problematicLine;
      
      console.log('[EditableFileView] Line', lineNumber, 'content:', problematicLine);
      
      // Generate fix based on issue type
      // CRITICAL: Only allow safe, non-destructive fixes
      // Mockups and placeholders need AI-generated code, not string replacement!
      
      if (issue.type === 'debug' && problematicLine) {
        // Remove debug console statements (safe operation)
        if (problematicLine.includes('console.log') || problematicLine.includes('console.error') || 
            problematicLine.includes('console.warn') || problematicLine.includes('console.info') ||
            problematicLine.includes('console.debug')) {
          fixedLine = ''; // Remove the line entirely
          console.log('[EditableFileView] Removing debug console statement');
        }
      } else if (issue.type === 'todo' && problematicLine.trim().startsWith('//')) {
        // Remove TODO comments ONLY if they're standalone comments (safe operation)
        fixedLine = ''; // Remove TODO comment line
        console.log('[EditableFileView] Removing TODO comment');
      } else if (issue.type === 'mock' || issue.type === 'placeholder' || issue.type === 'incomplete') {
        // CANNOT auto-fix mockups/placeholders - they need AI-generated real code!
        alert('⚠️ Cannot auto-fix mockups/placeholders!\n\nThese require AI-generated real code, not simple string replacement.\n\nUse the "Ask AI to Fix" button instead (coming soon).');
        console.log('[EditableFileView] Blocked auto-fix for', issue.type, '- needs AI');
        return; // Abort the fix
      } else {
        // Unknown issue type - don't modify code
        alert('⚠️ Cannot auto-fix this issue type: ' + issue.type);
        return;
      }
      
      // Replace the line
      lines[lineNumber - 1] = fixedLine;
      const newValue = lines.join('\n');
      
      console.log('[EditableFileView] New value length:', newValue.length, 'old:', currentValue.length);
      
      // Update the editor - force update by directly setting textarea value
      if (textRef.current) {
        textRef.current.value = newValue;
      }
      setValue(newValue);
      onContentChange?.(newValue);
      
      console.log('[EditableFileView] State updated');
      
      // Auto-save the file to disk so re-analysis works
      const saveFile = async () => {
        try {
          if (onSave) {
            await onSave(filePath, newValue);
            console.log('[EditableFileView] File auto-saved via onSave callback');
          } else {
            const api = (window as any).electronAPI;
            if (api?.saveFileContent) {
              await api.saveFileContent(filePath, newValue);
              console.log('[EditableFileView] File auto-saved via electronAPI.saveFileContent');
            } else {
              throw new Error('saveFileContent API not available');
            }
          }
        } catch (error) {
          console.error('[EditableFileView] Failed to auto-save:', error);
          throw error;
        }
      };
      
      // Save immediately after fix and wait for completion
      saveFile().then(() => {
        console.log('[EditableFileView] Save completed successfully');
        
        // Show confirmation after save completes
        alert(`✅ Auto-fixed line ${lineNumber}!\n\nOld: ${problematicLine}\nNew: ${fixedLine || '(removed)'}\n\n✅ File saved to disk.`);
        
        // Scroll to the fixed line
        if (textRef.current) {
          const lineHeight = 24; // Approximate line height
          const scrollTop = (lineNumber - 1) * lineHeight;
          textRef.current.scrollTop = scrollTop - 100;
          textRef.current.focus();
        }
      }).catch((error) => {
        alert(`⚠️ Auto-fix applied but save failed!\n\nPlease save manually (Ctrl+S)\n\nError: ${error.message || 'Unknown error'}`);
      });
    };

    window.addEventListener('ide:auto-fix-line', handleAutoFix as EventListener);
    return () => {
      window.removeEventListener('ide:auto-fix-line', handleAutoFix as EventListener);
    };
  }, [filePath, value, onContentChange, onSave]);

  // Defensive: handle undefined filePath
  const name = (filePath || 'untitled').split(/[/\\]/).pop() || 'file';

  return (
    <div className="h-full flex">
      {/* Line Numbers Column */}
      <div 
        ref={lineNumbersRef}
        className="line-numbers bg-gray-800 text-gray-500 text-xs font-mono p-4 overflow-y-auto select-none border-r border-gray-700 w-15 leading-6"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <style>{`
          .line-numbers::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {lineNumbers.map((lineNum) => (
          <div key={lineNum} className="h-6 leading-6 text-right pr-2">
            {lineNum}
          </div>
        ))}
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800 text-gray-200">
          <div className="text-sm font-medium truncate" title={filePath}>
            {name}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={performFormat}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
              title="Format (Shift+Alt+F)"
            >
              Format
            </button>
            <button
              onClick={performSave}
              className="px-3 py-1 text-xs bg-brand-blue hover:bg-blue-600 text-white rounded"
              title="Save (Ctrl/Cmd+S)"
            >
              Save
            </button>
          </div>
        </div>
        <textarea
          ref={textRef}
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onScroll={handleScroll}
          className="flex-1 bg-gray-900 text-gray-200 font-mono text-sm p-4 outline-none resize-none"
          style={{ lineHeight: '1.5' }}
          spellCheck={false}
          aria-label="code-editor"
        />
      </div>
    </div>
  );
};

export default EditableFileView;
