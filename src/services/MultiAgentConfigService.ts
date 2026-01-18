import type { PersistedAgentConfig } from './MultiAgentPipeline';

interface MultiAgentConfigBridge {
  listMultiAgentConfigs: () => Promise<{
    success: boolean;
    items?: PersistedAgentConfig[];
    error?: string;
  }>;
  saveMultiAgentConfigs: (
    configs: PersistedAgentConfig[]
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

const getBridge = (): MultiAgentConfigBridge => {
  const api = (window as any)?.electronAPI?.db;
  if (!api?.listMultiAgentConfigs || !api?.saveMultiAgentConfigs) {
    throw new Error(
      'Database bridge for multi-agent configuration is unavailable. Ensure the desktop app is running with DATABASE_URL configured.'
    );
  }
  return api as MultiAgentConfigBridge;
};

const normalizeError = (message?: string) =>
  new Error(message ? `Multi-agent config error: ${message}` : 'Multi-agent configuration error.');

export async function getPersistedAgentConfigs(): Promise<PersistedAgentConfig[]> {
  const response = await getBridge().listMultiAgentConfigs();
  if (!response.success) {
    throw normalizeError(response.error);
  }
  return response.items ?? [];
}

export async function savePersistedAgentConfigs(configs: PersistedAgentConfig[]): Promise<void> {
  const response = await getBridge().saveMultiAgentConfigs(configs);
  if (!response.success) {
    throw normalizeError(response.error);
  }
}
