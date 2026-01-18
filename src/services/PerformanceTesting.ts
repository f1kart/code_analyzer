// PerformanceTesting.ts - Enterprise-grade performance testing framework
// Provides load testing, stress testing, and automated performance regression detection

import { PerformanceMonitor } from './PerformanceMonitor';
import { DistributedTracer } from './DistributedTracer';
import { CodeReviewEngine } from './CodeReviewEngine';

export interface LoadTestConfig {
  name: string;
  description: string;
  duration: number; // seconds
  virtualUsers: number;
  rampUpTime: number; // seconds
  rampDownTime: number; // seconds
  targetRPS?: number; // requests per second
  targetConcurrency?: number;
  endpoints: LoadTestEndpoint[];
  assertions: LoadTestAssertion[];
  reporting: {
    interval: number; // seconds
    percentiles: number[];
    includeCharts: boolean;
  };
}

export interface LoadTestEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  weight: number; // Probability weight for load distribution
}

export interface LoadTestAssertion {
  name: string;
  condition: 'response_time' | 'error_rate' | 'throughput' | 'memory_usage' | 'cpu_usage';
  operator: 'less_than' | 'greater_than' | 'equals' | 'between';
  threshold: number | [number, number];
  description: string;
}

export interface LoadTestResult {
  testId: string;
  config: LoadTestConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  summary: LoadTestSummary;
  metrics: LoadTestMetrics;
  errors: LoadTestError[];
  assertions: LoadTestAssertionResult[];
  recommendations: string[];
}

export interface LoadTestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  percentiles: Record<string, number>;
  requestsPerSecond: number;
  errorsPerSecond: number;
}

export interface LoadTestMetrics {
  responseTime: {
    average: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    p99_9: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Record<string, number>;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface LoadTestError {
  timestamp: Date;
  requestId: string;
  endpoint: string;
  errorType: string;
  errorMessage: string;
  statusCode?: number;
  responseTime?: number;
}

export interface LoadTestAssertionResult {
  assertion: LoadTestAssertion;
  passed: boolean;
  actualValue: number;
  expectedValue: number | [number, number];
  message: string;
}

export interface StressTestConfig {
  name: string;
  description: string;
  maxVirtualUsers: number;
  stepSize: number; // Users to add per step
  stepDuration: number; // seconds per step
  maxDuration: number; // Maximum test duration
  failureThreshold: {
    errorRate: number;
    responseTime: number;
  };
}

export interface StressTestResult {
  testId: string;
  config: StressTestConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: StressTestStep[];
  summary: StressTestSummary;
  breakingPoint?: {
    virtualUsers: number;
    timestamp: Date;
    reason: string;
  };
}

export interface StressTestStep {
  stepNumber: number;
  virtualUsers: number;
  duration: number;
  requestsPerSecond: number;
  errorRate: number;
  averageResponseTime: number;
  status: 'running' | 'stable' | 'degraded' | 'failed';
}

export interface StressTestSummary {
  maxConcurrentUsers: number;
  peakThroughput: number;
  averageThroughput: number;
  totalRequests: number;
  errorRateAtPeak: number;
  breakingPoint?: number;
  systemBehavior: 'stable' | 'degraded' | 'failed';
}

export class PerformanceTesting {
  private performanceMonitor: PerformanceMonitor;
  private distributedTracer: DistributedTracer;
  private reviewEngine: CodeReviewEngine;
  private activeTests: Map<string, LoadTestResult | StressTestResult> = new Map();

  constructor(
    performanceMonitor?: PerformanceMonitor,
    distributedTracer?: DistributedTracer,
    reviewEngine?: CodeReviewEngine
  ) {
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    this.distributedTracer = distributedTracer || new DistributedTracer();
    this.reviewEngine = reviewEngine || new CodeReviewEngine();
  }

  /**
   * Runs a comprehensive load test
   * @param config Load test configuration
   * @returns Load test results
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = `load_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    console.log(`🚀 Starting load test: ${config.name}`);
    console.log(`📊 Virtual Users: ${config.virtualUsers}, Duration: ${config.duration}s`);

    // Initialize test result
    const result: LoadTestResult = {
      testId,
      config,
      startTime,
      endTime: new Date(),
      duration: 0,
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        percentiles: {},
        requestsPerSecond: 0,
        errorsPerSecond: 0
      },
      metrics: {
        responseTime: {
          average: 0,
          p50: 0,
          p90: 0,
          p95: 0,
          p99: 0,
          p99_9: 0,
          min: 0,
          max: 0
        },
        throughput: {
          requestsPerSecond: 0,
          bytesPerSecond: 0
        },
        errors: {
          total: 0,
          rate: 0,
          byType: {}
        },
        system: {
          memoryUsage: 0,
          cpuUsage: 0,
          activeConnections: 0
        }
      },
      errors: [],
      assertions: [],
      recommendations: []
    };

    this.activeTests.set(testId, result);

    try {
      // Simulate load test execution
      const responseTimes: number[] = [];
      const errors: LoadTestError[] = [];

      // Ramp up phase
      console.log('📈 Ramping up virtual users...');
      await this.rampUp(config, result, responseTimes, errors);

      // Steady state phase
      console.log('🔄 Running steady state...');
      await this.steadyState(config, result, responseTimes, errors);

      // Ramp down phase
      console.log('📉 Ramping down...');
      await this.rampDown(config, result, responseTimes, errors);

      // Calculate final metrics
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      this.calculateLoadTestMetrics(result, responseTimes, errors);

      // Evaluate assertions
      result.assertions = this.evaluateLoadTestAssertions(config, result);

      // Generate recommendations
      result.recommendations = this.generateLoadTestRecommendations(result);

      console.log(`✅ Load test completed: ${result.summary.successfulRequests}/${result.summary.totalRequests} requests successful`);

    } catch (error) {
      console.error('❌ Load test failed:', error);
      result.summary.failedRequests = result.summary.totalRequests;
      result.recommendations.push(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.activeTests.set(testId, result);
    return result;
  }

  /**
   * Runs a stress test to find system breaking point
   * @param config Stress test configuration
   * @returns Stress test results
   */
  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    const testId = `stress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    console.log(`🔥 Starting stress test: ${config.name}`);
    console.log(`📊 Max Users: ${config.maxVirtualUsers}, Steps: ${Math.ceil(config.maxVirtualUsers / config.stepSize)}`);

    const result: StressTestResult = {
      testId,
      config,
      startTime,
      endTime: new Date(),
      duration: 0,
      steps: [],
      summary: {
        maxConcurrentUsers: 0,
        peakThroughput: 0,
        averageThroughput: 0,
        totalRequests: 0,
        errorRateAtPeak: 0,
        systemBehavior: 'stable'
      }
    };

    this.activeTests.set(testId, result);

    try {
      let currentUsers = 0;
      let stepNumber = 0;

      while (currentUsers < config.maxVirtualUsers) {
        stepNumber++;
        currentUsers = Math.min(currentUsers + config.stepSize, config.maxVirtualUsers);

        console.log(`📊 Step ${stepNumber}: ${currentUsers} virtual users`);

        const stepStartTime = new Date();
        const stepMetrics = await this.runStressTestStep(currentUsers, config.stepDuration);

        const step: StressTestStep = {
          stepNumber,
          virtualUsers: currentUsers,
          duration: config.stepDuration,
          requestsPerSecond: stepMetrics.requestsPerSecond,
          errorRate: stepMetrics.errorRate,
          averageResponseTime: stepMetrics.averageResponseTime,
          status: this.determineStepStatus(stepMetrics, config)
        };

        result.steps.push(step);
        result.summary.totalRequests += stepMetrics.requestsPerSecond * config.stepDuration;

        // Check for breaking point
        if (step.status === 'failed' || step.errorRate > config.failureThreshold.errorRate) {
          result.breakingPoint = {
            virtualUsers: currentUsers,
            timestamp: new Date(),
            reason: step.errorRate > config.failureThreshold.errorRate ?
              'Error rate threshold exceeded' :
              'System failure detected'
          };

          console.log(`💥 Breaking point reached at ${currentUsers} users`);
          break;
        }

        // Update summary
        result.summary.maxConcurrentUsers = Math.max(result.summary.maxConcurrentUsers, currentUsers);
        result.summary.peakThroughput = Math.max(result.summary.peakThroughput, stepMetrics.requestsPerSecond);

        // Wait before next step
        if (currentUsers < config.maxVirtualUsers) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Calculate final summary
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      const totalDuration = result.steps.reduce((sum, step) => sum + step.duration, 0);
      result.summary.averageThroughput = result.summary.totalRequests / Math.max(totalDuration, 1);

      const peakStep = result.steps.find(step => step.requestsPerSecond === result.summary.peakThroughput);
      if (peakStep) {
        result.summary.errorRateAtPeak = peakStep.errorRate;
      }

      result.summary.systemBehavior = this.determineOverallSystemBehavior(result.steps);

      console.log(`✅ Stress test completed: Max users: ${result.summary.maxConcurrentUsers}`);

    } catch (error) {
      console.error('❌ Stress test failed:', error);
      result.summary.systemBehavior = 'failed';
    }

    this.activeTests.set(testId, result);
    return result;
  }

  /**
   * Runs performance regression tests
   * @param baseline Baseline performance data
   * @param current Current performance data
   * @returns Regression analysis results
   */
  async runRegressionTest(
    baseline: PerformanceReport,
    current: PerformanceReport
  ): Promise<RegressionTestResult> {
    const result: RegressionTestResult = {
      testId: `regression_${Date.now()}`,
      baselineTimestamp: baseline.generatedAt,
      currentTimestamp: current.generatedAt,
      regressions: [],
      improvements: [],
      stableMetrics: [],
      overallStatus: 'stable'
    };

    // Compare key metrics
    const metricsToCompare = [
      'averageResponseTime',
      'errorRate',
      'throughput',
      'memoryUsage',
      'cpuUsage'
    ];

    for (const metric of metricsToCompare) {
      const baselineValue = (baseline.summary as any)[metric] || 0;
      const currentValue = (current.summary as any)[metric] || 0;

      if (baselineValue === 0) continue;

      const change = ((currentValue - baselineValue) / baselineValue) * 100;
      const threshold = this.getRegressionThreshold(metric);

      if (Math.abs(change) > threshold) {
        if (change > 0) {
          // Regression (performance got worse)
          result.regressions.push({
            metric,
            baselineValue,
            currentValue,
            change,
            severity: this.calculateRegressionSeverity(change, metric)
          });
        } else {
          // Improvement (performance got better)
          result.improvements.push({
            metric,
            baselineValue,
            currentValue,
            change,
            significance: this.calculateImprovementSignificance(change)
          });
        }
      } else {
        result.stableMetrics.push({
          metric,
          baselineValue,
          currentValue,
          change
        });
      }
    }

    // Determine overall status
    if (result.regressions.some(r => r.severity === 'critical')) {
      result.overallStatus = 'critical_regression';
    } else if (result.regressions.some(r => r.severity === 'high')) {
      result.overallStatus = 'regression';
    } else if (result.improvements.length > result.regressions.length) {
      result.overallStatus = 'improved';
    }

    return result;
  }

  /**
   * Generates automated performance benchmarks
   * @param testType Type of benchmark to generate
   * @returns Benchmark results
   */
  async generateBenchmark(testType: 'load' | 'stress' | 'endurance'): Promise<BenchmarkResult> {
    const benchmarkId = `benchmark_${testType}_${Date.now()}`;

    console.log(`🏗️ Generating ${testType} benchmark: ${benchmarkId}`);

    switch (testType) {
      case 'load':
        return this.generateLoadBenchmark(benchmarkId);

      case 'stress':
        return this.generateStressBenchmark(benchmarkId);

      case 'endurance':
        return this.generateEnduranceBenchmark(benchmarkId);

      default:
        throw new Error(`Unsupported benchmark type: ${testType}`);
    }
  }

  private async rampUp(
    config: LoadTestConfig,
    result: LoadTestResult,
    responseTimes: number[],
    errors: LoadTestError[]
  ): Promise<void> {
    const rampUpDuration = config.rampUpTime;
    const steps = 10;
    const stepDuration = rampUpDuration / steps;

    for (let i = 0; i < steps; i++) {
      const targetUsers = Math.floor((i + 1) / steps * config.virtualUsers);
      await this.simulateLoad(targetUsers, config, result, responseTimes, errors, stepDuration);
    }
  }

  private async steadyState(
    config: LoadTestConfig,
    result: LoadTestResult,
    responseTimes: number[],
    errors: LoadTestError[]
  ): Promise<void> {
    const steadyDuration = config.duration;
    const steps = Math.floor(steadyDuration / 10); // 10-second intervals

    for (let i = 0; i < steps; i++) {
      await this.simulateLoad(config.virtualUsers, config, result, responseTimes, errors, 10);
    }
  }

  private async rampDown(
    config: LoadTestConfig,
    result: LoadTestResult,
    responseTimes: number[],
    errors: LoadTestError[]
  ): Promise<void> {
    const rampDownDuration = config.rampDownTime;
    const steps = 10;
    const stepDuration = rampDownDuration / steps;

    for (let i = steps - 1; i >= 0; i--) {
      const targetUsers = Math.floor((i + 1) / steps * config.virtualUsers);
      await this.simulateLoad(targetUsers, config, result, responseTimes, errors, stepDuration);
    }
  }

  private async simulateLoad(
    virtualUsers: number,
    config: LoadTestConfig,
    result: LoadTestResult,
    responseTimes: number[],
    errors: LoadTestError[],
    durationSeconds: number
  ): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);

    while (Date.now() < endTime) {
      // Simulate concurrent requests
      const promises = Array.from({ length: virtualUsers }, async (_, index) => {
        const requestStart = Date.now();
        let endpoint;

        try {
          // Simulate API call to code review endpoint
          endpoint = this.selectEndpoint(config.endpoints);
          const responseTime = await this.simulateRequest(endpoint);

          responseTimes.push(responseTime);
          result.summary.totalRequests++;
          result.summary.successfulRequests++;

          return { success: true, responseTime };

        } catch (error) {
          const endpointName = endpoint?.name || 'unknown';
          const errorObj: LoadTestError = {
            timestamp: new Date(),
            requestId: `req_${Date.now()}_${index}`,
            endpoint: endpointName,
            errorType: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - requestStart
          };

          errors.push(errorObj);
          result.summary.totalRequests++;
          result.summary.failedRequests++;

          return { success: false, error: errorObj };
        }
      });

      await Promise.allSettled(promises);

      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private selectEndpoint(endpoints: LoadTestEndpoint[]): LoadTestEndpoint {
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return endpoints[0];
  }

  private async simulateRequest(endpoint: LoadTestEndpoint): Promise<number> {
    const startTime = Date.now();

    // Simulate code review API call
    if (endpoint.url.includes('review')) {
      // Simulate code review operation
      const testCode = `
        function testFunction() {
          return Math.random() > 0.5;
        }
      `;

      await this.reviewEngine.reviewCode('test.ts', testCode);
    }

    const responseTime = Date.now() - startTime;
    return Math.max(responseTime, 10); // Minimum 10ms response time
  }

  private calculateLoadTestMetrics(
    result: LoadTestResult,
    responseTimes: number[],
    errors: LoadTestError[]
  ): void {
    if (responseTimes.length === 0) return;

    // Sort response times for percentile calculations
    const sortedTimes = responseTimes.sort((a, b) => a - b);

    result.metrics.responseTime = {
      average: this.calculateAverage(responseTimes),
      p50: this.calculatePercentile(sortedTimes, 50),
      p90: this.calculatePercentile(sortedTimes, 90),
      p95: this.calculatePercentile(sortedTimes, 95),
      p99: this.calculatePercentile(sortedTimes, 99),
      p99_9: this.calculatePercentile(sortedTimes, 99.9),
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes)
    };

    result.metrics.throughput = {
      requestsPerSecond: result.summary.totalRequests / (result.duration / 1000),
      bytesPerSecond: 0 // Would be calculated from actual response sizes
    };

    result.metrics.errors = {
      total: errors.length,
      rate: errors.length / result.summary.totalRequests,
      byType: errors.reduce((acc, error) => {
        acc[error.errorType] = (acc[error.errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // Update summary
    result.summary.averageResponseTime = result.metrics.responseTime.average;
    result.summary.minResponseTime = result.metrics.responseTime.min;
    result.summary.maxResponseTime = result.metrics.responseTime.max;
    result.summary.requestsPerSecond = result.metrics.throughput.requestsPerSecond;
    result.summary.errorsPerSecond = result.metrics.errors.rate * result.summary.requestsPerSecond;

    // Calculate percentiles for summary
    result.summary.percentiles = {
      p50: result.metrics.responseTime.p50,
      p90: result.metrics.responseTime.p90,
      p95: result.metrics.responseTime.p95,
      p99: result.metrics.responseTime.p99
    };
  }

  private evaluateLoadTestAssertions(
    config: LoadTestConfig,
    result: LoadTestResult
  ): LoadTestAssertionResult[] {
    return config.assertions.map(assertion => {
      let actualValue: number;
      let passed = false;

      switch (assertion.condition) {
        case 'response_time':
          actualValue = result.summary.averageResponseTime;
          break;
        case 'error_rate':
          actualValue = result.metrics.errors.rate;
          break;
        case 'throughput':
          actualValue = result.metrics.throughput.requestsPerSecond;
          break;
        case 'memory_usage':
          actualValue = result.metrics.system.memoryUsage;
          break;
        case 'cpu_usage':
          actualValue = result.metrics.system.cpuUsage;
          break;
        default:
          actualValue = 0;
      }

      switch (assertion.operator) {
        case 'less_than':
          passed = actualValue < (assertion.threshold as number);
          break;
        case 'greater_than':
          passed = actualValue > (assertion.threshold as number);
          break;
        case 'equals':
          passed = Math.abs(actualValue - (assertion.threshold as number)) < 0.01;
          break;
        case 'between':
          const [min, max] = assertion.threshold as [number, number];
          passed = actualValue >= min && actualValue <= max;
          break;
      }

      return {
        assertion,
        passed,
        actualValue,
        expectedValue: assertion.threshold,
        message: passed ?
          `${assertion.name} passed: ${actualValue} ${assertion.condition}` :
          `${assertion.name} failed: ${actualValue} ${assertion.condition} (expected ${assertion.threshold})`
      };
    });
  }

  private generateLoadTestRecommendations(result: LoadTestResult): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (result.summary.averageResponseTime > 1000) {
      recommendations.push('Response times are high (>1s) - consider performance optimization');
    }

    // Error rate recommendations
    if (result.metrics.errors.rate > 0.01) {
      recommendations.push('Error rate is high (>1%) - investigate system stability');
    }

    // Throughput recommendations
    if (result.metrics.throughput.requestsPerSecond < 10) {
      recommendations.push('Throughput is low - consider scaling or optimization');
    }

    // Assertion failures
    const failedAssertions = result.assertions.filter(a => !a.passed);
    if (failedAssertions.length > 0) {
      recommendations.push(`${failedAssertions.length} assertions failed - review test criteria`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance test passed all criteria - system performing well');
    }

    return recommendations;
  }

  private async runStressTestStep(virtualUsers: number, duration: number): Promise<{
    requestsPerSecond: number;
    errorRate: number;
    averageResponseTime: number;
  }> {
    const responseTimes: number[] = [];
    const errors: number[] = [];

    // Simulate stress test step
    const promises = Array.from({ length: virtualUsers * 10 }, async () => {
      try {
        const responseTime = await this.simulateRequest({
          name: 'stress_test',
          url: '/api/review',
          method: 'POST',
          weight: 1
        });

        responseTimes.push(responseTime);
      } catch (error) {
        errors.push(1);
      }
    });

    await Promise.allSettled(promises);

    return {
      requestsPerSecond: responseTimes.length / duration,
      errorRate: errors.length / (responseTimes.length + errors.length),
      averageResponseTime: this.calculateAverage(responseTimes)
    };
  }

  private determineStepStatus(
    metrics: { requestsPerSecond: number; errorRate: number; averageResponseTime: number },
    config: StressTestConfig
  ): StressTestStep['status'] {
    if (metrics.errorRate > config.failureThreshold.errorRate) {
      return 'failed';
    }

    if (metrics.averageResponseTime > config.failureThreshold.responseTime) {
      return 'degraded';
    }

    if (metrics.requestsPerSecond > 0) {
      return 'stable';
    }

    return 'running';
  }

  private determineOverallSystemBehavior(steps: StressTestStep[]): StressTestSummary['systemBehavior'] {
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    const degradedSteps = steps.filter(s => s.status === 'degraded').length;

    if (failedSteps > 0) return 'failed';
    if (degradedSteps > steps.length / 2) return 'degraded';
    return 'stable';
  }

  private async generateLoadBenchmark(benchmarkId: string): Promise<BenchmarkResult> {
    // Generate load benchmark with multiple scenarios
    const scenarios = [
      { name: 'Light Load', users: 10, duration: 60 },
      { name: 'Medium Load', users: 50, duration: 120 },
      { name: 'Heavy Load', users: 100, duration: 300 }
    ];

    const results = await Promise.all(
      scenarios.map(scenario =>
        this.runLoadTest({
          name: `Load Benchmark - ${scenario.name}`,
          description: `Benchmark ${scenario.name.toLowerCase()}`,
          duration: scenario.duration,
          virtualUsers: scenario.users,
          rampUpTime: 30,
          rampDownTime: 30,
          endpoints: [{
            name: 'code_review',
            url: '/api/review',
            method: 'POST',
            weight: 1
          }],
          assertions: [
            {
              name: 'Response Time',
              condition: 'response_time',
              operator: 'less_than',
              threshold: 2000,
              description: 'Response time should be under 2 seconds'
            }
          ],
          reporting: {
            interval: 10,
            percentiles: [50, 90, 95, 99],
            includeCharts: true
          }
        })
      )
    );

    return {
      benchmarkId,
      type: 'load',
      scenarios,
      results,
      generatedAt: new Date(),
      summary: {
        totalScenarios: scenarios.length,
        successfulScenarios: results.filter(r => r.assertions.every(a => a.passed)).length,
        averageThroughput: results.reduce((sum, r) => sum + r.metrics.throughput.requestsPerSecond, 0) / results.length,
        averageErrorRate: results.reduce((sum, r) => sum + r.metrics.errors.rate, 0) / results.length
      }
    };
  }

  private async generateStressBenchmark(benchmarkId: string): Promise<BenchmarkResult> {
    // Generate stress benchmark
    const result = await this.runStressTest({
      name: 'Stress Benchmark',
      description: 'Find system breaking point',
      maxVirtualUsers: 200,
      stepSize: 20,
      stepDuration: 60,
      maxDuration: 1800, // 30 minutes
      failureThreshold: {
        errorRate: 0.1, // 10%
        responseTime: 5000 // 5 seconds
      }
    });

    return {
      benchmarkId,
      type: 'stress',
      scenarios: [{ name: 'Stress Test', users: result.summary.maxConcurrentUsers, duration: result.duration }],
      results: [result as any],
      generatedAt: new Date(),
      summary: {
        totalScenarios: 1,
        successfulScenarios: result.summary.systemBehavior === 'stable' ? 1 : 0,
        averageThroughput: result.summary.averageThroughput,
        averageErrorRate: result.summary.errorRateAtPeak
      }
    };
  }

  private async generateEnduranceBenchmark(benchmarkId: string): Promise<BenchmarkResult> {
    // Generate endurance benchmark (long-running test)
    const result = await this.runLoadTest({
      name: 'Endurance Benchmark',
      description: 'Long-running stability test',
      duration: 1800, // 30 minutes
      virtualUsers: 20,
      rampUpTime: 60,
      rampDownTime: 60,
      endpoints: [{
        name: 'endurance_test',
        url: '/api/review',
        method: 'POST',
        weight: 1
      }],
      assertions: [
        {
          name: 'Memory Stability',
          condition: 'memory_usage',
          operator: 'less_than',
          threshold: 200 * 1024 * 1024, // 200MB
          description: 'Memory usage should remain stable'
        }
      ],
      reporting: {
        interval: 60,
        percentiles: [50, 90, 95, 99],
        includeCharts: true
      }
    });

    return {
      benchmarkId,
      type: 'endurance',
      scenarios: [{ name: 'Endurance Test', users: 20, duration: 1800 }],
      results: [result],
      generatedAt: new Date(),
      summary: {
        totalScenarios: 1,
        successfulScenarios: result.assertions.every(a => a.passed) ? 1 : 0,
        averageThroughput: result.metrics.throughput.requestsPerSecond,
        averageErrorRate: result.metrics.errors.rate
      }
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private getRegressionThreshold(metric: string): number {
    const thresholds: Record<string, number> = {
      averageResponseTime: 20, // 20% change
      errorRate: 50, // 50% change
      throughput: 15, // 15% change
      memoryUsage: 25, // 25% change
      cpuUsage: 20 // 20% change
    };

    return thresholds[metric] || 10;
  }

  private calculateRegressionSeverity(change: number, metric: string): 'low' | 'medium' | 'high' | 'critical' {
    const absChange = Math.abs(change);

    if (metric === 'errorRate' && absChange > 100) return 'critical';
    if (absChange > 50) return 'high';
    if (absChange > 25) return 'medium';
    return 'low';
  }

  private calculateImprovementSignificance(change: number): 'low' | 'medium' | 'high' {
    const absChange = Math.abs(change);

    if (absChange > 30) return 'high';
    if (absChange > 15) return 'medium';
    return 'low';
  }
}

interface BenchmarkResult {
  benchmarkId: string;
  type: 'load' | 'stress' | 'endurance';
  scenarios: Array<{ name: string; users: number; duration: number }>;
  results: (LoadTestResult | StressTestResult)[];
  generatedAt: Date;
  summary: {
    totalScenarios: number;
    successfulScenarios: number;
    averageThroughput: number;
    averageErrorRate: number;
  };
}

interface RegressionTestResult {
  testId: string;
  baselineTimestamp: Date;
  currentTimestamp: Date;
  regressions: Array<{
    metric: string;
    baselineValue: number;
    currentValue: number;
    change: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  improvements: Array<{
    metric: string;
    baselineValue: number;
    currentValue: number;
    change: number;
    significance: 'low' | 'medium' | 'high';
  }>;
  stableMetrics: Array<{
    metric: string;
    baselineValue: number;
    currentValue: number;
    change: number;
  }>;
  overallStatus: 'improved' | 'stable' | 'regression' | 'critical_regression';
}

interface PerformanceReport {
  reportId: string;
  generatedAt: Date;
  timeRange: { start: Date; end: Date };
  summary: any;
  topMetrics: any[];
  alerts: any[];
  recommendations: any[];
  trends: any[];
}
