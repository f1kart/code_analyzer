import React from 'react';

interface TerminalDisplayProps {
  output: {
    command: string;
    output: string;
  };
}

export const TerminalDisplay: React.FC<TerminalDisplayProps> = ({ output }) => {
  return (
    <div className="bg-black font-mono text-sm text-gray-300 rounded-lg border border-gray-700 my-2 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 text-xs text-gray-400">
        Terminal Output
      </div>
      <div className="p-4 overflow-x-auto">
        <div className="flex items-center">
          <span className="text-green-400 mr-2">$</span>
          <span className="text-white">{output.command}</span>
        </div>
        <pre className="whitespace-pre-wrap break-all mt-2">{output.output}</pre>
      </div>
    </div>
  );
};
