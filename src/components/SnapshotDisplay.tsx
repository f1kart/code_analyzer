import React from 'react';
import { SnapshotResult, SnapshotDescription } from '../services/geminiService';

interface SnapshotDisplayProps {
  result: SnapshotResult;
}

const ComponentCard: React.FC<{ title: string; desc: SnapshotDescription }> = ({ title, desc }) => {
  const style: React.CSSProperties = {
    ['--card-bg' as any]: desc.backgroundColor || 'transparent',
    ['--card-fg' as any]: desc.textColor || 'inherit',
    ['--card-border' as any]: desc.borderColor || '#4b5563',
    ['--card-font-size' as any]: desc.fontSize || '1rem',
    ['--card-font-weight' as any]: (desc.fontWeight as any) || 'normal',
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-800 border border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-300 px-4 py-2 border-b border-gray-700">
        {title}
      </h3>
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="p-8 border-2 border-dashed flex items-center justify-center" style={style}>
          <style>{`:root {}`}</style>
          <div className="[background-color:var(--card-bg)] [color:var(--card-fg)] [border-color:var(--card-border)] [font-size:var(--card-font-size)] [font-weight:var(--card-font-weight)]">
            <p>{desc.text || 'Sample Text'}</p>
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-400 p-4 border-t border-gray-700">
        <p>
          <strong>Layout:</strong> {desc.layout}
        </p>
        <p>
          <strong>BG:</strong> {desc.backgroundColor}
        </p>
        <p>
          <strong>Text:</strong> {desc.textColor}
        </p>
      </div>
    </div>
  );
};

export const SnapshotDisplay: React.FC<SnapshotDisplayProps> = ({ result }) => {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-100 flex-shrink-0">Visual Snapshot</h2>
      <div className="flex-grow flex flex-col md:flex-row gap-4 min-h-0">
        <ComponentCard title="Before" desc={result.before} />
        <ComponentCard title="After" desc={result.after} />
      </div>
    </div>
  );
};
