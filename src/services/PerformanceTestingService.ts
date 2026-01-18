interface PerformanceTestConfig {
  name: string;
  description: string;
  type: 'load' | 'stress' | 'spike' | 'volume';
  duration: number; // in seconds
  virtualUsers: number;
  rampUpTime: number; // in seconds
  requestsPerSecond?: number;
  endpoints: string[];
  thinkTime?: number; // in milliseconds
  maxResponseTime?: number; // in milliseconds
  baseUrl?: string; // base URL for endpoints
  method?: string; // HTTP method (GET, POST, etc.)
  headers?: Record<string, string>; // custom headers
  timeout?: number; // request timeout in milliseconds
  body?: string | object; // request body for POST/PUT/PATCH
}

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorsPerSecond: number;
  errorRate: number;
  throughput: number; // bytes per second
  concurrentUsers: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface TestResult {
  testId: string;
  config: PerformanceTestConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  metrics: PerformanceMetrics;
  errors: Array<{
    timestamp: Date;
    endpoint: string;
    error: string;
    responseTime: number;
  }>;
  status: 'passed' | 'failed' | 'warning';
}

interface LoadTestScenario {
  id: string;
  name: string;
  description: string;
  config: PerformanceTestConfig;
  expectedMetrics: Partial<PerformanceMetrics>;
}

export class PerformanceTestingService {
  private activeTests: Map<string, TestResult> = new Map();
  private testHistory: TestResult[] = [];
  private virtualUsers: Map<string, AbortController> = new Map();

  /**
   * Predefined load test scenarios
   */
  private scenarios: LoadTestScenario[] = [
    {
      id: 'light-load',
      name: 'Light Load Test',
      description: 'Test with 10 concurrent users for 5 minutes',
      config: {
        name: 'Light Load Test',
        description: 'Basic load testing with 10 users',
        type: 'load',
        duration: 300, // 5 minutes
        virtualUsers: 10,
        rampUpTime: 60,
        endpoints: ['/api/ai/review', '/api/files'],
        thinkTime: 1000,
        maxResponseTime: 5000,
      },
      expectedMetrics: {
        averageResponseTime: 2000,
        p95ResponseTime: 4000,
        errorRate: 0.05, // 5% error rate
      },
    },
    {
      id: 'heavy-load',
      name: 'Heavy Load Test',
      description: 'Test with 100 concurrent users for 10 minutes',
      config: {
        name: 'Heavy Load Test',
        description: 'Stress testing with 100 users',
        type: 'stress',
        duration: 600, // 10 minutes
        virtualUsers: 100,
        rampUpTime: 120,
        endpoints: ['/api/ai/review', '/api/files', '/api/chat'],
        thinkTime: 500,
        maxResponseTime: 8000,
      },
      expectedMetrics: {
        averageResponseTime: 3000,
        p95ResponseTime: 6000,
        errorRate: 0.1, // 10% error rate
      },
    },
    {
      id: 'spike-test',
      name: 'Spike Test',
      description: 'Sudden spike from 10 to 200 users',
      config: {
        name: 'Spike Test',
        description: 'Test sudden load increase',
        type: 'spike',
        duration: 300,
        virtualUsers: 200,
        rampUpTime: 10,
        endpoints: ['/api/ai/review'],
        thinkTime: 200,
        maxResponseTime: 10000,
      },
      expectedMetrics: {
        averageResponseTime: 5000,
        p95ResponseTime: 10000,
        errorRate: 0.15, // 15% error rate
      },
    },
  ];

  /**
   * Run a performance test
   */
  async runPerformanceTest(config: PerformanceTestConfig): Promise<TestResult> {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    console.log(`🚀 Starting performance test: ${config.name}`);

    const testResult: TestResult = {
      testId,
      config,
      startTime,
      endTime: new Date(),
      duration: 0,
      metrics: this.initializeMetrics(),
      errors: [],
      status: 'passed',
    };

    this.activeTests.set(testId, testResult);

    try {
      // Simulate test execution
      await this.executeTest(testResult);

      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - startTime.getTime();

      // Evaluate test results
      testResult.status = this.evaluateTestResults(testResult);

      console.log(`✅ Performance test completed: ${testResult.status.toUpperCase()}`);

    } catch (error) {
      testResult.status = 'failed';
      console.error('❌ Performance test failed:', error);
    }

    this.testHistory.push(testResult);
    this.activeTests.delete(testId);

    return testResult;
  }

  /**
   * Run a predefined scenario
   */
  async runScenario(scenarioId: string): Promise<TestResult | null> {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error(`Scenario not found: ${scenarioId}`);
      return null;
    }

    return this.runPerformanceTest(scenario.config);
  }

  /**
   * Get all available scenarios
   */
  getScenarios(): LoadTestScenario[] {
    return [...this.scenarios];
  }

  /**
   * Get active tests
   */
  getActiveTests(): TestResult[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Get test history
   */
  getTestHistory(limit?: number): TestResult[] {
    const history = [...this.testHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get test results for a specific test
   */
  getTestResult(testId: string): TestResult | null {
    return this.testHistory.find(test => test.testId === testId) || null;
  }

  /**
   * Generate performance report
   */
  generateReport(testIds: string[]): string {
    const tests = testIds.map(id => this.getTestResult(id)).filter(Boolean) as TestResult[];

    if (tests.length === 0) {
      return 'No test results found for the specified IDs.';
    }

    let report = `# Performance Test Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Tests: ${testIds.length}\n\n`;

    tests.forEach((test, index) => {
      report += `## Test ${index + 1}: ${test.config.name}\n`;
      report += `- **Type**: ${test.config.type}\n`;
      report += `- **Duration**: ${test.duration}ms\n`;
      report += `- **Virtual Users**: ${test.config.virtualUsers}\n`;
      report += `- **Status**: ${test.status.toUpperCase()}\n`;
      report += `- **Total Requests**: ${test.metrics.totalRequests}\n`;
      report += `- **Success Rate**: ${((test.metrics.successfulRequests / test.metrics.totalRequests) * 100).toFixed(1)}%\n`;
      report += `- **Avg Response Time**: ${test.metrics.averageResponseTime}ms\n`;
      report += `- **P95 Response Time**: ${test.metrics.p95ResponseTime}ms\n`;
      report += `- **Errors**: ${test.errors.length}\n\n`;
    });

    return report;
  }

  /**
   * Stop an active test
   */
  stopTest(testId: string): boolean {
    const test = this.activeTests.get(testId);
    if (!test) return false;

    // Abort all virtual users for this test
    const controllers = Array.from(this.virtualUsers.entries())
      .filter(([key]) => key.startsWith(testId))
      .map(([, controller]) => controller);

    controllers.forEach(controller => controller.abort());

    test.endTime = new Date();
    test.duration = test.endTime.getTime() - test.startTime.getTime();
    test.status = 'failed';

    this.testHistory.push(test);
    this.activeTests.delete(testId);

    console.log(`🛑 Stopped performance test: ${testId}`);
    return true;
  }

  /**
   * Execute the actual test
   */
  private async executeTest(testResult: TestResult): Promise<void> {
    const { config } = testResult;

    // Ramp-up period to gradually add users
    if (config.rampUpTime > 0) {
      await this.sleep(config.rampUpTime * 1000);
    }

    // Create virtual users
    const userPromises: Promise<void>[] = [];

    for (let i = 0; i < config.virtualUsers; i++) {
      const userId = `${testResult.testId}_user_${i}`;
      const controller = new AbortController();
      this.virtualUsers.set(userId, controller);

      userPromises.push(this.simulateUser(userId, controller.signal, config, testResult));
    }

    // Wait for all users to complete
    await Promise.allSettled(userPromises);
  }

  /**
   * Execute virtual user making real requests (PRODUCTION)
   */
  private async simulateUser(
    userId: string,
    signal: AbortSignal,
    config: PerformanceTestConfig,
    testResult: TestResult
  ): Promise<void> {
    const endTime = Date.now() + (config.duration * 1000);

    while (Date.now() < endTime && !signal.aborted) {
      try {
        // Select random endpoint
        const endpoint = config.endpoints[Math.floor(Math.random() * config.endpoints.length)];

        // Perform real HTTP request
        const startTime = Date.now();
        await this.performHttpRequest(endpoint, config);
        const responseTime = Date.now() - startTime;

        // Update metrics
        testResult.metrics.totalRequests++;
        testResult.metrics.successfulRequests++;
        testResult.metrics.minResponseTime = Math.min(testResult.metrics.minResponseTime, responseTime);
        testResult.metrics.maxResponseTime = Math.max(testResult.metrics.maxResponseTime, responseTime);

        const totalTime = testResult.metrics.averageResponseTime * (testResult.metrics.successfulRequests - 1) + responseTime;
        testResult.metrics.averageResponseTime = totalTime / testResult.metrics.successfulRequests;

        // Update percentile calculations (simplified)
        if (responseTime > testResult.metrics.p95ResponseTime) {
          testResult.metrics.p95ResponseTime = responseTime;
        }

        // Think time between requests
        if (config.thinkTime) {
          await this.sleep(config.thinkTime);
        }

      } catch (error) {
        // Handle request failure
        testResult.metrics.totalRequests++;
        testResult.metrics.failedRequests++;

        testResult.errors.push({
          timestamp: new Date(),
          endpoint: config.endpoints[0], // Simplified for demo
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: 0,
        });

        // Still apply think time even on errors
        if (config.thinkTime) {
          await this.sleep(config.thinkTime);
        }
      }
    }
  }

  /**
   * Perform real HTTP request (PRODUCTION)
   */
  private async performHttpRequest(endpoint: string, config: PerformanceTestConfig): Promise<void> {
    try {
      // Build full URL
      const baseUrl = config.baseUrl || 'http://localhost:3000';
      const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
      
      // Determine HTTP method
      const method = config.method || 'GET';
      
      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PerformanceTestingService/1.0',
          ...config.headers,
        },
        signal: AbortSignal.timeout(config.timeout || 30000),
      };

      // Add request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method) && config.body) {
        requestOptions.body = typeof config.body === 'string' 
          ? config.body 
          : JSON.stringify(config.body);
      }

      // Perform actual HTTP request
      const response = await fetch(url, requestOptions);
      
      // Check response status
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read response body to complete request
      await response.text();
      
    } catch (error) {
      // Re-throw errors for proper error counting
      if (error instanceof Error) {
        throw new Error(`${endpoint} failed: ${error.message}`);
      }
      throw new Error(`${endpoint} failed: Unknown error`);
    }
  }

  /**
   * Evaluate test results against expected metrics
   */
  private evaluateTestResults(test: TestResult): 'passed' | 'failed' | 'warning' {
    const { metrics, config } = test;

    // Check response time thresholds
    if (config.maxResponseTime && metrics.p95ResponseTime > config.maxResponseTime) {
      return 'failed';
    }

    // Check error rate
    const errorRate = metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;
    if (errorRate > 0.2) { // More than 20% errors
      return 'failed';
    }

    // Check if we met minimum request throughput
    if (metrics.requestsPerSecond < (config.virtualUsers * 0.5)) { // Less than 50% of expected throughput
      return 'warning';
    }

    return 'passed';
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorsPerSecond: 0,
      errorRate: 0,
      throughput: 0,
      concurrentUsers: 0,
      cpuUsage: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up old test history
   */
  cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): void { // 7 days default
    const cutoffTime = Date.now() - maxAge;
    this.testHistory = this.testHistory.filter(test => test.startTime.getTime() > cutoffTime);
  }

  /**
   * Get performance recommendations based on test results
   */
  getRecommendations(testId: string): string[] {
    const test = this.getTestResult(testId);
    if (!test) return [];

    const recommendations: string[] = [];

    if (test.metrics.p95ResponseTime > 5000) {
      recommendations.push('Consider optimizing database queries or caching frequently accessed data');
    }

    if (test.metrics.errorRate > 0.1) {
      recommendations.push('High error rate detected - review error handling and retry mechanisms');
    }

    if (test.metrics.memoryUsage > 80) {
      recommendations.push('Memory usage is high - consider implementing memory pooling or garbage collection optimization');
    }

    if (test.metrics.cpuUsage > 70) {
      recommendations.push('High CPU usage - consider load balancing or optimizing compute-intensive operations');
    }

    return recommendations;
  }
}

// Singleton instance
let performanceTestingService: PerformanceTestingService | null = null;

export function initializePerformanceTesting(): PerformanceTestingService {
  if (!performanceTestingService) {
    performanceTestingService = new PerformanceTestingService();
  }
  return performanceTestingService;
}

export function getPerformanceTestingService(): PerformanceTestingService | null {
  return performanceTestingService;
}
