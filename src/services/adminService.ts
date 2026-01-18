// Frontend Admin Service - uses HTTP API calls instead of direct database access
// This service is safe to use in browser/frontend code

const API_BASE_URL = '/api/admin';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  apiRequests: number;
  errorRate: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  uptime: string;
  memoryUsage: number;
  cpuUsage: number;
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface UserManagementData {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userGrowth: number;
  topFeatures: Array<{ name: string; usage: number }>;
}

export interface SystemConfiguration {
  maintenanceMode: boolean;
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  rateLimits: Record<string, number>;
  featureFlags: Record<string, boolean>;
  cacheSettings: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

// Type definitions for admin entities
export interface ModelProvider {
  id: number;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiKeyRef: string | null;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workflow {
  id: number;
  name: string;
  definition: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentModelMap {
  id: number;
  workflowId: number;
  agentRole: string;
  primaryModelId: number;
  collaboratorModelId: number;
  createdAt: Date;
  updatedAt: Date;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

class AdminService {
  public async getStats(): Promise<AdminStats> {
    return fetchApi<AdminStats>('/stats');
  }

  public async getAlerts(): Promise<SystemAlert[]> {
    return fetchApi<SystemAlert[]>('/alerts');
  }

  public async getUserManagementData(): Promise<UserManagementData> {
    return fetchApi<UserManagementData>('/users');
  }

  public async getSystemConfiguration(): Promise<SystemConfiguration> {
    return fetchApi<SystemConfiguration>('/config');
  }

  public async updateSystemConfiguration(newConfig: Partial<SystemConfiguration>): Promise<void> {
    await fetchApi('/config', {
      method: 'PUT',
      body: JSON.stringify(newConfig),
    });
  }
}

export const adminService = new AdminService();

// ---------------------------------------------------------------------------
// Provider, workflow, and agent mapping helpers used by the Admin modal
// ---------------------------------------------------------------------------

export interface CreateProviderInput {
  name: string;
  provider: string;
  baseUrl: string | null;
  apiKeyRef: string | null;
  modelId: string;
}

export async function listProviders(): Promise<ModelProvider[]> {
  return fetchApi<ModelProvider[]>('/providers');
}

export async function createProvider(input: CreateProviderInput): Promise<ModelProvider> {
  return fetchApi<ModelProvider>('/providers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteProvider(id: number): Promise<void> {
  await fetchApi(`/providers/${id}`, { method: 'DELETE' });
}

export interface CreateWorkflowInput {
  name: string;
  definition: any;
}

export interface UpdateWorkflowInput {
  name?: string;
  definition?: any;
}

export async function listWorkflows(): Promise<Workflow[]> {
  return fetchApi<Workflow[]>('/workflows');
}

export async function createWorkflow(input: CreateWorkflowInput): Promise<Workflow> {
  return fetchApi<Workflow>('/workflows', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateWorkflow(
  id: number,
  input: UpdateWorkflowInput,
): Promise<Workflow> {
  return fetchApi<Workflow>(`/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteWorkflow(id: number): Promise<void> {
  await fetchApi(`/workflows/${id}`, { method: 'DELETE' });
}

export async function listAgentMaps(workflowId: number): Promise<AgentModelMap[]> {
  return fetchApi<AgentModelMap[]>(`/workflows/${workflowId}/agent-maps`);
}

export interface SetAgentMapInput {
  workflowId: number;
  agentRole: string;
  primaryModelId: number;
  collaboratorModelId: number;
}

export async function setAgentMap(input: SetAgentMapInput): Promise<AgentModelMap> {
  return fetchApi<AgentModelMap>(`/workflows/${input.workflowId}/agent-maps`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}