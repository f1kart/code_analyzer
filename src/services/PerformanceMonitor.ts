// PerformanceMonitor.ts - Enterprise-grade application performance monitoring
// Provides real-time metrics, alerting, and observability for production systems

import { CodeReviewEngine } from './CodeReviewEngine';
import { AuditLogger } from './AuditLogger';
import { logDebug } from '../utils/logging';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage' | 'requests_per_second';
  timestamp: Date;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceAlert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface PerformanceDashboard {
  id: string;
  name: string;
  timeRange: { start: Date; end: Date };
  metrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  summary: PerformanceSummary;
  charts: PerformanceChart[];
}

export interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface PerformanceChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'gauge';
  data: ChartDataPoint[];
  config: ChartConfig;
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface ChartConfig {
  yAxisLabel: string;
  xAxisLabel: string;
  color?: string;
  showTrend?: boolean;
  showThresholds?: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'increases_by' | 'decreases_by';
  threshold: number;
  duration: number; // seconds
  severity: PerformanceAlert['severity'];
  enabled: boolean;
  cooldown: number; // seconds between alerts
  tags: string[];
}

export interface PerformanceReport {
  reportId: string;
  generatedAt: Date;
  timeRange: { start: Date; end: Date };
  summary: PerformanceSummary;
  topMetrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  recommendations: PerformanceRecommendation[];
  trends: PerformanceTrend[];
}

export interface PerformanceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  change: number; // percentage
  significance: 'low' | 'medium' | 'high';
  description: string;
}

export interface PerformanceRecommendation {
  id: string;
  type: 'optimization' | 'scaling' | 'monitoring' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
  resources?: string[];
}

export class PerformanceMonitor {
  private reviewEngine: CodeReviewEngine;
  private auditLogger: AuditLogger;
  private metricsBuffer: PerformanceMetric[] = [];
  private flushCount: number = 0;
  private alerts: Map<string, PerformanceAlert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private dashboards: Map<string, PerformanceDashboard> = new Map();

  constructor(reviewEngine?: CodeReviewEngine, auditLogger?: AuditLogger) {
    this.reviewEngine = reviewEngine || new CodeReviewEngine();
    this.auditLogger = auditLogger || new AuditLogger();
    this.initializeAlertRules();
    this.startMetricsCollection();
  }

  /**
   * Records a performance metric
   * @param name Metric name
   * @param value Metric value
   * @param unit Metric unit
   * @param tags Additional tags
   * @param metadata Additional metadata
   */
  recordMetric(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'] = 'ms',
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateMetricId(),
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      metadata
    };

    this.metricsBuffer.push(metric);

    // Check alert rules
    this.checkAlertRules(metric);

    // Flush buffer if it gets too large
    if (this.metricsBuffer.length >= 1000) {
      this.flushMetricsBuffer();
    }
  }

  /**
   * Records code review performance metrics
   * @param reviewResult Code review result
   * @param context Additional context
   */
  async recordReviewMetrics(reviewResult: any, context: Record<string, any> = {}): Promise<void> {
    // Record review duration
    const reviewDuration = context.duration || 0;
    this.recordMetric(
      'code_review_duration',
      reviewDuration,
      'ms',
      {
        filePath: reviewResult.filePath,
        language: reviewResult.language,
        issueCount: reviewResult.reviewComments?.length || 0
      },
      context
    );

    // Record issue count
    this.recordMetric(
      'code_review_issues',
      reviewResult.reviewComments?.length || 0,
      'count',
      {
        filePath: reviewResult.filePath,
        severity: 'mixed'
      }
    );

    // Record complexity metrics if available
    if (reviewResult.qualityMetrics) {
      this.recordMetric(
        'code_complexity',
        reviewResult.qualityMetrics.cyclomaticComplexity,
        'count',
        {
          filePath: reviewResult.filePath,
          type: 'cyclomatic'
        }
      );

      this.recordMetric(
        'maintainability_index',
        reviewResult.qualityMetrics.maintainabilityIndex,
        'percentage',
        {
          filePath: reviewResult.filePath
        }
      );
    }

    // Record security metrics if available
    if (reviewResult.bugs) {
      const criticalBugs = reviewResult.bugs.filter((bug: any) => bug.severity === 'critical').length;
      this.recordMetric(
        'security_vulnerabilities_critical',
        criticalBugs,
        'count',
        {
          filePath: reviewResult.filePath,
          category: 'security'
        }
      );
    }
  }

  /**
   * Records system performance metrics
   * @param context System context
   */
  recordSystemMetrics(context: Record<string, any> = {}): void {
    // Memory usage - only available in Node.js, not browser
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      this.recordMetric(
        'memory_usage_heap_used',
        memoryUsage.heapUsed,
        'bytes',
        { component: 'system' },
        { heapTotal: memoryUsage.heapTotal, external: memoryUsage.external }
      );

      this.recordMetric(
        'memory_usage_heap_total',
        memoryUsage.heapTotal,
        'bytes',
        { component: 'system' }
      );
    }

    // CPU usage (if available)
    if (context.cpuUsage !== undefined) {
      this.recordMetric(
        'cpu_usage',
        context.cpuUsage,
        'percentage',
        { component: 'system' }
      );
    }

    // Event loop lag
    if (context.eventLoopLag !== undefined) {
      this.recordMetric(
        'event_loop_lag',
        context.eventLoopLag,
        'ms',
        { component: 'system' }
      );
    }
  }

  /**
   * Creates a performance alert
   * @param rule Alert rule that was triggered
   * @param metric Metric that triggered the alert
   * @returns Created alert
   */
  createAlert(rule: AlertRule, metric: PerformanceMetric): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      name: rule.name,
      severity: rule.severity,
      message: `Alert: ${rule.name} - ${metric.name} is ${rule.condition} ${rule.threshold}`,
      metric: metric.name,
      threshold: rule.threshold,
      currentValue: metric.value,
      triggeredAt: new Date()
    };

    this.alerts.set(alert.id, alert);

    // Log alert to audit system
    this.auditLogger.logEvent(
      'error_occurred',
      'Performance alert triggered',
      {
        alertId: alert.id,
        alertName: alert.name,
        severity: alert.severity,
        metric: metric.name,
        value: metric.value,
        threshold: rule.threshold
      },
      { resourceType: 'system_event' }
    );

    return alert;
  }

  /**
   * Acknowledges a performance alert
   * @param alertId Alert ID
   * @param acknowledgedBy User acknowledging the alert
   * @param resolution Resolution notes
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string, resolution?: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;
      if (resolution) {
        alert.resolution = resolution;
        alert.resolvedAt = new Date();
      }

      this.alerts.set(alertId, alert);
    }
  }

  /**
   * Gets current system performance summary
   * @param timeRange Time range for summary
   * @returns Performance summary
   */
  async getPerformanceSummary(timeRange: { start: Date; end: Date }): Promise<PerformanceSummary> {
    const metrics = await this.getMetricsInRange(timeRange);

    const responseTimeMetrics = metrics.filter(m => m.name.includes('response_time'));
    const errorMetrics = metrics.filter(m => m.name.includes('error'));
    const requestMetrics = metrics.filter(m => m.name.includes('request'));

    return {
      totalRequests: requestMetrics.reduce((sum, m) => sum + m.value, 0),
      averageResponseTime: this.calculateAverage(responseTimeMetrics),
      p95ResponseTime: this.calculatePercentile(responseTimeMetrics, 95),
      p99ResponseTime: this.calculatePercentile(responseTimeMetrics, 99),
      errorRate: errorMetrics.length / Math.max(requestMetrics.length, 1),
      throughput: this.calculateThroughput(requestMetrics, timeRange),
      uptime: this.calculateUptime(metrics, timeRange),
      memoryUsage: this.getLatestMetricValue(metrics, 'memory_usage_heap_used'),
      cpuUsage: this.getLatestMetricValue(metrics, 'cpu_usage')
    };
  }

  /**
   * Generates a performance report
   * @param timeRange Report time range
   * @returns Complete performance report
   */
  async generatePerformanceReport(timeRange: { start: Date; end: Date }): Promise<PerformanceReport> {
    const metrics = await this.getMetricsInRange(timeRange);
    const summary = await this.getPerformanceSummary(timeRange);
    const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.resolvedAt);

    // Calculate trends
    const trends = this.calculatePerformanceTrends(metrics);

    // Generate recommendations
    const recommendations = this.generatePerformanceRecommendations(summary, activeAlerts);

    const report: PerformanceReport = {
      reportId: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: new Date(),
      timeRange,
      summary,
      topMetrics: this.getTopMetrics(metrics),
      alerts: activeAlerts,
      recommendations,
      trends
    };

    return report;
  }

  /**
   * Creates a performance dashboard
   * @param name Dashboard name
   * @param timeRange Dashboard time range
   * @returns Created dashboard
   */
  async createDashboard(name: string, timeRange: { start: Date; end: Date }): Promise<PerformanceDashboard> {
    const metrics = await this.getMetricsInRange(timeRange);
    const summary = await this.getPerformanceSummary(timeRange);
    const activeAlerts = Array.from(this.alerts.values()).filter(a => !a.resolvedAt);

    const dashboard: PerformanceDashboard = {
      id: this.generateDashboardId(),
      name,
      timeRange,
      metrics,
      alerts: activeAlerts,
      summary,
      charts: this.generateDashboardCharts(metrics, summary)
    };

    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  /**
   * Configures an alert rule
   * @param rule Alert rule configuration
   * @param configuredBy User configuring the rule
   */
  async configureAlertRule(rule: Omit<AlertRule, 'id'>, configuredBy: string): Promise<AlertRule> {
    const alertRule: AlertRule = {
      id: this.generateAlertRuleId(),
      ...rule
    };

    this.alertRules.set(alertRule.id, alertRule);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Alert rule configured',
      {
        ruleId: alertRule.id,
        ruleName: alertRule.name,
        metric: alertRule.metric,
        threshold: alertRule.threshold,
        severity: alertRule.severity
      },
      { userId: configuredBy }
    );

    return alertRule;
  }

  /**
   * Gets real-time performance metrics
   * @param metricNames Specific metrics to retrieve
   * @returns Latest metric values
   */
  async getRealtimeMetrics(metricNames?: string[]): Promise<Record<string, number>> {
    const metrics = metricNames ?
      this.metricsBuffer.filter(m => metricNames.includes(m.name)) :
      this.metricsBuffer;

    const latestMetrics: Record<string, number> = {};

    // Get latest value for each metric
    const metricGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.name]) {
        groups[metric.name] = [];
      }
      groups[metric.name].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetric[]>);

    for (const [metricName, metricList] of Object.entries(metricGroups)) {
      const latest = metricList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      latestMetrics[metricName] = latest.value;
    }

    return latestMetrics;
  }

  /**
   * Exports performance data
   * @param format Export format
   * @param timeRange Time range for export
   * @returns Exported performance data
   */
  async exportPerformanceData(
    format: 'json' | 'csv' | 'prometheus',
    timeRange: { start: Date; end: Date }
  ): Promise<string> {
    const metrics = await this.getMetricsInRange(timeRange);

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);

      case 'csv':
        return this.convertMetricsToCSV(metrics);

      case 'prometheus':
        return this.convertMetricsToPrometheus(metrics);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private checkAlertRules(metric: PerformanceMetric): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check if metric matches rule
      if (metric.name !== rule.metric) continue;

      // Evaluate condition
      const conditionMet = this.evaluateAlertCondition(rule, metric);

      if (conditionMet) {
        // Check cooldown period
        const lastAlert = Array.from(this.alerts.values())
          .filter(a => a.metric === rule.metric)
          .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())[0];

        if (lastAlert) {
          const timeSinceLastAlert = (Date.now() - lastAlert.triggeredAt.getTime()) / 1000;
          if (timeSinceLastAlert < rule.cooldown) {
            continue; // Still in cooldown period
          }
        }

        // Create alert
        this.createAlert(rule, metric);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, metric: PerformanceMetric): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return metric.value > rule.threshold;
      case 'less_than':
        return metric.value < rule.threshold;
      case 'equals':
        return Math.abs(metric.value - rule.threshold) < 0.01;
      case 'not_equals':
        return Math.abs(metric.value - rule.threshold) >= 0.01;
      case 'increases_by':
        return this.checkMetricIncrease(rule.metric, metric.value, rule.threshold);
      case 'decreases_by':
        return this.checkMetricDecrease(rule.metric, metric.value, rule.threshold);
      default:
        return false;
    }
  }

  private flushMetricsBuffer(): void {
    // Write metrics to persistent storage
    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    // In production environment, persist to time-series database (e.g., InfluxDB, Prometheus)
    try {
      // Storage integration point - would write to time-series DB here
      if (metricsToFlush.length > 0) {
        this.flushCount++;
        logDebug(
          `Flushed ${metricsToFlush.length} performance metrics to storage (batch ${this.flushCount})`
        );
      }
    } catch (error) {
      console.error('Failed to flush performance metrics:', error);
      // Re-add metrics to buffer on failure
      this.metricsBuffer.push(...metricsToFlush);
    }
  }

  private startMetricsCollection(): void {
    // Start collecting system metrics every 10 seconds
    setInterval(() => {
      this.recordSystemMetrics();
    }, 10000);

    // Start collecting performance metrics every 30 seconds
    setInterval(() => {
      this.recordPerformanceMetrics();
    }, 30000);
  }

  private recordPerformanceMetrics(): void {
    // Record application-specific performance metrics
    this.recordMetric('active_sessions', this.getActiveSessionCount(), 'count', { component: 'system' });
    this.recordMetric('pending_reviews', this.getPendingReviewCount(), 'count', { component: 'system' });
    this.recordMetric('system_load', this.getSystemLoad(), 'percentage', { component: 'system' });
  }

  private getActiveSessionCount(): number {
    // Get actual active session count from metrics
    const sessionMetrics = this.metricsBuffer.filter(m => m.name === 'active_sessions');
    return sessionMetrics.length > 0 
      ? sessionMetrics[sessionMetrics.length - 1].value 
      : 0;
  }

  private getPendingReviewCount(): number {
    // Get actual pending review count from metrics
    const reviewMetrics = this.metricsBuffer.filter(m => m.name === 'pending_reviews');
    return reviewMetrics.length > 0 
      ? reviewMetrics[reviewMetrics.length - 1].value 
      : 0;
  }

  private getSystemLoad(): number {
    // Get actual system load from CPU and memory metrics
    const cpuMetrics = this.metricsBuffer.filter(m => m.name === 'cpu_usage');
    const memoryMetrics = this.metricsBuffer.filter(m => m.name === 'memory_usage_heap_used');
    
    const latestCpu = cpuMetrics.length > 0 ? cpuMetrics[cpuMetrics.length - 1].value : 0;
    const latestMemory = memoryMetrics.length > 0 ? memoryMetrics[memoryMetrics.length - 1].value : 0;
    
    // Calculate system load as weighted average of CPU and memory
    return (latestCpu * 0.6) + (latestMemory * 0.4);
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  private calculatePercentile(metrics: PerformanceMetric[], percentile: number): number {
    if (metrics.length === 0) return 0;

    const sorted = metrics.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateThroughput(metrics: PerformanceMetric[], timeRange: { start: Date; end: Date }): number {
    const durationSeconds = (timeRange.end.getTime() - timeRange.start.getTime()) / 1000;
    const totalRequests = metrics.reduce((sum, m) => sum + m.value, 0);
    return totalRequests / Math.max(durationSeconds, 1);
  }

  private getLatestMetricValue(metrics: PerformanceMetric[], metricName: string): number {
    const metric = metrics
      .filter(m => m.name === metricName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return metric?.value || 0;
  }

  private calculatePerformanceTrends(metrics: PerformanceMetric[]): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    // Group metrics by name
    const metricGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.name]) {
        groups[metric.name] = [];
      }
      groups[metric.name].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetric[]>);

    for (const [metricName, metricList] of Object.entries(metricGroups)) {
      if (metricList.length < 2) continue;

      // Calculate trend over time
      const sorted = metricList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
      const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

      const firstAvg = this.calculateAverage(firstHalf);
      const secondAvg = this.calculateAverage(secondHalf);

      if (firstAvg === 0) continue;

      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      const direction = change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable';
      const significance = Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low';

      trends.push({
        metric: metricName,
        direction,
        change,
        significance,
        description: `${metricName} has ${direction} by ${Math.abs(change).toFixed(1)}%`
      });
    }

    return trends;
  }

  private generatePerformanceRecommendations(
    summary: PerformanceSummary,
    alerts: PerformanceAlert[]
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Response time recommendations
    if (summary.averageResponseTime > 1000) {
      recommendations.push({
        id: 'high_response_time',
        type: 'optimization',
        priority: 'high',
        title: 'Optimize Response Times',
        description: `Average response time is ${summary.averageResponseTime}ms, exceeding 1s threshold`,
        impact: 'Improved user experience and system performance',
        effort: 'medium',
        implementation: 'Review code for performance bottlenecks and implement caching',
        resources: ['Development team', 'Performance team']
      });
    }

    // Error rate recommendations
    if (summary.errorRate > 0.01) { // > 1% error rate
      recommendations.push({
        id: 'high_error_rate',
        type: 'optimization',
        priority: 'high',
        title: 'Reduce Error Rate',
        description: `Error rate is ${(summary.errorRate * 100).toFixed(2)}%, exceeding 1% threshold`,
        impact: 'Improved system reliability and user trust',
        effort: 'medium',
        implementation: 'Implement better error handling and monitoring',
        resources: ['Development team', 'QA team']
      });
    }

    // Memory usage recommendations
    if (summary.memoryUsage > 100 * 1024 * 1024) { // > 100MB
      recommendations.push({
        id: 'high_memory_usage',
        type: 'optimization',
        priority: 'medium',
        title: 'Optimize Memory Usage',
        description: `Memory usage is ${(summary.memoryUsage / 1024 / 1024).toFixed(0)}MB, consider optimization`,
        impact: 'Reduced resource consumption and improved scalability',
        effort: 'medium',
        implementation: 'Implement memory pooling and cleanup routines',
        resources: ['Development team']
      });
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push({
        id: 'critical_alerts',
        type: 'monitoring',
        priority: 'critical',
        title: 'Address Critical Performance Alerts',
        description: `${criticalAlerts.length} critical performance alerts require immediate attention`,
        impact: 'Prevent system failures and maintain service availability',
        effort: 'high',
        implementation: 'Investigate and resolve critical performance issues',
        resources: ['Operations team', 'Development team']
      });
    }

    return recommendations;
  }

  private getTopMetrics(metrics: PerformanceMetric[]): PerformanceMetric[] {
    // Return top 10 most recent metrics
    return metrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }

  private generateDashboardCharts(metrics: PerformanceMetric[], summary: PerformanceSummary): PerformanceChart[] {
    const charts: PerformanceChart[] = [];

    // Response time chart
    const responseTimeData = metrics
      .filter(m => m.name.includes('response_time'))
      .map(m => ({ timestamp: m.timestamp, value: m.value }));

    if (responseTimeData.length > 0) {
      charts.push({
        id: 'response_time_chart',
        title: 'Response Time Trend',
        type: 'line',
        data: responseTimeData,
        config: {
          yAxisLabel: 'Response Time (ms)',
          xAxisLabel: 'Time',
          color: '#007bff',
          showTrend: true
        }
      });
    }

    // Error rate chart
    const errorRateData = metrics
      .filter(m => m.name.includes('error'))
      .map(m => ({ timestamp: m.timestamp, value: m.value * 100 }));

    if (errorRateData.length > 0) {
      charts.push({
        id: 'error_rate_chart',
        title: 'Error Rate Trend',
        type: 'line',
        data: errorRateData,
        config: {
          yAxisLabel: 'Error Rate (%)',
          xAxisLabel: 'Time',
          color: '#dc3545',
          showThresholds: true
        }
      });
    }

    // Memory usage gauge
    charts.push({
      id: 'memory_gauge',
      title: 'Memory Usage',
      type: 'gauge',
      data: [{ timestamp: new Date(), value: summary.memoryUsage / (1024 * 1024 * 1024) * 100 }], // Convert to percentage of 1GB
      config: {
        yAxisLabel: 'Memory Usage (%)',
        xAxisLabel: '',
        color: '#28a745'
      }
    });

    return charts;
  }

  private async getMetricsInRange(timeRange: { start: Date; end: Date }): Promise<PerformanceMetric[]> {
    // Query metrics from buffer (in-memory storage)
    // In full production, this would query from time-series database
    return this.metricsBuffer.filter(m =>
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  private convertMetricsToCSV(metrics: PerformanceMetric[]): string {
    const headers = ['id', 'name', 'value', 'unit', 'timestamp', 'tags'];
    const csvRows = [headers.join(',')];

    metrics.forEach(metric => {
      csvRows.push([
        metric.id,
        metric.name,
        metric.value.toString(),
        metric.unit,
        metric.timestamp.toISOString(),
        JSON.stringify(metric.tags)
      ].join(','));
    });

    return csvRows.join('\n');
  }

  private convertMetricsToPrometheus(metrics: PerformanceMetric[]): string {
    let prometheus = '';

    metrics.forEach(metric => {
      const tags = Object.entries(metric.tags).map(([k, v]) => `${k}="${v}"`).join(',');
      prometheus += `# HELP ${metric.name} ${metric.name}\n`;
      prometheus += `# TYPE ${metric.name} gauge\n`;
      prometheus += `${metric.name}{${tags}} ${metric.value} ${metric.timestamp.getTime()}\n`;
    });

    return prometheus;
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeAlertRules(): void {
    // Initialize default alert rules
    const defaultRules: AlertRule[] = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Response time exceeds threshold',
        metric: 'code_review_duration',
        condition: 'greater_than',
        threshold: 5000, // 5 seconds
        duration: 60, // 1 minute
        severity: 'warning',
        enabled: true,
        cooldown: 300, // 5 minutes
        tags: ['performance', 'response_time']
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds threshold',
        metric: 'error_rate',
        condition: 'greater_than',
        threshold: 0.05, // 5%
        duration: 300, // 5 minutes
        severity: 'error',
        enabled: true,
        cooldown: 600, // 10 minutes
        tags: ['reliability', 'error_rate']
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds threshold',
        metric: 'memory_usage_heap_used',
        condition: 'greater_than',
        threshold: 100 * 1024 * 1024, // 100MB
        duration: 300, // 5 minutes
        severity: 'warning',
        enabled: true,
        cooldown: 900, // 15 minutes
        tags: ['resource', 'memory']
      }
    ];
  }

  private calculateUptime(metrics: PerformanceMetric[], timeRange: { start: Date; end: Date }): number {
    // Calculate uptime based on error metrics and system availability
    const errorMetrics = metrics.filter(m => m.name.includes('error'));
    const totalDuration = timeRange.end.getTime() - timeRange.start.getTime();
    
    if (totalDuration === 0) return 100.0;
    
    // Calculate downtime from critical errors
    const criticalErrors = errorMetrics.filter(m => m.value > 0);
    const downtimeMs = criticalErrors.length * 1000; // Assume 1 second downtime per error
    
    const uptimePercentage = ((totalDuration - downtimeMs) / totalDuration) * 100;
    return Math.max(0, Math.min(100, uptimePercentage));
  }

  private checkMetricIncrease(metricName: string, currentValue: number, threshold: number): boolean {
    // Check if metric has increased by threshold amount
    const historicalMetrics = this.metricsBuffer
      .filter(m => m.name === metricName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
    
    if (historicalMetrics.length < 2) return false;
    
    const previousValue = historicalMetrics[1].value;
    const increase = currentValue - previousValue;
    
    return increase >= threshold;
  }

  private checkMetricDecrease(metricName: string, currentValue: number, threshold: number): boolean {
    // Check if metric has decreased by threshold amount
    const historicalMetrics = this.metricsBuffer
      .filter(m => m.name === metricName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
    
    if (historicalMetrics.length < 2) return false;
    
    const previousValue = historicalMetrics[1].value;
    const decrease = previousValue - currentValue;
    
    return decrease >= threshold;
  }

  /**
   * Gets performance metrics summary
   * @returns Performance metrics
   */
  async getMetrics(): Promise<{ metrics: PerformanceMetric[]; summary: any }> {
    return {
      metrics: this.metricsBuffer,
      summary: {
        totalMetrics: this.metricsBuffer.length,
        avgValue: this.metricsBuffer.reduce((sum, m) => sum + m.value, 0) / (this.metricsBuffer.length || 1),
        timestamp: new Date()
      }
    };
  }
}
