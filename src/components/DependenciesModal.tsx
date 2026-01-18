import React from 'react';

interface DependenciesModalProps {
  result: string;
  onClose: () => void;
}

export const DependenciesModal: React.FC<DependenciesModalProps> = ({ result, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">Dependency Analysis</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-grow p-6 overflow-y-auto">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap">{result}</pre>
        </div>
      </div>
    </div>
  );
};
