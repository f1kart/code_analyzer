/**
 * Advanced Testing Platform Dashboard
 * Enterprise-grade testing interface with multiple framework support
 * Production-ready with real-time monitoring, coverage analysis, and CI/CD integration
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  BarChart3,
  Zap,
  Shield,
  Database,
  GitBranch,
  Package,
  FileText,
  Activity
} from 'lucide-react';
import { useTesting } from './TestingComponents';

interface TestingDashboardProps {
  className?: string;
  onTestSuiteSelect?: (suiteId: string) => void;
  onTestRun?: (suiteId: string) => void;
  onMockServiceToggle?: (serviceId: string) => void;
}

// Enhanced Testing Dashboard Component (separate from the one in TestingIntegrationService)
export const TestingDashboardComponent: React.FC<TestingDashboardProps> = ({
  className = '',
  onTestSuiteSelect,
  onTestRun,
  onMockServiceToggle,
}) => {
  const {
    testSuites,
    mockServices,
    benchmarks,
    isRunning,
    createTestSuite,
    runTestSuite,
    deleteTestSuite,
    setupMockService,
    runBenchmarks,
  } = useTesting();

  const [activeTab, setActiveTab] = useState<'suites' | 'results' | 'coverage' | 'benchmarks' | 'mocks'>('suites');
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [showCreateSuite, setShowCreateSuite] = useState(false);

  // Calculate summary statistics
  const totalSuites = testSuites.length;
  const runningSuites = testSuites.filter(s => s.status === 'running').length;
  const completedSuites = testSuites.filter(s => s.status === 'completed').length;
  const failedSuites = testSuites.filter(s => s.status === 'failed').length;
  const totalCoverage = testSuites
    .filter(s => s.coverage.overall > 0)
    .reduce((acc, s) => acc + s.coverage.overall, 0) / Math.max(completedSuites, 1);

  return (
    <div className={`h-full flex flex-col bg-slate-950 text-white ${className}`}>
      {/* Header with Statistics */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Testing Platform</h2>
            <p className="text-slate-400">
              Enterprise-grade testing with multi-framework support
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateSuite(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              New Test Suite
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Test Suites</span>
            </div>
            <div className="text-2xl font-bold">{totalSuites}</div>
            <div className="text-xs text-slate-500">{completedSuites} completed</div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Running</span>
            </div>
            <div className="text-2xl font-bold">{runningSuites}</div>
            <div className="text-xs text-slate-500">Currently executing</div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Passed</span>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {testSuites.reduce((acc, s) => acc + (s.results?.passed || 0), 0)}
            </div>
            <div className="text-xs text-slate-500">Total passed tests</div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-400">
              {testSuites.reduce((acc, s) => acc + (s.results?.failed || 0), 0)}
            </div>
            <div className="text-xs text-slate-500">Total failed tests</div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Coverage</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{Math.round(totalCoverage)}%</div>
            <div className="text-xs text-slate-500">Average coverage</div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Performance</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {benchmarks.length > 0 ? Math.round(benchmarks[benchmarks.length - 1]?.metrics[0]?.value || 0) : 0}ms
            </div>
            <div className="text-xs text-slate-500">Last benchmark</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {[
          { id: 'suites', label: 'Test Suites', icon: <Package className="w-4 h-4" /> },
          { id: 'results', label: 'Results', icon: <CheckCircle className="w-4 h-4" /> },
          { id: 'coverage', label: 'Coverage', icon: <Shield className="w-4 h-4" /> },
          { id: 'benchmarks', label: 'Benchmarks', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'mocks', label: 'Mock Services', icon: <Database className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'suites' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-4">
              {testSuites.map((suite) => (
                <div key={suite.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{suite.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          suite.status === 'running' ? 'bg-blue-900/50 text-blue-300' :
                          suite.status === 'completed' ? 'bg-green-900/50 text-green-300' :
                          suite.status === 'failed' ? 'bg-red-900/50 text-red-300' :
                          'bg-gray-900/50 text-gray-300'
                        }`}>
                          {suite.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                        <span>{suite.framework}</span>
                        <span>{suite.files.length} files</span>
                        {suite.results && (
                          <>
                            <span>{suite.results.passed} passed</span>
                            <span>{suite.results.failed} failed</span>
                          </>
                        )}
                        {suite.duration && <span>{suite.duration}ms</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runTestSuite(suite.id)}
                        disabled={suite.status === 'running'}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded text-sm transition-colors"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {suite.status === 'running' ? 'Running...' : 'Run'}
                      </button>
                      <button
                        onClick={() => runBenchmarks(suite.id)}
                        className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        Benchmark
                      </button>
                      <button
                        onClick={() => deleteTestSuite(suite.id)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {suite.results && (
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="bg-green-900/20 p-3 rounded">
                        <div className="text-green-400 font-semibold">{suite.results.passed}</div>
                        <div className="text-slate-400">Passed</div>
                      </div>
                      <div className="bg-red-900/20 p-3 rounded">
                        <div className="text-red-400 font-semibold">{suite.results.failed}</div>
                        <div className="text-slate-400">Failed</div>
                      </div>
                      <div className="bg-yellow-900/20 p-3 rounded">
                        <div className="text-yellow-400 font-semibold">{suite.results.skipped}</div>
                        <div className="text-slate-400">Skipped</div>
                      </div>
                      <div className="bg-blue-900/20 p-3 rounded">
                        <div className="text-blue-400 font-semibold">{suite.coverage.overall}%</div>
                        <div className="text-slate-400">Coverage</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mocks' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-4">
              {mockServices.map((service) => (
                <div key={service.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-slate-400">{service.type} service</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        service.status === 'active' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}>
                        {service.status}
                      </span>
                      <button
                        onClick={() => onMockServiceToggle?.(service.id)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        {service.status === 'active' ? 'Stop' : 'Start'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Mock Responses ({service.responses.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {service.responses.slice(0, 4).map((response, index) => (
                        <div key={response.id} className="bg-slate-800 rounded p-2 text-xs">
                          <div className="text-slate-400">Response {index + 1}</div>
                          <div className="text-white truncate">{JSON.stringify(response.response.body).slice(0, 50)}...</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'benchmarks' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-4">
              {benchmarks.map((benchmark) => (
                <div key={benchmark.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{benchmark.name}</h3>
                    <span className="text-xs text-slate-400">
                      {new Date(benchmark.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {benchmark.metrics.map((metric) => (
                      <div key={metric.name} className="flex items-center justify-between">
                        <span className="text-sm">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${
                            metric.status === 'pass' ? 'text-green-400' :
                            metric.status === 'warn' ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {metric.value}{metric.unit}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            metric.status === 'pass' ? 'bg-green-900/50 text-green-300' :
                            metric.status === 'warn' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300'
                          }`}>
                            {metric.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {benchmark.recommendations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-700">
                      <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                      <ul className="space-y-1">
                        {benchmark.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(activeTab === 'results' || activeTab === 'coverage') && (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Select a test suite to view {activeTab}</p>
              <p className="text-sm">Choose a test suite from the Test Suites tab to see detailed results and coverage.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Test Suite Creation Modal
export const CreateTestSuiteModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (suite: any) => void;
}> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('jest');
  const [testEnvironment, setTestEnvironment] = useState('node');
  const [coverageThreshold, setCoverageThreshold] = useState(80);

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreate({
      name,
      framework,
      testEnvironment,
      coverageThreshold,
      files: [],
      configuration: {
        framework,
        testEnvironment,
        coverageThreshold,
        parallelExecution: true,
        maxConcurrency: 4,
        timeout: 30000,
        retries: 2,
        environmentVariables: {},
        setupScripts: [],
        teardownScripts: [],
      },
      coverage: {
        statements: { total: 0, covered: 0, uncovered: 0, percentage: 0, details: [] },
        branches: { total: 0, covered: 0, uncovered: 0, percentage: 0, details: [] },
        functions: { total: 0, covered: 0, uncovered: 0, percentage: 0, details: [] },
        lines: { total: 0, covered: 0, uncovered: 0, percentage: 0, details: [] },
        overall: 0,
      },
      status: 'pending',
      createdAt: new Date(),
    });

    setName('');
    setFramework('jest');
    setTestEnvironment('node');
    setCoverageThreshold(80);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Create Test Suite</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Suite Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Test Suite"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Test Framework
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Select test framework"
                aria-label="Test framework selection"
              >
                <option value="jest">Jest</option>
                <option value="mocha">Mocha</option>
                <option value="jasmine">Jasmine</option>
                <option value="cypress">Cypress</option>
                <option value="playwright">Playwright</option>
                <option value="vitest">Vitest</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Test Environment
              </label>
              <select
                value={testEnvironment}
                onChange={(e) => setTestEnvironment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Select test environment"
                aria-label="Test environment selection"
              >
                <option value="node">Node.js</option>
                <option value="browser">Browser</option>
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Coverage Threshold (%)
              </label>
              <input
                type="number"
                value={coverageThreshold}
                onChange={(e) => setCoverageThreshold(Number(e.target.value))}
                min="0"
                max="100"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Set coverage threshold percentage"
                aria-label="Coverage threshold percentage"
                placeholder="80"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              Create Suite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export types
export type {
  TestingDashboardProps,
};
