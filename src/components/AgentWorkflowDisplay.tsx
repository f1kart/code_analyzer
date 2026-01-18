import React from 'react';
import { AgentWorkflowState } from '../services/geminiService';

interface AgentWorkflowDisplayProps {
  result: AgentWorkflowState | null;
}

export const AgentWorkflowDisplay: React.FC<AgentWorkflowDisplayProps> = ({ result }) => {
  if (!result) {
    return <div className="text-center text-gray-500">No agent workflow active.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Agent Task Execution</h2>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-gray-200">Goal:</h3>
        <p className="text-sm text-gray-400">{result.goal}</p>
      </div>
      <div className="flex-grow overflow-y-auto space-y-2">
        {result.plan.map((step, index) => (
          <div key={index} className="bg-gray-800/50 p-3 rounded-md">
            <p className="font-semibold text-gray-300">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
