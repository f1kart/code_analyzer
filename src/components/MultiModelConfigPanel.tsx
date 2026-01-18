import React, { useState, useEffect } from 'react';
import {
  CogIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CloudIcon,
  CpuChipIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline';
import { multiModelConfig, AIProvider, AIModel, ModelProfile } from '../services/multiModelConfig';

interface MultiModelConfigPanelProps {
  className?: string;
}

export const MultiModelConfigPanel: React.FC<MultiModelConfigPanelProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'models' | 'profiles' | 'usage'>(
    'providers',
  );
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<ModelProfile | null>(null);
  const [_showAddProvider, _setShowAddProvider] = useState(false);
  const [_showAddModel, _setShowAddModel] = useState(false);
  const [_showAddProfile, _setShowAddProfile] = useState(false);
  const [_editingProvider, _setEditingProvider] = useState<AIProvider | null>(null);
  const [_editingModel, _setEditingModel] = useState<AIModel | null>(null);

  useEffect(() => {
    const unsubscribe = multiModelConfig.onConfigChanged(() => {
      setProviders(multiModelConfig.getProviders());
      setModels(multiModelConfig.getModels());
      setProfiles(multiModelConfig.getProfiles());
      setActiveProfile(multiModelConfig.getActiveProfile());
    });

    // Load initial data
    setProviders(multiModelConfig.getProviders());
    setModels(multiModelConfig.getModels());
    setProfiles(multiModelConfig.getProfiles());
    setActiveProfile(multiModelConfig.getActiveProfile());

    return unsubscribe;
  }, []);

  const _handleAddProvider = async (providerData: Omit<AIProvider, 'id'>) => {
    try {
      await multiModelConfig.addProvider(providerData);
      _setShowAddProvider(false);
    } catch (error) {
      console.error('Failed to add provider:', error);
    }
  };

  const _handleUpdateProvider = async (providerId: string, updates: Partial<AIProvider>) => {
    try {
      await multiModelConfig.updateProvider(providerId, updates);
      _setEditingProvider(null);
    } catch (error) {
      console.error('Failed to update provider:', error);
    }
  };

  const handleRemoveProvider = async (providerId: string) => {
    if (confirm('Are you sure you want to remove this provider?')) {
      try {
        await multiModelConfig.removeProvider(providerId);
      } catch (error) {
        console.error('Failed to remove provider:', error);
      }
    }
  };

  const handleSetActiveProfile = async (profileId: string) => {
    try {
      await multiModelConfig.setActiveProfile(profileId);
    } catch (error) {
      console.error('Failed to set active profile:', error);
    }
  };

  const exportConfig = () => {
    const config = multiModelConfig.exportConfiguration();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-model-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const config = e.target?.result as string;
        await multiModelConfig.importConfiguration(config);
      } catch (error) {
        console.error('Failed to import configuration:', error);
        alert('Failed to import configuration. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <CogIcon className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">AI Model Configuration</h2>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={importConfig}
            className="hidden"
            id="import-config"
          />
          <label
            htmlFor="import-config"
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
          >
            <DocumentArrowUpIcon className="w-4 h-4" />
            <span className="text-sm">Import</span>
          </label>
          <button
            onClick={exportConfig}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'providers', label: 'Providers', icon: CloudIcon },
          { id: 'models', label: 'Models', icon: CpuChipIcon },
          { id: 'profiles', label: 'Profiles', icon: CogIcon },
          { id: 'usage', label: 'Usage Stats', icon: ChartBarIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'providers' && (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">AI Providers</h3>
                <button
                  onClick={() => _setShowAddProvider(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Provider</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="bg-panel border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            provider.isActive ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <h4 className="font-medium text-gray-900">{provider.name}</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => _setEditingProvider(provider)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title={`Edit ${provider.name} provider`}
                          aria-label={`Edit ${provider.name} provider`}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveProvider(provider.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title={`Remove ${provider.name} provider`}
                          aria-label={`Remove ${provider.name} provider`}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div>
                        Type: <span className="font-medium">{provider.type}</span>
                      </div>
                      <div>
                        Models: <span className="font-medium">{provider.models.length}</span>
                      </div>
                      <div>
                        Rate Limit:{' '}
                        <span className="font-medium">
                          {provider.rateLimits.requestsPerMinute}/min
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500">{provider.metadata.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">AI Models</h3>
                <button
                  onClick={() => _setShowAddModel(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Model</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {models.map((model) => (
                  <div key={model.id} className="bg-panel border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            model.isActive ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">{model.displayName}</h4>
                          <p className="text-sm text-gray-500">{model.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => _setEditingModel(model)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title={`Edit ${model.displayName} model`}
                          aria-label={`Edit ${model.displayName} model`}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Type</div>
                        <div className="font-medium">{model.type}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Context Window</div>
                        <div className="font-medium">
                          {model.capabilities.contextWindow.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Max Tokens</div>
                        <div className="font-medium">
                          {model.capabilities.maxTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg Latency</div>
                        <div className="font-medium">{model.performance.averageLatency}ms</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {model.capabilities.specialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Model Profiles</h3>
                <button
                  onClick={() => _setShowAddProfile(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Profile</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      activeProfile?.id === profile.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-border bg-panel hover:border-interactive'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleSetActiveProfile(profile.id)}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            activeProfile?.id === profile.id
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-gray-300 hover:border-blue-600'
                          }`}
                        >
                          {activeProfile?.id === profile.id && (
                            <CheckCircleIcon className="w-3 h-3 text-white" />
                          )}
                        </button>
                        <div>
                          <h4 className="font-medium text-gray-900">{profile.name}</h4>
                          <p className="text-sm text-gray-500">{profile.description}</p>
                        </div>
                      </div>
                      {profile.isDefault && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {profile.models.map((assignment, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{assignment.task}</span>
                          <span className="font-medium">
                            {models.find((m) => m.id === assignment.modelId)?.displayName ||
                              assignment.modelId}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Usage Statistics</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {multiModelConfig.getUsageStats().map((stats) => {
                  const model = models.find((m) => m.id === stats.modelId);
                  return (
                    <div
                      key={stats.modelId}
                      className="bg-panel border border-border rounded-lg p-4"
                    >
                      <h4 className="font-medium text-gray-900 mb-3">
                        {model?.displayName || stats.modelId}
                      </h4>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Total Requests</div>
                          <div className="font-medium text-lg">
                            {stats.totalRequests.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Success Rate</div>
                          <div className="font-medium text-lg">
                            {((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Total Tokens</div>
                          <div className="font-medium text-lg">
                            {stats.totalTokens.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Total Cost</div>
                          <div className="font-medium text-lg">${stats.totalCost.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-500 mb-2">Recent Usage (Last 7 Days)</div>
                        <div className="flex space-x-1 h-8">
                          {stats.usageByDay.slice(-7).map((_day, _index) => (
                            <div
                              key={_day.date}
                              className="flex-1 bg-blue-200 rounded-sm relative"
                              style={{
                                height: `${Math.max(10, (_day.requests / Math.max(...stats.usageByDay.slice(-7).map((d) => d.requests))) * 100)}%`,
                              }} // eslint-disable-line react/style-prop-object
                              title={`${_day.date}: ${_day.requests} requests`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiModelConfigPanel;
