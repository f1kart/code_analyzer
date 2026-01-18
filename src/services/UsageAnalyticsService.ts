interface UserAnalyticsEvent {
  eventId: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  eventType: 'page_view' | 'feature_usage' | 'performance' | 'error' | 'ai_interaction';
  eventName: string;
  properties: Record<string, any>;
  duration?: number;
  metadata?: {
    userAgent?: string;
    url?: string;
    referrer?: string;
    screenResolution?: string;
    language?: string;
  };
}

interface AnalyticsConfig {
  enabled?: boolean;
  batchSize?: number;
  flushInterval?: number;
  retentionDays?: number;
  samplingRate?: number;
  endpoint?: string;
}

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

interface UserBehavior {
  userId: string;
  sessionId: string;
  events: UserAnalyticsEvent[];
  sessionStart: Date;
  sessionEnd?: Date;
  totalEvents: number;
  featuresUsed: string[];
  errors: number;
  aiInteractions: number;
}

export class UsageAnalyticsService {
  private events: UserAnalyticsEvent[] = [];
  private sessions: Map<string, UserBehavior> = new Map();
  private config: Required<AnalyticsConfig>;
  private flushTimer?: NodeJS.Timeout;
  private currentSessionId: string;

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      enabled: true,
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      retentionDays: 90,
      samplingRate: 1.0, // 100% sampling
      endpoint: 'http://localhost:3001/analytics',
      ...config,
    };

    this.currentSessionId = this.generateSessionId();

    if (this.config.enabled) {
      this.startPeriodicFlush();
    }
  }

  /**
   * Track a user analytics event
   */
  trackEvent(
    eventType: UserAnalyticsEvent['eventType'],
    eventName: string,
    properties: Record<string, any> = {},
    duration?: number
  ): void {
    if (!this.config.enabled) return;

    // Apply sampling
    if (Math.random() > this.config.samplingRate) return;

    const event: UserAnalyticsEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      sessionId: this.currentSessionId,
      eventType,
      eventName,
      properties,
      duration,
      metadata: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof window !== 'undefined' ? window.document.referrer : undefined,
        screenResolution: this.getScreenResolution(),
        language: typeof window !== 'undefined' ? window.navigator.language : undefined,
      },
    };

    this.events.push(event);
    this.updateSessionData(event);

    // Flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track page view events
   */
  trackPageView(pageName: string, properties: Record<string, any> = {}): void {
    this.trackEvent('page_view', `view_${pageName}`, {
      page: pageName,
      ...properties,
    });
  }

  /**
   * Track feature usage events
   */
  trackFeatureUsage(featureName: string, properties: Record<string, any> = {}): void {
    this.trackEvent('feature_usage', `use_${featureName}`, {
      feature: featureName,
      ...properties,
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(operationName: string, duration: number, properties: Record<string, any> = {}): void {
    this.trackEvent('performance', `perf_${operationName}`, {
      operation: operationName,
      duration,
      ...properties,
    }, duration);
  }

  /**
   * Track error events
   */
  trackError(errorName: string, error: Error, properties: Record<string, any> = {}): void {
    this.trackEvent('error', `error_${errorName}`, {
      error: error.message,
      stack: error.stack,
      ...properties,
    });
  }

  /**
   * Track AI interaction events
   */
  trackAIInteraction(action: string, model?: string, properties: Record<string, any> = {}): void {
    this.trackEvent('ai_interaction', `ai_${action}`, {
      action,
      model,
      ...properties,
    });
  }

  /**
   * Start a new user session
   */
  startNewSession(): void {
    this.endCurrentSession();
    this.currentSessionId = this.generateSessionId();
    this.sessions.clear();
  }

  /**
   * End the current session
   */
  endCurrentSession(): void {
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) {
        session.sessionEnd = new Date();
        this.trackEvent('page_view', 'session_end', {
          sessionDuration: session.sessionEnd.getTime() - session.sessionStart.getTime(),
          totalEvents: session.totalEvents,
        });
      }
    }
  }

  /**
   * Get usage metrics for the current period
   */
  getUsageMetrics(): UsageMetrics {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (this.config.retentionDays * 24 * 60 * 60 * 1000));

    // Filter events within retention period
    const recentEvents = this.events.filter(event => event.timestamp >= cutoffDate);

    // Calculate metrics
    const uniqueUsers = new Set(recentEvents.map(e => e.userId).filter(Boolean)).size;
    const uniqueSessions = new Set(recentEvents.map(e => e.sessionId)).size;
    const featureUsage: Record<string, number> = {};
    const errors = recentEvents.filter(e => e.eventType === 'error');
    const aiInteractions = recentEvents.filter(e => e.eventType === 'ai_interaction');

    // Count feature usage
    recentEvents
      .filter(e => e.eventType === 'feature_usage')
      .forEach(event => {
        const feature = event.properties.feature as string;
        if (feature) {
          featureUsage[feature] = (featureUsage[feature] || 0) + 1;
        }
      });

    // Calculate performance metrics
    const performanceEvents = recentEvents.filter(e => e.eventType === 'performance');
    const averageResponseTime = performanceEvents.length > 0
      ? performanceEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / performanceEvents.length
      : 0;

    const durations = performanceEvents.map(e => e.duration || 0).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p95ResponseTime = durations.length > 0 ? durations[Math.min(p95Index, durations.length - 1)] : 0;

    return {
      totalUsers: uniqueUsers,
      activeUsers: uniqueSessions,
      sessionsPerUser: uniqueUsers > 0 ? uniqueSessions / uniqueUsers : 0,
      averageSessionDuration: this.calculateAverageSessionDuration(),
      featureUsage,
      errorRate: recentEvents.length > 0 ? (errors.length / recentEvents.length) * 100 : 0,
      aiInteractions: aiInteractions.length,
      codeReviewSessions: this.sessions.size,
      performanceMetrics: {
        averageResponseTime,
        p95ResponseTime,
        errorRate: performanceEvents.length > 0 ? (errors.length / performanceEvents.length) * 100 : 0,
      },
    };
  }

  /**
   * Get user behavior analytics
   */
  getUserBehaviorAnalytics(): Array<{
    sessionId: string;
    duration: number;
    events: number;
    featuresUsed: string[];
    errors: number;
    aiInteractions: number;
  }> {
    return Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      duration: session.sessionEnd
        ? session.sessionEnd.getTime() - session.sessionStart.getTime()
        : Date.now() - session.sessionStart.getTime(),
      events: session.totalEvents,
      featuresUsed: session.featuresUsed,
      errors: session.errors,
      aiInteractions: session.aiInteractions,
    }));
  }

  /**
   * Export analytics data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      events: this.events,
      sessions: Array.from(this.sessions.values()),
      metrics: this.getUsageMetrics(),
      exportedAt: new Date().toISOString(),
    };

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Flush events to external analytics service
   */
  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToFlush = [...this.events];
    this.events = [];

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToFlush,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.error('Failed to flush analytics events:', response.statusText);
        // Re-queue events for next flush
        this.events.unshift(...eventsToFlush);
      }
    } catch (error) {
      console.error('Error flushing analytics events:', error);
      // Re-queue events for next flush
      this.events.unshift(...eventsToFlush);
    }
  }

  /**
   * Update session data with new event
   */
  private updateSessionData(event: UserAnalyticsEvent): void {
    let session = this.sessions.get(this.currentSessionId);

    if (!session) {
      session = {
        userId: event.userId || 'anonymous',
        sessionId: this.currentSessionId,
        events: [],
        sessionStart: event.timestamp,
        totalEvents: 0,
        featuresUsed: [],
        errors: 0,
        aiInteractions: 0,
      };
      this.sessions.set(this.currentSessionId, session);
    }

    if (session) {
      session.events.push(event);
      session.totalEvents++;

      if (event.eventType === 'feature_usage') {
        const feature = event.properties.feature as string;
        if (feature && !session.featuresUsed.includes(feature)) {
          session.featuresUsed.push(feature);
        }
      }

      if (event.eventType === 'error') {
        session.errors++;
      }

      if (event.eventType === 'ai_interaction') {
        session.aiInteractions++;
      }
    }
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Calculate average session duration
   */
  private calculateAverageSessionDuration(): number {
    const completedSessions = Array.from(this.sessions.values())
      .filter(session => session.sessionEnd);

    if (completedSessions.length === 0) return 0;

    const totalDuration = completedSessions.reduce((sum, session) => {
      return sum + (session.sessionEnd!.getTime() - session.sessionStart.getTime());
    }, 0);

    return totalDuration / completedSessions.length;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get screen resolution
   */
  private getScreenResolution(): string {
    if (typeof window === 'undefined') return '';

    return `${window.screen.width}x${window.screen.height}`;
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    const events = data.events || [];
    if (events.length === 0) return '';

    const headers = ['eventId', 'timestamp', 'eventType', 'eventName', 'sessionId', 'duration'];
    const csvRows = [headers.join(',')];

    events.forEach((event: UserAnalyticsEvent) => {
      const row = [
        event.eventId,
        event.timestamp.toISOString(),
        event.eventType,
        event.eventName,
        event.sessionId,
        event.duration || '',
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Clean up old data based on retention policy
   */
  cleanup(): void {
    const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));

    // Remove old events
    this.events = this.events.filter(event => event.timestamp >= cutoffDate);

    // Remove old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.sessionStart < cutoffDate) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Shutdown analytics service
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining events
    this.flush();

    // End current session
    this.endCurrentSession();
  }
}

// Singleton instance
let analyticsService: UsageAnalyticsService | null = null;

export function initializeAnalytics(config?: AnalyticsConfig): UsageAnalyticsService {
  if (!analyticsService) {
    analyticsService = new UsageAnalyticsService(config);
  }
  return analyticsService;
}

export function getAnalyticsService(): UsageAnalyticsService | null {
  return analyticsService;
}

// Convenience functions for common analytics patterns
export function trackFeatureUsage(featureName: string, properties?: Record<string, any>): void {
  analyticsService?.trackFeatureUsage(featureName, properties);
}

export function trackError(errorName: string, error: Error, properties?: Record<string, any>): void {
  analyticsService?.trackError(errorName, error, properties);
}

export function trackAIInteraction(action: string, model?: string, properties?: Record<string, any>): void {
  analyticsService?.trackAIInteraction(action, model, properties);
}

export function trackPerformance(operationName: string, duration: number, properties?: Record<string, any>): void {
  analyticsService?.trackPerformance(operationName, duration, properties);
}
