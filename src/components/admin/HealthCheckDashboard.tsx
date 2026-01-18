import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  ServerIcon,
  CircleStackIcon,
  CpuChipIcon,
  HardDriveIcon,
  ChartBarIcon,
  BeakerIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Health check response interfaces
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    cpu: HealthCheck;
    disk: HealthCheck;
    metrics: HealthCheck;
    tracing: HealthCheck;
  };
  summary: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
  };
}

interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  details?: any;
  duration_ms?: number;
  timestamp: string;
}

const HealthCheckDashboard: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  // Fetch health data
  const fetchHealthData = async (endpoint: string = 'ready') => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/health/${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      console.error('Health check error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchHealthData('ready');
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Initial fetch
  useEffect(() => {
    fetchHealthData('ready');
  }, []);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getStatusIcon = (status: 'pass' | 'warn' | 'fail' | 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warn':
      case 'degraded':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'fail':
      case 'unhealthy':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: 'pass' | 'warn' | 'fail' | 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'warn':
      case 'degraded':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'fail':
      case 'unhealthy':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const CheckCard: React.FC<{
    title: string;
    check: HealthCheck;
    icon: React.ReactNode;
  }> = ({ title, check, icon }) => {
    return (
      <div className={`p-4 rounded-lg border ${getStatusColor(check.status)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded bg-white bg-opacity-50">
              {icon}
            </div>
            <h4 className="font-medium">{title}</h4>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(check.status)}
            {check.duration_ms && (
              <span className="text-xs text-gray-500">
                {formatDuration(check.duration_ms)}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm opacity-80 mb-2">{check.message}</p>
        {check.details && (
          <details className="text-xs">
            <summary className="cursor-pointer hover:underline">Details</summary>
            <pre className="mt-2 p-2 bg-black bg-opacity-10 rounded overflow-x-auto">
              {JSON.stringify(check.details, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  if (loading && !healthData) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !healthData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircleIcon className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => fetchHealthData('ready')}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!healthData) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Check Dashboard</h1>
          <p className="text-gray-600">Monitor system health and service status</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Auto-refresh:</label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              aria-label={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Refresh interval"
              aria-label="Refresh interval"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
          )}
          <button
            onClick={() => fetchHealthData('ready')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`p-6 rounded-lg border ${getStatusColor(healthData.status)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getStatusIcon(healthData.status)}
            <div>
              <h2 className="text-xl font-semibold capitalize">{healthData.status}</h2>
              <p className="text-sm opacity-80">
                {healthData.summary.passed_checks}/{healthData.summary.total_checks} checks passing
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Uptime: {formatUptime(healthData.uptime)}</p>
            <p className="text-sm opacity-80">Version: {healthData.version}</p>
            <p className="text-sm opacity-80">Environment: {healthData.environment}</p>
          </div>
        </div>
      </div>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CheckCard
          title="Database"
          check={healthData.checks.database}
          icon={<CircleStackIcon className="h-4 w-4" />}
        />
        <CheckCard
          title="Memory"
          check={healthData.checks.memory}
          icon={<ServerIcon className="h-4 w-4" />}
        />
        <CheckCard
          title="CPU"
          check={healthData.checks.cpu}
          icon={<CpuChipIcon className="h-4 w-4" />}
        />
        <CheckCard
          title="Disk"
          check={healthData.checks.disk}
          icon={<HardDriveIcon className="h-4 w-4" />}
        />
        <CheckCard
          title="Metrics"
          check={healthData.checks.metrics}
          icon={<ChartBarIcon className="h-4 w-4" />}
        />
        <CheckCard
          title="Tracing"
          check={healthData.checks.tracing}
          icon={<BeakerIcon className="h-4 w-4" />}
        />
      </div>

      {/* System Information */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusIcon(healthData.status)}
              <span className="font-medium capitalize">{healthData.status}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Uptime</p>
            <p className="font-medium">{formatUptime(healthData.uptime)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Version</p>
            <p className="font-medium">{healthData.version}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Environment</p>
            <p className="font-medium capitalize">{healthData.environment}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Check</p>
            <p className="font-medium">{new Date(healthData.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Checks</p>
            <p className="font-medium">{healthData.summary.total_checks}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Passed</p>
            <p className="font-medium text-green-600">{healthData.summary.passed_checks}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Failed</p>
            <p className="font-medium text-red-600">{healthData.summary.failed_checks}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => fetchHealthData('health')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Basic Health Check
        </button>
        <button
          onClick={() => fetchHealthData('ready')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Readiness Check
        </button>
        <button
          onClick={() => fetchHealthData('live')}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Liveness Check
        </button>
        <button
          onClick={() => fetchHealthData('detailed')}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          Detailed Check
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Health Check Information</h4>
            <p className="text-sm text-blue-700 mt-1">
              This dashboard monitors the health of various system components. Green indicates healthy status,
              yellow indicates warnings, and red indicates failures. Auto-refresh can be enabled for continuous monitoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthCheckDashboard;
