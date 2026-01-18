import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Log entry interface (matching backend)
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
  tags?: string[];
  spanId?: string;
  traceId?: string;
}

const LoggingDashboard: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, you would fetch from the logging API
      // For now, we'll simulate with mock data
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockLogs: LogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'HTTP Request completed successfully',
          service: 'gemini-ide-backend',
          version: '1.0.0',
          environment: 'development',
          correlationId: 'corr_1234567890_abc123',
          userId: 'user_123',
          method: 'GET',
          url: '/api/admin/providers',
          statusCode: 200,
          duration: 145,
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          tags: ['http', 'success'],
        },
        {
          timestamp: new Date(Date.now() - 5000).toISOString(),
          level: 'warn',
          message: 'Database connection slow',
          service: 'gemini-ide-backend',
          version: '1.0.0',
          environment: 'development',
          correlationId: 'corr_1234567890_def456',
          metadata: {
            operation: 'SELECT',
            table: 'providers',
            duration: 1200,
          },
          tags: ['database', 'performance'],
        },
        {
          timestamp: new Date(Date.now() - 10000).toISOString(),
          level: 'error',
          message: 'Authentication failed for user',
          service: 'gemini-ide-backend',
          version: '1.0.0',
          environment: 'development',
          correlationId: 'corr_1234567890_ghi789',
          userId: 'user_456',
          ip: '192.168.1.101',
          error: {
            name: 'AuthenticationError',
            message: 'Invalid credentials provided',
            code: 'AUTH_001',
          },
          tags: ['security', 'auth'],
        },
        {
          timestamp: new Date(Date.now() - 15000).toISOString(),
          level: 'debug',
          message: 'Cache hit for user preferences',
          service: 'gemini-ide-backend',
          version: '1.0.0',
          environment: 'development',
          correlationId: 'corr_1234567890_jkl012',
          userId: 'user_123',
          metadata: {
            cacheKey: 'user_prefs_123',
            hit: true,
          },
          tags: ['cache', 'debug'],
        },
        {
          timestamp: new Date(Date.now() - 20000).toISOString(),
          level: 'fatal',
          message: 'Database connection pool exhausted',
          service: 'gemini-ide-backend',
          version: '1.0.0',
          environment: 'development',
          correlationId: 'corr_1234567890_mno345',
          error: {
            name: 'DatabaseError',
            message: 'No available connections in pool',
            stack: 'Error: No available connections\n    at Database.query',
          },
          tags: ['database', 'critical'],
        },
      ];

      setLogs(mockLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      console.error('Logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    // Level filter
    if (selectedLevel !== 'all' && log.level !== selectedLevel) return false;

    // Search filter
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Tags filter
    if (selectedTags.length > 0) {
      const hasSelectedTag = selectedTags.some(tag => log.tags?.includes(tag));
      if (!hasSelectedTag) return false;
    }

    return true;
  });

  // Get unique tags from logs
  const uniqueTags = Array.from(new Set(logs.flatMap(log => log.tags || [])));

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get level icon and color
  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'debug':
        return { icon: <DocumentTextIcon className="h-4 w-4" />, color: 'text-gray-500', bgColor: 'bg-gray-50' };
      case 'info':
        return { icon: <CheckCircleIcon className="h-4 w-4" />, color: 'text-blue-500', bgColor: 'bg-blue-50' };
      case 'warn':
        return { icon: <ExclamationTriangleIcon className="h-4 w-4" />, color: 'text-yellow-500', bgColor: 'bg-yellow-50' };
      case 'error':
        return { icon: <XCircleIcon className="h-4 w-4" />, color: 'text-red-500', bgColor: 'bg-red-50' };
      case 'fatal':
        return { icon: <XCircleIcon className="h-4 w-4" />, color: 'text-purple-500', bgColor: 'bg-purple-50' };
      default:
        return { icon: <DocumentTextIcon className="h-4 w-4" />, color: 'text-gray-500', bgColor: 'bg-gray-50' };
    }
  };

  // Toggle log expansion
  const toggleLogExpansion = (timestamp: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(timestamp)) {
      newExpanded.delete(timestamp);
    } else {
      newExpanded.add(timestamp);
    }
    setExpandedLogs(newExpanded);
  };

  // Toggle tag selection
  const toggleTagSelection = (tag: string) => {
    const newSelected = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newSelected);
  };

  // Log entry component
  const LogEntry: React.FC<{ log: LogEntry; index: number }> = ({ log, index: _index }) => {
    const levelInfo = getLevelInfo(log.level);
    const isExpanded = expandedLogs.has(log.timestamp);

    return (
      <div className="border border-gray-200 rounded-lg mb-2">
        <div
          className={`p-4 cursor-pointer hover:bg-gray-50 ${levelInfo.bgColor}`}
          onClick={() => toggleLogExpansion(log.timestamp)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-1 rounded ${levelInfo.bgColor}`}>
                {levelInfo.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${levelInfo.color}`}>{log.level.toUpperCase()}</span>
                  <span className="text-sm text-gray-600">{formatTimestamp(log.timestamp)}</span>
                  {log.correlationId && (
                    <span className="text-xs text-gray-500">ID: {log.correlationId}</span>
                  )}
                </div>
                <p className="text-gray-900 mt-1">{log.message}</p>
                <div className="flex items-center space-x-4 mt-2">
                  {log.method && log.url && (
                    <span className="text-xs text-gray-500">
                      {log.method} {log.url}
                    </span>
                  )}
                  {log.statusCode && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {log.statusCode}
                    </span>
                  )}
                  {log.duration && (
                    <span className="text-xs text-gray-500">{log.duration}ms</span>
                  )}
                  {log.userId && (
                    <span className="text-xs text-gray-500">User: {log.userId}</span>
                  )}
                </div>
                {log.tags && log.tags.length > 0 && (
                  <div className="flex items-center space-x-2 mt-2">
                    {log.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTagSelection(tag);
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ChevronRightIcon
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Request Information</h4>
                <div className="space-y-1">
                  {log.method && <div><span className="font-medium">Method:</span> {log.method}</div>}
                  {log.url && <div><span className="font-medium">URL:</span> {log.url}</div>}
                  {log.statusCode && <div><span className="font-medium">Status:</span> {log.statusCode}</div>}
                  {log.duration && <div><span className="font-medium">Duration:</span> {log.duration}ms</div>}
                  {log.ip && <div><span className="font-medium">IP:</span> {log.ip}</div>}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">System Information</h4>
                <div className="space-y-1">
                  <div><span className="font-medium">Service:</span> {log.service}</div>
                  <div><span className="font-medium">Version:</span> {log.version}</div>
                  <div><span className="font-medium">Environment:</span> {log.environment}</div>
                  {log.userId && <div><span className="font-medium">User ID:</span> {log.userId}</div>}
                  {log.correlationId && <div><span className="font-medium">Correlation ID:</span> {log.correlationId}</div>}
                </div>
              </div>
            </div>

            {log.error && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Error Details</h4>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <div className="text-sm">
                    <div><span className="font-medium">Name:</span> {log.error.name}</div>
                    <div><span className="font-medium">Message:</span> {log.error.message}</div>
                    {log.error.code && <div><span className="font-medium">Code:</span> {log.error.code}</div>}
                    {log.error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-red-700 hover:underline">Stack Trace</summary>
                        <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                          {log.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Metadata</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircleIcon className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={fetchLogs}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logging Dashboard</h1>
          <p className="text-gray-600">Monitor and analyze structured logs across services</p>
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
            onClick={fetchLogs}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <FunnelIcon className="h-4 w-4" />
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Log Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Select log level filter"
                aria-label="Select log level filter"
              >
                <option value="all">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
                <option value="fatal">Fatal</option>
              </select>
            </div>

            {/* Search Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search log messages..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {uniqueTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTagSelection(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {(selectedLevel !== 'all' || searchTerm || selectedTags.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Showing {filteredLogs.length} of {logs.length} logs
              </span>
              <button
                onClick={() => {
                  setSelectedLevel('all');
                  setSearchTerm('');
                  setSelectedTags([]);
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {(['debug', 'info', 'warn', 'error', 'fatal'] as const).map(level => {
          const count = logs.filter(log => log.level === level).length;
          const levelInfo = getLevelInfo(level);
          return (
            <div key={level} className={`p-4 rounded-lg border ${levelInfo.bgColor}`}>
              <div className="flex items-center space-x-2">
                <div className={`p-1 rounded ${levelInfo.bgColor}`}>
                  {levelInfo.icon}
                </div>
                <div>
                  <p className="text-sm text-gray-600">{level.toUpperCase()}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No logs found matching your filters</p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <LogEntry key={`${log.timestamp}-${index}`} log={log} index={index} />
          ))
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Logging Information</h4>
            <p className="text-sm text-blue-700 mt-1">
              This dashboard displays structured logs from all services. Click on any log entry to view detailed information.
              Use filters to narrow down the logs by level, search terms, or tags. Auto-refresh can be enabled for real-time monitoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoggingDashboard;
