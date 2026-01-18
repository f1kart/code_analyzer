import React, { useState, useEffect } from 'react';
import { getAnalyticsService } from '../services/UsageAnalyticsService';

interface UsageMetrics {
  totalUsers: number;
  activeUsers: number;
  sessionsPerUser: number;
  averageSessionDuration: number;
  featureUsage: Record<string, number>;
  errorRate: number;
  aiInteractions: number;
  codeReviewSessions: number;
  performanceMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
  };
}

interface UserBehaviorData {
  sessionId: string;
  duration: number;
  events: number;
  featuresUsed: string[];
  errors: number;
  aiInteractions: number;
}

export const AnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [userBehavior, setUserBehavior] = useState<UserBehaviorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  const analyticsService = getAnalyticsService();

  useEffect(() => {
    if (analyticsService) {
      setMetrics(analyticsService.getUsageMetrics());
      setUserBehavior(analyticsService.getUserBehaviorAnalytics());
      setLoading(false);
    }
  }, []);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getTopFeatures = (limit: number = 5): Array<{ name: string; count: number }> => {
    if (!metrics?.featureUsage) return [];

    return Object.entries(metrics.featureUsage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Usage Analytics</h2>
        <div className="flex gap-2">
          {(['1h', '24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
          <p className="text-3xl font-bold text-blue-600">{metrics.totalUsers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Active Sessions</h3>
          <p className="text-3xl font-bold text-green-600">{metrics.activeUsers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Avg Session Duration</h3>
          <p className="text-3xl font-bold text-purple-600">
            {formatDuration(metrics.averageSessionDuration)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">AI Interactions</h3>
          <p className="text-3xl font-bold text-orange-600">{metrics.aiInteractions}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Usage */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Feature Usage</h3>
          <div className="space-y-3">
            {getTopFeatures().map((feature) => (
              <div key={feature.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {feature.name.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-sm text-gray-600">{feature.count} uses</span>
              </div>
            ))}
            {getTopFeatures().length === 0 && (
              <p className="text-gray-500 text-sm">No feature usage data available</p>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Response Time</span>
              <span className="text-sm font-medium">
                {formatDuration(metrics.performanceMetrics.averageResponseTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">P95 Response Time</span>
              <span className="text-sm font-medium">
                {formatDuration(metrics.performanceMetrics.p95ResponseTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Error Rate</span>
              <span className="text-sm font-medium text-red-600">
                {formatPercentage(metrics.performanceMetrics.errorRate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User Behavior */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Session ID</th>
                <th className="text-left py-2">Duration</th>
                <th className="text-left py-2">Events</th>
                <th className="text-left py-2">Features Used</th>
                <th className="text-left py-2">Errors</th>
                <th className="text-left py-2">AI Interactions</th>
              </tr>
            </thead>
            <tbody>
              {userBehavior.slice(0, 10).map((session) => (
                <tr key={session.sessionId} className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">
                    {session.sessionId.substring(0, 8)}...
                  </td>
                  <td className="py-2 text-gray-600">
                    {formatDuration(session.duration)}
                  </td>
                  <td className="py-2 text-gray-600">{session.events}</td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {session.featuresUsed.slice(0, 3).map((feature) => (
                        <span
                          key={feature}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {feature}
                        </span>
                      ))}
                      {session.featuresUsed.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{session.featuresUsed.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      session.errors > 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {session.errors}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                      {session.aiInteractions}
                    </span>
                  </td>
                </tr>
              ))}
              {userBehavior.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No session data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Export Analytics</h3>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => {
              if (analyticsService) {
                const data = analyticsService.exportData('json');
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            Export JSON
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => {
              if (analyticsService) {
                const data = analyticsService.exportData('csv');
                const blob = new Blob([data], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};
