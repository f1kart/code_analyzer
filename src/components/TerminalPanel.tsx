import React, { useState, useEffect, useRef } from 'react';
import { spawnPty, writePty, killPty, onPtyData, onPtyExit } from '../services/terminalService';
import { BugIcon } from './icons/BugIcon';

interface TerminalPanelProps {
  history: { command: string; output: string; error?: boolean }[];
  onCommand: (command: string) => void;
  onClose: () => void;
  onDebug: (command: string, output: string) => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  history,
  onCommand,
  onClose,
  onDebug,
}) => {
  const [input, setInput] = useState('');
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [ptyOutput, setPtyOutput] = useState<string>('');
  const endOfHistoryRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      if (ptyId) {
        try {
          await writePty(ptyId, input + '\r');
        } catch (err) {
          console.error('PTY write error:', err);
        }
        setInput('');
      } else {
        onCommand(input);
        setInput('');
      }
    }
  };

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Spawn PTY if available
  useEffect(() => {
    let removeData: (() => void) | null = null;
    let removeExit: (() => void) | null = null;
    (async () => {
      try {
        const { id } = await spawnPty(undefined, 120, 30);
        setPtyId(id);
        removeData = onPtyData(({ id: incomingId, data }) => {
          if (incomingId === id) setPtyOutput((prev) => prev + data);
        });
        removeExit = onPtyExit(({ id: exitingId }) => {
          if (exitingId === id) setPtyId(null);
        });
      } catch {
        // PTY not available; silently use fallback
      }
    })();
    return () => {
      if (removeData) removeData();
      if (removeExit) removeExit();
      if (ptyId) {
        killPty(ptyId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1/3 max-h-96 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 flex flex-col z-20">
      <div className="flex-shrink-0 flex justify-between items-center p-2 border-b border-gray-700">
        <h3 className="font-semibold text-gray-300">Terminal</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">
          &times;
        </button>
      </div>
      <div className="flex-grow p-4 overflow-y-auto font-mono text-sm">
        {history.map((entry, index) => (
          <div key={index} className="mb-2">
            <div className="flex items-center">
              <span className="text-green-400 mr-2">$</span>
              <span className="text-white">{entry.command}</span>
            </div>
            <div className="relative">
              <pre
                className={`whitespace-pre-wrap break-all ${entry.error ? 'text-red-400' : 'text-gray-400'}`}
              >
                {entry.output}
              </pre>
              {entry.error && (
                <button
                  onClick={() => onDebug(entry.command, entry.output)}
                  className="absolute top-0 right-0 flex items-center gap-1.5 px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900/80 text-red-300 rounded-md"
                >
                  <BugIcon className="w-4 h-4" /> Debug with AI
                </button>
              )}
            </div>
          </div>
        ))}
        {ptyId && (
          <div className="mt-2">
            <div className="flex items-center">
              <span className="text-blue-400 mr-2">PTY</span>
              <span className="text-gray-300">Interactive session</span>
            </div>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-gray-300">
              {ptyOutput}
            </pre>
          </div>
        )}
        <div ref={endOfHistoryRef} />
      </div>
      <div className="flex-shrink-0 p-2 border-t border-gray-700 flex items-center font-mono text-sm">
        <span className="text-green-400 mr-2">$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent w-full focus:outline-none text-white"
          placeholder="Enter command..."
          autoFocus
        />
      </div>
    </div>
  );
};
