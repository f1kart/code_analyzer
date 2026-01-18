import React from 'react';
import { AITeamRefactorResult, AITeamRefactorStep } from '../services/geminiService';
import { SummaryDisplay } from './SummaryDisplay';
import { CopyButton } from './CopyButton';
import { PlannerIcon } from './icons/PlannerIcon';
import { CoderIcon } from './icons/CoderIcon';
import { SecurityIcon } from './icons/SecurityIcon';
import { CriticIcon } from './icons/CriticIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { CheckIcon } from './icons/CheckIcon';

interface AITeamRefactorDisplayProps {
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
      case 'Optimizer':
        return <SparklesIcon className="w-5 h-5" />;
      case 'FeatureComplete':
        return <CheckIcon className="w-5 h-5" />;
      case 'ErrorChecker':
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

export const AITeamRefactorDisplay: React.FC<AITeamRefactorDisplayProps> = ({ result }) => {
  const finalSummaryStep = result.steps.find((s) => s.role === 'Integrator');
  // Optional debate transcript support: result.debateRounds?: { round: number; primary: string; collaborator: string }[]
  const rounds = (result as any).debateRounds as
    | { round: number; primary: string; collaborator: string }[]
    | undefined;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-100">AI Team Refactor: War Room</h2>
        <CopyButton textToCopy={result.refactoredCode} />
      </div>
      <div className="flex-grow overflow-y-auto space-y-4 pr-2">
        {Array.isArray(rounds) && rounds.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 text-gray-200">
              <SparklesIcon className="w-5 h-5" />
              <h3 className="font-semibold">Debate Rounds (Primary vs Collaborator)</h3>
            </div>
            <div className="p-4 space-y-4">
              {rounds.map((r, idx) => (
                <div key={idx} className="grid md:grid-cols-2 gap-3">
                  <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Round {r.round} — Primary</div>
                    <SummaryDisplay summary={r.primary} />
                  </div>
                  <div className="bg-gray-900/50 rounded p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Round {r.round} — Collaborator</div>
                    <SummaryDisplay summary={r.collaborator} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          {result.steps
            .filter((s) => s.role !== 'Integrator')
            .map((step, index) => (
              <AgentStepDisplay key={index} step={step} />
            ))}
        </div>

        {finalSummaryStep && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg mt-4">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 text-gray-200">
              <SparklesIcon className="w-5 h-5" />
              <h3 className="font-semibold">Final Summary</h3>
            </div>
            <div className="p-4">
              <SummaryDisplay summary={finalSummaryStep.content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
