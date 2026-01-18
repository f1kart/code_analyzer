export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
  inputs: NodePort[];
  outputs: NodePort[];
  style?: NodeStyle;
  selected: boolean;
  dragging: boolean;
  metadata: NodeMetadata;
}

export interface Position {
  x: number;
  y: number;
}

export interface NodePort {
  id: string;
  type: 'input' | 'output';
  dataType: DataType;
  label: string;
  required: boolean;
  connected: boolean;
  connections: Connection[];
  value?: any;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  style?: ConnectionStyle;
}

export interface NodeData {
  label: string;
  description?: string;
  parameters: Parameter[];
  configuration: Record<string, any>;
  code?: string;
  template?: string;
}

export interface Parameter {
  name: string;
  type: DataType;
  required: boolean;
  defaultValue?: any;
  description?: string;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}

export interface ConnectionStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
}

export interface NodeMetadata {
  category: string;
  version: string;
  author?: string;
  documentation?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type NodeType =
  | 'input'
  | 'output'
  | 'process'
  | 'condition'
  | 'loop'
  | 'function'
  | 'api'
  | 'database'
  | 'ai-agent'
  | 'transform'
  | 'filter'
  | 'merge'
  | 'split'
  | 'delay'
  | 'trigger'
  | 'custom';

export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'file'
  | 'image'
  | 'audio'
  | 'video'
  | 'any';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  variables: WorkflowVariable[];
  settings: WorkflowSettings;
  metadata: WorkflowMetadata;
}

export interface WorkflowVariable {
  name: string;
  type: DataType;
  value: any;
  scope: 'global' | 'local';
  description?: string;
}

export interface WorkflowSettings {
  autoSave: boolean;
  validation: boolean;
  execution: ExecutionSettings;
  ui: UISettings;
}

export interface ExecutionSettings {
  mode: 'sequential' | 'parallel' | 'hybrid';
  timeout: number;
  retryAttempts: number;
  errorHandling: 'stop' | 'continue' | 'retry';
}

export interface UISettings {
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  zoomLevel: number;
  theme: 'light' | 'dark';
}

export interface WorkflowMetadata {
  author: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  category: string;
  isPublic: boolean;
}

export interface NodeTemplate {
  type: NodeType;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaultData: NodeData;
  defaultStyle: NodeStyle;
  inputs: PortTemplate[];
  outputs: PortTemplate[];
}

export interface PortTemplate {
  type: 'input' | 'output';
  dataType: DataType;
  label: string;
  required: boolean;
}

export class VisualWorkflowBuilder {
  private workflows = new Map<string, WorkflowDefinition>();
  private activeWorkflow: WorkflowDefinition | null = null;
  private nodeTemplates = new Map<string, NodeTemplate>();
  private clipboard: WorkflowNode[] = [];
  private history: WorkflowDefinition[] = [];
  private historyIndex = -1;
  private workflowCallbacks = new Set<(workflow: WorkflowDefinition) => void>();
  private selectionCallbacks = new Set<(nodes: WorkflowNode[]) => void>();

  constructor() {
    this.initializeNodeTemplates();
    this.loadWorkflows();
  }

  // Workflow Management
  createWorkflow(options: { name: string; description?: string }): WorkflowDefinition {
    const workflow: WorkflowDefinition = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: options.name,
      description: options.description || '',
      version: '1.0.0',
      nodes: [],
      connections: [],
      variables: [],
      settings: this.getDefaultSettings(),
      metadata: {
        author: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        category: 'general',
        isPublic: false,
      },
    };

    this.workflows.set(workflow.id, workflow);
    this.activeWorkflow = workflow;
    this.saveWorkflows();
    this.notifyWorkflowCallbacks(workflow);
    return workflow;
  }

  loadWorkflow(workflowId: string): WorkflowDefinition | null {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      this.activeWorkflow = workflow;
      this.notifyWorkflowCallbacks(workflow);
    }
    return workflow || null;
  }

  saveWorkflow(workflowId?: string): void {
    const workflow = workflowId ? this.workflows.get(workflowId) : this.activeWorkflow;
    if (!workflow) return;

    workflow.metadata.updatedAt = Date.now();
    this.workflows.set(workflow.id, workflow);
    this.saveWorkflows();
    this.addToHistory(workflow);
  }

  deleteWorkflow(workflowId: string): void {
    this.workflows.delete(workflowId);
    if (this.activeWorkflow?.id === workflowId) {
      this.activeWorkflow = null;
    }
    this.saveWorkflows();
  }

  // Node Operations
  addNode(template: NodeTemplate, position: Position): WorkflowNode {
    if (!this.activeWorkflow) throw new Error('No active workflow');

    const node: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: template.type,
      position,
      data: { ...template.defaultData },
      inputs: template.inputs.map((input) => ({
        id: `port-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'input',
        dataType: input.dataType,
        label: input.label,
        required: input.required,
        connected: false,
        connections: [],
      })),
      outputs: template.outputs.map((output) => ({
        id: `port-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'output',
        dataType: output.dataType,
        label: output.label,
        required: output.required,
        connected: false,
        connections: [],
      })),
      style: { ...template.defaultStyle },
      selected: false,
      dragging: false,
      metadata: {
        category: template.category,
        version: '1.0.0',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.activeWorkflow.nodes.push(node);
    this.saveWorkflow();
    return node;
  }

  removeNode(nodeId: string): void {
    if (!this.activeWorkflow) return;

    // Remove connections
    this.activeWorkflow.connections = this.activeWorkflow.connections.filter(
      (conn) => conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId,
    );

    // Remove node
    this.activeWorkflow.nodes = this.activeWorkflow.nodes.filter((node) => node.id !== nodeId);

    this.saveWorkflow();
  }

  updateNode(nodeId: string, updates: Partial<WorkflowNode>): void {
    if (!this.activeWorkflow) return;

    const node = this.activeWorkflow.nodes.find((n) => n.id === nodeId);
    if (node) {
      Object.assign(node, updates);
      node.metadata.updatedAt = Date.now();
      this.saveWorkflow();
    }
  }

  moveNode(nodeId: string, position: Position): void {
    this.updateNode(nodeId, { position });
  }

  // Connection Operations
  createConnection(
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ): Connection {
    if (!this.activeWorkflow) throw new Error('No active workflow');

    // Validate connection
    if (!this.validateConnection(sourceNodeId, sourcePortId, targetNodeId, targetPortId)) {
      throw new Error('Invalid connection');
    }

    const connection: Connection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
      style: {
        color: '#666',
        width: 2,
        style: 'solid',
      },
    };

    this.activeWorkflow.connections.push(connection);

    // Update port connection status
    this.updatePortConnections();
    this.saveWorkflow();
    return connection;
  }

  removeConnection(connectionId: string): void {
    if (!this.activeWorkflow) return;

    this.activeWorkflow.connections = this.activeWorkflow.connections.filter(
      (conn) => conn.id !== connectionId,
    );

    this.updatePortConnections();
    this.saveWorkflow();
  }

  private validateConnection(
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ): boolean {
    if (!this.activeWorkflow) return false;

    const sourceNode = this.activeWorkflow.nodes.find((n) => n.id === sourceNodeId);
    const targetNode = this.activeWorkflow.nodes.find((n) => n.id === targetNodeId);

    if (!sourceNode || !targetNode) return false;

    const sourcePort = sourceNode.outputs.find((p) => p.id === sourcePortId);
    const targetPort = targetNode.inputs.find((p) => p.id === targetPortId);

    if (!sourcePort || !targetPort) return false;

    // Check data type compatibility
    if (
      sourcePort.dataType !== 'any' &&
      targetPort.dataType !== 'any' &&
      sourcePort.dataType !== targetPort.dataType
    ) {
      return false;
    }

    // Check for cycles
    return !this.wouldCreateCycle(sourceNodeId, targetNodeId);
  }

  private wouldCreateCycle(sourceNodeId: string, targetNodeId: string): boolean {
    if (!this.activeWorkflow) return false;

    const visited = new Set<string>();
    const stack = [targetNodeId];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (nodeId === sourceNodeId) return true;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);

      // Find all nodes that this node connects to
      const connections = this.activeWorkflow.connections.filter(
        (conn) => conn.sourceNodeId === nodeId,
      );

      connections.forEach((conn) => stack.push(conn.targetNodeId));
    }

    return false;
  }

  private updatePortConnections(): void {
    if (!this.activeWorkflow) return;

    // Reset all port connections
    this.activeWorkflow.nodes.forEach((node) => {
      [...node.inputs, ...node.outputs].forEach((port) => {
        port.connected = false;
        port.connections = [];
      });
    });

    // Update based on current connections
    this.activeWorkflow.connections.forEach((conn) => {
      const sourceNode = this.activeWorkflow!.nodes.find((n) => n.id === conn.sourceNodeId);
      const targetNode = this.activeWorkflow!.nodes.find((n) => n.id === conn.targetNodeId);

      if (sourceNode && targetNode) {
        const sourcePort = sourceNode.outputs.find((p) => p.id === conn.sourcePortId);
        const targetPort = targetNode.inputs.find((p) => p.id === conn.targetPortId);

        if (sourcePort && targetPort) {
          sourcePort.connected = true;
          targetPort.connected = true;
          sourcePort.connections.push(conn);
          targetPort.connections.push(conn);
        }
      }
    });
  }

  // Selection and Clipboard
  selectNodes(nodeIds: string[]): void {
    if (!this.activeWorkflow) return;

    this.activeWorkflow.nodes.forEach((node) => {
      node.selected = nodeIds.includes(node.id);
    });

    const selectedNodes = this.activeWorkflow.nodes.filter((node) => node.selected);
    this.notifySelectionCallbacks(selectedNodes);
  }

  copyNodes(nodeIds: string[]): void {
    if (!this.activeWorkflow) return;

    this.clipboard = this.activeWorkflow.nodes
      .filter((node) => nodeIds.includes(node.id))
      .map((node) => ({ ...node }));
  }

  pasteNodes(offset: Position = { x: 20, y: 20 }): WorkflowNode[] {
    if (!this.activeWorkflow || this.clipboard.length === 0) return [];

    const pastedNodes: WorkflowNode[] = [];

    this.clipboard.forEach((clipboardNode) => {
      const newNode: WorkflowNode = {
        ...clipboardNode,
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: {
          x: clipboardNode.position.x + offset.x,
          y: clipboardNode.position.y + offset.y,
        },
        selected: true,
        inputs: clipboardNode.inputs.map((input) => ({
          ...input,
          id: `port-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          connected: false,
          connections: [],
        })),
        outputs: clipboardNode.outputs.map((output) => ({
          ...output,
          id: `port-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          connected: false,
          connections: [],
        })),
      };

      this.activeWorkflow!.nodes.push(newNode);
      pastedNodes.push(newNode);
    });

    this.saveWorkflow();
    return pastedNodes;
  }

  // History Management
  undo(): WorkflowDefinition | null {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const workflow = this.history[this.historyIndex];
      if (workflow) {
        this.activeWorkflow = { ...workflow };
        this.workflows.set(workflow.id, this.activeWorkflow);
        this.notifyWorkflowCallbacks(this.activeWorkflow);
        return this.activeWorkflow;
      }
    }
    return null;
  }

  redo(): WorkflowDefinition | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const workflow = this.history[this.historyIndex];
      if (workflow) {
        this.activeWorkflow = { ...workflow };
        this.workflows.set(workflow.id, this.activeWorkflow);
        this.notifyWorkflowCallbacks(this.activeWorkflow);
        return this.activeWorkflow;
      }
    }
    return null;
  }

  private addToHistory(workflow: WorkflowDefinition): void {
    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({ ...workflow });
    this.historyIndex = this.history.length - 1;

    // Limit history size
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  // Validation and Execution
  validateWorkflow(workflowId?: string): ValidationResult {
    const workflow = workflowId ? this.workflows.get(workflowId) : this.activeWorkflow;
    if (!workflow) {
      return { isValid: false, errors: ['No workflow found'] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for disconnected nodes
    workflow.nodes.forEach((node) => {
      const hasInputs = node.inputs.some((port) => port.connected || !port.required);
      const hasOutputs = node.outputs.some((port) => port.connected);

      if (!hasInputs) {
        errors.push(`Node ${node.data.label} has unconnected required inputs`);
      }

      if (node.type !== 'output' && !hasOutputs) {
        warnings.push(`Node ${node.data.label} has no output connections`);
      }
    });

    // Check for cycles
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private hasCycles(workflow: WorkflowDefinition): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleUtil = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const connections = workflow.connections.filter((conn) => conn.sourceNodeId === nodeId);

      for (const conn of connections) {
        if (!visited.has(conn.targetNodeId)) {
          if (hasCycleUtil(conn.targetNodeId)) return true;
        } else if (recursionStack.has(conn.targetNodeId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleUtil(node.id)) return true;
      }
    }

    return false;
  }

  // Node Templates
  private initializeNodeTemplates(): void {
    const templates: NodeTemplate[] = [
      {
        type: 'input',
        name: 'Input',
        description: 'Data input node',
        category: 'io',
        icon: '📥',
        defaultData: {
          label: 'Input',
          parameters: [],
          configuration: {},
        },
        defaultStyle: {
          backgroundColor: '#e3f2fd',
          borderColor: '#2196f3',
          width: 120,
          height: 60,
        },
        inputs: [],
        outputs: [{ type: 'output', dataType: 'any', label: 'Output', required: false }],
      },
      {
        type: 'output',
        name: 'Output',
        description: 'Data output node',
        category: 'io',
        icon: '📤',
        defaultData: {
          label: 'Output',
          parameters: [],
          configuration: {},
        },
        defaultStyle: {
          backgroundColor: '#f3e5f5',
          borderColor: '#9c27b0',
          width: 120,
          height: 60,
        },
        inputs: [{ type: 'input', dataType: 'any', label: 'Input', required: true }],
        outputs: [],
      },
      {
        type: 'process',
        name: 'Process',
        description: 'Data processing node',
        category: 'processing',
        icon: '⚙️',
        defaultData: {
          label: 'Process',
          parameters: [],
          configuration: {},
        },
        defaultStyle: {
          backgroundColor: '#fff3e0',
          borderColor: '#ff9800',
          width: 140,
          height: 80,
        },
        inputs: [{ type: 'input', dataType: 'any', label: 'Input', required: true }],
        outputs: [{ type: 'output', dataType: 'any', label: 'Output', required: false }],
      },
    ];

    templates.forEach((template) => {
      this.nodeTemplates.set(template.type, template);
    });
  }

  // Persistence
  private loadWorkflows(): void {
    try {
      const saved = localStorage.getItem('visual_workflows');
      if (saved) {
        const data = JSON.parse(saved);
        this.workflows = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load workflows:', error);
    }
  }

  private saveWorkflows(): void {
    try {
      const data = Array.from(this.workflows.entries());
      localStorage.setItem('visual_workflows', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save workflows:', error);
    }
  }

  private getDefaultSettings(): WorkflowSettings {
    return {
      autoSave: true,
      validation: true,
      execution: {
        mode: 'sequential',
        timeout: 30000,
        retryAttempts: 3,
        errorHandling: 'stop',
      },
      ui: {
        gridSize: 20,
        snapToGrid: true,
        showGrid: true,
        zoomLevel: 1,
        theme: 'light',
      },
    };
  }

  // Event Handling
  onWorkflowChanged(callback: (workflow: WorkflowDefinition) => void): () => void {
    this.workflowCallbacks.add(callback);
    return () => this.workflowCallbacks.delete(callback);
  }

  onSelectionChanged(callback: (nodes: WorkflowNode[]) => void): () => void {
    this.selectionCallbacks.add(callback);
    return () => this.selectionCallbacks.delete(callback);
  }

  private notifyWorkflowCallbacks(workflow: WorkflowDefinition): void {
    this.workflowCallbacks.forEach((callback) => {
      try {
        callback(workflow);
      } catch (error) {
        console.warn('Workflow callback failed:', error);
      }
    });
  }

  private notifySelectionCallbacks(nodes: WorkflowNode[]): void {
    this.selectionCallbacks.forEach((callback) => {
      try {
        callback(nodes);
      } catch (error) {
        console.warn('Selection callback failed:', error);
      }
    });
  }

  // Public API
  getWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  getActiveWorkflow(): WorkflowDefinition | null {
    return this.activeWorkflow;
  }

  getNodeTemplates(): NodeTemplate[] {
    return Array.from(this.nodeTemplates.values());
  }

  exportWorkflow(workflowId: string): string {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
    return JSON.stringify(workflow, null, 2);
  }

  importWorkflow(workflowData: string): WorkflowDefinition {
    try {
      const workflow = JSON.parse(workflowData) as WorkflowDefinition;
      workflow.id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.workflows.set(workflow.id, workflow);
      this.saveWorkflows();

      return workflow;
    } catch (error) {
      throw new Error(`Failed to import workflow: ${error}`);
    }
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export const visualWorkflowBuilder = new VisualWorkflowBuilder();
