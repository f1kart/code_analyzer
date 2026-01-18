/**
 * Production-Ready AI Development Panel
 * UI for orchestrating AI code generation with testing, security, performance, and docs
 * Real-time workflow visualization and progress tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getProductionAIOrchestrator, 
  ProductionWorkflow, 
  AIDevRequest, 
  ProductionResult 
} from '../services/ProductionAIOrchestrator';

interface ProductionAIPanelProps {
  onCodeGenerated?: (result: ProductionResult) => void;
  onClose?: () => void;
}

export const ProductionAIPanel: React.FC<ProductionAIPanelProps> = ({ 
  onCodeGenerated,
  onClose 
}) => {
  const [prompt, setPrompt] = useState('');
  const [requestType, setRequestType] = useState<'feature' | 'bugfix' | 'refactor' | 'optimization'>('feature');
  const [currentWorkflow, setCurrentWorkflow] = useState<ProductionWorkflow | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<ProductionWorkflow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(
    !!localStorage.getItem('geminiApiKey') || !!(import.meta as any).env?.VITE_GEMINI_API_KEY
  );
  const [config, setConfig] = useState({
    generateTests: true,
    runSecurity: true,
    analyzePerformance: true,
    generateDocs: true,
    autoCommit: false,
  });

  const orchestrator = getProductionAIOrchestrator();

  // Listen for workflow progress
  useEffect(() => {
    const handleProgress = (event: CustomEvent<ProductionWorkflow>) => {
      setCurrentWorkflow(event.detail);
    };

    window.addEventListener('production-ai-progress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('production-ai-progress', handleProgress as EventListener);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      alert('Please enter a description of what you want to generate');
      return;
    }

    // Check for API key in localStorage or environment variables
    const apiKey = localStorage.getItem('geminiApiKey') || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      const userKey = window.prompt(
        '🔑 Gemini API Key Required\n\n' +
        'Production AI requires a valid Gemini API key to generate code.\n\n' +
        'Get your free API key at: https://aistudio.google.com/apikey\n\n' +
        'Enter your API key:'
      );
      
      if (!userKey || !userKey.trim()) {
        alert('❌ API key is required to use Production AI Development');
        return;
      }
      
      localStorage.setItem('geminiApiKey', userKey.trim());
      setHasApiKey(true);
      alert('✅ API key saved! Proceeding with code generation...');
      
      // Reload orchestrator with new API key
      window.location.reload();
      return;
    }

    setIsGenerating(true);
    setCurrentWorkflow(null);

    try {
      const request: AIDevRequest = {
        prompt,
        type: requestType,
        config,
      };

      const workflow = await orchestrator.executeProductionWorkflow(request);
      
      setWorkflowHistory(prev => [workflow, ...prev]);
      
      if (workflow.result && onCodeGenerated) {
        onCodeGenerated(workflow.result);
      }

      if (workflow.status === 'complete') {
        alert(`✅ Production-Ready Code Generated!\n\nQuality Score: ${workflow.result?.qualityScore}%\nReady for Production: ${workflow.result?.readyForProduction ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.error('[Production AI] Generation failed:', error);
      alert(`❌ Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, requestType, config, orchestrator, onCodeGenerated]);

  const handleQuickGenerate = useCallback(async (template: string) => {
    setPrompt(template);
    // Auto-trigger generation after short delay
    setTimeout(() => {
      const request: AIDevRequest = {
        prompt: template,
        type: 'feature',
        config,
      };

      setIsGenerating(true);
      orchestrator.executeProductionWorkflow(request)
        .then(workflow => {
          setWorkflowHistory(prev => [workflow, ...prev]);
          if (workflow.result && onCodeGenerated) {
            onCodeGenerated(workflow.result);
          }
        })
        .finally(() => setIsGenerating(false));
    }, 100);
  }, [config, orchestrator, onCodeGenerated]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'complete': return '✅';
      case 'running': return '⏳';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '⭕';
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600 bg-green-50';
      case 'running': return 'text-blue-600 bg-blue-50 animate-pulse';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'skipped': return 'text-gray-400 bg-gray-50';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-500 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              🚀 Production-Ready AI Development
            </h2>
            <p className="text-purple-200 text-xs mt-1">
              Generate → Test → Secure → Profile → Document - All in One Click
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold text-sm flex-shrink-0"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
        {/* API Key Status */}
        {!hasApiKey && (
          <div className="bg-yellow-900 border-2 border-yellow-600 rounded-xl p-4 flex items-start gap-3">
            <span className="text-3xl">🔑</span>
            <div className="flex-1">
              <h3 className="text-yellow-200 font-bold text-lg">API Key Required</h3>
              <p className="text-yellow-100 text-sm mt-1">
                Production AI needs a Gemini API key to generate code. Get your free key at:
              </p>
              <a 
                href="https://aistudio.google.com/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-300 underline text-sm font-bold mt-1 inline-block"
              >
                https://aistudio.google.com/apikey
              </a>
              <p className="text-yellow-100 text-xs mt-2">
                The key will be requested when you click Generate.
              </p>
            </div>
          </div>
        )}

        {hasApiKey && (
          <div className="bg-green-900 border-2 border-green-600 rounded-xl p-3 flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <span className="text-green-100 font-bold">API Key Configured</span>
          </div>
        )}

        {/* Input Section */}
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-purple-500 shadow-2xl">
          <label className="block text-white font-bold mb-2 text-sm">
            ✨ Describe What You Want to Build
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Create a user authentication system with JWT, email verification, and password reset"
            className="w-full h-24 px-3 py-2 bg-slate-900 text-white border-2 border-slate-700 focus:border-purple-500 rounded-lg resize-none font-mono text-xs"
            disabled={isGenerating}
          />

          {/* Request Type */}
          <div className="mt-3 flex flex-wrap gap-2">
            {(['feature', 'bugfix', 'refactor', 'optimization'] as const).map(type => (
              <button
                key={type}
                onClick={() => setRequestType(type)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs ${
                  requestType === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                disabled={isGenerating}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Advanced Options */}
          <div className="mt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-purple-300 hover:text-purple-100 text-sm font-bold"
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>
            
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {Object.entries(config).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4"
                      disabled={isGenerating}
                    />
                    <span className="text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="mt-3 w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-black text-sm rounded-xl shadow-2xl transition-all disabled:cursor-not-allowed"
          >
            {isGenerating ? '⏳ Generating...' : '🚀 Generate Production-Ready Code'}
          </button>
        </div>

        {/* Quick Templates */}
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-indigo-500">
          <h3 className="text-white font-bold mb-2 text-sm">⚡ Quick Templates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickGenerate('Create a REST API for managing tasks with CRUD operations')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs text-left"
              disabled={isGenerating}
            >
              📋 Task API
            </button>
            <button
              onClick={() => handleQuickGenerate('Build a React form component with validation and error handling')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs text-left"
              disabled={isGenerating}
            >
              📝 Form Component
            </button>
            <button
              onClick={() => handleQuickGenerate('Create a database migration for user profiles with avatar upload')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs text-left"
              disabled={isGenerating}
            >
              💾 DB Migration
            </button>
            <button
              onClick={() => handleQuickGenerate('Generate an authentication middleware with JWT verification')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs text-left"
              disabled={isGenerating}
            >
              🔐 Auth Middleware
            </button>
          </div>
        </div>

        {/* Current Workflow Progress */}
        {currentWorkflow && (
          <div className="bg-slate-800 rounded-xl p-4 border-2 border-cyan-500 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">📊 Workflow Progress</h3>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                currentWorkflow.status === 'complete' ? 'bg-green-600 text-white' :
                currentWorkflow.status === 'failed' ? 'bg-red-600 text-white' :
                'bg-blue-600 text-white'
              }`}>
                {currentWorkflow.status.toUpperCase()}
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-3">
              {currentWorkflow.steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${getStepColor(step.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getStepIcon(step.status)}</span>
                      <div>
                        <div className="font-bold">{step.name}</div>
                        {step.duration && (
                          <div className="text-xs opacity-75">
                            Completed in {(step.duration / 1000).toFixed(2)}s
                          </div>
                        )}
                        {step.error && (
                          <div className="text-xs text-red-600 mt-1">
                            Error: {step.error}
                          </div>
                        )}
                      </div>
                    </div>
                    {step.status === 'running' && (
                      <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Results */}
            {currentWorkflow.result && (
              <div className="mt-4 p-4 bg-slate-900 rounded-lg border-2 border-green-500">
                <h4 className="text-white font-bold mb-2">✅ Production Ready!</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-gray-300">
                    <span className="font-bold">Quality Score:</span> {currentWorkflow.result.qualityScore}%
                  </div>
                  <div className="text-gray-300">
                    <span className="font-bold">Tests Generated:</span> {currentWorkflow.result.tests.length}
                  </div>
                  <div className="text-gray-300">
                    <span className="font-bold">Security Issues:</span> {currentWorkflow.result.securityReport.totalVulnerabilities}
                  </div>
                  <div className="text-gray-300">
                    <span className="font-bold">Files Created:</span> {currentWorkflow.result.files.length}
                  </div>
                </div>

                {currentWorkflow.result.readyForProduction ? (
                  <div className="mt-3 p-3 bg-green-600 text-white rounded font-bold text-center">
                    🎉 Ready for Production Deployment!
                  </div>
                ) : (
                  <div className="mt-3 p-3 bg-yellow-600 text-white rounded font-bold text-center">
                    ⚠️ Needs Review Before Production
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Workflow History */}
        {workflowHistory.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-6 border-2 border-gray-500">
            <h3 className="text-white font-bold mb-3">📚 Recent Workflows</h3>
            <div className="space-y-2">
              {workflowHistory.slice(0, 5).map((workflow) => (
                <div
                  key={workflow.id}
                  className="p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-purple-500 cursor-pointer transition-all"
                  onClick={() => setCurrentWorkflow(workflow)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-white font-bold text-sm truncate">
                        {workflow.name}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {new Date(workflow.startTime).toLocaleString()}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                      workflow.status === 'complete' ? 'bg-green-600 text-white' :
                      workflow.status === 'failed' ? 'bg-red-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {workflow.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
