import React, { useState, useCallback, useRef } from 'react';

interface WorkflowStep {
  id: string;
  type: 'ai-action' | 'condition' | 'input' | 'output' | 'delay';
  title: string;
  description: string;
  config: { [key: string]: any };
  position: { x: number; y: number };
  connections: string[]; // IDs of connected steps
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  category: 'coding' | 'analysis' | 'testing' | 'documentation' | 'custom';
}

interface AIWorkflowBuilderProps {
  onSaveWorkflow: (workflow: WorkflowTemplate) => void;
  onExecuteWorkflow: (workflow: WorkflowTemplate) => void;
  existingWorkflows: WorkflowTemplate[];
  isVisible: boolean;
}

const STEP_TYPES = {
  'ai-action': {
    icon: '🤖',
    color: 'bg-brand-blue',
    actions: [
      'Simple Refactor',
      'AI Team Refactor',
      'Code Analysis',
      'Generate Tests',
      'Generate Documentation',
      'Find Similar Code',
      'Debug Error',
      'Explain Code',
      'Code Review',
    ],
  },
  condition: {
    icon: '🔀',
    color: 'bg-yellow-600',
    conditions: [
      'File Type Check',
      'Code Quality Score',
      'Test Coverage',
      'Error Count',
      'File Size',
      'Custom Condition',
    ],
  },
  input: {
    icon: '📥',
    color: 'bg-green-600',
    inputs: ['File Selection', 'User Input', 'Project Path', 'Configuration', 'External Data'],
  },
  output: {
    icon: '📤',
    color: 'bg-purple-600',
    outputs: [
      'Save File',
      'Generate Report',
      'Send Notification',
      'Update Database',
      'Export Results',
    ],
  },
  delay: {
    icon: '⏱️',
    color: 'bg-gray-600',
    delays: ['Fixed Delay', 'Wait for User', 'Wait for Condition', 'Rate Limiting'],
  },
};

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'code-review',
    name: 'Automated Code Review',
    description: 'Complete code review with AI team analysis and documentation',
    category: 'coding',
    steps: [
      {
        id: 'input-1',
        type: 'input',
        title: 'Select Files',
        description: 'Choose files for review',
        config: { inputType: 'file-selection', multiple: true },
        position: { x: 100, y: 100 },
        connections: ['ai-1'],
      },
      {
        id: 'ai-1',
        type: 'ai-action',
        title: 'AI Team Analysis',
        description: 'Analyze code with AI team',
        config: { action: 'ai-team-refactor', includeTests: true },
        position: { x: 300, y: 100 },
        connections: ['ai-2'],
      },
      {
        id: 'ai-2',
        type: 'ai-action',
        title: 'Generate Documentation',
        description: 'Create documentation for reviewed code',
        config: { action: 'generate-docs', format: 'markdown' },
        position: { x: 500, y: 100 },
        connections: ['output-1'],
      },
      {
        id: 'output-1',
        type: 'output',
        title: 'Save Results',
        description: 'Save review results and documentation',
        config: { outputType: 'file', format: 'report' },
        position: { x: 700, y: 100 },
        connections: [],
      },
    ],
  },
  {
    id: 'test-generation',
    name: 'Comprehensive Test Suite',
    description: 'Generate unit tests, integration tests, and documentation',
    category: 'testing',
    steps: [
      {
        id: 'input-1',
        type: 'input',
        title: 'Select Source Files',
        description: 'Choose source files to test',
        config: { inputType: 'file-selection', filter: '*.ts,*.js' },
        position: { x: 100, y: 100 },
        connections: ['ai-1'],
      },
      {
        id: 'ai-1',
        type: 'ai-action',
        title: 'Generate Unit Tests',
        description: 'Create comprehensive unit tests',
        config: { action: 'generate-tests', testType: 'unit' },
        position: { x: 300, y: 100 },
        connections: ['ai-2'],
      },
      {
        id: 'ai-2',
        type: 'ai-action',
        title: 'Generate Integration Tests',
        description: 'Create integration test scenarios',
        config: { action: 'generate-tests', testType: 'integration' },
        position: { x: 300, y: 250 },
        connections: ['output-1'],
      },
      {
        id: 'output-1',
        type: 'output',
        title: 'Save Test Files',
        description: 'Save generated test files',
        config: { outputType: 'file', directory: 'tests' },
        position: { x: 500, y: 175 },
        connections: [],
      },
    ],
  },
];

export const AIWorkflowBuilder: React.FC<AIWorkflowBuilderProps> = ({
  onSaveWorkflow,
  onExecuteWorkflow,
  existingWorkflows,
  isVisible,
}) => {
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowTemplate | null>(null);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [isCreatingStep, setIsCreatingStep] = useState(false);
  const [newStepType, setNewStepType] = useState<keyof typeof STEP_TYPES>('ai-action');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const createNewWorkflow = useCallback(() => {
    const newWorkflow: WorkflowTemplate = {
      id: `workflow-${Date.now()}`,
      name: workflowName || 'New Workflow',
      description: workflowDescription || 'Custom AI workflow',
      category: 'custom',
      steps: [],
    };
    setCurrentWorkflow(newWorkflow);
    setShowTemplates(false);
  }, [workflowName, workflowDescription]);

  const loadTemplate = useCallback((template: WorkflowTemplate) => {
    setCurrentWorkflow({ ...template, id: `workflow-${Date.now()}` });
    setWorkflowName(template.name);
    setWorkflowDescription(template.description);
    setShowTemplates(false);
  }, []);

  const addStep = useCallback(
    (type: keyof typeof STEP_TYPES, x: number, y: number) => {
      if (!currentWorkflow) return;

      const newStep: WorkflowStep = {
        id: `step-${Date.now()}`,
        type,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
        description: 'Configure this step',
        config: {},
        position: { x, y },
        connections: [],
      };

      setCurrentWorkflow({
        ...currentWorkflow,
        steps: [...currentWorkflow.steps, newStep],
      });
      setSelectedStep(newStep);
      setIsCreatingStep(false);
    },
    [currentWorkflow],
  );

  const updateStep = useCallback(
    (stepId: string, updates: Partial<WorkflowStep>) => {
      if (!currentWorkflow) return;

      setCurrentWorkflow({
        ...currentWorkflow,
        steps: currentWorkflow.steps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step,
        ),
      });

      if (selectedStep?.id === stepId) {
        setSelectedStep({ ...selectedStep, ...updates });
      }
    },
    [currentWorkflow, selectedStep],
  );

  const deleteStep = useCallback(
    (stepId: string) => {
      if (!currentWorkflow) return;

      setCurrentWorkflow({
        ...currentWorkflow,
        steps: currentWorkflow.steps.filter((step) => step.id !== stepId),
      });

      if (selectedStep?.id === stepId) {
        setSelectedStep(null);
      }
    },
    [currentWorkflow, selectedStep],
  );

  const connectSteps = useCallback(
    (fromId: string, toId: string) => {
      if (!currentWorkflow) return;

      setCurrentWorkflow({
        ...currentWorkflow,
        steps: currentWorkflow.steps.map((step) =>
          step.id === fromId ? { ...step, connections: [...step.connections, toId] } : step,
        ),
      });
    },
    [currentWorkflow],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isCreatingStep || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      addStep(newStepType, x, y);
    },
    [isCreatingStep, newStepType, addStep],
  );

  const executeWorkflow = useCallback(() => {
    if (currentWorkflow) {
      onExecuteWorkflow(currentWorkflow);
    }
  }, [currentWorkflow, onExecuteWorkflow]);

  const saveWorkflow = useCallback(() => {
    if (currentWorkflow) {
      const updatedWorkflow = {
        ...currentWorkflow,
        name: workflowName,
        description: workflowDescription,
      };
      onSaveWorkflow(updatedWorkflow);
    }
  }, [currentWorkflow, workflowName, workflowDescription, onSaveWorkflow]);

  if (!isVisible) return null;

  if (showTemplates) {
    return (
      <div className="h-full bg-panel flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-2">AI Workflow Builder</h2>
          <p className="text-sm text-text-secondary">
            Create custom AI workflows or start from a template
          </p>
        </div>

        {/* New Workflow Form */}
        <div className="p-4 border-b border-border bg-panel-light">
          <h3 className="text-sm font-medium text-text-primary mb-3">Create New Workflow</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Workflow name..."
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-full bg-panel border border-border rounded px-3 py-2 text-sm text-text-primary"
              title="Workflow name"
              aria-label="Workflow name"
            />
            <textarea
              placeholder="Workflow description..."
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              rows={2}
              className="w-full bg-panel border border-border rounded px-3 py-2 text-sm text-text-primary"
              title="Workflow description"
              aria-label="Workflow description"
            />
            <button
              onClick={createNewWorkflow}
              className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors"
              title="Create new workflow"
            >
              Create New Workflow
            </button>
          </div>
        </div>

        {/* Templates */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Workflow Templates</h3>
          <div className="grid grid-cols-1 gap-3">
            {WORKFLOW_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="bg-panel-light border border-border rounded-lg p-4 cursor-pointer hover:border-brand-blue transition-colors"
                onClick={() => loadTemplate(template)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-text-primary">{template.name}</h4>
                  <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-1 rounded">
                    {template.category}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-3">{template.description}</p>
                <div className="flex items-center text-xs text-text-secondary">
                  <span>{template.steps.length} steps</span>
                  <span className="mx-2">•</span>
                  <span>
                    {template.steps.filter((s) => s.type === 'ai-action').length} AI actions
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-panel flex">
      {/* Toolbar */}
      <div className="w-64 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-text-primary">Workflow Builder</h3>
            <button
              onClick={() => setShowTemplates(true)}
              className="text-xs text-text-secondary hover:text-text-primary"
              title="Back to templates"
            >
              ← Back
            </button>
          </div>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="w-full bg-panel-light border border-border rounded px-2 py-1 text-sm text-text-primary"
            placeholder="Workflow name..."
            title="Workflow name"
            aria-label="Workflow name"
          />
        </div>

        {/* Step Types */}
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-medium text-text-primary mb-3">Add Steps</h4>
          <div className="space-y-2">
            {Object.entries(STEP_TYPES).map(([type, config]) => (
              <button
                key={type}
                onClick={() => {
                  setNewStepType(type as keyof typeof STEP_TYPES);
                  setIsCreatingStep(true);
                }}
                className={`w-full flex items-center space-x-2 p-2 rounded text-sm transition-colors ${
                  isCreatingStep && newStepType === type
                    ? 'bg-brand-blue text-white'
                    : 'bg-panel-light hover:bg-panel text-text-primary'
                }`}
                title={`Add ${type} step`}
              >
                <span>{config.icon}</span>
                <span className="capitalize">{type.replace('-', ' ')}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Properties */}
        {selectedStep && (
          <div className="flex-1 p-4 overflow-y-auto">
            <h4 className="text-sm font-medium text-text-primary mb-3">Step Properties</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Title</label>
                <input
                  type="text"
                  value={selectedStep.title}
                  onChange={(e) => updateStep(selectedStep.id, { title: e.target.value })}
                  className="w-full bg-panel-light border border-border rounded px-2 py-1 text-sm text-text-primary"
                  title="Step title"
                  aria-label="Step title"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Description</label>
                <textarea
                  value={selectedStep.description}
                  onChange={(e) => updateStep(selectedStep.id, { description: e.target.value })}
                  rows={2}
                  className="w-full bg-panel-light border border-border rounded px-2 py-1 text-sm text-text-primary"
                  title="Step description"
                  aria-label="Step description"
                />
              </div>
              <button
                onClick={() => deleteStep(selectedStep.id)}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                title="Delete step"
              >
                Delete Step
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={saveWorkflow}
            disabled={!currentWorkflow || !workflowName}
            className="w-full px-3 py-2 bg-brand-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
            title="Save workflow"
          >
            Save Workflow
          </button>
          <button
            onClick={executeWorkflow}
            disabled={!currentWorkflow || currentWorkflow.steps.length === 0}
            className="w-full px-3 py-2 bg-brand-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
            title="Execute workflow"
          >
            Execute Workflow
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={canvasRef}
          className={`w-full h-full bg-gray-900 ${isCreatingStep ? 'cursor-crosshair' : 'cursor-default'}`}
          onClick={handleCanvasClick}
        >
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Workflow Steps */}
          {currentWorkflow?.steps.map((step) => {
            const stepConfig = STEP_TYPES[step.type];
            return (
              <div
                key={step.id}
                className={`absolute w-32 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedStep?.id === step.id
                    ? 'border-brand-blue bg-panel'
                    : 'border-border bg-panel-light hover:border-gray-400'
                }`}
                style={{
                  left: step.position.x,
                  top: step.position.y,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStep(step);
                }}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">{stepConfig.icon}</div>
                  <div className="text-xs font-medium text-text-primary mb-1">{step.title}</div>
                  <div className="text-xs text-text-secondary">{step.type}</div>
                </div>
              </div>
            );
          })}

          {/* Instructions */}
          {isCreatingStep && (
            <div className="absolute top-4 left-4 bg-panel border border-border rounded-lg p-3">
              <p className="text-sm text-text-primary">
                Click anywhere to add a{' '}
                <span className="font-medium">{newStepType.replace('-', ' ')}</span> step
              </p>
              <button
                onClick={() => setIsCreatingStep(false)}
                className="mt-2 text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          )}

          {currentWorkflow && currentWorkflow.steps.length === 0 && !isCreatingStep && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-text-secondary">
                <div className="text-4xl mb-4">🔧</div>
                <p className="text-lg font-medium mb-2">Start Building Your Workflow</p>
                <p className="text-sm">
                  Select a step type from the sidebar and click here to add it
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWorkflowBuilder;
