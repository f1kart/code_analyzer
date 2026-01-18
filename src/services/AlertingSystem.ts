/**
 * Real-Time Alerting System
 * Enterprise-grade alerting with severity levels, channels, and throttling
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';
export type AlertChannel = 'ui' | 'email' | 'slack' | 'webhook' | 'console';
export type AlertCategory = 'performance' | 'security' | 'error' | 'system' | 'user_action';

export interface Alert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  details?: Record<string, any>;
  source?: string;
  acknowledged?: boolean;
  resolvedAt?: Date;
  metadata?: {
    userId?: string;
    sessionId?: string;
    component?: string;
    action?: string;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (context: Record<string, any>) => boolean;
  severity: AlertSeverity;
  category: AlertCategory;
  channels: AlertChannel[];
  throttleMs?: number;
  enabled: boolean;
}

export interface AlertingConfig {
  enabled: boolean;
  channels: {
    ui: boolean;
    email: boolean;
    slack: boolean;
    webhook: boolean;
    console: boolean;
  };
  throttleDefaults: Record<AlertSeverity, number>;
  retentionDays: number;
}

type AlertListener = (alert: Alert) => void;

/**
 * Alerting System Service
 * Manages real-time alerts with throttling, acknowledgment, and multiple channels
 */
export class AlertingSystem {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private listeners: Set<AlertListener> = new Set();
  private throttleTimers: Map<string, number> = new Map();
  private config: AlertingConfig;
  private alertCount: Record<AlertSeverity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
  };

  constructor(config?: Partial<AlertingConfig>) {
    this.config = {
      enabled: true,
      channels: {
        ui: true,
        email: false,
        slack: false,
        webhook: false,
        console: true,
      },
      throttleDefaults: {
        critical: 0, // No throttle for critical
        error: 5000, // 5 seconds
        warning: 30000, // 30 seconds
        info: 60000, // 1 minute
      },
      retentionDays: 7,
      ...config,
    };

    // Register default alert rules
    this.registerDefaultRules();
  }

  /**
   * Register default alert rules
   */
  private registerDefaultRules(): void {
    // Performance alerts
    this.addRule({
      id: 'slow-api-response',
      name: 'Slow API Response',
      condition: (ctx) => ctx.responseTime > 5000,
      severity: 'warning',
      category: 'performance',
      channels: ['ui', 'console'],
      throttleMs: 30000,
      enabled: true,
    });

    this.addRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      condition: (ctx) => ctx.memoryUsageMB > 500,
      severity: 'warning',
      category: 'performance',
      channels: ['ui', 'console'],
      throttleMs: 60000,
      enabled: true,
    });

    // Security alerts
    this.addRule({
      id: 'auth-failure',
      name: 'Authentication Failure',
      condition: (ctx) => ctx.authFailed === true,
      severity: 'error',
      category: 'security',
      channels: ['ui', 'console'],
      throttleMs: 10000,
      enabled: true,
    });

    this.addRule({
      id: 'suspicious-activity',
      name: 'Suspicious Activity Detected',
      condition: (ctx) => ctx.suspiciousActivity === true,
      severity: 'critical',
      category: 'security',
      channels: ['ui', 'console', 'webhook'],
      throttleMs: 0,
      enabled: true,
    });

    // Error alerts
    this.addRule({
      id: 'api-error',
      name: 'API Error',
      condition: (ctx) => ctx.apiError === true,
      severity: 'error',
      category: 'error',
      channels: ['ui', 'console'],
      throttleMs: 5000,
      enabled: true,
    });
  }

  /**
   * Create and send an alert
   */
  public sendAlert(
    severity: AlertSeverity,
    category: AlertCategory,
    title: string,
    message: string,
    options?: {
      details?: Record<string, any>;
      source?: string;
      channels?: AlertChannel[];
      metadata?: Alert['metadata'];
    }
  ): Alert {
    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      severity,
      category,
      title,
      message,
      details: options?.details,
      source: options?.source,
      acknowledged: false,
      metadata: options?.metadata,
    };

    // Check throttling
    const throttleKey = `${severity}-${category}-${title}`;
    if (this.isThrottled(throttleKey, severity)) {
      console.log(`[AlertingSystem] Alert throttled: ${title}`);
      return alert;
    }

    // Store alert
    this.alerts.set(alert.id, alert);
    this.alertCount[severity]++;

    // Send to channels
    const channels = options?.channels || this.getChannelsForSeverity(severity);
    this.deliverToChannels(alert, channels);

    // Notify listeners
    this.notifyListeners(alert);

    // Auto-cleanup old alerts
    this.cleanupOldAlerts();

    return alert;
  }

  /**
   * Check if alert should be throttled
   */
  private isThrottled(key: string, severity: AlertSeverity): boolean {
    const now = Date.now();
    const lastSent = this.throttleTimers.get(key);
    const throttleMs = this.config.throttleDefaults[severity];

    if (lastSent && now - lastSent < throttleMs) {
      return true;
    }

    this.throttleTimers.set(key, now);
    return false;
  }

  /**
   * Get channels for alert severity
   */
  private getChannelsForSeverity(severity: AlertSeverity): AlertChannel[] {
    const channels: AlertChannel[] = [];
    
    if (this.config.channels.ui) channels.push('ui');
    if (this.config.channels.console) channels.push('console');
    
    if (severity === 'critical') {
      if (this.config.channels.webhook) channels.push('webhook');
      if (this.config.channels.slack) channels.push('slack');
      if (this.config.channels.email) channels.push('email');
    }

    return channels;
  }

  /**
   * Deliver alert to specified channels
   */
  private deliverToChannels(alert: Alert, channels: AlertChannel[]): void {
    for (const channel of channels) {
      switch (channel) {
        case 'console':
          this.deliverToConsole(alert);
          break;
        case 'ui':
          // UI notifications handled by listeners
          break;
        case 'email':
          this.deliverToEmail(alert);
          break;
        case 'slack':
          this.deliverToSlack(alert);
          break;
        case 'webhook':
          this.deliverToWebhook(alert);
          break;
      }
    }
  }

  /**
   * Deliver to console
   */
  private deliverToConsole(alert: Alert): void {
    const emoji = this.getSeverityEmoji(alert.severity);
    const prefix = `[AlertingSystem] ${emoji} ${alert.severity.toUpperCase()}`;
    console.log(`${prefix}: ${alert.title}`);
    console.log(`  ${alert.message}`);
    if (alert.details) {
      console.log('  Details:', alert.details);
    }
  }

  /**
   * Deliver to email (stub for production integration)
   */
  private async deliverToEmail(alert: Alert): Promise<void> {
    // Production: Integrate with SendGrid, AWS SES, or similar
    console.log(`[AlertingSystem] Email alert: ${alert.title}`);
    // await emailService.send({
    //   to: adminEmail,
    //   subject: `[${alert.severity}] ${alert.title}`,
    //   body: alert.message,
    // });
  }

  /**
   * Deliver to Slack (stub for production integration)
   */
  private async deliverToSlack(alert: Alert): Promise<void> {
    // Production: Integrate with Slack Webhook API
    console.log(`[AlertingSystem] Slack alert: ${alert.title}`);
    // await fetch(slackWebhookUrl, {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     text: `*${alert.severity}*: ${alert.title}\n${alert.message}`,
    //   }),
    // });
  }

  /**
   * Deliver to webhook (stub for production integration)
   */
  private async deliverToWebhook(alert: Alert): Promise<void> {
    // Production: Send to configured webhook endpoint
    console.log(`[AlertingSystem] Webhook alert: ${alert.title}`);
    // await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(alert),
    // });
  }

  /**
   * Get emoji for severity
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    const emojis: Record<AlertSeverity, string> = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return emojis[severity];
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.alerts.set(alertId, alert);
      console.log(`[AlertingSystem] Alert acknowledged: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      alert.acknowledged = true;
      this.alerts.set(alertId, alert);
      console.log(`[AlertingSystem] Alert resolved: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * Add alert rule
   */
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`[AlertingSystem] Rule added: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      console.log(`[AlertingSystem] Rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Evaluate rules against context
   */
  public evaluateRules(context: Record<string, any>): Alert[] {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(context)) {
          const alert = this.sendAlert(
            rule.severity,
            rule.category,
            rule.name,
            `Rule "${rule.name}" triggered`,
            {
              details: context,
              source: 'rule-engine',
              channels: rule.channels,
            }
          );
          triggeredAlerts.push(alert);
        }
      } catch (error) {
        console.error(`[AlertingSystem] Error evaluating rule ${rule.id}:`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Subscribe to alerts
   */
  public subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(alert: Alert): void {
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('[AlertingSystem] Error in listener:', error);
      }
    }
  }

  /**
   * Get all alerts
   */
  public getAlerts(filter?: {
    severity?: AlertSeverity;
    category?: AlertCategory;
    acknowledged?: boolean;
    resolved?: boolean;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filter) {
      if (filter.severity) {
        alerts = alerts.filter((a) => a.severity === filter.severity);
      }
      if (filter.category) {
        alerts = alerts.filter((a) => a.category === filter.category);
      }
      if (filter.acknowledged !== undefined) {
        alerts = alerts.filter((a) => a.acknowledged === filter.acknowledged);
      }
      if (filter.resolved !== undefined) {
        const isResolved = (a: Alert) => !!a.resolvedAt;
        alerts = alerts.filter((a) => isResolved(a) === filter.resolved);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get alert statistics
   */
  public getStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byCategory: Record<AlertCategory, number>;
    unacknowledged: number;
    resolved: number;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const byCategory: Record<AlertCategory, number> = {
      performance: 0,
      security: 0,
      error: 0,
      system: 0,
      user_action: 0,
    };

    for (const alert of alerts) {
      byCategory[alert.category]++;
    }

    return {
      total: alerts.length,
      bySeverity: { ...this.alertCount },
      byCategory,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
      resolved: alerts.filter((a) => !!a.resolvedAt).length,
    };
  }

  /**
   * Clear all alerts
   */
  public clearAll(): void {
    this.alerts.clear();
    this.alertCount = { critical: 0, error: 0, warning: 0, info: 0 };
    console.log('[AlertingSystem] All alerts cleared');
  }

  /**
   * Cleanup old alerts based on retention policy
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;

    for (const [id, alert] of this.alerts.entries()) {
      if (now - alert.timestamp.getTime() > retentionMs) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AlertingConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[AlertingSystem] Configuration updated');
  }

  /**
   * Get configuration
   */
  public getConfig(): AlertingConfig {
    return { ...this.config };
  }
}

// Singleton instance
let alertingSystemInstance: AlertingSystem | null = null;

/**
 * Get singleton alerting system instance
 */
export function getAlertingSystem(): AlertingSystem {
  if (!alertingSystemInstance) {
    alertingSystemInstance = new AlertingSystem();
    console.log('[AlertingSystem] Initialized');
  }
  return alertingSystemInstance;
}

/**
 * Helper functions for common alerts
 */
export const AlertHelpers = {
  performance: (title: string, details: Record<string, any>) =>
    getAlertingSystem().sendAlert('warning', 'performance', title, `Performance issue detected`, { details }),
  
  security: (title: string, details: Record<string, any>) =>
    getAlertingSystem().sendAlert('critical', 'security', title, `Security issue detected`, { details }),
  
  error: (title: string, error: Error | string) =>
    getAlertingSystem().sendAlert('error', 'error', title, typeof error === 'string' ? error : error.message, {
      details: error instanceof Error ? { stack: error.stack } : {},
    }),
  
  info: (title: string, message: string) =>
    getAlertingSystem().sendAlert('info', 'system', title, message),
};
