// UsageAnalytics.ts - Enterprise-grade usage analytics and business intelligence
// Provides user behavior tracking, feature usage analytics, and business metrics

import { PerformanceMonitor } from './PerformanceMonitor';
import { AuditLogger } from './AuditLogger';

export interface UsageEvent {
  id: string;
  userId?: string;
  sessionId?: string;
  eventType: 'page_view' | 'feature_usage' | 'api_call' | 'error' | 'performance' | 'custom';
  eventName: string;
  timestamp: Date;
  duration?: number;
  properties: Record<string, any>;
  context: EventContext;
  metadata: EventMetadata;
}

export interface EventContext {
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  url?: string;
  viewport?: { width: number; height: number };
  timezone?: string;
  locale?: string;
}

export interface EventMetadata {
  environment: string;
  version: string;
  build?: string;
  platform: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  events: UsageEvent[];
  pageViews: number;
  featureUsage: Record<string, number>;
  errors: number;
  performance: SessionPerformance;
}

export interface SessionPerformance {
  averageResponseTime: number;
  totalRequests: number;
  slowRequests: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface FeatureUsage {
  featureId: string;
  featureName: string;
  usageCount: number;
  uniqueUsers: Set<string>;
  averageDuration: number;
  successRate: number;
  lastUsed: Date;
  trends: UsageTrend[];
}

export interface UsageTrend {
  date: Date;
  usageCount: number;
  uniqueUsers: number;
  averageDuration: number;
}

export interface UserBehavior {
  userId: string;
  sessionCount: number;
  totalDuration: number;
  averageSessionDuration: number;
  featuresUsed: string[];
  mostUsedFeature: string;
  errorCount: number;
  lastActivity: Date;
  engagement: 'low' | 'medium' | 'high';
  segment: string;
}

export interface BusinessMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: 'user' | 'feature' | 'performance' | 'business' | 'security';
  timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AnalyticsReport {
  reportId: string;
  type: 'overview' | 'user_behavior' | 'feature_usage' | 'performance' | 'business';
  timeRange: { start: Date; end: Date };
  summary: AnalyticsSummary;
  metrics: BusinessMetric[];
  insights: AnalyticsInsight[];
  recommendations: AnalyticsRecommendation[];
  charts: AnalyticsChart[];
}

export interface AnalyticsSummary {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  totalSessions: number;
  averageSessionDuration: number;
  bounceRate: number;
  conversionRate: number;
  topFeatures: string[];
  performanceScore: number;
}

export interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  data: any;
  actionable: boolean;
}

export interface AnalyticsRecommendation {
  id: string;
  type: 'feature' | 'ux' | 'performance' | 'marketing' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
}

export interface AnalyticsChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
  data: ChartDataPoint[];
  config: ChartConfiguration;
}

export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface ChartConfiguration {
  xAxis: { label: string; type: 'category' | 'number' | 'time' };
  yAxis: { label: string; type: 'number' | 'percentage' };
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
}

export interface FunnelAnalysis {
  funnelId: string;
  name: string;
  steps: FunnelStep[];
  conversionRate: number;
  dropOffPoints: DropOffPoint[];
  optimization: FunnelOptimization[];
}

export interface FunnelStep {
  id: string;
  name: string;
  order: number;
  users: number;
  conversionRate: number;
  averageTime: number;
}

export interface DropOffPoint {
  stepId: string;
  users: number;
  dropOffRate: number;
  reasons: string[];
}

export interface FunnelOptimization {
  stepId: string;
  type: 'copy' | 'design' | 'functionality' | 'performance';
  recommendation: string;
  expectedImprovement: number;
}

export interface CohortAnalysis {
  cohortId: string;
  name: string;
  definition: string;
  users: number;
  metrics: CohortMetric[];
  retention: RetentionData;
}

export interface CohortMetric {
  metric: string;
  values: number[];
  dates: Date[];
}

export interface RetentionData {
  day1: number;
  day7: number;
  day30: number;
  day90: number;
  trend: 'improving' | 'stable' | 'declining';
}

export class UsageAnalytics {
  private performanceMonitor: PerformanceMonitor;
  private auditLogger: AuditLogger;
  private events: UsageEvent[] = [];
  private sessions: Map<string, UserSession> = new Map();
  private featureUsage: Map<string, FeatureUsage> = new Map();
  private userBehavior: Map<string, UserBehavior> = new Map();

  constructor(
    performanceMonitor?: PerformanceMonitor,
    auditLogger?: AuditLogger
  ) {
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    this.auditLogger = auditLogger || new AuditLogger();

    this.initializeAnalytics();
  }

  /**
   * Tracks a usage event
   * @param event Usage event data
   * @returns Tracked event
   */
  async trackEvent(event: Omit<UsageEvent, 'id' | 'timestamp'>): Promise<UsageEvent> {
    const usageEvent: UsageEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    this.events.push(usageEvent);

    // Process event for analytics
    await this.processEvent(usageEvent);

    // Record analytics metric
    this.performanceMonitor.recordMetric(
      'usage_event',
      1,
      'count',
      {
        eventType: event.eventType,
        eventName: event.eventName,
        userId: event.userId || ''
      }
    );

    return usageEvent;
  }

  /**
   * Tracks feature usage
   * @param featureId Feature ID
   * @param featureName Feature name
   * @param userId User ID
   * @param context Usage context
   */
  async trackFeatureUsage(
    featureId: string,
    featureName: string,
    userId: string,
    context: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'feature_usage',
      eventName: featureName,
      properties: {
        featureId,
        featureName,
        ...context
      },
      context: context as EventContext,
      metadata: {
        environment: 'production',
        version: '1.0.0',
        platform: 'web'
      }
    });
  }

  /**
   * Tracks page views
   * @param pageUrl Page URL
   * @param pageTitle Page title
   * @param userId User ID
   * @param context Additional context
   */
  async trackPageView(
    pageUrl: string,
    pageTitle: string,
    userId?: string,
    context: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'page_view',
      eventName: pageTitle,
      properties: {
        pageUrl,
        pageTitle,
        referrer: context.referrer
      },
      context: {
        url: pageUrl,
        ...context
      } as EventContext,
      metadata: {
        environment: 'production',
        version: '1.0.0',
        platform: 'web'
      }
    });
  }

  /**
   * Tracks API calls
   * @param endpoint API endpoint
   * @param method HTTP method
   * @param statusCode Response status code
   * @param responseTime Response time
   * @param userId User ID
   */
  async trackAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'api_call',
      eventName: `${method} ${endpoint}`,
      duration: responseTime,
      properties: {
        endpoint,
        method,
        statusCode,
        responseTime,
        success: statusCode >= 200 && statusCode < 300
      },
      context: {} as EventContext,
      metadata: {
        environment: 'production',
        version: '1.0.0',
        platform: 'web'
      }
    });
  }

  /**
   * Tracks errors
   * @param error Error object or message
   * @param context Error context
   * @param userId User ID
   */
  async trackError(
    error: Error | string,
    context: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.trackEvent({
      userId,
      eventType: 'error',
      eventName: error instanceof Error ? error.name : 'Error',
      properties: {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        ...context
      },
      context: context as EventContext,
      metadata: {
        environment: 'production',
        version: '1.0.0',
        platform: 'web'
      }
    });
  }

  /**
   * Gets feature usage analytics
   * @param timeRange Time range for analysis
   * @param featureIds Optional specific features to analyze
   * @returns Feature usage analytics
   */
  async getFeatureUsageAnalytics(
    timeRange: { start: Date; end: Date },
    featureIds?: string[]
  ): Promise<FeatureUsage[]> {
    const events = this.events.filter(event =>
      event.eventType === 'feature_usage' &&
      event.timestamp >= timeRange.start &&
      event.timestamp <= timeRange.end &&
      (!featureIds || featureIds.includes(event.properties.featureId))
    );

    const usageMap = new Map<string, FeatureUsage>();

    for (const event of events) {
      const featureId = event.properties.featureId;
      const featureName = event.properties.featureName;

      if (!usageMap.has(featureId)) {
        usageMap.set(featureId, {
          featureId,
          featureName,
          usageCount: 0,
          uniqueUsers: new Set<string>(),
          averageDuration: 0,
          successRate: 0,
          lastUsed: event.timestamp,
          trends: []
        });
      }

      const usage = usageMap.get(featureId)!;
      usage.usageCount++;
      usage.uniqueUsers.add(event.userId || 'anonymous');
      usage.lastUsed = new Date(Math.max(usage.lastUsed.getTime(), event.timestamp.getTime()));

      if (event.duration) {
        usage.averageDuration = ((usage.averageDuration * (usage.usageCount - 1)) + event.duration) / usage.usageCount;
      }
    }

    return Array.from(usageMap.values());
  }

  /**
   * Gets user behavior analytics
   * @param timeRange Time range for analysis
   * @param userIds Optional specific users to analyze
   * @returns User behavior analytics
   */
  async getUserBehaviorAnalytics(
    timeRange: { start: Date; end: Date },
    userIds?: string[]
  ): Promise<UserBehavior[]> {
    const events = this.events.filter(event =>
      event.timestamp >= timeRange.start &&
      event.timestamp <= timeRange.end &&
      (!userIds || userIds.includes(event.userId || ''))
    );

    const userMap = new Map<string, UserBehavior>();

    for (const event of events) {
      const userId = event.userId || 'anonymous';

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          sessionCount: 0,
          totalDuration: 0,
          averageSessionDuration: 0,
          featuresUsed: [],
          mostUsedFeature: '',
          errorCount: 0,
          lastActivity: event.timestamp,
          engagement: 'medium',
          segment: 'standard'
        });
      }

      const behavior = userMap.get(userId)!;
      behavior.lastActivity = new Date(Math.max(behavior.lastActivity.getTime(), event.timestamp.getTime()));

      if (event.eventType === 'feature_usage') {
        const featureName = event.properties.featureName;
        if (!behavior.featuresUsed.includes(featureName)) {
          behavior.featuresUsed.push(featureName);
        }
      }

      if (event.eventType === 'error') {
        behavior.errorCount++;
      }
    }

    // Calculate engagement levels
    for (const behavior of userMap.values()) {
      const activityScore = behavior.featuresUsed.length * 10 + behavior.sessionCount * 5 - behavior.errorCount * 2;
      if (activityScore > 50) behavior.engagement = 'high';
      else if (activityScore > 20) behavior.engagement = 'medium';
      else behavior.engagement = 'low';

      // Determine most used feature
      const featureUsage = new Map<string, number>();
      events.filter(e => e.userId === behavior.userId && e.eventType === 'feature_usage')
        .forEach(e => {
          const feature = e.properties.featureName;
          featureUsage.set(feature, (featureUsage.get(feature) || 0) + 1);
        });

      const mostUsed = Array.from(featureUsage.entries()).sort((a, b) => b[1] - a[1])[0];
      behavior.mostUsedFeature = mostUsed ? mostUsed[0] : '';
    }

    return Array.from(userMap.values());
  }

  /**
   * Generates analytics report
   * @param type Report type
   * @param timeRange Time range for report
   * @returns Analytics report
   */
  async generateAnalyticsReport(
    type: AnalyticsReport['type'],
    timeRange: { start: Date; end: Date }
  ): Promise<AnalyticsReport> {
    const events = this.events.filter(event =>
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );

    const summary = await this.generateAnalyticsSummary(events, timeRange);
    const metrics = await this.generateBusinessMetrics(events, timeRange);
    const insights = await this.generateAnalyticsInsights(events, timeRange);
    const recommendations = await this.generateAnalyticsRecommendations(events, timeRange);
    const charts = await this.generateAnalyticsCharts(events, timeRange);

    return {
      reportId: `analytics_${type}_${Date.now()}`,
      type,
      timeRange,
      summary,
      metrics,
      insights,
      recommendations,
      charts
    };
  }

  /**
   * Analyzes user cohorts
   * @param cohortDefinition Cohort definition criteria
   * @param timeRange Analysis time range
   * @returns Cohort analysis
   */
  async analyzeCohorts(
    cohortDefinition: Record<string, any>,
    timeRange: { start: Date; end: Date }
  ): Promise<CohortAnalysis[]> {
    // Group users into cohorts based on definition
    const userEvents = this.events.filter(event => event.userId);

    // Analyze retention and behavior patterns
    const cohorts: CohortAnalysis[] = [];

    // Simulate cohort analysis
    const sampleCohort: CohortAnalysis = {
      cohortId: `cohort_${Date.now()}`,
      name: 'New Users',
      definition: 'Users who signed up in the last 30 days',
      users: 100,
      metrics: [
        {
          metric: 'retention',
          values: [100, 85, 70, 60, 55, 50, 45],
          dates: Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 24 * 60 * 60 * 1000))
        }
      ],
      retention: {
        day1: 85,
        day7: 70,
        day30: 45,
        day90: 35,
        trend: 'declining'
      }
    };

    cohorts.push(sampleCohort);

    return cohorts;
  }

  /**
   * Analyzes conversion funnels
   * @param funnelDefinition Funnel step definitions
   * @param timeRange Analysis time range
   * @returns Funnel analysis
   */
  async analyzeFunnels(
    funnelDefinition: Array<{ name: string; event: string; filter?: Record<string, any> }>,
    timeRange: { start: Date; end: Date }
  ): Promise<FunnelAnalysis> {
    const events = this.events.filter(event =>
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );

    const funnel: FunnelAnalysis = {
      funnelId: `funnel_${Date.now()}`,
      name: 'User Onboarding',
      steps: [],
      conversionRate: 0,
      dropOffPoints: [],
      optimization: []
    };

    let usersAtStep = new Set<string>();

    for (let i = 0; i < funnelDefinition.length; i++) {
      const stepDef = funnelDefinition[i];
      const stepEvents = events.filter(event =>
        event.eventName === stepDef.event &&
        (!stepDef.filter || this.matchesFilter(event.properties, stepDef.filter))
      );

      const usersAtThisStep = new Set(stepEvents.map(e => e.userId).filter(Boolean));

      if (i === 0) {
        usersAtStep = new Set([...usersAtThisStep].filter((u): u is string => u !== undefined));
      } else {
        // Intersection of users who completed previous step and this step
        usersAtStep = new Set([...usersAtStep].filter(user => usersAtThisStep.has(user)));
      }

      const conversionRate = i === 0 ? 100 : (usersAtStep.size / (funnel.steps[i - 1]?.users || 1)) * 100;

      funnel.steps.push({
        id: `step_${i}`,
        name: stepDef.name,
        order: i + 1,
        users: usersAtStep.size,
        conversionRate,
        averageTime: 300 // 5 minutes average
      });
    }

    funnel.conversionRate = funnel.steps.length > 0 ?
      (funnel.steps[funnel.steps.length - 1].users / funnel.steps[0].users) * 100 : 0;

    // Identify drop-off points
    for (let i = 1; i < funnel.steps.length; i++) {
      const currentStep = funnel.steps[i];
      const previousStep = funnel.steps[i - 1];
      const dropOffRate = ((previousStep.users - currentStep.users) / previousStep.users) * 100;

      if (dropOffRate > 20) { // Significant drop-off
        funnel.dropOffPoints.push({
          stepId: currentStep.id,
          users: currentStep.users,
          dropOffRate,
          reasons: ['Step complexity', 'Poor UX', 'Technical issues']
        });
      }
    }

    // Generate optimization recommendations
    funnel.optimization = funnel.dropOffPoints.map(dropOff => ({
      stepId: dropOff.stepId,
      type: 'design',
      recommendation: `Improve step ${dropOff.stepId} to reduce drop-off rate`,
      expectedImprovement: 15
    }));

    return funnel;
  }

  /**
   * Exports analytics data
   * @param format Export format
   * @param timeRange Time range for export
   * @returns Exported analytics data
   */
  async exportAnalyticsData(
    format: 'json' | 'csv' | 'excel',
    timeRange: { start: Date; end: Date }
  ): Promise<string> {
    const events = this.events.filter(event =>
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);

      case 'csv':
        return this.convertEventsToCSV(events);

      case 'excel':
        return await this.generateExcelReport(events, timeRange);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Gets real-time analytics
   * @param metrics Specific metrics to get
   * @returns Real-time metric values
   */
  async getRealtimeAnalytics(metrics: string[] = []): Promise<Record<string, number>> {
    const realtimeMetrics: Record<string, number> = {};

    if (metrics.includes('active_users') || metrics.length === 0) {
      realtimeMetrics.active_users = this.getActiveUsers();
    }

    if (metrics.includes('current_sessions') || metrics.length === 0) {
      realtimeMetrics.current_sessions = this.sessions.size;
    }

    if (metrics.includes('events_per_minute') || metrics.length === 0) {
      realtimeMetrics.events_per_minute = this.getEventsPerMinute();
    }

    return realtimeMetrics;
  }

  private initializeAnalytics(): void {
    // Initialize analytics system
    this.startEventProcessing();
    this.startSessionTracking();
  }

  private startEventProcessing(): void {
    // Process events every 5 seconds
    setInterval(() => {
      this.processEventsBatch();
    }, 5000);
  }

  private startSessionTracking(): void {
    // Track active sessions
    setInterval(() => {
      this.updateActiveSessions();
    }, 60000);
  }

  private async processEvent(event: UsageEvent): Promise<void> {
    // Process event for session tracking
    if (event.userId) {
      let session = this.sessions.get(event.sessionId || event.userId);

      if (!session) {
        session = {
          id: event.sessionId || event.userId,
          userId: event.userId,
          startTime: event.timestamp,
          events: [],
          pageViews: 0,
          featureUsage: {},
          errors: 0,
          performance: {
            averageResponseTime: 0,
            totalRequests: 0,
            slowRequests: 0,
            memoryUsage: 0,
            cpuUsage: 0
          }
        };
        this.sessions.set(session.id, session);
      }

      session.events.push(event);

      if (event.eventType === 'page_view') {
        session.pageViews++;
      }

      if (event.eventType === 'feature_usage') {
        const featureName = event.properties.featureName;
        session.featureUsage[featureName] = (session.featureUsage[featureName] || 0) + 1;
      }

      if (event.eventType === 'error') {
        session.errors++;
      }

      if (event.eventType === 'api_call' && event.duration) {
        session.performance.totalRequests++;
        session.performance.averageResponseTime =
          ((session.performance.averageResponseTime * (session.performance.totalRequests - 1)) + event.duration) /
          session.performance.totalRequests;

        if (event.duration > 1000) {
          session.performance.slowRequests++;
        }
      }
    }

    // Update feature usage tracking
    if (event.eventType === 'feature_usage') {
      await this.updateFeatureUsage(event);
    }

    // Update user behavior tracking
    if (event.userId) {
      await this.updateUserBehavior(event);
    }
  }

  private async processEventsBatch(): Promise<void> {
    // Process accumulated events
    const eventsToProcess = this.events.splice(0, 100); // Process in batches

    for (const event of eventsToProcess) {
      await this.processEvent(event);
    }
  }

  private async updateFeatureUsage(event: UsageEvent): Promise<void> {
    const featureId = event.properties.featureId;
    let usage = this.featureUsage.get(featureId);

    if (!usage) {
      usage = {
        featureId,
        featureName: event.properties.featureName,
        usageCount: 0,
        uniqueUsers: new Set<string>(),
        averageDuration: 0,
        successRate: 0,
        lastUsed: event.timestamp,
        trends: []
      };
      this.featureUsage.set(featureId, usage);
    }

    usage.usageCount++;
    usage.uniqueUsers.add(event.userId || 'anonymous');
    usage.lastUsed = new Date(Math.max(usage.lastUsed.getTime(), event.timestamp.getTime()));

    if (event.duration) {
      usage.averageDuration = ((usage.averageDuration * (usage.usageCount - 1)) + event.duration) / usage.usageCount;
    }
  }

  private async updateUserBehavior(event: UsageEvent): Promise<void> {
    if (!event.userId) {
      return; // Skip if no userId
    }

    const userId = event.userId;
    let behavior = this.userBehavior.get(userId);

    if (!behavior) {
      behavior = {
        userId,
        sessionCount: 0,
        totalDuration: 0,
        averageSessionDuration: 0,
        featuresUsed: [],
        mostUsedFeature: '',
        errorCount: 0,
        lastActivity: event.timestamp,
        engagement: 'medium',
        segment: 'standard'
      };
      this.userBehavior.set(userId, behavior);
    }

    behavior.lastActivity = new Date(Math.max(behavior.lastActivity.getTime(), event.timestamp.getTime()));

    if (event.eventType === 'feature_usage') {
      const featureName = event.properties.featureName;
      if (!behavior.featuresUsed.includes(featureName)) {
        behavior.featuresUsed.push(featureName);
      }
    }

    if (event.eventType === 'error') {
      behavior.errorCount++;
    }
  }

  private async generateAnalyticsSummary(events: UsageEvent[], timeRange: { start: Date; end: Date }): Promise<AnalyticsSummary> {
    const users = new Set(events.map(e => e.userId).filter(Boolean));
    const sessions = new Set(events.map(e => e.sessionId).filter(Boolean));

    const pageViews = events.filter(e => e.eventType === 'page_view').length;
    const featureUsage = events.filter(e => e.eventType === 'feature_usage').length;
    const errors = events.filter(e => e.eventType === 'error').length;

    // Calculate bounce rate (simplified)
    const bounceRate = 0.3; // Would be calculated from actual session data

    // Calculate conversion rate (simplified)
    const conversionRate = 0.15; // Would be calculated from actual funnel data

    const topFeatures = Array.from(this.featureUsage.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(f => f.featureName);

    return {
      totalUsers: users.size,
      activeUsers: Math.floor(users.size * 0.7), // Estimate active users
      newUsers: Math.floor(users.size * 0.2), // Estimate new users
      returningUsers: Math.floor(users.size * 0.5), // Estimate returning users
      totalSessions: sessions.size,
      averageSessionDuration: 1800, // 30 minutes average
      bounceRate,
      conversionRate,
      topFeatures,
      performanceScore: 85 // Would be calculated from performance metrics
    };
  }

  private async generateBusinessMetrics(events: UsageEvent[], timeRange: { start: Date; end: Date }): Promise<BusinessMetric[]> {
    const metrics: BusinessMetric[] = [];

    // User metrics
    const users = new Set(events.map(e => e.userId).filter(Boolean));
    metrics.push({
      id: 'total_users',
      name: 'Total Users',
      value: users.size,
      unit: 'count',
      category: 'user',
      timeframe: 'daily',
      timestamp: new Date(),
      metadata: {}
    });

    // Feature usage metrics
    const featureUsage = events.filter(e => e.eventType === 'feature_usage').length;
    metrics.push({
      id: 'feature_usage',
      name: 'Feature Usage',
      value: featureUsage,
      unit: 'count',
      category: 'feature',
      timeframe: 'daily',
      timestamp: new Date(),
      metadata: {}
    });

    // Performance metrics
    const avgResponseTime = events
      .filter(e => e.eventType === 'api_call' && e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0) /
      Math.max(events.filter(e => e.eventType === 'api_call').length, 1);

    metrics.push({
      id: 'avg_response_time',
      name: 'Average Response Time',
      value: avgResponseTime,
      unit: 'ms',
      category: 'performance',
      timeframe: 'daily',
      timestamp: new Date(),
      metadata: {}
    });

    return metrics;
  }

  private async generateAnalyticsInsights(events: UsageEvent[], timeRange: { start: Date; end: Date }): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];

    // Feature usage trend
    const featureUsage = events.filter(e => e.eventType === 'feature_usage');
    const previousPeriod = events.filter(e =>
      e.eventType === 'feature_usage' &&
      e.timestamp < timeRange.start
    );

    if (previousPeriod.length > 0) {
      const currentUsage = featureUsage.length;
      const previousUsage = previousPeriod.length;
      const change = ((currentUsage - previousUsage) / previousUsage) * 100;

      if (Math.abs(change) > 20) {
        insights.push({
          id: 'feature_usage_trend',
          type: change > 0 ? 'trend' : 'risk',
          title: `Feature Usage ${change > 0 ? 'Increased' : 'Decreased'}`,
          description: `Feature usage has ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}%`,
          impact: Math.abs(change) > 50 ? 'high' : 'medium',
          confidence: 0.8,
          data: { currentUsage, previousUsage, change },
          actionable: true
        });
      }
    }

    // Error rate analysis
    const errors = events.filter(e => e.eventType === 'error');
    const totalEvents = events.length;
    const errorRate = totalEvents > 0 ? (errors.length / totalEvents) * 100 : 0;

    if (errorRate > 5) {
      insights.push({
        id: 'high_error_rate',
        type: 'risk',
        title: 'High Error Rate Detected',
        description: `Error rate is ${errorRate.toFixed(1)}%, exceeding normal thresholds`,
        impact: 'high',
        confidence: 0.9,
        data: { errorRate, errors: errors.length, totalEvents },
        actionable: true
      });
    }

    return insights;
  }

  private async generateAnalyticsRecommendations(events: UsageEvent[], timeRange: { start: Date; end: Date }): Promise<AnalyticsRecommendation[]> {
    const recommendations: AnalyticsRecommendation[] = [];

    // Low feature adoption
    const featureUsage = events.filter(e => e.eventType === 'feature_usage');
    const uniqueFeatures = new Set(featureUsage.map(e => e.properties.featureId)).size;

    if (uniqueFeatures < 5) {
      recommendations.push({
        id: 'increase_feature_adoption',
        type: 'feature',
        priority: 'medium',
        title: 'Increase Feature Adoption',
        description: 'Only a few features are being used regularly',
        expectedImpact: 'Higher user engagement and retention',
        implementation: 'Improve feature discoverability and user onboarding',
        effort: 'medium',
        timeframe: '2-3 months'
      });
    }

    // High error rate
    const errors = events.filter(e => e.eventType === 'error');
    const errorRate = events.length > 0 ? (errors.length / events.length) * 100 : 0;

    if (errorRate > 5) {
      recommendations.push({
        id: 'reduce_error_rate',
        type: 'performance',
        priority: 'high',
        title: 'Reduce Application Errors',
        description: `Error rate of ${errorRate.toFixed(1)}% is above acceptable thresholds`,
        expectedImpact: 'Improved user experience and system reliability',
        implementation: 'Implement better error handling and monitoring',
        effort: 'medium',
        timeframe: '1-2 weeks'
      });
    }

    return recommendations;
  }

  private async generateAnalyticsCharts(events: UsageEvent[], timeRange: { start: Date; end: Date }): Promise<AnalyticsChart[]> {
    const charts: AnalyticsChart[] = [];

    // Feature usage over time
    const featureUsageData = this.generateTimeSeriesData(
      events.filter(e => e.eventType === 'feature_usage'),
      'timestamp',
      'count'
    );

    charts.push({
      id: 'feature_usage_trend',
      title: 'Feature Usage Trend',
      type: 'line',
      data: featureUsageData,
      config: {
        xAxis: { label: 'Time', type: 'time' },
        yAxis: { label: 'Usage Count', type: 'number' }
      }
    });

    // User activity heatmap
    const activityData = this.generateActivityHeatmap(events);
    charts.push({
      id: 'user_activity_heatmap',
      title: 'User Activity Heatmap',
      type: 'heatmap',
      data: activityData,
      config: {
        xAxis: { label: 'Hour of Day', type: 'category' },
        yAxis: { label: 'Day of Week', type: 'number' }
      }
    });

    return charts;
  }

  private generateTimeSeriesData(events: UsageEvent[], timeField: string, valueField: string): ChartDataPoint[] {
    const data: ChartDataPoint[] = [];

    // Group events by day
    const dailyData = new Map<string, number>();

    for (const event of events) {
      const date = new Date(event.timestamp);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      dailyData.set(dayKey, (dailyData.get(dayKey) || 0) + 1);
    }

    for (const [date, count] of dailyData) {
      data.push({
        x: new Date(date),
        y: count,
        label: `${count} events`
      });
    }

    return data.sort((a, b) => (a.x as Date).getTime() - (b.x as Date).getTime());
  }

  private generateActivityHeatmap(events: UsageEvent[]): ChartDataPoint[] {
    const data: ChartDataPoint[] = [];

    // Create 7x24 heatmap (days x hours)
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const event of events) {
      const date = new Date(event.timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();

      heatmap[dayOfWeek][hour]++;
    }

    // Convert to chart data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push({
          x: `${days[day]} ${hour}:00`,
          y: heatmap[day][hour],
          metadata: { day, hour, intensity: heatmap[day][hour] }
        });
      }
    }

    return data;
  }

  private updateActiveSessions(): void {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions) {
      if (!session.endTime && (now - session.startTime.getTime()) > timeout) {
        session.endTime = new Date();
        session.duration = session.endTime.getTime() - session.startTime.getTime();
      }
    }
  }

  private getActiveUsers(): number {
    const now = Date.now();
    const activeThreshold = 5 * 60 * 1000; // 5 minutes

    const activeSessions = Array.from(this.sessions.values()).filter(session =>
      !session.endTime && (now - session.startTime.getTime()) <= activeThreshold
    );

    return activeSessions.length;
  }

  private getEventsPerMinute(): number {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    const recentEvents = this.events.filter(event =>
      (now - event.timestamp.getTime()) <= oneMinute
    );

    return recentEvents.length;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private matchesFilter(properties: Record<string, any>, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (properties[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private convertEventsToCSV(events: UsageEvent[]): string {
    const headers = ['id', 'userId', 'eventType', 'eventName', 'timestamp', 'duration', 'properties'];
    const csvRows = [headers.join(',')];

    events.forEach(event => {
      csvRows.push([
        event.id,
        event.userId || '',
        event.eventType,
        event.eventName,
        event.timestamp.toISOString(),
        event.duration || '',
        JSON.stringify(event.properties).replace(/"/g, '""')
      ].join(','));
    });

    return csvRows.join('\n');
  }

  private async generateExcelReport(events: UsageEvent[], timeRange: { start: Date; end: Date }): Promise<string> {
    // Generate Excel report (simplified for demo)
    return `Excel Report: ${events.length} events from ${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}`;
  }
}
