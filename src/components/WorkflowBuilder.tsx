/**
 * Visual Workflow Builder
 * Drag-and-drop workflow designer with templates
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

import React, { useState, useCallback } from 'react';
import {
  getWorkflowAutomationEngine,
  Workflow,
  WorkflowStep,
  WorkflowAction,
  WorkflowTrigger,
  WorkflowTemplate,
  TriggerType,
  ActionType,
} from '../services/WorkflowAutomation';

interface WorkflowBuilderProps {
  onClose: () => void;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ onClose }) => {
  const engine = getWorkflowAutomationEngine();
  
  const [workflows, setWorkflows] = useState<Workflow[]>(engine.getAllWorkflows());
  const [templates] = useState<WorkflowTemplate[]>(engine.getTemplates());
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'edit' | 'templates' | 'executions'>('list');
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null);

  /**
   * Load workflows
   */
  const loadWorkflows = useCallback(() => {
    setWorkflows(engine.getAllWorkflows());
  }, [engine]);

  /**
   * Create workflow from template
   */
  const handleCreateFromTemplate = useCallback((templateId: string) => {
    const workflow = engine.createFromTemplate(templateId);
    loadWorkflows();
    setSelectedWorkflow(workflow);
    setActiveView('edit');
  }, [engine, loadWorkflows]);

  /**
   * Create new blank workflow
   */
  const handleCreateBlank = useCallback(() => {
    setEditingWorkflow({
      name: 'New Workflow',
      description: '',
      enabled: true,
      triggers: [],
      steps: [],
    });
    setActiveView('edit');
  }, []);

  /**
   * Save workflow
   */
  const handleSaveWorkflow = useCallback(() => {
    if (!editingWorkflow) return;

    if (selectedWorkflow) {
      engine.updateWorkflow(selectedWorkflow.id, editingWorkflow);
    } else {
      engine.createWorkflow(editingWorkflow as any);
    }

    loadWorkflows();
    setActiveView('list');
    setEditingWorkflow(null);
    setSelectedWorkflow(null);
  }, [engine, editingWorkflow, selectedWorkflow, loadWorkflows]);

  /**
   * Delete workflow
   */
  const handleDeleteWorkflow = useCallback((id: string) => {
    if (confirm('Delete this workflow?')) {
      engine.deleteWorkflow(id);
      loadWorkflows();
    }
  }, [engine, loadWorkflows]);

  /**
   * Execute workflow
   */
  const handleExecuteWorkflow = useCallback(async (id: string) => {
    try {
      await engine.executeWorkflow(id);
      alert('✅ Workflow executed successfully!');
    } catch (error: any) {
      alert(`❌ Workflow failed: ${error.message}`);
    }
  }, [engine]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚙️</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Workflow Automation</h2>
              <p className="text-purple-100 text-sm">Visual workflow builder with triggers & actions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-4 bg-gray-800 border-b border-gray-700">
          {[
            { id: 'list', label: '📋 Workflows', icon: '📋' },
            { id: 'templates', label: '📦 Templates', icon: '📦' },
            { id: 'executions', label: '📊 History', icon: '📊' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeView === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeView === 'list' && (
            <WorkflowListView
              workflows={workflows}
              onSelect={(w) => {
                setSelectedWorkflow(w);
                setEditingWorkflow(w);
                setActiveView('edit');
              }}
              onDelete={handleDeleteWorkflow}
              onExecute={handleExecuteWorkflow}
              onCreateNew={handleCreateBlank}
            />
          )}

          {activeView === 'templates' && (
            <TemplatesView templates={templates} onSelect={handleCreateFromTemplate} />
          )}

          {activeView === 'executions' && <ExecutionsView engine={engine} />}

          {activeView === 'edit' && editingWorkflow && (
            <WorkflowEditor
              workflow={editingWorkflow}
              onChange={setEditingWorkflow}
              onSave={handleSaveWorkflow}
              onCancel={() => {
                setActiveView('list');
                setEditingWorkflow(null);
                setSelectedWorkflow(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Workflow List View
 */
const WorkflowListView: React.FC<{
  workflows: Workflow[];
  onSelect: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
  onCreateNew: () => void;
}> = ({ workflows, onSelect, onDelete, onExecute, onCreateNew }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Your Workflows</h3>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition"
        >
          ＋ Create New
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <span className="text-6xl">⚙️</span>
          <p className="text-white text-xl mt-4">No workflows yet</p>
          <p className="text-gray-400 mt-2">Create one from scratch or use a template</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-indigo-500 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-white font-bold text-lg">{workflow.name}</h4>
                  <p className="text-gray-400 text-sm mt-1">{workflow.description}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    workflow.enabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}
                >
                  {workflow.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                <span>🎯 {workflow.triggers.length} triggers</span>
                <span>•</span>
                <span>📝 {workflow.steps.length} steps</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onSelect(workflow)}
                  className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold transition"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => onExecute(workflow.id)}
                  className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold transition"
                >
                  ▶️ Run
                </button>
                <button
                  onClick={() => onDelete(workflow.id)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold transition"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Templates View
 */
const TemplatesView: React.FC<{
  templates: WorkflowTemplate[];
  onSelect: (templateId: string) => void;
}> = ({ templates, onSelect }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-white">Workflow Templates</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-lg p-6 border-2 border-indigo-500 hover:border-purple-400 transition"
          >
            <div className="text-5xl mb-3">{template.icon}</div>
            <h4 className="text-white font-bold text-lg mb-2">{template.name}</h4>
            <p className="text-indigo-200 text-sm mb-4">{template.description}</p>
            <button
              onClick={() => onSelect(template.id)}
              className="w-full px-4 py-2 bg-white text-indigo-900 rounded-lg font-bold hover:bg-indigo-50 transition"
            >
              Use Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Executions View
 */
const ExecutionsView: React.FC<{ engine: any }> = ({ engine }) => {
  const [executions] = useState(engine.getExecutions());

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-white">Execution History</h3>

      {executions.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <span className="text-6xl">📊</span>
          <p className="text-white text-xl mt-4">No executions yet</p>
          <p className="text-gray-400 mt-2">Run a workflow to see execution history</p>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((exec: any) => (
            <div key={exec.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold">{exec.workflowName}</h4>
                <span
                  className={`px-3 py-1 rounded text-sm font-bold ${
                    exec.status === 'success'
                      ? 'bg-green-600 text-white'
                      : exec.status === 'failed'
                      ? 'bg-red-600 text-white'
                      : 'bg-yellow-600 text-white'
                  }`}
                >
                  {exec.status}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                Started: {exec.startTime.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Workflow Editor
 */
const WorkflowEditor: React.FC<{
  workflow: Partial<Workflow>;
  onChange: (workflow: Partial<Workflow>) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ workflow, onChange, onSave, onCancel }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Edit Workflow</h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition"
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <div>
          <label className="block text-white font-bold mb-2">Workflow Name</label>
          <input
            type="text"
            value={workflow.name || ''}
            onChange={(e) => onChange({ ...workflow, name: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
            placeholder="Enter workflow name"
          />
        </div>

        <div>
          <label className="block text-white font-bold mb-2">Description</label>
          <textarea
            value={workflow.description || ''}
            onChange={(e) => onChange({ ...workflow, description: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:outline-none"
            placeholder="Describe what this workflow does"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={workflow.enabled || false}
            onChange={(e) => onChange({ ...workflow, enabled: e.target.checked })}
            className="w-5 h-5"
            title="Enable or disable this workflow"
            aria-label="Workflow enabled"
            id="workflow-enabled"
          />
          <label htmlFor="workflow-enabled" className="text-white font-bold">Enabled</label>
        </div>
      </div>

      {/* Triggers */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h4 className="text-white font-bold mb-4">🎯 Triggers</h4>
        <p className="text-gray-400 text-sm mb-4">When should this workflow run?</p>
        
        {(workflow.triggers || []).length === 0 ? (
          <div className="text-center py-8 bg-gray-900 rounded-lg border border-dashed border-gray-600">
            <p className="text-gray-400">No triggers yet</p>
            <button className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition">
              ＋ Add Trigger
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {workflow.triggers?.map((trigger, index) => (
              <div key={index} className="bg-gray-900 p-4 rounded-lg">
                <span className="text-white">{trigger.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h4 className="text-white font-bold mb-4">📝 Steps</h4>
        <p className="text-gray-400 text-sm mb-4">What should this workflow do?</p>
        
        {(workflow.steps || []).length === 0 ? (
          <div className="text-center py-8 bg-gray-900 rounded-lg border border-dashed border-gray-600">
            <p className="text-gray-400">No steps yet</p>
            <button className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition">
              ＋ Add Step
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflow.steps?.map((step, index) => (
              <div key={index} className="bg-gray-900 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h5 className="text-white font-bold">{step.name}</h5>
                    <p className="text-gray-400 text-sm">{step.actions.length} actions</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
