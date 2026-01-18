/**
 * Testing React Components and Hooks
 * React components for the testing platform (separated from service logic)
 */

import React, { createContext, useContext, useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import {
  TestSuite,
  MockService,
  BenchmarkReport,
  TestingIntegrationService,
  TestingContextType,
} from '../services/TestingIntegrationService';

// React Components
export interface TestingDashboardProps {
  testSuites: TestSuite[];
  onRunTests: (suiteId: string) => void;
  onCreateSuite: (suite: TestSuite) => void;
  onDeleteSuite: (suiteId: string) => void;
}

export const TestingDashboard: React.FC<TestingDashboardProps> = ({
  testSuites,
  onRunTests,
  onCreateSuite,
  onDeleteSuite,
}) => {
  const [activeTab, setActiveTab] = useState<'suites' | 'results' | 'coverage' | 'benchmarks'>('suites');

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div>
          <h2 className="text-xl font-bold">Testing Platform</h2>
          <p className="text-sm text-slate-400">
            {testSuites.length} test suites • {testSuites.filter(s => s.status === 'completed').length} completed
          </p>
        </div>
        <button
          onClick={() => onCreateSuite({
            id: `suite-${Date.now()}`,
            name: 'New Test Suite',
            framework: 'jest',
            files: [],
            configuration: {
              framework: 'jest',
              testEnvironment: 'node',
              coverageThreshold: 80,
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
          })}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          New Test Suite
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {[
          { id: 'suites', label: 'Test Suites', icon: <Play className="w-4 h-4" /> },
          { id: 'results', label: 'Results', icon: <CheckCircle className="w-4 h-4" /> },
          { id: 'coverage', label: 'Coverage', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'benchmarks', label: 'Benchmarks', icon: <Clock className="w-4 h-4" /> },
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
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'suites' && (
          <div className="space-y-4">
            {testSuites.map((suite) => (
              <div key={suite.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{suite.name}</h3>
                    <p className="text-sm text-slate-400">
                      {suite.framework} • {suite.files.length} files • {suite.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRunTests(suite.id)}
                      disabled={suite.status === 'running'}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded text-sm transition-colors"
                    >
                      {suite.status === 'running' ? 'Running...' : 'Run Tests'}
                    </button>
                    <button
                      onClick={() => onDeleteSuite(suite.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
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
        )}

        {activeTab === 'results' && (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a test suite to view results</p>
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="text-center py-8 text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Coverage analysis will be available after running tests</p>
          </div>
        )}

        {activeTab === 'benchmarks' && (
          <div className="text-center py-8 text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Performance benchmarks will be available after test runs</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TestingContext = createContext<TestingContextType | null>(null);

export const TestingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [mockServices, setMockServices] = useState<MockService[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkReport[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testingService = new TestingIntegrationService();

  const createTestSuite = async (suite: TestSuite) => {
    const created = await testingService.createTestSuite(suite.name, suite.files, suite.configuration);
    setTestSuites(prev => [...prev, created]);
  };

  const runTestSuite = async (suiteId: string) => {
    setIsRunning(true);
    try {
      await testingService.runTestSuite(suiteId);
      // Update test suite in state
      setTestSuites(prev => prev.map(suite =>
        suite.id === suiteId ? { ...suite, status: 'completed' } : suite
      ));
    } finally {
      setIsRunning(false);
    }
  };

  const deleteTestSuite = async (suiteId: string) => {
    setTestSuites(prev => prev.filter(suite => suite.id !== suiteId));
  };

  const setupMockService = async (service: MockService) => {
    await testingService.setupMockService(service);
    setMockServices(prev => [...prev, service]);
  };

  const runBenchmarks = async (suiteId: string) => {
    const suite = testSuites.find(s => s.id === suiteId);
    if (suite && suite.results) {
      const report = await testingService.runBenchmarks(suite);
      setBenchmarks(prev => [...prev, report]);
    }
  };

  return (
    <TestingContext.Provider value={{
      testSuites,
      mockServices,
      benchmarks,
      isRunning,
      createTestSuite,
      runTestSuite,
      deleteTestSuite,
      setupMockService,
      runBenchmarks,
    }}>
      {children}
    </TestingContext.Provider>
  );
};

export const useTesting = (): TestingContextType => {
  const context = useContext(TestingContext);
  if (!context) {
    throw new Error('useTesting must be used within TestingProvider');
  }
  return context;
};
