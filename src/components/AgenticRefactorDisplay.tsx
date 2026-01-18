import React from 'react';
import { AITeamRefactorResult, AITeamRefactorStep } from '../services/geminiService';
import { SummaryDisplay } from './SummaryDisplay';
import { CopyButton } from './CopyButton';
import { PlannerIcon } from './icons/PlannerIcon';
import { CoderIcon } from './icons/CoderIcon';
import { SecurityIcon } from './icons/SecurityIcon';
import { CriticIcon } from './icons/CriticIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface AgenticRefactorDisplayProps {
  result: AITeamRefactorResult;
}

const AgentStepDisplay: React.FC<{ step: AITeamRefactorStep }> = ({ step }) => {
  const getIcon = () => {
    switch (step.role) {
      case 'Planner':
        return <PlannerIcon className="w-5 h-5" />;
      case 'Coder':
        return <CoderIcon className="w-5 h-5" />;
      case 'SecurityAnalyst':
        return <SecurityIcon className="w-5 h-5" />;
      case 'Critic':
        return <CriticIcon className="w-5 h-5" />;
      case 'Integrator':
        return <SparklesIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg flex-1 min-w-[300px] flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 text-gray-200 flex-shrink-0">
        {getIcon()}
        <h3 className="font-semibold">{step.role}</h3>
      </div>
      <div className="p-4 h-64 overflow-y-auto">
        <SummaryDisplay summary={step.content} />
      </div>
    </div>
  );
};

export const AgenticRefactorDisplay: React.FC<AgenticRefactorDisplayProps> = ({ result }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-100">AI Team Refactor: War Room</h2>
        <CopyButton textToCopy={result.refactoredCode} />
      </div>
      <div className="flex-grow overflow-y-auto space-y-4 pr-2">
        <div className="flex flex-wrap gap-4">
          {result.steps
            .filter((s) => s.role !== 'Integrator')
            .map((step, index) => (
              <AgentStepDisplay key={index} step={step} />
            ))}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg mt-4">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 text-gray-200">
            <SparklesIcon className="w-5 h-5" />
            <h3 className="font-semibold">Final Summary</h3>
          </div>
          <div className="p-4">
            <SummaryDisplay summary={result.summary} />
          </div>
        </div>
      </div>
    </div>
  );
};
