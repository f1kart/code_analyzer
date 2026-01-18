import React, { useCallback, useState } from 'react';

import { isDesktopApp } from '../../../utils/env';
import { PROVIDER_TYPES, ToastType } from '../adminModalShared';
import { useCreateProviderMutation, useDeleteProviderMutation, useProvidersQuery } from '../hooks/adminQueries';
import { VirtualizedProvidersList } from '../VirtualizedList';
import { FallbackUI } from '../FallbackUI';
import { logPerformance } from '../../../utils/logger';

interface ProvidersTabProps {
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

interface ProviderFormState {
  name: string;
  provider: string;
  baseUrl: string;
  apiKeyRef: string;
  modelId: string;
  isSubmitting: boolean;
}

const defaultProviderFormState: ProviderFormState = {
  name: '',
  provider: PROVIDER_TYPES.GEMINI,
  baseUrl: '',
  apiKeyRef: '',
  modelId: '',
  isSubmitting: false,
};

const ProvidersTab: React.FC<ProvidersTabProps> = ({ showToast }) => {
  const {
    data: providers,
    isLoading: isLoadingProviders,
    refetch: refetchProviders,
  } = useProvidersQuery();
  const createProviderMutation = useCreateProviderMutation();
  const deleteProviderMutation = useDeleteProviderMutation();
  const isDesktop = isDesktopApp();
  const [providerForm, setProviderForm] = useState<ProviderFormState>(defaultProviderFormState);

  const resetForm = useCallback(() => setProviderForm(defaultProviderFormState), []);

  const handleCreateProvider = useCallback(async () => {
    const startTime = performance.now();
    
    if (!providerForm.name.trim() || !providerForm.modelId.trim()) {
      showToast('warning', 'Provider name and model ID are required.');
      return;
    }

    try {
      setProviderForm((prev) => ({ ...prev, isSubmitting: true }));
      const payload = {
        name: providerForm.name.trim(),
        provider: providerForm.provider,
        baseUrl: providerForm.baseUrl?.trim() || null,
        apiKeyRef: providerForm.apiKeyRef?.trim() || null,
        modelId: providerForm.modelId.trim(),
      };
      const created = await createProviderMutation.mutateAsync(payload);
      
      const duration = performance.now() - startTime;
      logPerformance('create_provider', duration, { providerName: created.name });
      
      showToast('success', `Provider '${created.name}' added.`);
      resetForm();
    } catch (error) {
      const duration = performance.now() - startTime;
      logPerformance('create_provider_error', duration, { 
        error: (error as Error).message,
        providerName: providerForm.name 
      });
      
      console.error('Failed to create provider:', error);
      showToast('error', `Failed to create provider: ${(error as Error).message}`);
    } finally {
      setProviderForm((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [createProviderMutation, providerForm, resetForm, showToast]);

  const handleDeleteProvider = useCallback(
    async (id: number) => {
      const startTime = performance.now();
      
      try {
        await deleteProviderMutation.mutateAsync(id);
        
        const duration = performance.now() - startTime;
        logPerformance('delete_provider', duration, { providerId: id });
        
        showToast('success', 'Provider deleted.');
      } catch (error) {
        const duration = performance.now() - startTime;
        logPerformance('delete_provider_error', duration, { 
          error: (error as Error).message,
          providerId: id 
        });
        
        console.error('Failed to delete provider:', error);
        showToast('error', `Failed to delete provider: ${(error as Error).message}`);
      }
    },
    [deleteProviderMutation, showToast],
  );

  return (
    <div className="space-y-4">
      {!isDesktop && (
        <p className="text-xs text-blue-300">
          Provider persistence is only available in the desktop app. Edits in the web preview are
          transient.
        </p>
      )}

      <div className="bg-gray-900/60 border border-gray-800 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Add Provider</h3>
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-200"
            onClick={() => refetchProviders().catch((error) => console.error(error))}
          >
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded p-2"
            placeholder="Provider name"
            title="Provider name"
            value={providerForm.name}
            onChange={(event) => setProviderForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <select
            className="col-span-2 bg-gray-700 border border-gray-600 rounded p-2"
            title="Provider type"
            aria-label="Provider type"
            value={providerForm.provider}
            onChange={(event) =>
              setProviderForm((prev) => ({ ...prev, provider: event.target.value }))
            }
          >
            {Object.values(PROVIDER_TYPES).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded p-2"
            placeholder="Base URL (optional)"
            title="Base URL (optional)"
            value={providerForm.baseUrl}
            onChange={(event) =>
              setProviderForm((prev) => ({ ...prev, baseUrl: event.target.value }))
            }
          />
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded p-2"
            placeholder="API key environment variable (optional)"
            title="API key environment variable (optional)"
            value={providerForm.apiKeyRef}
            onChange={(event) =>
              setProviderForm((prev) => ({ ...prev, apiKeyRef: event.target.value }))
            }
          />
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded p-2"
            placeholder="Default model ID"
            title="Default model ID"
            value={providerForm.modelId}
            onChange={(event) =>
              setProviderForm((prev) => ({ ...prev, modelId: event.target.value }))
            }
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreateProvider}
            disabled={providerForm.isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {providerForm.isSubmitting ? 'Saving…' : 'Add Provider'}
          </button>
        </div>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">Configured Providers</h3>
          {isLoadingProviders && <span className="text-xs text-gray-400">Loading…</span>}
        </div>
        
        {providers === null ? (
          <FallbackUI
            type="loading"
            title="Loading Providers"
            message="Fetching your configured providers..."
            className="h-64"
          />
        ) : providers.length === 0 ? (
          <FallbackUI
            type="empty"
            title="No Providers"
            message="No providers configured yet. Add your first provider to get started."
            className="h-64"
          />
        ) : (
          <VirtualizedProvidersList
            providers={providers.map(p => ({
              ...p,
              status: 'active' // Could be determined from health checks
            }))}
            onDelete={handleDeleteProvider}
            height={Math.min(400, providers.length * 80)}
          />
        )}
      </div>
    </div>
  );
};

export default ProvidersTab;
