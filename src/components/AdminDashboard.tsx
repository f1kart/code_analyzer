import React, { useState } from 'react';
import { PipelineIntegration } from './PipelineIntegration';
import { useAdminDashboardData } from '../hooks/useAdminDashboardData';
import { LoadingSpinner } from './LoadingSpinner';
import { SystemConfiguration } from '../services/adminService';

type AdminDashboardTab = 'overview' | 'users' | 'system' | 'analytics' | 'configuration';

export const AdminDashboard: React.FC<{ projectPath?: string }> = ({ projectPath }) => {
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('overview');
  const {
    stats,
    alerts,
    userData,
    configuration,
    loading,
    error,
    updateConfiguration,
  } = useAdminDashboardData();

  const resolveAlert = (alertId: string) => {
    // This would call a service to resolve the alert in a real application
    console.log(`Resolving alert ${alertId}`);
  };

  const handleConfigChange = (newConfig: Partial<SystemConfiguration>) => {
    updateConfiguration(newConfig);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded ${
              configuration?.maintenanceMode
                ? 'bg-red-500 text-white'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
            onClick={() => handleConfigChange({ maintenanceMode: !configuration?.maintenanceMode })}
          >
            {configuration?.maintenanceMode ? 'Disable' : 'Enable'} Maintenance Mode
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'User Management' },
            { id: 'system', label: 'System Health' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'configuration', label: 'Configuration' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id as AdminDashboardTab)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* System Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
                <p className="text-sm text-green-600">↗ +12.5% this month</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
                <p className="text-3xl font-bold text-green-600">{stats.activeUsers}</p>
                <p className="text-sm text-gray-600">Currently online</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-500">API Requests</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.apiRequests}</p>
                <p className="text-sm text-gray-600">Last 24 hours</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="text-sm font-medium text-gray-500">Error Rate</h3>
                <p className="text-3xl font-bold text-red-600">{stats.errorRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">System health</p>
              </div>
            </div>
          )}

          {/* System Alerts */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">System Alerts</h3>
            <div className="space-y-3">
              {alerts.filter(alert => !alert.resolved).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded border-l-4 ${
                    alert.type === 'error' ? 'bg-red-50 border-red-400' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-blue-50 border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          alert.type === 'error' ? 'bg-red-100 text-red-800' :
                          alert.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.type.toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-800">{alert.title}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {alert.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <button
                      className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
              {alerts.filter(alert => !alert.resolved).length === 0 && (
                <p className="text-gray-500 text-center py-4">No active alerts</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && userData && (
        <div className="space-y-6">
          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <p className="text-3xl font-bold text-blue-600">{userData.totalUsers}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
              <p className="text-3xl font-bold text-green-600">{userData.activeUsers}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">New Users</h3>
              <p className="text-3xl font-bold text-purple-600">{userData.newUsers}</p>
            </div>
          </div>

          {/* Top Features */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Features</h3>
            <div className="space-y-3">
              {userData.topFeatures.map((feature, index) => (
                <div key={feature.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {feature.name.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">{feature.usage} uses</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && stats && (
        <div className="space-y-6">
          {/* System Health */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">System Health</h3>
              <p className={`text-2xl font-bold ${
                stats.systemHealth === 'healthy' ? 'text-green-600' :
                stats.systemHealth === 'warning' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {stats.systemHealth.toUpperCase()}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Uptime</h3>
              <p className="text-2xl font-bold text-blue-600">{stats.uptime}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Memory Usage</h3>
              <p className="text-2xl font-bold text-purple-600">{stats.memoryUsage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">CPU Usage</h4>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${stats.cpuUsage}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{stats.cpuUsage.toFixed(1)}%</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Memory Usage</h4>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${stats.memoryUsage}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{stats.memoryUsage.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'configuration' && configuration && (
        <div className="space-y-6">
          {/* Rate Limits */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Rate Limits</h3>
            <div className="space-y-4">
              {Object.entries(configuration.rateLimits).map(([endpoint, limit]) => (
                <div key={endpoint} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{endpoint}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={limit}
                      onChange={(e) => handleConfigChange({ rateLimits: { ...configuration.rateLimits, [endpoint]: parseInt(e.target.value) } })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      title={`Rate limit for ${endpoint}`}
                      placeholder="requests/min"
                    />
                    <span className="text-sm text-gray-600">requests/minute</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Feature Flags</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(configuration.featureFlags).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {feature.replace('_', ' ')}
                  </span>
                  <button
                    className={`px-3 py-1 text-sm rounded ${
                      enabled
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => handleConfigChange({ featureFlags: { ...configuration.featureFlags, [feature]: !enabled } })}
                  >
                    {enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cache Settings */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cache Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Cache Enabled</span>
                <button
                  className={`px-3 py-1 text-sm rounded ${
                    configuration.cacheSettings.enabled
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => handleConfigChange({ cacheSettings: { ...configuration.cacheSettings, enabled: !configuration.cacheSettings.enabled } })}
                >
                  {configuration.cacheSettings.enabled ? 'On' : 'Off'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TTL (seconds)
                </label>
                <input
                  type="number"
                  value={configuration.cacheSettings.ttl}
                  onChange={(e) => handleConfigChange({ cacheSettings: { ...configuration.cacheSettings, ttl: parseInt(e.target.value) } })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  title="Cache time-to-live in seconds"
                  placeholder="3600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Size
                </label>
                <input
                  type="number"
                  value={configuration.cacheSettings.maxSize}
                  title="Maximum cache size"
                  placeholder="1000"
                  onChange={(e) => handleConfigChange({ cacheSettings: { ...configuration.cacheSettings, maxSize: parseInt(e.target.value) } })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* CI/CD Pipeline Integration */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">CI/CD Pipeline Integration</h3>
            <PipelineIntegration
              projectPath={projectPath || ''}
              onReviewComplete={(result) => {
                console.log('Pipeline review completed:', result);
                // Could trigger notifications or update status
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Analytics Dashboard</h3>
          <p className="text-gray-600">Analytics dashboard integration would go here</p>
          <p className="text-sm text-gray-500 mt-2">
            This would show detailed usage analytics, performance metrics, and user behavior insights.
          </p>
        </div>
      )}
    </div>
  );
};