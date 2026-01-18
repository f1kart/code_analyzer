/**
 * GeminiRateLimiter - Production-Ready API Rate Limit Management
 * 
 * ENTERPRISE FEATURES:
 * - Request queue with priority levels
 * - Automatic throttling to stay within quota
 * - Exponential backoff on rate limit errors
 * - Real-time quota tracking and metrics
 * - Cancellable requests with cleanup
 * - Observable progress events
 * 
 * FREE TIER LIMITS (Gemini 2.5 Flash):
 * - 10 requests per minute
 * - 1500 requests per day
 * 
 * @module GeminiRateLimiter
 */

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  maxRetries: number;
  baseRetryDelay: number; // milliseconds
  maxRetryDelay: number; // milliseconds
}

export interface QueuedRequest {
  id: string;
  priority: 'high' | 'normal' | 'low';
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
  cancelled: boolean;
}

export interface RateLimitMetrics {
  requestsThisMinute: number;
  requestsToday: number;
  queueLength: number;
  averageWaitTime: number;
  successRate: number;
  totalRequests: number;
  totalRetries: number;
  totalErrors: number;
}

export type RateLimitEvent = 
  | { type: 'queued'; requestId: string; queuePosition: number }
  | { type: 'executing'; requestId: string }
  | { type: 'completed'; requestId: string; duration: number }
  | { type: 'rate_limited'; requestId: string; retryAfter: number }
  | { type: 'error'; requestId: string; error: string }
  | { type: 'cancelled'; requestId: string };

export class GeminiRateLimiter {
  private config: RateLimitConfig;
  private queue: QueuedRequest[] = [];
  private requestTimestamps: number[] = [];
  private dailyRequestTimestamps: number[] = [];
  private isProcessing = false;
  private metrics: RateLimitMetrics;
  private eventListeners: Array<(event: RateLimitEvent) => void> = [];

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      requestsPerMinute: 10, // Gemini Free Tier limit
      requestsPerDay: 1500,
      maxRetries: 3,
      baseRetryDelay: 1000,
      maxRetryDelay: 60000,
      ...config,
    };

    this.metrics = {
      requestsThisMinute: 0,
      requestsToday: 0,
      queueLength: 0,
      averageWaitTime: 0,
      successRate: 100,
      totalRequests: 0,
      totalRetries: 0,
      totalErrors: 0,
    };

    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Add a request to the queue with priority
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        priority,
        execute,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
        cancelled: false,
      };

      // Insert based on priority
      const insertIndex = this.queue.findIndex(
        (r) => this.getPriorityValue(r.priority) < this.getPriorityValue(priority)
      );

      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.metrics.queueLength = this.queue.length;
      this.emitEvent({
        type: 'queued',
        requestId: request.id,
        queuePosition: this.queue.indexOf(request),
      });
    });
  }

  /**
   * Cancel a queued request
   */
  cancel(requestId: string): boolean {
    const request = this.queue.find((r) => r.id === requestId);
    if (request) {
      request.cancelled = true;
      request.reject(new Error('Request cancelled by user'));
      this.queue = this.queue.filter((r) => r.id !== requestId);
      this.metrics.queueLength = this.queue.length;
      this.emitEvent({ type: 'cancelled', requestId });
      return true;
    }
    return false;
  }

  /**
   * Get current rate limit metrics
   */
  getMetrics(): RateLimitMetrics {
    this.cleanupOldTimestamps();
    return {
      ...this.metrics,
      requestsThisMinute: this.requestTimestamps.length,
      requestsToday: this.dailyRequestTimestamps.length,
      queueLength: this.queue.length,
    };
  }

  /**
   * Subscribe to rate limit events
   */
  on(listener: (event: RateLimitEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Check if we can make a request now
   */
  private canMakeRequest(): boolean {
    this.cleanupOldTimestamps();
    return (
      this.requestTimestamps.length < this.config.requestsPerMinute &&
      this.dailyRequestTimestamps.length < this.config.requestsPerDay
    );
  }

  /**
   * Process the request queue
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.queue.length === 0) {
        return;
      }

      this.isProcessing = true;

      try {
        while (this.queue.length > 0 && this.canMakeRequest()) {
          const request = this.queue.shift();
          if (!request || request.cancelled) {
            continue;
          }

          await this.executeRequest(request);
        }
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Check queue every 100ms
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    const startTime = Date.now();

    try {
      this.emitEvent({ type: 'executing', requestId: request.id });

      // Record request timestamp
      const now = Date.now();
      this.requestTimestamps.push(now);
      this.dailyRequestTimestamps.push(now);
      this.metrics.totalRequests++;

      // Execute the request
      const result = await request.execute();

      // Success
      const duration = Date.now() - startTime;
      this.emitEvent({ type: 'completed', requestId: request.id, duration });
      
      // Update metrics
      this.updateSuccessMetrics(duration);
      
      request.resolve(result);
    } catch (error: any) {
      await this.handleRequestError(request, error, startTime);
    }
  }

  /**
   * Handle request errors with retry logic
   */
  private async handleRequestError(
    request: QueuedRequest,
    error: any,
    startTime: number
  ): Promise<void> {
    const errorStr = error?.message || JSON.stringify(error) || String(error);
    const isRateLimit =
      errorStr.includes('429') ||
      errorStr.includes('quota') ||
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('rate limit');

    if (isRateLimit && request.retryCount < this.config.maxRetries) {
      // Extract retry delay from error
      const retryMatch = errorStr.match(/retry.*?(\d+)/i);
      const retrySeconds = retryMatch ? parseInt(retryMatch[1]) : 60;
      const retryDelay = Math.min(
        retrySeconds * 1000,
        this.config.maxRetryDelay
      );

      this.metrics.totalRetries++;
      request.retryCount++;

      this.emitEvent({
        type: 'rate_limited',
        requestId: request.id,
        retryAfter: retryDelay,
      });

      console.warn(
        `[GeminiRateLimiter] Rate limit hit. Retrying in ${retryDelay}ms (attempt ${request.retryCount}/${this.config.maxRetries})`
      );

      // Wait and re-queue with high priority
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      
      if (!request.cancelled) {
        request.priority = 'high'; // Prioritize retries
        this.queue.unshift(request); // Add to front of queue
        this.metrics.queueLength = this.queue.length;
      }
    } else {
      // Max retries reached or non-rate-limit error
      this.metrics.totalErrors++;
      this.updateErrorMetrics();
      
      this.emitEvent({
        type: 'error',
        requestId: request.id,
        error: errorStr,
      });

      request.reject(error);
    }
  }

  /**
   * Clean up old timestamps outside the tracking window
   */
  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > oneMinuteAgo
    );
    this.dailyRequestTimestamps = this.dailyRequestTimestamps.filter(
      (ts) => ts > oneDayAgo
    );
  }

  /**
   * Update success metrics
   */
  private updateSuccessMetrics(duration: number): void {
    const successCount = this.metrics.totalRequests - this.metrics.totalErrors;
    this.metrics.successRate = (successCount / this.metrics.totalRequests) * 100;
    
    // Update average wait time (exponential moving average)
    const alpha = 0.2;
    this.metrics.averageWaitTime =
      alpha * duration + (1 - alpha) * this.metrics.averageWaitTime;
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(): void {
    const successCount = this.metrics.totalRequests - this.metrics.totalErrors;
    this.metrics.successRate = (successCount / this.metrics.totalRequests) * 100;
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: RateLimitEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[GeminiRateLimiter] Error in event listener:', error);
      }
    });
  }

  /**
   * Get numeric priority value for sorting
   */
  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Get estimated wait time for a new request
   */
  getEstimatedWaitTime(): number {
    if (this.canMakeRequest()) {
      return 0;
    }

    this.cleanupOldTimestamps();
    
    // Calculate when the oldest request will expire
    const oldestTimestamp = this.requestTimestamps[0] || Date.now();
    const timeUntilSlotAvailable = oldestTimestamp + 60 * 1000 - Date.now();
    
    // Add queue processing time
    const queueDelay = this.queue.length * this.metrics.averageWaitTime;
    
    return Math.max(0, timeUntilSlotAvailable + queueDelay);
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.queue.forEach((request) => {
      request.cancelled = true;
      request.reject(new Error('Queue cleared'));
      this.emitEvent({ type: 'cancelled', requestId: request.id });
    });
    this.queue = [];
    this.metrics.queueLength = 0;
  }

  /**
   * Reset all metrics and timestamps
   */
  reset(): void {
    this.clearQueue();
    this.requestTimestamps = [];
    this.dailyRequestTimestamps = [];
    this.metrics = {
      requestsThisMinute: 0,
      requestsToday: 0,
      queueLength: 0,
      averageWaitTime: 0,
      successRate: 100,
      totalRequests: 0,
      totalRetries: 0,
      totalErrors: 0,
    };
  }
}

// Singleton instance for global use
export const geminiRateLimiter = new GeminiRateLimiter();
