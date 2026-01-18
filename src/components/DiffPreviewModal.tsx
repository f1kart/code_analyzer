import React, { useMemo, useState } from 'react';

interface DiffPreviewModalProps {
  isOpen: boolean;
  filePath: string;
  original: string;
  proposed: string;
  onClose: () => void;
  onReplace: () => void;
  onAppend: () => void;
  onSaveAsNew: () => void;
}

export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isOpen,
  filePath,
  original,
  proposed,
  onClose,
  onReplace,
  onAppend,
  onSaveAsNew,
}) => {
  const name = filePath?.split(/[/\\]/).pop() || 'file';

  const [mode, setMode] = useState<'side' | 'unified'>('side');

  type DiffLine = { t: 'ctx' | '+' | '-'; text: string };
  const unified: DiffLine[] = useMemo(() => {
    try {
      const a = (original || '').split(/\r?\n/);
      const b = (proposed || '').split(/\r?\n/);
      const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0),
      );
      for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
          dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      const out: DiffLine[] = [];
      let i = 0,
        j = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
          out.push({ t: 'ctx', text: a[i] });
          i++;
          j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          out.push({ t: '-', text: a[i++] });
        } else {
          out.push({ t: '+', text: b[j++] });
        }
      }
      while (i < a.length) out.push({ t: '-', text: a[i++] });
      while (j < b.length) out.push({ t: '+', text: b[j++] });
      return out;
    } catch {
      return [];
    }
  }, [original, proposed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-[90vw] h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">Diff Preview</div>
            <div className="text-base text-gray-200 font-semibold truncate" title={filePath}>
              {name}
            </div>
            <div className="ml-4 flex items-center gap-2 text-xs">
              <button
                onClick={() => setMode('side')}
                className={`px-2 py-1 rounded ${mode === 'side' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setMode('unified')}
                className={`px-2 py-1 rounded ${mode === 'unified' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
              >
                Unified
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
          >
            Close
          </button>
        </div>

        {mode === 'side' ? (
          <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
            <div className="flex flex-col border-r border-gray-800">
              <div className="px-3 py-2 text-xs bg-gray-800 text-gray-300 border-b border-gray-700">
                Original
              </div>
              <pre className="flex-1 m-0 p-3 overflow-auto text-xs text-gray-300 whitespace-pre-wrap">
                {original || '\n// (Empty)'}
              </pre>
            </div>
            <div className="flex flex-col">
              <div className="px-3 py-2 text-xs bg-gray-800 text-gray-300 border-b border-gray-700">
                Proposed
              </div>
              <pre className="flex-1 m-0 p-3 overflow-auto text-xs text-gray-300 whitespace-pre-wrap">
                {proposed || '\n// (Empty)'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="px-3 py-2 text-xs bg-gray-800 text-gray-300 border-b border-gray-700">
              Unified Diff
            </div>
            <pre className="m-0 p-3 text-xs whitespace-pre-wrap">
              {unified.map((ln, idx) => (
                <div
                  key={idx}
                  className={`${ln.t === '+' ? 'bg-green-900/30 text-green-300' : ln.t === '-' ? 'bg-red-900/30 text-red-300' : 'text-gray-300'}`}
                >
                  <span className="mr-2 opacity-60">{ln.t === 'ctx' ? ' ' : ln.t}</span>
                  {ln.text || '\u00A0'}
                </div>
              ))}
            </pre>
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Left: {original?.length || 0} chars • Right: {proposed?.length || 0} chars
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAppend}
              className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded"
            >
              Append
            </button>
            <button
              onClick={onReplace}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Replace
            </button>
            <button
              onClick={onSaveAsNew}
              className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded"
            >
              Save as New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffPreviewModal;
