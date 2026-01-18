/**
 * useGeminiRateLimiter - React Hook for Rate-Limited Gemini API Calls
 * 
 * ENTERPRISE FEATURES:
 * - Automatic request queuing and throttling
 * - Real-time metrics and progress tracking
 * - Cancellable requests
 * - Priority-based execution
 * - Observable state updates
 * 
 * @module useGeminiRateLimiter
 */

import { useCallback, useEffect, useState } from 'react';
import { geminiRateLimiter, RateLimitMetrics, RateLimitEvent } from '../services/GeminiRateLimiter';

export interface UseGeminiRateLimiterResult {
  /**
   * Execute a Gemini API call with rate limiting
   */
  execute: <T>(
    apiCall: () => Promise<T>,
    priority?: 'high' | 'normal' | 'low'
  ) => Promise<T>;

  /**
   * Current rate limit metrics
   */
  metrics: RateLimitMetrics;

  /**
   * Whether a request is currently being processed
   */
  isProcessing: boolean;

  /**
   * Recent events (last 10)
   */
  recentEvents: RateLimitEvent[];

  /**
   * Estimated wait time for next request (milliseconds)
   */
  estimatedWaitTime: number;

  /**
   * Clear all queued requests
   */
  clearQueue: () => void;

  /**
   * Reset all metrics
   */
  reset: () => void;
}

/**
 * Hook for making rate-limited Gemini API calls
 */
export function useGeminiRateLimiter(): UseGeminiRateLimiterResult {
  const [metrics, setMetrics] = useState<RateLimitMetrics>(
    geminiRateLimiter.getMetrics()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentEvents, setRecentEvents] = useState<RateLimitEvent[]>([]);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(0);

  // Subscribe to rate limiter events
  useEffect(() => {
    const unsubscribe = geminiRateLimiter.on((event) => {
      // Update processing state
      if (event.type === 'executing') {
        setIsProcessing(true);
      } else if (
        event.type === 'completed' ||
        event.type === 'error' ||
        event.type === 'cancelled'
      ) {
        setIsProcessing(false);
      }

      // Update recent events (keep last 10)
      setRecentEvents((prev) => [event, ...prev].slice(0, 10));

      // Update metrics
      setMetrics(geminiRateLimiter.getMetrics());
      setEstimatedWaitTime(geminiRateLimiter.getEstimatedWaitTime());
    });

    // Update metrics periodically
    const interval = setInterval(() => {
      setMetrics(geminiRateLimiter.getMetrics());
      setEstimatedWaitTime(geminiRateLimiter.getEstimatedWaitTime());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Execute a rate-limited API call
  const execute = useCallback(
    async <T,>(
      apiCall: () => Promise<T>,
      priority: 'high' | 'normal' | 'low' = 'normal'
    ): Promise<T> => {
      return geminiRateLimiter.enqueue(apiCall, priority);
    },
    []
  );

  // Clear queue
  const clearQueue = useCallback(() => {
    geminiRateLimiter.clearQueue();
    setMetrics(geminiRateLimiter.getMetrics());
    setEstimatedWaitTime(0);
  }, []);

  // Reset metrics
  const reset = useCallback(() => {
    geminiRateLimiter.reset();
    setMetrics(geminiRateLimiter.getMetrics());
    setRecentEvents([]);
    setEstimatedWaitTime(0);
  }, []);

  return {
    execute,
    metrics,
    isProcessing,
    recentEvents,
    estimatedWaitTime,
    clearQueue,
    reset,
  };
}

/**
 * Hook for displaying rate limit status in UI
 */
export function useRateLimitStatus() {
  const { metrics, estimatedWaitTime } = useGeminiRateLimiter();

  const getStatusColor = useCallback(() => {
    const percentUsed =
      (metrics.requestsThisMinute / 10) * 100; // 10 requests per minute limit

    if (percentUsed >= 90) return 'red';
    if (percentUsed >= 70) return 'orange';
    if (percentUsed >= 50) return 'yellow';
    return 'green';
  }, [metrics.requestsThisMinute]);

  const getStatusMessage = useCallback(() => {
    const remaining = 10 - metrics.requestsThisMinute;

    if (remaining === 0) {
      const waitSeconds = Math.ceil(estimatedWaitTime / 1000);
      return `Rate limit reached. Wait ${waitSeconds}s`;
    }

    if (remaining <= 2) {
      return `⚠️ ${remaining} requests remaining`;
    }

    return `✅ ${remaining}/10 requests available`;
  }, [metrics.requestsThisMinute, estimatedWaitTime]);

  const getQueueStatus = useCallback(() => {
    if (metrics.queueLength === 0) {
      return null;
    }

    return `📋 ${metrics.queueLength} request${metrics.queueLength > 1 ? 's' : ''} queued`;
  }, [metrics.queueLength]);

  return {
    statusColor: getStatusColor(),
    statusMessage: getStatusMessage(),
    queueStatus: getQueueStatus(),
    metrics,
    estimatedWaitTime,
  };
}
