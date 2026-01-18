// WebhookManager.ts - Enterprise-grade webhook integration system
// Provides webhook management, event handling, and external system integration

import { AuditLogger } from './AuditLogger';
import { PerformanceMonitor } from './PerformanceMonitor';
import { APIManager } from './APIManager';

export interface WebhookConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  events: WebhookEvent[];
  headers: Record<string, string>;
  authentication?: WebhookAuth;
  retryPolicy: RetryPolicy;
  rateLimit?: RateLimitConfig;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface WebhookEvent {
  type: 'code_review' | 'security_scan' | 'test_completion' | 'deployment' | 'system_alert' | 'custom';
  filters?: EventFilter[];
  payload: WebhookPayload;
}

export interface EventFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
  value: any;
}

export interface WebhookPayload {
  template: string; // Handlebars template or JSON schema
  includeMetadata: boolean;
  includeRawData: boolean;
  customFields?: Record<string, any>;
}

export interface WebhookAuth {
  type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth' | 'hmac';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    secret?: string;
  };
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number; // seconds
  maxDelay: number; // seconds
}

export interface RateLimitConfig {
  requests: number;
  window: number; // seconds
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  error?: string;
  createdAt: Date;
}

export interface WebhookAnalytics {
  timeRange: { start: Date; end: Date };
  summary: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    successRate: number;
  };
  byEvent: Record<string, EventAnalytics>;
  byWebhook: Record<string, WebhookAnalytics>;
  failures: WebhookFailure[];
  recommendations: string[];
}

export interface EventAnalytics {
  eventType: string;
  deliveries: number;
  successRate: number;
  averageResponseTime: number;
  failures: number;
}

export interface WebhookFailure {
  deliveryId: string;
  webhookId: string;
  eventType: string;
  error: string;
  statusCode?: number;
  timestamp: Date;
  retryCount: number;
}

export class WebhookManager {
  private auditLogger: AuditLogger;
  private performanceMonitor: PerformanceMonitor;
  private apiManager: APIManager;
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private eventQueue: WebhookEvent[] = [];
  private retryQueue: WebhookDelivery[] = [];

  constructor(
    auditLogger?: AuditLogger,
    performanceMonitor?: PerformanceMonitor,
    apiManager?: APIManager
  ) {
    this.auditLogger = auditLogger || new AuditLogger();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    this.apiManager = apiManager || new APIManager();

    this.initializeWebhookSystem();
  }

  /**
   * Registers a new webhook
   * @param config Webhook configuration
   * @param registeredBy User registering the webhook
   * @returns Created webhook
   */
  async registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'lastTriggered'>, registeredBy: string): Promise<WebhookConfig> {
    const webhook: WebhookConfig = {
      id: this.generateWebhookId(),
      createdAt: new Date(),
      ...config
    };

    this.webhooks.set(webhook.id, webhook);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Webhook registered',
      {
        webhookId: webhook.id,
        webhookName: webhook.name,
        url: webhook.url,
        events: webhook.events.map(e => e.type),
        enabled: webhook.enabled
      },
      { userId: registeredBy }
    );

    return webhook;
  }

  /**
   * Triggers webhook delivery for an event
   * @param eventType Event type
   * @param payload Event payload
   * @param context Event context
   */
  async triggerWebhook(eventType: WebhookEvent['type'], payload: any, context: EventContext = {}): Promise<void> {
    // Find matching webhooks
    const matchingWebhooks = Array.from(this.webhooks.values()).filter(webhook =>
      webhook.enabled && webhook.events.some(event => event.type === eventType)
    );

    if (matchingWebhooks.length === 0) {
      return;
    }

    console.log(`📡 Triggering ${matchingWebhooks.length} webhooks for event: ${eventType}`);

    // Create delivery records
    for (const webhook of matchingWebhooks) {
      const delivery = await this.createWebhookDelivery(webhook, eventType, payload, context);

      // Add to delivery queue
      this.deliveries.set(delivery.id, delivery);
      this.eventQueue.push({
        type: eventType,
        payload: {
          template: JSON.stringify(payload),
          includeMetadata: true,
          includeRawData: false
        }
      });

      // Trigger immediate delivery
      this.deliverWebhook(delivery).catch(error => {
        console.error(`Webhook delivery failed for ${webhook.name}:`, error);
      });
    }
  }

  /**
   * Handles webhook delivery with retry logic
   * @param delivery Webhook delivery
   */
  private async deliverWebhook(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook) {
      delivery.status = 'failed';
      delivery.error = 'Webhook not found';
      return;
    }

    delivery.status = 'sent';
    delivery.attempts++;
    delivery.lastAttempt = new Date();

    try {
      const startTime = Date.now();

      // Prepare request
      const request = this.prepareWebhookRequest(webhook, delivery);

      // Send webhook
      const response = await this.sendWebhookRequest(request);

      delivery.response = {
        statusCode: response.status,
        headers: response.headers,
        body: response.body,
        duration: Date.now() - startTime
      };

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'sent';

        // Record successful delivery
        this.performanceMonitor.recordMetric(
          'webhook_delivered',
          1,
          'count',
          {
            webhookId: webhook.id,
            eventType: delivery.eventType,
            statusCode: response.status.toString()
          }
        );

      } else {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
      }

    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';

      // Schedule retry if configured
      if (delivery.attempts < webhook.retryPolicy.maxRetries) {
        delivery.status = 'retrying';
        delivery.nextRetry = this.calculateNextRetry(delivery.attempts, webhook.retryPolicy);

        this.retryQueue.push(delivery);

        this.performanceMonitor.recordMetric(
          'webhook_retry_scheduled',
          1,
          'count',
          {
            webhookId: webhook.id,
            attempt: delivery.attempts.toString()
          }
        );
      }

      this.performanceMonitor.recordMetric(
        'webhook_delivery_failed',
        1,
        'count',
        {
          webhookId: webhook.id,
          eventType: delivery.eventType,
          error: delivery.error
        }
      );
    }

    this.deliveries.set(delivery.id, delivery);

    // Log delivery attempt
    await this.auditLogger.logEvent(
      'data_exported',
      'Webhook delivery attempt',
      {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        eventType: delivery.eventType,
        status: delivery.status,
        attempts: delivery.attempts,
        responseStatus: delivery.response?.statusCode
      },
      { resourceType: 'system_event' }
    );
  }

  /**
   * Processes retry queue
   */
  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const readyRetries = this.retryQueue.filter(delivery => delivery.nextRetry && delivery.nextRetry.getTime() <= now);

    for (const delivery of readyRetries) {
      // Remove from retry queue
      this.retryQueue = this.retryQueue.filter(d => d.id !== delivery.id);

      // Retry delivery
      await this.deliverWebhook(delivery);
    }
  }

  /**
   * Gets webhook analytics
   * @param timeRange Time range for analytics
   * @returns Webhook analytics
   */
  async getWebhookAnalytics(timeRange: { start: Date; end: Date }): Promise<WebhookAnalytics> {
    const deliveries = Array.from(this.deliveries.values()).filter(delivery =>
      delivery.createdAt >= timeRange.start && delivery.createdAt <= timeRange.end
    );

    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(d => d.status === 'sent').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;

    // Group by event type
    const byEvent: Record<string, EventAnalytics> = {};
    for (const delivery of deliveries) {
      if (!byEvent[delivery.eventType]) {
        byEvent[delivery.eventType] = {
          eventType: delivery.eventType,
          deliveries: 0,
          successRate: 0,
          averageResponseTime: 0,
          failures: 0
        };
      }

      const eventAnalytics = byEvent[delivery.eventType];
      eventAnalytics.deliveries++;
      eventAnalytics.averageResponseTime += delivery.response?.duration || 0;

      if (delivery.status === 'sent') {
        eventAnalytics.successRate = (eventAnalytics.deliveries - eventAnalytics.failures) / eventAnalytics.deliveries;
      } else {
        eventAnalytics.failures++;
      }
    }

    // Calculate averages
    for (const eventAnalytics of Object.values(byEvent)) {
      eventAnalytics.averageResponseTime /= eventAnalytics.deliveries;
    }

    // Get failures
    const failures = deliveries
      .filter(d => d.status === 'failed')
      .map(d => ({
        deliveryId: d.id,
        webhookId: d.webhookId,
        eventType: d.eventType,
        error: d.error || 'Unknown error',
        statusCode: d.response?.statusCode,
        timestamp: d.createdAt,
        retryCount: d.attempts
      }));

    return {
      timeRange,
      summary: {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        averageResponseTime: deliveries.reduce((sum, d) => sum + (d.response?.duration || 0), 0) / Math.max(deliveries.length, 1),
        successRate: totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 0
      },
      byEvent,
      byWebhook: {}, // Would be populated in production
      failures,
      recommendations: this.generateWebhookRecommendations(deliveries, failures)
    };
  }

  /**
   * Tests webhook configuration
   * @param webhookId Webhook ID to test
   * @param testPayload Test payload
   * @returns Test result
   */
  async testWebhook(webhookId: string, testPayload: any): Promise<WebhookTestResult> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const testDelivery: WebhookDelivery = {
      id: `test_${Date.now()}`,
      webhookId,
      eventType: 'test',
      payload: testPayload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    };

    try {
      await this.deliverWebhook(testDelivery);

      return {
        webhookId,
        success: testDelivery.status === 'sent',
        statusCode: testDelivery.response?.statusCode,
        responseTime: testDelivery.response?.duration,
        error: testDelivery.error,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        webhookId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Updates webhook configuration
   * @param webhookId Webhook ID
   * @param updates Configuration updates
   * @param updatedBy User making updates
   */
  async updateWebhook(webhookId: string, updates: Partial<WebhookConfig>, updatedBy: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    Object.assign(webhook, updates);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Webhook configuration updated',
      {
        webhookId,
        updates: Object.keys(updates),
        updatedBy
      },
      { userId: updatedBy }
    );
  }

  /**
   * Removes a webhook
   * @param webhookId Webhook ID
   * @param removedBy User removing webhook
   */
  async removeWebhook(webhookId: string, removedBy: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    this.webhooks.delete(webhookId);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Webhook removed',
      {
        webhookId,
        webhookName: webhook.name,
        url: webhook.url
      },
      { userId: removedBy }
    );
  }

  /**
   * Gets webhook delivery history
   * @param webhookId Optional webhook ID filter
   * @param limit Maximum number of deliveries to return
   * @returns Delivery history
   */
  async getDeliveryHistory(webhookId?: string, limit: number = 100): Promise<WebhookDelivery[]> {
    let deliveries = Array.from(this.deliveries.values());

    if (webhookId) {
      deliveries = deliveries.filter(d => d.webhookId === webhookId);
    }

    return deliveries
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  private initializeWebhookSystem(): void {
    // Initialize webhook processing
    this.startWebhookProcessor();

    // Set up retry processor
    this.startRetryProcessor();

    // Register default webhook endpoints
    this.registerDefaultWebhookEndpoints();
  }

  private startWebhookProcessor(): void {
    // Process webhook queue every 5 seconds
    setInterval(() => {
      this.processWebhookQueue();
    }, 5000);
  }

  private startRetryProcessor(): void {
    // Process retry queue every 30 seconds
    setInterval(() => {
      this.processRetryQueue();
    }, 30000);
  }

  private async processWebhookQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    // Process queued events
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      // Process event (would trigger webhooks in production)
    }
  }

  private async createWebhookDelivery(
    webhook: WebhookConfig,
    eventType: string,
    payload: any,
    context: EventContext
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: this.generateDeliveryId(),
      webhookId: webhook.id,
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date()
    };

    return delivery;
  }

  private prepareWebhookRequest(webhook: WebhookConfig, delivery: WebhookDelivery): any {
    // Prepare HTTP request for webhook
    return {
      url: webhook.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enterprise-Code-Review-Webhook/1.0',
        ...webhook.headers
      },
      body: JSON.stringify(delivery.payload),
      timeout: 30000 // 30 seconds
    };
  }

  private async sendWebhookRequest(request: any): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    // Real HTTP request implementation
    try {
      const response = await fetch(request.url, {
        method: request.method || 'POST',
        headers: request.headers || {},
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseText = await response.text();
      const responseHeaders: Record<string, string> = {};
      
      // Convert Headers to plain object
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body: responseText
      };
    } catch (error) {
      // Handle network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Webhook request timeout after 30 seconds');
        }
        throw new Error(`Webhook request failed: ${error.message}`);
      }
      throw new Error('Webhook request failed with unknown error');
    }
  }

  private calculateNextRetry(attempt: number, retryPolicy: RetryPolicy): Date {
    let delay: number;

    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        delay = retryPolicy.baseDelay * attempt;
        break;
      case 'exponential':
        delay = retryPolicy.baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'fixed':
        delay = retryPolicy.baseDelay;
        break;
      default:
        delay = retryPolicy.baseDelay;
    }

    delay = Math.min(delay, retryPolicy.maxDelay);

    return new Date(Date.now() + (delay * 1000));
  }

  private generateWebhookId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeliveryId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private registerDefaultWebhookEndpoints(): void {
    // Register webhook management endpoints
    [
      {
        path: '/webhooks',
        method: 'GET',
        handler: 'listWebhooks',
        authentication: { required: true, methods: ['bearer'] },
        authorization: { required: true, permissions: ['webhook.read'], roles: ['admin'] }
      },
      {
        path: '/webhooks',
        method: 'POST',
        handler: 'createWebhook',
        authentication: { required: true, methods: ['bearer'] },
        authorization: { required: true, permissions: ['webhook.create'], roles: ['admin'] }
      },
      {
        path: '/webhooks/:id',
        method: 'PUT',
        handler: 'updateWebhook',
        authentication: { required: true, methods: ['bearer'] },
        authorization: { required: true, permissions: ['webhook.update'], roles: ['admin'] }
      },
      {
        path: '/webhooks/:id',
        method: 'DELETE',
        handler: 'deleteWebhook',
        authentication: { required: true, methods: ['bearer'] },
        authorization: { required: true, permissions: ['webhook.delete'], roles: ['admin'] }
      },
      {
        path: '/webhooks/:id/test',
        method: 'POST',
        handler: 'testWebhook',
        authentication: { required: true, methods: ['bearer'] },
        authorization: { required: true, permissions: ['webhook.test'], roles: ['admin'] }
      }
    ].forEach(endpoint => {
      this.apiManager.registerEndpoint(endpoint as any, 'system').catch(console.error);
    });
  }

  private generateWebhookRecommendations(deliveries: WebhookDelivery[], failures: WebhookFailure[]): string[] {
    const recommendations: string[] = [];

    if (failures.length > deliveries.length * 0.1) {
      recommendations.push('High webhook failure rate - check webhook URLs and configurations');
    }

    const slowDeliveries = deliveries.filter(d => d.response && d.response.duration > 5000);
    if (slowDeliveries.length > 0) {
      recommendations.push('Some webhooks are slow - consider optimizing webhook endpoints');
    }

    const retryDeliveries = deliveries.filter(d => d.attempts > 1);
    if (retryDeliveries.length > 0) {
      recommendations.push(`${retryDeliveries.length} webhook deliveries required retries - review reliability`);
    }

    return recommendations;
  }
}

interface WebhookTestResult {
  webhookId: string;
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  timestamp: Date;
}

interface EventContext {
  userId?: string;
  sessionId?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}
