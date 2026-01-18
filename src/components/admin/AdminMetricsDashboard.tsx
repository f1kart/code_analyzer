import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  ServerIcon, 
  UserGroupIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

// Mock metrics data - in production, this would come from API
interface MetricsData {
  operations: {
    total: number;
    errors: number;
    success_rate: number;
    avg_duration: number;
  };
  resources: {
    providers: { created: number; updated: number; deleted: number; errors: number };
    workflows: { created: number; updated: number; deleted: number; executed: number; errors: number };
    users: { created: number; updated: number; deleted: number; login_attempts: number; login_failures: number };
  };
  performance: {
    concurrent_operations: number;
    active_users: number;
    rate_limit_hits: number;
    cache_operations: number;
  };
  recent_operations: Array<{
    id: string;
    operation: string;
    resource_type: string;
    user_id: string;
    success: boolean;
    duration: number;
    timestamp: string;
  }>;
}

const AdminMetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Mock data fetch - in production, this would call the metrics API
  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock metrics data
        const mockMetrics: MetricsData = {
          operations: {
            total: 1250,
            errors: 23,
            success_rate: 98.2,
            avg_duration: 245,
          },
          resources: {
            providers: {
              created: 45,
              updated: 128,
              deleted: 12,
              errors: 3,
            },
            workflows: {
              created: 23,
              updated: 67,
              deleted: 8,
              executed: 234,
              errors: 7,
            },
            users: {
              created: 12,
              updated: 34,
              deleted: 5,
              login_attempts: 567,
              login_failures: 23,
            },
          },
          performance: {
            concurrent_operations: 8,
            active_users: 15,
            rate_limit_hits: 45,
            cache_operations: 1234,
          },
          recent_operations: [
            {
              id: '1',
              operation: 'POST',
              resource_type: 'providers',
              user_id: 'admin_1',
              success: true,
              duration: 234,
              timestamp: '2025-01-23T10:30:00Z',
            },
            {
              id: '2',
              operation: 'PUT',
              resource_type: 'workflows',
              user_id: 'admin_2',
              success: false,
              duration: 567,
              timestamp: '2025-01-23T10:28:00Z',
            },
            {
              id: '3',
              operation: 'GET',
              resource_type: 'users',
              user_id: 'admin_1',
              success: true,
              duration: 123,
              timestamp: '2025-01-23T10:25:00Z',
            },
            {
              id: '4',
              operation: 'DELETE',
              resource_type: 'providers',
              user_id: 'admin_3',
              success: true,
              duration: 89,
              timestamp: '2025-01-23T10:22:00Z',
            },
            {
              id: '5',
              operation: 'POST',
              resource_type: 'workflows',
              user_id: 'admin_2',
              success: true,
              duration: 456,
              timestamp: '2025-01-23T10:20:00Z',
            },
          ],
        };

        setMetrics(mockMetrics);
      } catch (err) {
        setError('Failed to load metrics data');
        console.error('Metrics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timeRange]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    color?: 'green' | 'red' | 'blue' | 'yellow';
  }> = ({ title, value, icon, trend, color = 'blue' }) => {
    const colorClasses = {
      green: 'bg-green-50 text-green-600 border-green-200',
      red: 'bg-red-50 text-red-600 border-red-200',
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    };

    const trendIcons = {
      up: <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />,
      down: <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />,
      neutral: null,
    };

    return (
      <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-white bg-opacity-50">
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
          {trend && (
            <div className="flex items-center space-x-1">
              {trendIcons[trend]}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Metrics Dashboard</h1>
          <p className="text-gray-600">Monitor admin operations and system performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Select time range for metrics"
            aria-label="Select time range for metrics"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Operations"
          value={metrics.operations.total.toLocaleString()}
          icon={<ChartBarIcon className="h-5 w-5" />}
          trend="up"
          color="blue"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.operations.success_rate}%`}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          trend="up"
          color="green"
        />
        <MetricCard
          title="Avg Duration"
          value={formatDuration(metrics.operations.avg_duration)}
          icon={<ClockIcon className="h-5 w-5" />}
          trend="neutral"
          color="yellow"
        />
        <MetricCard
          title="Errors"
          value={metrics.operations.errors}
          icon={<XCircleIcon className="h-5 w-5" />}
          trend="down"
          color="red"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Concurrent Operations"
          value={metrics.performance.concurrent_operations}
          icon={<ServerIcon className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          title="Active Users"
          value={metrics.performance.active_users}
          icon={<UserGroupIcon className="h-5 w-5" />}
          color="green"
        />
        <MetricCard
          title="Rate Limit Hits"
          value={metrics.performance.rate_limit_hits}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          color="yellow"
        />
        <MetricCard
          title="Cache Operations"
          value={metrics.performance.cache_operations.toLocaleString()}
          icon={<ServerIcon className="h-5 w-5" />}
          color="blue"
        />
      </div>

      {/* Resource Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Providers */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Providers</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Created</span>
              <span className="font-medium">{metrics.resources.providers.created}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Updated</span>
              <span className="font-medium">{metrics.resources.providers.updated}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Deleted</span>
              <span className="font-medium">{metrics.resources.providers.deleted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Errors</span>
              <span className="font-medium text-red-600">{metrics.resources.providers.errors}</span>
            </div>
          </div>
        </div>

        {/* Workflows */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflows</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Created</span>
              <span className="font-medium">{metrics.resources.workflows.created}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Updated</span>
              <span className="font-medium">{metrics.resources.workflows.updated}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Executed</span>
              <span className="font-medium">{metrics.resources.workflows.executed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Errors</span>
              <span className="font-medium text-red-600">{metrics.resources.workflows.errors}</span>
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Users</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Created</span>
              <span className="font-medium">{metrics.resources.users.created}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Updated</span>
              <span className="font-medium">{metrics.resources.users.updated}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Login Attempts</span>
              <span className="font-medium">{metrics.resources.users.login_attempts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Login Failures</span>
              <span className="font-medium text-red-600">{metrics.resources.users.login_failures}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Operations */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Operations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.recent_operations.map((operation) => (
                <tr key={operation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {operation.operation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {operation.resource_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {operation.user_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        operation.success
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {operation.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(operation.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(operation.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminMetricsDashboard;
