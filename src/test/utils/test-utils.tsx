import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AppSettings } from '../../utils/sessionManager';

// Test utilities for admin components
const createTestQueryClient = () => 
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider>
          {children}
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Mock admin service
export const mockAdminService = {
  listProviders: jest.fn(),
  createProvider: jest.fn(),
  deleteProvider: jest.fn(),
  listWorkflows: jest.fn(),
  createWorkflow: jest.fn(),
  updateWorkflow: jest.fn(),
  deleteWorkflow: jest.fn(),
  listAgentMaps: jest.fn(),
  setAgentMap: jest.fn(),
  getStats: jest.fn(),
  getAlerts: jest.fn(),
};

// Mock data
export const mockProviders = [
  {
    id: 1,
    name: 'OpenAI GPT-4',
    provider: 'openai',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'openai_key',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: 'Gemini Pro',
    provider: 'gemini',
    modelId: 'gemini-pro',
    baseUrl: null,
    apiKeyRef: 'gemini_key',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockWorkflows = [
  {
    id: 1,
    name: 'Code Review',
    definition: { steps: ['analyze', 'review', 'comment'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: 'Test Generation',
    definition: { steps: ['analyze', 'generate', 'validate'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockAgentMaps = [
  {
    id: 1,
    workflowId: 1,
    agentRole: 'reviewer',
    primaryModelId: 1,
    collaboratorModelId: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockStats = {
  systemHealth: 'healthy',
  uptime: '5d 12h 30m',
  apiRequests: 15420,
  errorRate: 0.02,
  cpuUsage: 45.6,
  memoryUsage: 62.3,
};

export const mockAlerts = [
  {
    id: 1,
    type: 'warning',
    title: 'High Memory Usage',
    message: 'Memory usage exceeds 60%',
    timestamp: new Date(),
  },
];

export const mockSettings: AppSettings = {
  general: {
    aiModel: 'gpt-4',
    logVerbosity: 'info',
    enableTelemetry: true,
  },
  aiTeamConfiguration: [
    {
      id: 'agent-1',
      role: 'reviewer',
      systemPrompt: 'You are a code reviewer',
      enabled: true,
      model: 'gpt-4',
    },
  ],
  agentBehavior: {},
  tools: {
    enabledTools: ['editor', 'terminal'],
  },
  desktop: {
    enableFileSystem: true,
    enableLocalDatabase: false,
  },
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };
