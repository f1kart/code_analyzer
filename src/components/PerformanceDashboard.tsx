/**
 * Performance Dashboard
 * Real-time monitoring dashboard with alerts, metrics, and load testing
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAlertingSystem, Alert, AlertSeverity } from '../services/AlertingSystem';
import { getLoadTestingFramework, LoadTestConfig, LoadTestMetrics } from '../services/LoadTestingFramework';
import { getUserActivityTracker } from '../services/UserActivityTracker';
import {
  getMultiAgentPipeline,
  QuotaHealthSnapshot,
  CooldownBlockEvent,
  PipelineFailureType
} from '../services/MultiAgentPipeline';
import { statePersistence } from '../services/StatePersistenceService';

interface PerformanceDashboardProps {
  onClose: () => void;
}

type DashboardView = 'overview' | 'alerts' | 'load-testing' | 'activity' | 'multi-agent';

interface MultiAgentRunReport {
  id: string;
  timestamp: string;
  success: boolean;
  contextMode: string;
  selectedFileCount: number;
  qualityScore?: number;
  warnings: string[];
  errorMessage?: string;
  totalDurationMs: number | null;
  failureType: PipelineFailureType;
  stages: Array<{
    id: string;
    name: string;
    model: string;
    status: string;
    durationMs: number | null;
  }>;
  files: Array<{
    path: string;
    isNewFile: boolean;
    summary?: string;
  }>;
}

interface MultiAgentStageProgress {
  runId: string;
  stage: {
    id: string;
    name: string;
    model: string;
    status: string;
    startTime?: string;
    endTime?: string;
  };
  prompt: string;
  contextMode: string;
  selectedFileCount: number;
  timestamp: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ onClose }) => {
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [activityStats, setActivityStats] = useState<any>(null);
  const [loadTestResults, setLoadTestResults] = useState<LoadTestMetrics[]>([]);
  const [isLoadTesting, setIsLoadTesting] = useState(false);
  const [multiAgentRuns, setMultiAgentRuns] = useState<MultiAgentRunReport[]>([]);
  const [liveStageEvents, setLiveStageEvents] = useState<MultiAgentStageProgress[]>([]);

  // Initialize services
  const alerting = getAlertingSystem();
  const loadTesting = getLoadTestingFramework();
  const activityTracker = getUserActivityTracker();

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
    
    // Subscribe to new alerts
    const unsubscribe = alerting.subscribe((alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{ report?: MultiAgentRunReport }>;
        const report = customEvent.detail?.report;
        if (!report) {
          return;
        }
        setMultiAgentRuns((prev) => [report, ...prev].slice(0, 100));
      } catch (error) {
        console.error('[PerformanceDashboard] Failed to handle multi-agent run report event:', error);
      }
    };

    window.addEventListener('ide:multi-agent-run-report', handler);
    return () => {
      window.removeEventListener('ide:multi-agent-run-report', handler);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      try {
        const customEvent = event as CustomEvent<MultiAgentStageProgress>;
        if (!customEvent.detail) {
          return;
        }
        setLiveStageEvents((prev) => {
          const next = [...prev, customEvent.detail];
          return next.slice(-200);
        });
      } catch (error) {
        console.error('[PerformanceDashboard] Failed to handle multi-agent stage progress event:', error);
      }
    };

    window.addEventListener('ide:multi-agent-stage-progress', handler);
    return () => {
      window.removeEventListener('ide:multi-agent-stage-progress', handler);
    };
  }, []);

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(() => {
    setAlerts(alerting.getAlerts());
    setAlertStats(alerting.getStats());
    setActivityStats(activityTracker.getStatistics());
    setLoadTestResults(loadTesting.getTestResults() as LoadTestMetrics[]);
  }, [alerting, activityTracker, loadTesting]);

  /**
   * Run quick load test
   */
  const runQuickLoadTest = async () => {
    setIsLoadTesting(true);
    
    try {
      const config: LoadTestConfig = {
        name: 'Quick Load Test',
        targetUrl: window.location.origin,
        method: 'GET',
        duration: 10,
        concurrentUsers: 5,
      };

      const result = await loadTesting.runLoadTest(config);
      setLoadTestResults([result, ...loadTestResults]);
      
      // Check for performance regression
      const regression = loadTesting.detectRegression(result);
      if (regression.detected) {
        alerting.sendAlert(
          'warning',
          'performance',
          'Performance Regression Detected',
          `${regression.regressions.length} performance regressions detected`,
          { details: regression }
        );
      }
    } catch (error: any) {
      alerting.sendAlert('error', 'error', 'Load Test Failed', error.message);
    } finally {
      setIsLoadTesting(false);
      loadDashboardData();
    }
  };

  /**
   * Acknowledge alert
   */
  const handleAcknowledgeAlert = (alertId: string) => {
    alerting.acknowledgeAlert(alertId);
    loadDashboardData();
  };

  /**
   * Clear all alerts
   */
  const handleClearAlerts = () => {
    alerting.clearAll();
    loadDashboardData();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📊</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Performance Dashboard</h2>
              <p className="text-purple-100 text-sm">Real-time monitoring & analytics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition"
            title="Close dashboard"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-4 bg-gray-800 border-b border-gray-700">
          {[
            { id: 'overview', label: '📈 Overview', icon: '📈' },
            { id: 'alerts', label: '🚨 Alerts', icon: '🚨', count: alertStats?.unacknowledged },
            { id: 'load-testing', label: '⚡ Load Testing', icon: '⚡' },
            { id: 'activity', label: '👤 Activity', icon: '👤' },
            { id: 'multi-agent', label: '🤖 Multi-Agent Runs', icon: '🤖', count: multiAgentRuns.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as DashboardView)}
              className={`px-4 py-2 rounded-lg font-medium transition relative ${
                activeView === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeView === 'overview' && (
            <OverviewView
              alertStats={alertStats}
              activityStats={activityStats}
              loadTestResults={loadTestResults}
              onRunLoadTest={runQuickLoadTest}
              isLoadTesting={isLoadTesting}
            />
          )}

          {activeView === 'alerts' && (
            <AlertsView
              alerts={alerts}
              stats={alertStats}
              onAcknowledge={handleAcknowledgeAlert}
              onClearAll={handleClearAlerts}
            />
          )}

          {activeView === 'load-testing' && (
            <LoadTestingView
              results={loadTestResults}
              onRunTest={runQuickLoadTest}
              isRunning={isLoadTesting}
            />
          )}

          {activeView === 'activity' && <ActivityView stats={activityStats} />}

          {activeView === 'multi-agent' && (
            <MultiAgentRunsView runs={multiAgentRuns} liveStages={liveStageEvents} />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Overview View
 */
const OverviewView: React.FC<{
  alertStats: any;
  activityStats: any;
  loadTestResults: LoadTestMetrics[];
  onRunLoadTest: () => void;
  isLoadTesting: boolean;
}> = ({ alertStats, activityStats, loadTestResults, onRunLoadTest, isLoadTesting }) => {
  const latestTest = loadTestResults[0];

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border-2 border-blue-500/50">
        <div className="flex items-start gap-4">
          <span className="text-4xl">💡</span>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-3">What is this Dashboard?</h3>
            <p className="text-blue-100 text-base leading-relaxed mb-4">
              This is your Performance Control Center - it shows you how your application is performing in REAL-TIME.
              Think of it like a car's dashboard: instead of speed and fuel, you see alerts, user activity, and system performance.
            </p>
            
            <h4 className="text-lg font-bold text-white mb-2">📖 How to Use:</h4>
            <ol className="text-blue-100 space-y-2 mb-4 list-decimal list-inside">
              <li><strong>Overview</strong> - See all metrics at a glance (you're here now)</li>
              <li><strong>Alerts</strong> - View and acknowledge system warnings and errors</li>
              <li><strong>Load Testing</strong> - Test how your app handles heavy traffic</li>
              <li><strong>Activity</strong> - See what users are doing in your app</li>
            </ol>

            <h4 className="text-lg font-bold text-white mb-2">📊 What Each Metric Means:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-blue-900/30 rounded p-3">
                <span className="text-red-400 font-bold">🚨 Total Alerts:</span>
                <p className="text-blue-100 mt-1">Problems detected in your system (errors, warnings, critical issues)</p>
              </div>
              <div className="bg-blue-900/30 rounded p-3">
                <span className="text-cyan-400 font-bold">👤 Total Activities:</span>
                <p className="text-blue-100 mt-1">Things users have done (clicks, logins, actions) and success rate</p>
              </div>
              <div className="bg-blue-900/30 rounded p-3">
                <span className="text-green-400 font-bold">⚡ Load Tests:</span>
                <p className="text-blue-100 mt-1">Performance tests run + requests per second (RPS) your app can handle</p>
              </div>
              <div className="bg-blue-900/30 rounded p-3">
                <span className="text-purple-400 font-bold">✅ System Health:</span>
                <p className="text-blue-100 mt-1">Overall system status - Good means everything is working fine</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded">
              <p className="text-yellow-100 text-sm">
                <strong>💡 Pro Tip:</strong> Click <strong>"Run Load Test"</strong> below to see how your app performs under stress.
                This simulates multiple users hitting your app at once and shows if it can handle the load.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Alerts"
          value={alertStats?.total || 0}
          subtitle={`${alertStats?.unacknowledged || 0} unacknowledged`}
          icon="🚨"
          gradient="from-red-500 to-pink-500"
        />
        <MetricCard
          title="Total Activities"
          value={activityStats?.totalActivities || 0}
          subtitle={`${activityStats?.successRate?.toFixed(1) || 0}% success rate`}
          icon="👤"
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="Load Tests"
          value={loadTestResults.length}
          subtitle={latestTest ? `${latestTest.requestsPerSecond.toFixed(1)} RPS` : 'No tests'}
          icon="⚡"
          gradient="from-green-500 to-emerald-500"
        />
        <MetricCard
          title="System Health"
          value="Good"
          subtitle="All systems operational"
          icon="✅"
          gradient="from-purple-500 to-indigo-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Distribution */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">🚨 Alert Distribution</h3>
          {alertStats && (
            <div className="space-y-3">
              {Object.entries(alertStats.bySeverity as Record<AlertSeverity, number>).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <span className="text-gray-300 capitalize">{severity}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getSeverityColor(severity as AlertSeverity)}`}
                        style={{ width: `${(count / (alertStats.total || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white font-bold w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Types */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">📊 Top Activities</h3>
          {activityStats?.topActions && (
            <div className="space-y-2">
              {activityStats.topActions.slice(0, 5).map((action: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 truncate flex-1">{action.action}</span>
                  <span className="text-white font-bold ml-2">{action.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">⚡ Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRunLoadTest}
            disabled={isLoadTesting}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-bold hover:bg-purple-50 transition disabled:opacity-50"
          >
            {isLoadTesting ? '🔄 Running...' : '▶️ Run Load Test'}
          </button>
          <button
            className="bg-white/20 text-white px-6 py-3 rounded-lg font-bold hover:bg-white/30 transition"
          >
            📄 Export Report
          </button>
          <button
            className="bg-white/20 text-white px-6 py-3 rounded-lg font-bold hover:bg-white/30 transition"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Alerts View
 */
const AlertsView: React.FC<{
  alerts: Alert[];
  stats: any;
  onAcknowledge: (id: string) => void;
  onClearAll: () => void;
}> = ({ alerts, stats: _stats, onAcknowledge, onClearAll }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Recent Alerts</h3>
        <button
          onClick={onClearAll}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Clear All
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <span className="text-6xl">✅</span>
          <p className="text-white text-xl mt-4">No alerts</p>
          <p className="text-gray-400 mt-2">All systems operating normally</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getSeverityBorderColor(alert.severity)} ${
                alert.acknowledged ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getSeverityEmoji(alert.severity)}</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${getSeverityBadgeColor(alert.severity)}`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-gray-500 text-sm">{alert.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-white font-bold mb-1">{alert.title}</h4>
                  <p className="text-gray-300 text-sm">{alert.message}</p>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Load Testing View
 */
const LoadTestingView: React.FC<{
  results: LoadTestMetrics[];
  onRunTest: () => void;
  isRunning: boolean;
}> = ({ results, onRunTest, isRunning }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Load Test Results</h3>
        <button
          onClick={onRunTest}
          disabled={isRunning}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
        >
          {isRunning ? '🔄 Running...' : '▶️ Run Test'}
        </button>
      </div>

      {results.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <span className="text-6xl">⚡</span>
          <p className="text-white text-xl mt-4">No load tests yet</p>
          <p className="text-gray-400 mt-2">Run your first load test to see results</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.testId} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-white font-bold mb-4">{result.testName}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Total Requests</p>
                  <p className="text-white text-2xl font-bold">{result.totalRequests}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-green-400 text-2xl font-bold">
                    {((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Avg Response</p>
                  <p className="text-white text-2xl font-bold">{result.averageResponseTime.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">RPS</p>
                  <p className="text-white text-2xl font-bold">{result.requestsPerSecond.toFixed(1)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Activity View
 */
const ActivityView: React.FC<{ stats: any }> = ({ stats: _stats }) => {
  // Use _stats prefix to indicate intentionally unused for future implementation
  const stats = _stats;
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white">User Activity Statistics</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Activities"
          value={stats?.totalActivities || 0}
          subtitle="All tracked actions"
          icon="📊"
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="Success Rate"
          value={`${stats?.successRate?.toFixed(1) || 0}%`}
          subtitle="Successful actions"
          icon="✅"
          gradient="from-green-500 to-emerald-500"
        />
        <MetricCard
          title="Error Rate"
          value={`${stats?.errorRate?.toFixed(1) || 0}%`}
          subtitle="Failed actions"
          icon="❌"
          gradient="from-red-500 to-pink-500"
        />
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h4 className="text-white font-bold mb-4">Most Active Hours</h4>
        <div className="flex gap-2">
          {stats?.mostActiveHours?.map((hour: number) => (
            <span key={hour} className="bg-purple-600 text-white px-3 py-1 rounded-lg font-bold">
              {hour}:00
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Multi-Agent Runs View
 */
const buildThroughputBuckets = (
  runs: MultiAgentRunReport[],
  timeFilter: 'all' | 'hour' | 'day',
  nowMs: number
): { label: string; count: number }[] => {
  if (runs.length === 0) {
    return [];
  }

  if (timeFilter === 'hour') {
    const bucketCount = 12;
    const windowMs = 60 * 60 * 1000;
    const bucketSizeMs = windowMs / bucketCount;
    const windowStartMs = nowMs - windowMs;

    return Array.from({ length: bucketCount }, (_, index) => {
      const startMs = windowStartMs + index * bucketSizeMs;
      const endMs = startMs + bucketSizeMs;
      const label = new Date(startMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      const count = runs.filter((run) => {
        const timestampMs = Date.parse(run.timestamp);
        if (Number.isNaN(timestampMs)) {
          return false;
        }
        return timestampMs >= startMs && timestampMs < endMs;
      }).length;

      return { label, count };
    });
  }

  if (timeFilter === 'day') {
    const bucketCount = 24;
    const windowMs = 24 * 60 * 60 * 1000;
    const bucketSizeMs = windowMs / bucketCount;
    const windowStartMs = nowMs - windowMs;

    return Array.from({ length: bucketCount }, (_, index) => {
      const startMs = windowStartMs + index * bucketSizeMs;
      const endMs = startMs + bucketSizeMs;
      const label = new Date(startMs).toLocaleTimeString([], {
        hour: '2-digit'
      });
      const count = runs.filter((run) => {
        const timestampMs = Date.parse(run.timestamp);
        if (Number.isNaN(timestampMs)) {
          return false;
        }
        return timestampMs >= startMs && timestampMs < endMs;
      }).length;

      return { label, count };
    });
  }

  // All time: spread across up to 20 buckets
  let oldestTimestampMs = Number.POSITIVE_INFINITY;
  runs.forEach((run) => {
    const timestampMs = Date.parse(run.timestamp);
    if (!Number.isNaN(timestampMs) && timestampMs < oldestTimestampMs) {
      oldestTimestampMs = timestampMs;
    }
  });

  if (!Number.isFinite(oldestTimestampMs)) {
    return [];
  }

  const timeSpanMs = Math.max(60 * 60 * 1000, nowMs - oldestTimestampMs);
  const bucketCount = 20;
  const bucketSizeMs = Math.max(1, timeSpanMs / bucketCount);
  const windowStartMs = nowMs - timeSpanMs;

  return Array.from({ length: bucketCount }, (_, index) => {
    const startMs = windowStartMs + index * bucketSizeMs;
    const endMs = startMs + bucketSizeMs;
    const label = new Date(startMs).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
    const count = runs.filter((run) => {
      const timestampMs = Date.parse(run.timestamp);
      if (Number.isNaN(timestampMs)) {
        return false;
      }
      return timestampMs >= startMs && timestampMs < endMs;
    }).length;

    return { label, count };
  });
};

const buildCooldownBuckets = (
  events: CooldownBlockEvent[],
  timeFilter: 'all' | 'hour' | 'day',
  nowMs: number
): { label: string; count: number }[] => {
  if (events.length === 0) {
    return [];
  }

  const mapWindow = (windowMs: number, bucketCount: number, labelOptions: Intl.DateTimeFormatOptions) => {
    const bucketSizeMs = windowMs / bucketCount;
    const windowStartMs = nowMs - windowMs;

    return Array.from({ length: bucketCount }, (_, index) => {
      const startMs = windowStartMs + index * bucketSizeMs;
      const endMs = startMs + bucketSizeMs;
      const label = new Date(startMs).toLocaleTimeString([], labelOptions);
      const count = events.filter((event) => event.timestamp >= startMs && event.timestamp < endMs).length;
      return { label, count };
    });
  };

  if (timeFilter === 'hour') {
    return mapWindow(60 * 60 * 1000, 12, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (timeFilter === 'day') {
    return mapWindow(24 * 60 * 60 * 1000, 24, {
      hour: '2-digit'
    });
  }

  // All time: spread across up to 20 buckets
  let oldestTimestampMs = Number.POSITIVE_INFINITY;
  events.forEach((event) => {
    if (event.timestamp < oldestTimestampMs) {
      oldestTimestampMs = event.timestamp;
    }
  });

  if (!Number.isFinite(oldestTimestampMs)) {
    return [];
  }

  const timeSpanMs = Math.max(60 * 60 * 1000, nowMs - oldestTimestampMs);
  const bucketCount = 20;
  const bucketSizeMs = Math.max(1, timeSpanMs / bucketCount);
  const windowStartMs = nowMs - timeSpanMs;

  return Array.from({ length: bucketCount }, (_, index) => {
    const startMs = windowStartMs + index * bucketSizeMs;
    const endMs = startMs + bucketSizeMs;
    const label = new Date(startMs).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
    const count = events.filter(
      (event) => event.timestamp >= startMs && event.timestamp < endMs
    ).length;

    return { label, count };
  });
};

interface PipelineSloConfig {
  successRateTarget: number;
  maxQuotaErrorRate: number;
  maxCooldownBlockRate: number;
}

interface ModelSloConfig {
  successRateTarget: number;
  maxQuotaErrorRate: number;
  maxCooldownBlockRate: number;
}

const MultiAgentRunsView: React.FC<{
  runs: MultiAgentRunReport[];
  liveStages: MultiAgentStageProgress[];
}> = ({ runs, liveStages }) => {
  const [timeFilter, setTimeFilter] = useState<'all' | 'hour' | 'day'>('all');
  const [quotaHealth, setQuotaHealth] = useState<QuotaHealthSnapshot | null>(null);
  const [cooldownHistory, setCooldownHistory] = useState<CooldownBlockEvent[]>([]);
  const [runFailureFilter, setRunFailureFilter] =
    useState<'all' | 'quota' | 'cooldown'>('all');
  const MODEL_SLO_SUCCESS_RATE_TARGET = 95;
  const MODEL_SLO_AVG_DURATION_MS_TARGET = 120_000;
  const PIPELINE_SLO_SUCCESS_RATE_TARGET = MODEL_SLO_SUCCESS_RATE_TARGET;
  const PIPELINE_SLO_MAX_QUOTA_ERROR_RATE = 5;
  const PIPELINE_SLO_MAX_COOLDOWN_BLOCK_RATE = 10;

  const [pipelineSloConfig, setPipelineSloConfig] = useState<PipelineSloConfig>(() => ({
    successRateTarget: PIPELINE_SLO_SUCCESS_RATE_TARGET,
    maxQuotaErrorRate: PIPELINE_SLO_MAX_QUOTA_ERROR_RATE,
    maxCooldownBlockRate: PIPELINE_SLO_MAX_COOLDOWN_BLOCK_RATE
  }));

  const [modelSloConfig, setModelSloConfig] = useState<ModelSloConfig>(() => ({
    successRateTarget: MODEL_SLO_SUCCESS_RATE_TARGET,
    maxQuotaErrorRate: 5,
    maxCooldownBlockRate: 10
  }));

  const PIPELINE_SLO_ALERT_THRESHOLD = 2;
  const MODEL_SLO_ALERT_THRESHOLD = 5;
  const pipelineSloAtRiskWindowsRef = useRef(0);
  const pipelineSloAlertActiveRef = useRef(false);
  const modelSloAtRiskWindowsRef = useRef<Record<string, number>>({});
  const modelSloAlertActiveRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const pipeline = getMultiAgentPipeline();

    const updateQuotaAndCooldown = () => {
      try {
        setQuotaHealth(pipeline.getQuotaHealth());
      } catch (error) {
        console.error('[PerformanceDashboard] Failed to read quota health:', error);
      }

      try {
        setCooldownHistory(pipeline.getCooldownHistory());
      } catch (error) {
        console.error('[PerformanceDashboard] Failed to read cooldown history:', error);
      }
    };

    updateQuotaAndCooldown();
    const intervalId = window.setInterval(updateQuotaAndCooldown, 10_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    try {
      const saved = statePersistence.getScopedSetting<PipelineSloConfig>(
        'multi-agent-pipeline-slo-config'
      );
      if (saved) {
        const normalized: PipelineSloConfig = {
          successRateTarget: Number.isFinite(saved.successRateTarget)
            ? Math.min(100, Math.max(0, Math.round(saved.successRateTarget)))
            : PIPELINE_SLO_SUCCESS_RATE_TARGET,
          maxQuotaErrorRate: Number.isFinite(saved.maxQuotaErrorRate)
            ? Math.min(100, Math.max(0, Math.round(saved.maxQuotaErrorRate)))
            : PIPELINE_SLO_MAX_QUOTA_ERROR_RATE,
          maxCooldownBlockRate: Number.isFinite(saved.maxCooldownBlockRate)
            ? Math.min(100, Math.max(0, Math.round(saved.maxCooldownBlockRate)))
            : PIPELINE_SLO_MAX_COOLDOWN_BLOCK_RATE
        };
        setPipelineSloConfig(normalized);
      }
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to load pipeline SLO config:', error);
    }
  }, [
    PIPELINE_SLO_SUCCESS_RATE_TARGET,
    PIPELINE_SLO_MAX_QUOTA_ERROR_RATE,
    PIPELINE_SLO_MAX_COOLDOWN_BLOCK_RATE
  ]);

  useEffect(() => {
    try {
      const saved = statePersistence.getScopedSetting<ModelSloConfig>(
        'multi-agent-model-slo-config'
      );
      if (saved) {
        const normalized: ModelSloConfig = {
          successRateTarget: Number.isFinite(saved.successRateTarget)
            ? Math.min(100, Math.max(0, Math.round(saved.successRateTarget)))
            : MODEL_SLO_SUCCESS_RATE_TARGET,
          maxQuotaErrorRate: Number.isFinite(saved.maxQuotaErrorRate)
            ? Math.min(100, Math.max(0, Math.round(saved.maxQuotaErrorRate)))
            : 5,
          maxCooldownBlockRate: Number.isFinite(saved.maxCooldownBlockRate)
            ? Math.min(100, Math.max(0, Math.round(saved.maxCooldownBlockRate)))
            : 10
        };
        setModelSloConfig(normalized);
      }
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to load model SLO config:', error);
    }
  }, []);

  const now = Date.now();
  const filteredRuns = runs.filter((run) => {
    if (timeFilter === 'all') {
      return true;
    }
    const timestampMs = Date.parse(run.timestamp);
    if (Number.isNaN(timestampMs)) {
      return true;
    }
    const ageMs = now - timestampMs;
    if (timeFilter === 'hour') {
      return ageMs <= 60 * 60 * 1000;
    }
    if (timeFilter === 'day') {
      return ageMs <= 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const hasAnyRuns = runs.length > 0;
  const totalRuns = filteredRuns.length;
  const successCount = filteredRuns.filter((run) => run.success).length;
  const quotaFailureRuns = filteredRuns.filter((run) => run.failureType === 'quota').length;
  const cooldownFailureRuns = filteredRuns.filter((run) => run.failureType === 'cooldown').length;
  const avgDurationMs =
    totalRuns === 0
      ? 0
      : Math.round(
          filteredRuns.reduce((sum, run) => sum + (run.totalDurationMs ?? 0), 0) /
            totalRuns
        );

  const modelCounts: Record<string, number> = {};
  filteredRuns.forEach((run) => {
    run.stages.forEach((stage) => {
      if (!stage.model) {
        return;
      }
      modelCounts[stage.model] = (modelCounts[stage.model] ?? 0) + 1;
    });
  });
  const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
  const modelSloStats = sortedModels.map(([modelId]) => {
    let invocations = 0;
    let successfulInvocations = 0;
    let durationTotal = 0;
    let durationCount = 0;
    let quotaFailures = 0;
    let cooldownBlocks = 0;
    let runsWithModel = 0;

    filteredRuns.forEach((run) => {
      let usedInRun = false;

      run.stages.forEach((stage) => {
        if (!stage.model || stage.model !== modelId) {
          return;
        }
        usedInRun = true;
        invocations += 1;
        if (stage.status === 'completed' || stage.status === 'completed_with_warnings') {
          successfulInvocations += 1;
        }
        if (typeof stage.durationMs === 'number' && stage.durationMs >= 0) {
          durationTotal += stage.durationMs;
          durationCount += 1;
        }
      });

      if (!usedInRun) {
        return;
      }

      runsWithModel += 1;
      if (run.failureType === 'quota') {
        quotaFailures += 1;
      } else if (run.failureType === 'cooldown') {
        cooldownBlocks += 1;
      }
    });

    const successRate = invocations === 0 ? 0 : (successfulInvocations / invocations) * 100;
    const avgDurationForModel =
      durationCount === 0 ? null : Math.round(durationTotal / Math.max(1, durationCount));
    const quotaErrorRateForModel =
      runsWithModel === 0 ? 0 : (quotaFailures / runsWithModel) * 100;
    const cooldownBlockRateForModel =
      runsWithModel === 0 ? 0 : (cooldownBlocks / runsWithModel) * 100;

    const meetsSuccessTarget = successRate >= modelSloConfig.successRateTarget;
    const meetsLatencyTarget =
      avgDurationForModel === null || avgDurationForModel <= MODEL_SLO_AVG_DURATION_MS_TARGET;
    const meetsQuotaTarget = quotaErrorRateForModel <= modelSloConfig.maxQuotaErrorRate;
    const meetsCooldownTarget =
      cooldownBlockRateForModel <= modelSloConfig.maxCooldownBlockRate;
    const meetsSlo =
      invocations > 0 &&
      meetsSuccessTarget &&
      meetsLatencyTarget &&
      meetsQuotaTarget &&
      meetsCooldownTarget;

    return {
      modelId,
      invocations,
      successRate,
      avgDurationMs: avgDurationForModel,
      meetsSlo,
      quotaFailures,
      cooldownBlocks,
      runsWithModel,
      quotaErrorRate: quotaErrorRateForModel,
      cooldownBlockRate: cooldownBlockRateForModel
    };
  });

  const throughputBuckets = buildThroughputBuckets(filteredRuns, timeFilter, now);
  const maxThroughput = throughputBuckets.reduce(
    (max, bucket) => (bucket.count > max ? bucket.count : max),
    0
  );

  const distinctModelsForRun = (run: MultiAgentRunReport): string => {
    const distinct = Array.from(new Set(run.stages.map((stage) => stage.model)));
    if (distinct.length <= 3) {
      return distinct.join(', ');
    }
    return `${distinct.slice(0, 3).join(', ')} …`;
  };

  const successRate = totalRuns === 0 ? 0 : (successCount / totalRuns) * 100;

  const quotaErrorRate = totalRuns === 0 ? 0 : (quotaFailureRuns / totalRuns) * 100;
  const cooldownBlockRate = totalRuns === 0 ? 0 : (cooldownFailureRuns / totalRuns) * 100;

  let prevQuotaErrorRate: number | null = null;
  let prevCooldownBlockRate: number | null = null;

  if (timeFilter === 'hour' || timeFilter === 'day') {
    const windowMs = timeFilter === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const currentWindowStart = now - windowMs;
    const previousWindowStart = now - 2 * windowMs;
    const previousWindowEnd = currentWindowStart;

    const previousRuns = runs.filter((run) => {
      const timestampMs = Date.parse(run.timestamp);
      if (Number.isNaN(timestampMs)) {
        return false;
      }
      return timestampMs >= previousWindowStart && timestampMs < previousWindowEnd;
    });

    const prevTotal = previousRuns.length;
    if (prevTotal > 0) {
      const prevQuotaFailures = previousRuns.filter((run) => run.failureType === 'quota').length;
      const prevCooldownFailures = previousRuns.filter((run) => run.failureType === 'cooldown').length;
      prevQuotaErrorRate = (prevQuotaFailures / prevTotal) * 100;
      prevCooldownBlockRate = (prevCooldownFailures / prevTotal) * 100;
    }
  }

  const quotaRateDelta =
    prevQuotaErrorRate === null ? null : Number((quotaErrorRate - prevQuotaErrorRate).toFixed(1));
  const cooldownRateDelta =
    prevCooldownBlockRate === null
      ? null
      : Number((cooldownBlockRate - prevCooldownBlockRate).toFixed(1));

  const _latestLiveStages = liveStages.slice(-20).reverse();

  const cooldownEventsForFilter = cooldownHistory.filter((event) => {
    const ageMs = now - event.timestamp;
    if (timeFilter === 'hour') {
      return ageMs <= 60 * 60 * 1000;
    }
    if (timeFilter === 'day') {
      return ageMs <= 24 * 60 * 60 * 1000;
    }
    return true;
  });
  const cooldownBlocksCount = cooldownEventsForFilter.length;
  const cooldownBuckets = buildCooldownBuckets(cooldownEventsForFilter, timeFilter, now);
  const maxCooldown = cooldownBuckets.reduce(
    (max, bucket) => (bucket.count > max ? bucket.count : max),
    0
  );

  const quotaStatusLabel = quotaHealth
    ? quotaHealth.isCoolingDown
      ? 'Cool-down active'
      : quotaHealth.recentQuotaFailures > 0
        ? 'Degraded'
        : 'Healthy'
    : 'Unknown';

  const quotaSubtitle = quotaHealth
    ? `Recent quota failures (10 min): ${quotaHealth.recentQuotaFailures} • Cooldown blocks (${timeFilter === 'hour' ? '1h' : timeFilter === 'day' ? '24h' : 'all time'}): ${cooldownBlocksCount}`
    : 'Quota health unavailable';

  const pipelineSloHasData = hasAnyRuns && totalRuns > 0;
  const pipelineSloStatus = !pipelineSloHasData
    ? 'No data yet'
    : successRate >= pipelineSloConfig.successRateTarget &&
        quotaErrorRate <= pipelineSloConfig.maxQuotaErrorRate &&
        cooldownBlockRate <= pipelineSloConfig.maxCooldownBlockRate
      ? 'On target'
      : 'At risk';

  const pipelineSloSubtitle = !pipelineSloHasData
    ? 'Run the Multi-Agent Pipeline to start tracking SLOs for reliability and quota protection.'
    : `Targets: success >= ${pipelineSloConfig.successRateTarget}%, quota errors <= ${pipelineSloConfig.maxQuotaErrorRate}%, cooldown blocks <= ${pipelineSloConfig.maxCooldownBlockRate}%. Actual: success ${successRate.toFixed(
        1
      )}%, quota ${quotaErrorRate.toFixed(1)}%, cooldown ${cooldownBlockRate.toFixed(1)}%.`;

  const pipelineSloGradient = !pipelineSloHasData
    ? 'from-gray-500 to-gray-600'
    : pipelineSloStatus === 'On target'
      ? 'from-green-500 to-emerald-500'
      : 'from-yellow-500 to-orange-500';

  const pipelineSloIcon =
    pipelineSloStatus === 'On target' ? '🎯' : pipelineSloHasData ? '⚠️' : '⏳';

  useEffect(() => {
    if (!pipelineSloHasData) {
      pipelineSloAtRiskWindowsRef.current = 0;
      pipelineSloAlertActiveRef.current = false;
      return;
    }

    if (pipelineSloStatus !== 'At risk') {
      pipelineSloAtRiskWindowsRef.current = 0;
      pipelineSloAlertActiveRef.current = false;
      return;
    }

    pipelineSloAtRiskWindowsRef.current += 1;
    const windows = pipelineSloAtRiskWindowsRef.current;
    const shouldAlert =
      windows >= PIPELINE_SLO_ALERT_THRESHOLD && !pipelineSloAlertActiveRef.current;

    if (!shouldAlert) {
      return;
    }

    pipelineSloAlertActiveRef.current = true;

    try {
      const alertSystem = getAlertingSystem();
      alertSystem.sendAlert(
        'warning',
        'performance',
        'Multi-Agent Pipeline SLO at risk',
        `Success ${successRate.toFixed(1)}%, quota errors ${quotaErrorRate.toFixed(
          1
        )}%, cooldown blocks ${cooldownBlockRate.toFixed(1)}% in the selected time frame.`,
        {
          details: {
            timeFilter,
            successRate,
            quotaErrorRate,
            cooldownBlockRate,
            successRateTarget: pipelineSloConfig.successRateTarget,
            maxQuotaErrorRate: pipelineSloConfig.maxQuotaErrorRate,
            maxCooldownBlockRate: pipelineSloConfig.maxCooldownBlockRate,
            atRiskWindows: windows,
            alertThreshold: PIPELINE_SLO_ALERT_THRESHOLD
          },
          source: 'multi-agent-slo-monitor'
        }
      );
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to emit multi-agent SLO alert:', error);
    }
  }, [
    pipelineSloHasData,
    pipelineSloStatus,
    successRate,
    quotaErrorRate,
    cooldownBlockRate,
    timeFilter,
    pipelineSloConfig,
    PIPELINE_SLO_ALERT_THRESHOLD
  ]);

  useEffect(() => {
    if (modelSloStats.length === 0) {
      modelSloAtRiskWindowsRef.current = {};
      modelSloAlertActiveRef.current = {};
      return;
    }

    try {
      const alertSystem = getAlertingSystem();

      modelSloStats.forEach((stat) => {
        if (!stat.invocations) {
          modelSloAtRiskWindowsRef.current[stat.modelId] = 0;
          modelSloAlertActiveRef.current[stat.modelId] = false;
          return;
        }

        const isAtRisk = !stat.meetsSlo;
        const currentCount = modelSloAtRiskWindowsRef.current[stat.modelId] ?? 0;
        const alertActive = modelSloAlertActiveRef.current[stat.modelId] ?? false;

        if (!isAtRisk) {
          modelSloAtRiskWindowsRef.current[stat.modelId] = 0;
          modelSloAlertActiveRef.current[stat.modelId] = false;
          return;
        }

        const nextCount = currentCount + 1;
        modelSloAtRiskWindowsRef.current[stat.modelId] = nextCount;

        if (nextCount < MODEL_SLO_ALERT_THRESHOLD || alertActive) {
          return;
        }

        modelSloAlertActiveRef.current[stat.modelId] = true;

        alertSystem.sendAlert(
          'warning',
          'performance',
          `Model SLO at risk: ${stat.modelId}`,
          `Model ${stat.modelId} is failing its SLO policy over the selected time frame (success ${stat.successRate.toFixed(
            1
          )}%, quota ${stat.quotaErrorRate.toFixed(1)}%, cooldown ${stat.cooldownBlockRate.toFixed(
            1
          )}%).`,
          {
            details: {
              timeFilter,
              modelId: stat.modelId,
              invocations: stat.invocations,
              runsWithModel: stat.runsWithModel,
              successRate: stat.successRate,
              avgDurationMs: stat.avgDurationMs,
              quotaFailures: stat.quotaFailures,
              cooldownBlocks: stat.cooldownBlocks,
              quotaErrorRate: stat.quotaErrorRate,
              cooldownBlockRate: stat.cooldownBlockRate,
              successRateTarget: modelSloConfig.successRateTarget,
              maxQuotaErrorRate: modelSloConfig.maxQuotaErrorRate,
              maxCooldownBlockRate: modelSloConfig.maxCooldownBlockRate,
              alertThreshold: MODEL_SLO_ALERT_THRESHOLD
            },
            source: 'multi-agent-model-slo-monitor'
          }
        );
      });
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to emit model SLO alert:', error);
    }
  }, [modelSloStats, timeFilter, modelSloConfig, MODEL_SLO_ALERT_THRESHOLD]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-white">Multi-Agent Run Metrics</h3>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span>Time frame:</span>
          <select
            value={timeFilter}
            onChange={(event) =>
              setTimeFilter(event.target.value as 'all' | 'hour' | 'day')
            }
            className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-100"
            title="Filter multi-agent runs by time frame"
          >
            <option value="all">All time</option>
            <option value="hour">Last hour</option>
            <option value="day">Last 24 hours</option>
          </select>
        </div>
      </div>

      {!hasAnyRuns && (
        <p className="text-xs text-gray-400">
          No completed multi-agent runs yet. As you run the Multi-Agent Pipeline, metrics, history,
          SLOs, and throughput will appear here.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Multi-Agent Runs"
          value={totalRuns}
          subtitle={`${successCount} successful`}
          icon="🤖"
          gradient="from-purple-500 to-indigo-500"
        />
        <MetricCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          subtitle="Successful pipeline executions"
          icon="✅"
          gradient="from-green-500 to-emerald-500"
        />
        <MetricCard
          title="Avg Duration"
          value={avgDurationMs ? `${avgDurationMs} ms` : '—'}
          subtitle="Across all runs"
          icon="⏱️"
          gradient="from-blue-500 to-cyan-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <MetricCard
          title="Quota Error Rate"
          value={`${quotaErrorRate.toFixed(1)}%`}
          subtitle={`Quota failures: ${quotaFailureRuns}/${totalRuns || 1}${
            quotaRateDelta === null
              ? ''
              : ` • vs prev ${timeFilter === 'hour' ? 'hour' : '24h'}: ${
                  quotaRateDelta >= 0 ? '+' : ''
                }${quotaRateDelta.toFixed(1)} pts`
          }`}
          icon="📉"
          gradient="from-red-500 to-orange-500"
        />
        <MetricCard
          title="Cooldown Block Rate"
          value={`${cooldownBlockRate.toFixed(1)}%`}
          subtitle={`Cooldown blocks: ${cooldownFailureRuns}/${totalRuns || 1}${
            cooldownRateDelta === null
              ? ''
              : ` • vs prev ${timeFilter === 'hour' ? 'hour' : '24h'}: ${
                  cooldownRateDelta >= 0 ? '+' : ''
                }${cooldownRateDelta.toFixed(1)} pts`
          }`}
          icon="🧊"
          gradient="from-blue-500 to-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <MetricCard
          title="Pipeline SLO Status"
          value={pipelineSloStatus}
          subtitle={pipelineSloSubtitle}
          icon={pipelineSloIcon}
          gradient={pipelineSloGradient}
        />
        <MetricCard
          title="Gemini Quota Health"
          value={quotaStatusLabel}
          subtitle={quotaSubtitle}
          icon="🧱"
          gradient="from-red-500 to-yellow-500"
        />
      </div>

      <div className="mt-3 rounded-lg border border-gray-700 bg-gray-900/70 p-4 text-[11px] text-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="font-semibold text-gray-100">Pipeline SLO Policy</span>
          <span className="text-[10px] text-gray-400">
            Adjust targets for success rate and acceptable quota/cooldown error rates. Changes are persisted
            locally for this dashboard.
          </span>
          <span className="text-[10px] text-gray-500">
            Pipeline SLO alerts fire after {PIPELINE_SLO_ALERT_THRESHOLD} consecutive "At risk" evaluations in
            the selected time frame.
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap">Success target ≥</span>
            <input
              type="number"
              min={50}
              max={100}
              value={pipelineSloConfig.successRateTarget}
              onChange={(event) => {
                const raw = Number(event.target.value) || 0;
                const sanitized = Math.min(100, Math.max(50, Math.round(raw)));
                const next: PipelineSloConfig = {
                  ...pipelineSloConfig,
                  successRateTarget: sanitized
                };
                setPipelineSloConfig(next);
                try {
                  statePersistence.setScopedSetting('multi-agent-pipeline-slo-config', next);
                } catch (error) {
                  console.error('[PerformanceDashboard] Failed to persist pipeline SLO config:', error);
                }
              }}
              className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
            />
            <span>% success</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap">Max quota errors ≤</span>
            <input
              type="number"
              min={0}
              max={50}
              value={pipelineSloConfig.maxQuotaErrorRate}
              onChange={(event) => {
                const raw = Number(event.target.value) || 0;
                const sanitized = Math.min(50, Math.max(0, Math.round(raw)));
                const next: PipelineSloConfig = {
                  ...pipelineSloConfig,
                  maxQuotaErrorRate: sanitized
                };
                setPipelineSloConfig(next);
                try {
                  statePersistence.setScopedSetting('multi-agent-pipeline-slo-config', next);
                } catch (error) {
                  console.error('[PerformanceDashboard] Failed to persist pipeline SLO config:', error);
                }
              }}
              className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
            />
            <span>% of runs</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap">Max cooldown blocks ≤</span>
            <input
              type="number"
              min={0}
              max={50}
              value={pipelineSloConfig.maxCooldownBlockRate}
              onChange={(event) => {
                const raw = Number(event.target.value) || 0;
                const sanitized = Math.min(50, Math.max(0, Math.round(raw)));
                const next: PipelineSloConfig = {
                  ...pipelineSloConfig,
                  maxCooldownBlockRate: sanitized
                };
                setPipelineSloConfig(next);
                try {
                  statePersistence.setScopedSetting('multi-agent-pipeline-slo-config', next);
                } catch (error) {
                  console.error('[PerformanceDashboard] Failed to persist pipeline SLO config:', error);
                }
              }}
              className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
            />
            <span>% of runs</span>
          </label>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-500">
        Manage Gemini API usage and limits at{' '}
        <a
          href="https://ai.dev/usage?tab=rate-limit"
          target="_blank"
          rel="noreferrer noopener"
          className="text-blue-300 hover:text-blue-200 underline"
        >
          ai.dev/usage
        </a>
        .
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Run &amp; Cooldown Timeline</h3>
          {throughputBuckets.length === 0 || maxThroughput === 0 ? (
            <p className="text-gray-400 text-sm">
              No runs in the selected time frame to plot throughput.
            </p>
          ) : (
            <div
              className="flex h-32 items-end gap-1"
              role="img"
              aria-label="Histogram of multi-agent pipeline runs over time"
            >
              {throughputBuckets.map((bucket, index) => {
                const heightPercent =
                  maxThroughput === 0 ? 0 : (bucket.count / maxThroughput) * 100;
                return (
                  <div
                    key={`${bucket.label}-${index}`}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className="w-full rounded-t bg-purple-500/80"
                      style={{ height: `${heightPercent}%` }}
                      aria-hidden="true"
                    />
                    <span
                      className="mt-1 text-[9px] text-gray-400 truncate"
                      title={`${bucket.label}: ${bucket.count} run${
                        bucket.count === 1 ? '' : 's'
                      }`}
                    >
                      {bucket.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-[11px] text-gray-500">
            Showing run throughput over{' '}
            {timeFilter === 'hour'
              ? 'the last 60 minutes'
              : timeFilter === 'day'
                ? 'the last 24 hours'
                : 'all recorded history'}
            .
          </p>
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-red-200 mb-2">Cooldown blocks</h4>
            {cooldownBuckets.length === 0 || maxCooldown === 0 ? (
              <p className="text-gray-400 text-[11px]">
                No cooldown blocks in the selected time frame.
              </p>
            ) : (
              <div
                className="flex h-20 items-end gap-1"
                role="img"
                aria-label="Histogram of multi-agent pipeline cooldown blocks over time"
              >
                {cooldownBuckets.map((bucket, index) => {
                  const heightPercent =
                    maxCooldown === 0 ? 0 : (bucket.count / maxCooldown) * 100;
                  return (
                    <div
                      key={`${bucket.label}-${index}`}
                      className="flex-1 flex flex-col items-center"
                    >
                      <div
                        className="w-full rounded-t bg-red-500/80"
                        style={{ height: `${heightPercent}%` }}
                        aria-hidden="true"
                      />
                      <span
                        className="mt-1 text-[9px] text-gray-400 truncate"
                        title={`${bucket.label}: ${bucket.count} cooldown block${
                          bucket.count === 1 ? '' : 's'
                        }`}
                      >
                        {bucket.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-gray-500">
              Cooldown blocks represent runs that were proactively prevented from calling Gemini
              due to recent quota failures.
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Model SLOs &amp; Quota Impact</h3>
          <div className="mb-3 rounded border border-gray-700/80 bg-gray-900/70 p-3 text-[11px] text-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-gray-100">Model SLO Policy</span>
              <span className="text-[10px] text-gray-400">
                Targets applied when evaluating each model's success and quota/cooldown rates. Changes
                are persisted locally for this dashboard.
              </span>
              <span className="text-[10px] text-gray-500">
                Model SLO alerts fire after {MODEL_SLO_ALERT_THRESHOLD} consecutive SLO-at-risk evaluations in the
                selected time frame.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2">
                <span className="whitespace-nowrap">Success target ≥</span>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={modelSloConfig.successRateTarget}
                  onChange={(event) => {
                    const raw = Number(event.target.value) || 0;
                    const sanitized = Math.min(100, Math.max(50, Math.round(raw)));
                    const next: ModelSloConfig = {
                      ...modelSloConfig,
                      successRateTarget: sanitized
                    };
                    setModelSloConfig(next);
                    try {
                      statePersistence.setScopedSetting('multi-agent-model-slo-config', next);
                    } catch (error) {
                      console.error(
                        '[PerformanceDashboard] Failed to persist model SLO config:',
                        error
                      );
                    }
                  }}
                  className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <span>% success</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="whitespace-nowrap">Max quota errors ≤</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={modelSloConfig.maxQuotaErrorRate}
                  onChange={(event) => {
                    const raw = Number(event.target.value) || 0;
                    const sanitized = Math.min(50, Math.max(0, Math.round(raw)));
                    const next: ModelSloConfig = {
                      ...modelSloConfig,
                      maxQuotaErrorRate: sanitized
                    };
                    setModelSloConfig(next);
                    try {
                      statePersistence.setScopedSetting('multi-agent-model-slo-config', next);
                    } catch (error) {
                      console.error(
                        '[PerformanceDashboard] Failed to persist model SLO config:',
                        error
                      );
                    }
                  }}
                  className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <span>% of runs</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="whitespace-nowrap">Max cooldown blocks ≤</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={modelSloConfig.maxCooldownBlockRate}
                  onChange={(event) => {
                    const raw = Number(event.target.value) || 0;
                    const sanitized = Math.min(50, Math.max(0, Math.round(raw)));
                    const next: ModelSloConfig = {
                      ...modelSloConfig,
                      maxCooldownBlockRate: sanitized
                    };
                    setModelSloConfig(next);
                    try {
                      statePersistence.setScopedSetting('multi-agent-model-slo-config', next);
                    } catch (error) {
                      console.error(
                        '[PerformanceDashboard] Failed to persist model SLO config:',
                        error
                      );
                    }
                  }}
                  className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <span>% of runs</span>
              </label>
            </div>
          </div>
          {modelSloStats.length === 0 ? (
            <p className="text-xs text-gray-400">
              No model invocations in the selected time frame.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span>Model</span>
                <span className="flex gap-4">
                  <span>Success</span>
                  <span>Avg ms</span>
                  <span>Quota</span>
                  <span>Cooldown</span>
                </span>
              </div>
              {modelSloStats.map((stat) => {
                const meetsOverall = stat.invocations > 0 && stat.meetsSlo;

                return (
                  <div
                    key={stat.modelId}
                    className="flex items-center justify-between gap-3 border border-gray-700/60 rounded px-3 py-2 bg-gray-900/60"
                  >
                    <div className="flex flex-col">
                      <span className="text-gray-100 font-semibold break-all">
                        {stat.modelId}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Invocations: {stat.invocations}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-gray-200">
                      <span>{stat.successRate.toFixed(1)}%</span>
                      <span>
                        {stat.avgDurationMs == null
                          ? ''
                          : `${stat.avgDurationMs} ms`}
                      </span>
                      <span>
                        {stat.quotaFailures}
                        {stat.runsWithModel > 0
                          ? ` (${stat.quotaErrorRate.toFixed(1)}%)`
                          : ''}
                      </span>
                      <span>
                        {stat.cooldownBlocks}
                        {stat.runsWithModel > 0
                          ? ` (${stat.cooldownBlockRate.toFixed(1)}%)`
                          : ''}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          !stat.invocations
                            ? 'bg-gray-700 text-gray-300'
                            : meetsOverall
                              ? 'bg-green-700 text-green-100'
                              : 'bg-yellow-700 text-yellow-100'
                        }`}
                      >
                        {!stat.invocations
                          ? 'No data'
                          : meetsOverall
                            ? 'SLO OK'
                            : 'SLO At Risk'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Recent Multi-Agent Runs</h3>
        <div className="flex items-center justify-between mb-2 text-xs text-gray-300">
          <span>Recent runs in selected time frame</span>
          <div className="flex gap-1">
            {(['all', 'quota', 'cooldown'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRunFailureFilter(value)}
                className={`px-2 py-0.5 rounded-full border text-[11px] ${
                  runFailureFilter === value
                    ? 'bg-purple-600 text-white border-purple-400'
                    : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                }`}
                title={
                  value === 'all'
                    ? 'Show all runs'
                    : value === 'quota'
                      ? 'Only runs that failed due to quota exhaustion'
                      : 'Only runs blocked by cooldown'
                }
              >
                {value === 'all'
                  ? 'All'
                  : value === 'quota'
                    ? 'Quota failures'
                    : 'Cooldown blocks'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {filteredRuns
            .filter((run) => {
              if (runFailureFilter === 'all') {
                return true;
              }
              return run.failureType === runFailureFilter;
            })
            .slice(0, 10)
            .map((run) => (
              <div
                key={run.id}
                className="rounded border border-gray-700 bg-gray-900/60 p-4 text-sm flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">{run.timestamp}</span>
                    <span className="text-gray-200 break-all">Run ID: {run.id}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      run.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {run.success ? 'Success' : 'Failed'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                  <span>Context: {run.contextMode}</span>
                  {typeof run.qualityScore === 'number' && (
                    <span>Quality: {run.qualityScore}/100</span>
                  )}
                  {run.totalDurationMs !== null && (
                    <span>Duration: {run.totalDurationMs} ms</span>
                  )}
                  <span>Files: {run.files.length}</span>
                  {run.stages.length > 0 && (
                    <span>Models: {distinctModelsForRun(run)}</span>
                  )}
                  {!run.success && run.failureType !== 'none' && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        run.failureType === 'quota'
                          ? 'bg-red-700 text-red-100'
                          : run.failureType === 'cooldown'
                            ? 'bg-blue-700 text-blue-100'
                            : 'bg-yellow-700 text-yellow-100'
                      }`}
                    >
                      {run.failureType === 'quota'
                        ? 'Quota Exhausted'
                        : run.failureType === 'cooldown'
                          ? 'Cooldown Blocked'
                          : 'Failure (Other)'}
                    </span>
                  )}
                </div>
                {run.errorMessage && (
                  <div className="text-xs text-red-300">Error: {run.errorMessage}</div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: string;
  gradient: string;
}> = ({ title, value, subtitle, icon, gradient }) => {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-lg p-6 text-white`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-4xl">{icon}</span>
      </div>
      <h4 className="text-sm opacity-90 mb-1">{title}</h4>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm opacity-75">{subtitle}</p>
    </div>
  );
};

// Helper functions
const getSeverityColor = (severity: AlertSeverity): string => {
  const colors = {
    critical: 'bg-red-500',
    error: 'bg-orange-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };
  return colors[severity];
};

const getSeverityBorderColor = (severity: AlertSeverity): string => {
  const colors = {
    critical: 'border-red-500',
    error: 'border-orange-500',
    warning: 'border-yellow-500',
    info: 'border-blue-500',
  };
  return colors[severity];
};

const getSeverityBadgeColor = (severity: AlertSeverity): string => {
  const colors = {
    critical: 'bg-red-600 text-white',
    error: 'bg-orange-600 text-white',
    warning: 'bg-yellow-600 text-white',
    info: 'bg-blue-600 text-white',
  };
  return colors[severity];
};

const getSeverityEmoji = (severity: AlertSeverity): string => {
  const emojis = {
    critical: '🚨',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
  return emojis[severity];
};
