import { AgentConfig, AppSettings, AIToolSettings, ModelConfig, LogVerbosity } from '../../utils/sessionManager';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export type SettingsAction =
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'UPDATE_AGENT_CONFIG'; payload: { role: string; config: Partial<AgentConfig> } }
  | { type: 'ADD_MODEL'; payload: { model: ModelConfig } }
  | { type: 'REMOVE_MODEL'; payload: { modelId: string } }
  | {
      type: 'UPDATE_DESKTOP_SETTING';
      payload: { key: keyof AppSettings['desktopSettings']; value: boolean };
    }
  | { type: 'UPDATE_TOOL_SETTING'; payload: { tool: keyof AIToolSettings; enabled: boolean } }
  | { type: 'REORDER_AGENTS'; payload: AgentConfig[] }
  | { type: 'UPDATE_AI_PERSONA'; payload: string }
  | { type: 'UPDATE_CUSTOM_RULES'; payload: string }
  | { type: 'SET_LOG_VERBOSITY'; payload: LogVerbosity };

export const TABS = {
  GENERAL: 'general',
  TEAM: 'team',
  AGENT_BEHAVIOR: 'agentBehavior',
  PROVIDERS: 'providers',
  WORKFLOWS: 'workflows',
  TOOLS: 'tools',
  ENTERPRISE_TOOLS: 'enterpriseTools',
  DESKTOP: 'desktop',
  OPERATIONS: 'operations',
} as const;

export const RESERVED_ROLES = {
  BRAINSTORMER: 'Brainstormer',
  INTEGRATOR: 'Integrator',
} as const;

export const PROVIDER_TYPES = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  OLLAMA: 'ollama',
} as const;

export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';

export const defaultWorkflowDefinition = '{\n  "steps": []\n}';

export const settingsReducer = (state: AppSettings, action: SettingsAction): AppSettings => {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...action.payload };

    case 'UPDATE_AGENT_CONFIG':
      return {
        ...state,
        aiTeamConfiguration: state.aiTeamConfiguration.map((agent) =>
          agent.role === action.payload.role ? { ...agent, ...action.payload.config } : agent,
        ),
      };

    case 'ADD_MODEL':
      return {
        ...state,
        availableModels: [...state.availableModels, action.payload.model],
      };

    case 'REMOVE_MODEL':
      return {
        ...state,
        availableModels: state.availableModels.filter((model) => model.id !== action.payload.modelId),
      };

    case 'UPDATE_DESKTOP_SETTING':
      return {
        ...state,
        desktopSettings: {
          ...state.desktopSettings,
          [action.payload.key]: action.payload.value,
        },
      };

    case 'UPDATE_TOOL_SETTING':
      return {
        ...state,
        aiTools: {
          ...state.aiTools,
          [action.payload.tool]: action.payload.enabled,
        },
      };

    case 'REORDER_AGENTS':
      return {
        ...state,
        aiTeamConfiguration: action.payload,
      };

    case 'UPDATE_AI_PERSONA':
      return {
        ...state,
        aiPersona: action.payload,
      };

    case 'UPDATE_CUSTOM_RULES':
      return {
        ...state,
        customRules: action.payload,
      };

    case 'SET_LOG_VERBOSITY':
      return {
        ...state,
        logVerbosity: action.payload,
      };

    default:
      return state;
  }
};

export const computeDraggableAgents = (agents: AgentConfig[]) =>
  agents
    .filter(
      (agent) =>
        agent.role !== RESERVED_ROLES.BRAINSTORMER && agent.role !== RESERVED_ROLES.INTEGRATOR,
    )
    .sort((a, b) => a.order - b.order);

export const getIntegratorsOrder = (agents: AgentConfig[]) =>
  computeDraggableAgents(agents).length + 1;
