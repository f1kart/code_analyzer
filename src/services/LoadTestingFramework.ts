/**
 * Load Testing Framework
 * Enterprise-grade load testing with stress testing and performance regression detection
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

export interface LoadTestConfig {
  name: string;
  targetUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  duration: number; // seconds
  concurrentUsers: number;
  rampUpTime?: number; // seconds
  thinkTime?: number; // milliseconds between requests
}

export interface LoadTestMetrics {
  testId: string;
  testName: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number; // ms
  minResponseTime: number; // ms
  maxResponseTime: number; // ms
  p50ResponseTime: number; // ms
  p95ResponseTime: number; // ms
  p99ResponseTime: number; // ms
  requestsPerSecond: number;
  errorsPerSecond: number;
  throughputKBps: number;
  errors: Array<{ timestamp: Date; error: string; statusCode?: number }>;
}

export interface StressTestConfig extends LoadTestConfig {
  maxUsers: number;
  userIncrementStep: number;
  userIncrementInterval: number; // seconds
  failureThresholdPercent: number; // % of failed requests to stop test
}

export interface PerformanceBenchmark {
  id: string;
  name: string;
  timestamp: Date;
  metrics: LoadTestMetrics;
  baseline?: boolean;
}

export interface RegressionDetection {
  detected: boolean;
  severity: 'none' | 'minor' | 'major' | 'critical';
  regressions: Array<{
    metric: string;
    baseline: number;
    current: number;
    percentageChange: number;
    threshold: number;
  }>;
}

/**
 * Load Testing Framework Service
 */
export class LoadTestingFramework {
  private activeTests: Map<string, AbortController> = new Map();
  private benchmarks: Map<string, PerformanceBenchmark> = new Map();
  private testResults: Map<string, LoadTestMetrics> = new Map();
  
  private regressionThresholds = {
    averageResponseTime: 20, // 20% increase is regression
    p95ResponseTime: 25,
    p99ResponseTime: 30,
    requestsPerSecond: -15, // 15% decrease is regression
    failureRate: 5, // 5% increase is regression
  };

  constructor() {
    console.log('[LoadTesting] Framework initialized');
  }

  /**
   * Run load test
   */
  public async runLoadTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
    const testId = this.generateTestId();
    const abortController = new AbortController();
    this.activeTests.set(testId, abortController);

    console.log(`[LoadTesting] Starting test: ${config.name}`);
    console.log(`  Target: ${config.targetUrl}`);
    console.log(`  Duration: ${config.duration}s`);
    console.log(`  Concurrent users: ${config.concurrentUsers}`);

    const metrics: LoadTestMetrics = {
      testId,
      testName: config.name,
      startTime: new Date(),
      duration: config.duration,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorsPerSecond: 0,
      throughputKBps: 0,
      errors: [],
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;
    const rampUpTime = config.rampUpTime || 0;
    const thinkTime = config.thinkTime || 0;

    try {
      // Create virtual users
      const userPromises: Promise<void>[] = [];
      
      for (let i = 0; i < config.concurrentUsers; i++) {
        // Ramp up delay
        const rampUpDelay = rampUpTime > 0 ? (i / config.concurrentUsers) * rampUpTime * 1000 : 0;
        
        const userPromise = this.runVirtualUser(
          config,
          endTime,
          thinkTime,
          rampUpDelay,
          metrics,
          responseTimes,
          abortController.signal
        );
        
        userPromises.push(userPromise);
      }

      // Wait for all users to complete
      await Promise.all(userPromises);
      
      // Calculate final metrics
      metrics.endTime = new Date();
      const actualDuration = (metrics.endTime.getTime() - metrics.startTime.getTime()) / 1000;
      
      metrics.requestsPerSecond = metrics.totalRequests / actualDuration;
      metrics.errorsPerSecond = metrics.failedRequests / actualDuration;
      
      if (responseTimes.length > 0) {
        responseTimes.sort((a, b) => a - b);
        metrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        metrics.minResponseTime = responseTimes[0];
        metrics.maxResponseTime = responseTimes[responseTimes.length - 1];
        metrics.p50ResponseTime = this.calculatePercentile(responseTimes, 50);
        metrics.p95ResponseTime = this.calculatePercentile(responseTimes, 95);
        metrics.p99ResponseTime = this.calculatePercentile(responseTimes, 99);
      }

      console.log(`[LoadTesting] Test completed: ${config.name}`);
      console.log(`  Total requests: ${metrics.totalRequests}`);
      console.log(`  Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
      console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  P95 response time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
      console.log(`  Requests/sec: ${metrics.requestsPerSecond.toFixed(2)}`);

      // Store results
      this.testResults.set(testId, metrics);
      
      return metrics;
    } catch (error) {
      console.error(`[LoadTesting] Test failed:`, error);
      throw error;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Run virtual user
   */
  private async runVirtualUser(
    config: LoadTestConfig,
    endTime: number,
    thinkTime: number,
    rampUpDelay: number,
    metrics: LoadTestMetrics,
    responseTimes: number[],
    signal: AbortSignal
  ): Promise<void> {
    // Ramp up delay
    if (rampUpDelay > 0) {
      await this.sleep(rampUpDelay);
    }

    while (Date.now() < endTime && !signal.aborted) {
      const requestStart = Date.now();
      
      try {
        const response = await fetch(config.targetUrl, {
          method: config.method,
          headers: config.headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
          signal,
        });

        const requestEnd = Date.now();
        const responseTime = requestEnd - requestStart;
        
        responseTimes.push(responseTime);
        metrics.totalRequests++;
        
        if (response.ok) {
          metrics.successfulRequests++;
        } else {
          metrics.failedRequests++;
          metrics.errors.push({
            timestamp: new Date(),
            error: `HTTP ${response.status}: ${response.statusText}`,
            statusCode: response.status,
          });
        }
        
        // Calculate throughput
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        metrics.throughputKBps += contentLength / 1024;
        
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          metrics.totalRequests++;
          metrics.failedRequests++;
          metrics.errors.push({
            timestamp: new Date(),
            error: error.message,
          });
        }
      }

      // Think time
      if (thinkTime > 0 && Date.now() < endTime) {
        await this.sleep(thinkTime);
      }
    }
  }

  /**
   * Run stress test
   */
  public async runStressTest(config: StressTestConfig): Promise<LoadTestMetrics[]> {
    console.log(`[LoadTesting] Starting stress test: ${config.name}`);
    console.log(`  Max users: ${config.maxUsers}`);
    console.log(`  Increment: ${config.userIncrementStep} users every ${config.userIncrementInterval}s`);

    const results: LoadTestMetrics[] = [];
    let currentUsers = config.concurrentUsers;

    while (currentUsers <= config.maxUsers) {
      console.log(`\n[LoadTesting] Testing with ${currentUsers} concurrent users...`);
      
      const testConfig: LoadTestConfig = {
        ...config,
        name: `${config.name} - ${currentUsers} users`,
        concurrentUsers: currentUsers,
        duration: config.userIncrementInterval,
      };

      const metrics = await this.runLoadTest(testConfig);
      results.push(metrics);

      // Check failure threshold
      const failureRate = (metrics.failedRequests / metrics.totalRequests) * 100;
      if (failureRate > config.failureThresholdPercent) {
        console.log(`[LoadTesting] Stress test stopped: Failure threshold exceeded (${failureRate.toFixed(2)}%)`);
        break;
      }

      currentUsers += config.userIncrementStep;
    }

    console.log(`\n[LoadTesting] Stress test completed`);
    this.printStressTestSummary(results);

    return results;
  }

  /**
   * Save benchmark
   */
  public saveBenchmark(name: string, metrics: LoadTestMetrics, baseline: boolean = false): void {
    const benchmark: PerformanceBenchmark = {
      id: this.generateBenchmarkId(),
      name,
      timestamp: new Date(),
      metrics,
      baseline,
    };

    this.benchmarks.set(benchmark.id, benchmark);
    console.log(`[LoadTesting] Benchmark saved: ${name}${baseline ? ' (baseline)' : ''}`);
  }

  /**
   * Detect performance regression
   */
  public detectRegression(
    currentMetrics: LoadTestMetrics,
    baselineName?: string
  ): RegressionDetection {
    const baseline = baselineName
      ? Array.from(this.benchmarks.values()).find((b) => b.name === baselineName && b.baseline)
      : Array.from(this.benchmarks.values()).find((b) => b.baseline);

    if (!baseline) {
      return {
        detected: false,
        severity: 'none',
        regressions: [],
      };
    }

    const regressions: RegressionDetection['regressions'] = [];

    // Check average response time
    const avgRTChange = this.calculatePercentageChange(
      baseline.metrics.averageResponseTime,
      currentMetrics.averageResponseTime
    );
    if (avgRTChange > this.regressionThresholds.averageResponseTime) {
      regressions.push({
        metric: 'Average Response Time',
        baseline: baseline.metrics.averageResponseTime,
        current: currentMetrics.averageResponseTime,
        percentageChange: avgRTChange,
        threshold: this.regressionThresholds.averageResponseTime,
      });
    }

    // Check P95 response time
    const p95Change = this.calculatePercentageChange(
      baseline.metrics.p95ResponseTime,
      currentMetrics.p95ResponseTime
    );
    if (p95Change > this.regressionThresholds.p95ResponseTime) {
      regressions.push({
        metric: 'P95 Response Time',
        baseline: baseline.metrics.p95ResponseTime,
        current: currentMetrics.p95ResponseTime,
        percentageChange: p95Change,
        threshold: this.regressionThresholds.p95ResponseTime,
      });
    }

    // Check requests per second
    const rpsChange = this.calculatePercentageChange(
      baseline.metrics.requestsPerSecond,
      currentMetrics.requestsPerSecond
    );
    if (rpsChange < this.regressionThresholds.requestsPerSecond) {
      regressions.push({
        metric: 'Requests Per Second',
        baseline: baseline.metrics.requestsPerSecond,
        current: currentMetrics.requestsPerSecond,
        percentageChange: rpsChange,
        threshold: this.regressionThresholds.requestsPerSecond,
      });
    }

    // Check failure rate
    const baselineFailureRate = (baseline.metrics.failedRequests / baseline.metrics.totalRequests) * 100;
    const currentFailureRate = (currentMetrics.failedRequests / currentMetrics.totalRequests) * 100;
    const failureRateChange = currentFailureRate - baselineFailureRate;
    
    if (failureRateChange > this.regressionThresholds.failureRate) {
      regressions.push({
        metric: 'Failure Rate',
        baseline: baselineFailureRate,
        current: currentFailureRate,
        percentageChange: (failureRateChange / baselineFailureRate) * 100,
        threshold: this.regressionThresholds.failureRate,
      });
    }

    // Determine severity
    let severity: RegressionDetection['severity'] = 'none';
    if (regressions.length > 0) {
      const maxChange = Math.max(...regressions.map((r) => Math.abs(r.percentageChange)));
      if (maxChange > 50) severity = 'critical';
      else if (maxChange > 30) severity = 'major';
      else severity = 'minor';
    }

    return {
      detected: regressions.length > 0,
      severity,
      regressions,
    };
  }

  /**
   * Get test results
   */
  public getTestResults(testId?: string): LoadTestMetrics | LoadTestMetrics[] {
    if (testId) {
      const result = this.testResults.get(testId);
      if (!result) {
        throw new Error(`Test results not found for ID: ${testId}`);
      }
      return result;
    }
    return Array.from(this.testResults.values());
  }

  /**
   * Get benchmarks
   */
  public getBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Stop active test
   */
  public stopTest(testId: string): boolean {
    const controller = this.activeTests.get(testId);
    if (controller) {
      controller.abort();
      this.activeTests.delete(testId);
      console.log(`[LoadTesting] Test stopped: ${testId}`);
      return true;
    }
    return false;
  }

  /**
   * Stop all active tests
   */
  public stopAllTests(): void {
    for (const [testId, controller] of this.activeTests.entries()) {
      controller.abort();
      console.log(`[LoadTesting] Test stopped: ${testId}`);
    }
    this.activeTests.clear();
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(baseline: number, current: number): number {
    if (baseline === 0) return current > 0 ? 100 : 0;
    return ((current - baseline) / baseline) * 100;
  }

  /**
   * Print stress test summary
   */
  private printStressTestSummary(results: LoadTestMetrics[]): void {
    console.log('\n[LoadTesting] Stress Test Summary:');
    console.log('═'.repeat(80));
    console.log('Users | RPS    | Avg RT | P95 RT | Success Rate | Errors');
    console.log('─'.repeat(80));
    
    for (const result of results) {
      const users = result.testName.match(/(\d+) users/)?.[1] || '?';
      const rps = result.requestsPerSecond.toFixed(1);
      const avgRT = result.averageResponseTime.toFixed(0);
      const p95RT = result.p95ResponseTime.toFixed(0);
      const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
      const errors = result.failedRequests;
      
      console.log(`${users.padStart(5)} | ${rps.padStart(6)} | ${avgRT.padStart(6)}ms | ${p95RT.padStart(6)}ms | ${successRate.padStart(11)}% | ${errors}`);
    }
    
    console.log('═'.repeat(80));
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate test ID
   */
  private generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate benchmark ID
   */
  private generateBenchmarkId(): string {
    return `benchmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all results
   */
  public clearResults(): void {
    this.testResults.clear();
    console.log('[LoadTesting] All test results cleared');
  }

  /**
   * Clear all benchmarks
   */
  public clearBenchmarks(): void {
    this.benchmarks.clear();
    console.log('[LoadTesting] All benchmarks cleared');
  }
}

// Singleton instance
let loadTestingInstance: LoadTestingFramework | null = null;

/**
 * Get singleton load testing framework instance
 */
export function getLoadTestingFramework(): LoadTestingFramework {
  if (!loadTestingInstance) {
    loadTestingInstance = new LoadTestingFramework();
  }
  return loadTestingInstance;
}
