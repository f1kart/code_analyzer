interface RateLimitRule {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  limit: number; // requests per window
  window: number; // window size in milliseconds
  strategy: 'fixed' | 'sliding' | 'token_bucket';
  burst?: number; // for token bucket strategy
  refillRate?: number; // tokens per second for token bucket
}

interface APIRoute {
  id: string;
  path: string;
  method: string;
  handler: string;
  middleware: string[];
  rateLimit?: string; // Rate limit rule ID
  authentication?: boolean;
  authorization?: string[];
  cors?: {
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
}

interface APIKey {
  id: string;
  key: string;
  name: string;
  userId?: string;
  permissions: string[];
  rateLimits?: string[]; // Rate limit rule IDs
  expiresAt?: Date;
  lastUsed?: Date;
  isActive: boolean;
}

interface RequestContext {
  requestId: string;
  userId?: string;
  apiKey?: string;
  startTime: number;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
  traceId?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class APIGatewayService {
  private routes: Map<string, APIRoute> = new Map();
  private rateLimitRules: Map<string, RateLimitRule> = new Map();
  private apiKeys: Map<string, APIKey> = new Map();
  private requestCounts: Map<string, Map<string, number>> = new Map(); // endpoint -> clientId -> count
  private slidingWindows: Map<string, Map<string, number[]>> = new Map(); // endpoint -> clientId -> timestamps
  private tokenBuckets: Map<string, Map<string, { tokens: number; lastRefill: number }>> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Register an API route
   */
  registerRoute(route: APIRoute): void {
    const key = `${route.method}:${route.path}`;
    this.routes.set(key, route);
    console.log(`✅ Registered route: ${route.method} ${route.path}`);
  }

  /**
   * Register a rate limit rule
   */
  registerRateLimitRule(rule: RateLimitRule): void {
    this.rateLimitRules.set(rule.id, rule);
    console.log(`✅ Registered rate limit rule: ${rule.name}`);
  }

  /**
   * Register an API key
   */
  registerAPIKey(apiKey: APIKey): void {
    this.apiKeys.set(apiKey.key, apiKey);
    console.log(`✅ Registered API key: ${apiKey.name}`);
  }

  /**
   * Process an incoming request
   */
  async processRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any,
    query?: Record<string, string>
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: any;
    context?: RequestContext;
  }> {
    const requestId = this.generateRequestId();
    const context: RequestContext = {
      requestId,
      startTime: Date.now(),
      method,
      path,
      ip: this.extractClientIP(headers),
      userAgent: headers['user-agent'],
    };

    try {
      // Find matching route
      const route = this.findRoute(method, path);
      if (!route) {
        return this.createErrorResponse(404, 'Route not found', context);
      }

      context.traceId = this.extractTraceId(headers);

      // Authenticate request
      const authResult = await this.authenticateRequest(route, headers, context);
      if (!authResult.allowed) {
        return this.createErrorResponse(authResult.status, authResult.message, context);
      }

      // Apply rate limiting
      const rateLimitResult = await this.checkRateLimit(route, context);
      if (!rateLimitResult.allowed) {
        return this.createRateLimitResponse(rateLimitResult, context);
      }

      // Route to handler (simulated)
      const handlerResult = await this.routeToHandler(route, body, query || {}, context);

      // Add rate limit headers
      const responseHeaders: Record<string, string> = {
        ...(handlerResult.headers || {}),
        'X-RateLimit-Limit': rateLimitResult.remaining.toString(),
        'X-RateLimit-Remaining': Math.max(0, rateLimitResult.remaining - 1).toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        'X-Request-ID': requestId,
      };

      return {
        status: handlerResult.status,
        headers: responseHeaders,
        body: handlerResult.body,
        context,
      };

    } catch (error) {
      console.error('API Gateway error:', error);
      return this.createErrorResponse(500, 'Internal server error', context);
    }
  }

  /**
   * Get API gateway statistics
   */
  getStats(): {
    routes: number;
    rateLimitRules: number;
    activeAPIKeys: number;
    requestCounts: Record<string, number>;
  } {
    return {
      routes: this.routes.size,
      rateLimitRules: this.rateLimitRules.size,
      activeAPIKeys: Array.from(this.apiKeys.values()).filter(key => key.isActive).length,
      requestCounts: this.getRequestCounts(),
    };
  }

  /**
   * Get rate limit status for a client
   */
  getRateLimitStatus(clientId: string, ruleId?: string): Array<{
    ruleId: string;
    ruleName: string;
    currentCount: number;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const status: Array<{
      ruleId: string;
      ruleName: string;
      currentCount: number;
      limit: number;
      remaining: number;
      resetTime: number;
    }> = [];

    for (const [id, rule] of this.rateLimitRules.entries()) {
      if (ruleId && ruleId !== id) continue;

      const currentCount = this.getCurrentRequestCount(`${rule.method}:${rule.endpoint}`, clientId);
      const remaining = Math.max(0, rule.limit - currentCount);
      const resetTime = this.calculateResetTime(rule);

      status.push({
        ruleId: id,
        ruleName: rule.name,
        currentCount,
        limit: rule.limit,
        remaining,
        resetTime,
      });
    }

    return status;
  }

  /**
   * Find matching route for request
   */
  private findRoute(method: string, path: string): APIRoute | null {
    // Simple exact match for now - in production, implement proper routing
    const routeKey = `${method}:${path}`;
    return this.routes.get(routeKey) || null;
  }

  /**
   * Authenticate request
   */
  private async authenticateRequest(
    route: APIRoute,
    headers: Record<string, string>,
    context: RequestContext
  ): Promise<{ allowed: boolean; status: number; message: string }> {
    // Skip authentication if not required
    if (!route.authentication) {
      return { allowed: true, status: 200, message: 'OK' };
    }

    // Check API key
    const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
    if (!apiKey) {
      return { allowed: false, status: 401, message: 'API key required' };
    }

    const keyRecord = this.apiKeys.get(apiKey);
    if (!keyRecord || !keyRecord.isActive) {
      return { allowed: false, status: 401, message: 'Invalid API key' };
    }

    // Check expiration
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return { allowed: false, status: 401, message: 'API key expired' };
    }

    // Update last used
    keyRecord.lastUsed = new Date();
    context.apiKey = apiKey;
    context.userId = keyRecord.userId;

    return { allowed: true, status: 200, message: 'OK' };
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(route: APIRoute, context: RequestContext): Promise<RateLimitResult> {
    if (!route.rateLimit) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const rule = this.rateLimitRules.get(route.rateLimit);
    if (!rule) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const clientId = context.apiKey || context.ip;
    const endpointKey = `${rule.method}:${rule.endpoint}`;

    switch (rule.strategy) {
      case 'fixed':
        return this.checkFixedWindowRateLimit(rule, endpointKey, clientId);
      case 'sliding':
        return this.checkSlidingWindowRateLimit(rule, endpointKey, clientId);
      case 'token_bucket':
        return this.checkTokenBucketRateLimit(rule, endpointKey, clientId);
      default:
        return { allowed: true, remaining: Infinity, resetTime: 0 };
    }
  }

  /**
   * Fixed window rate limiting
   */
  private checkFixedWindowRateLimit(rule: RateLimitRule, endpointKey: string, clientId: string): RateLimitResult {
    if (!this.requestCounts.has(endpointKey)) {
      this.requestCounts.set(endpointKey, new Map());
    }

    const endpointCounts = this.requestCounts.get(endpointKey)!;
    const currentCount = endpointCounts.get(clientId) || 0;

    if (currentCount >= rule.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + rule.window,
        retryAfter: rule.window,
      };
    }

    return {
      allowed: true,
      remaining: rule.limit - currentCount - 1,
      resetTime: Date.now() + rule.window,
    };
  }

  /**
   * Sliding window rate limiting
   */
  private checkSlidingWindowRateLimit(rule: RateLimitRule, endpointKey: string, clientId: string): RateLimitResult {
    if (!this.slidingWindows.has(endpointKey)) {
      this.slidingWindows.set(endpointKey, new Map());
    }

    const endpointWindows = this.slidingWindows.get(endpointKey)!;
    if (!endpointWindows.has(clientId)) {
      endpointWindows.set(clientId, []);
    }

    const timestamps = endpointWindows.get(clientId)!;
    const now = Date.now();
    const windowStart = now - rule.window;

    // Remove old timestamps
    const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
    endpointWindows.set(clientId, validTimestamps);

    if (validTimestamps.length >= rule.limit) {
      const oldestValidTimestamp = Math.min(...validTimestamps);
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestValidTimestamp + rule.window,
        retryAfter: oldestValidTimestamp + rule.window - now,
      };
    }

    return {
      allowed: true,
      remaining: rule.limit - validTimestamps.length - 1,
      resetTime: now + rule.window,
    };
  }

  /**
   * Token bucket rate limiting
   */
  private checkTokenBucketRateLimit(rule: RateLimitRule, endpointKey: string, clientId: string): RateLimitResult {
    if (!this.tokenBuckets.has(endpointKey)) {
      this.tokenBuckets.set(endpointKey, new Map());
    }

    const endpointBuckets = this.tokenBuckets.get(endpointKey)!;
    if (!endpointBuckets.has(clientId)) {
      endpointBuckets.set(clientId, {
        tokens: rule.burst || rule.limit,
        lastRefill: Date.now(),
      });
    }

    const bucket = endpointBuckets.get(clientId)!;
    const now = Date.now();

    // Refill tokens
    const timePassed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * (rule.refillRate || (rule.limit / (rule.window / 1000)));
    bucket.tokens = Math.min(rule.burst || rule.limit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + (1 / (rule.refillRate || 1)) * 1000,
        retryAfter: (1 / (rule.refillRate || 1)) * 1000,
      };
    }

    bucket.tokens -= 1;

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetTime: now + (rule.burst || rule.limit) / (rule.refillRate || 1) * 1000,
    };
  }

  /**
   * Route to handler (simulated)
   */
  private async routeToHandler(
    route: APIRoute,
    body: any,
    query: Record<string, string>,
    context: RequestContext
  ): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    // Simulate different response types
    switch (route.handler) {
      case 'ai-review':
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: true,
            reviewId: `review_${Date.now()}`,
            status: 'completed',
            traceId: context.traceId,
          },
        };

      case 'health-check':
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        };

      case 'metrics':
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            requests: this.getStats(),
            rateLimits: this.getRateLimitStatus(context.apiKey || context.ip),
          },
        };

      default:
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'OK', handler: route.handler },
        };
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(status: number, message: string, context: RequestContext) {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.requestId,
      },
      body: {
        error: message,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Create rate limit response
   */
  private createRateLimitResponse(rateLimitResult: RateLimitResult, context: RequestContext) {
    return {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimitResult.remaining.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        'Retry-After': (rateLimitResult.retryAfter || 0).toString(),
        'X-Request-ID': context.requestId,
      },
      body: {
        error: 'Rate limit exceeded',
        requestId: context.requestId,
        retryAfter: rateLimitResult.retryAfter,
        resetTime: rateLimitResult.resetTime,
      },
    };
  }

  /**
   * Helper methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractClientIP(headers: Record<string, string>): string {
    return headers['x-forwarded-for']?.split(',')[0] ||
           headers['x-real-ip'] ||
           '127.0.0.1';
  }

  private extractTraceId(headers: Record<string, string>): string | undefined {
    return headers['x-trace-id'] || headers['x-request-id'];
  }

  private getCurrentRequestCount(endpointKey: string, clientId: string): number {
    return this.requestCounts.get(endpointKey)?.get(clientId) || 0;
  }

  private calculateResetTime(rule: RateLimitRule): number {
    return Date.now() + rule.window;
  }

  private getRequestCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const [endpoint, clientCounts] of this.requestCounts.entries()) {
      let total = 0;
      for (const count of clientCounts.values()) {
        total += count;
      }
      counts[endpoint] = total;
    }

    return counts;
  }

  private initializeDefaultRules(): void {
    // Default rate limit rules
    this.registerRateLimitRule({
      id: 'api-key-default',
      name: 'API Key Default Rate Limit',
      endpoint: '*',
      method: '*',
      limit: 1000,
      window: 60000, // 1 minute
      strategy: 'sliding',
    });

    this.registerRateLimitRule({
      id: 'ai-review-limit',
      name: 'AI Review Rate Limit',
      endpoint: '/api/ai/review',
      method: 'POST',
      limit: 10,
      window: 60000, // 1 minute
      strategy: 'token_bucket',
      burst: 5,
      refillRate: 0.1, // 0.1 tokens per second
    });

    this.registerRateLimitRule({
      id: 'ip-default',
      name: 'IP Default Rate Limit',
      endpoint: '*',
      method: '*',
      limit: 100,
      window: 60000, // 1 minute
      strategy: 'sliding',
    });

    // Default routes
    this.registerRoute({
      id: 'health-check',
      path: '/health',
      method: 'GET',
      handler: 'health-check',
      middleware: ['cors', 'logging'],
      authentication: false,
    });

    this.registerRoute({
      id: 'ai-review',
      path: '/api/ai/review',
      method: 'POST',
      handler: 'ai-review',
      middleware: ['cors', 'auth', 'rate-limit', 'logging'],
      rateLimit: 'ai-review-limit',
      authentication: true,
      cors: {
        origins: ['*'],
        methods: ['POST'],
        headers: ['Content-Type', 'Authorization'],
        credentials: true,
      },
    });

    this.registerRoute({
      id: 'metrics',
      path: '/api/metrics',
      method: 'GET',
      handler: 'metrics',
      middleware: ['cors', 'auth', 'rate-limit', 'logging'],
      rateLimit: 'api-key-default',
      authentication: true,
    });
  }
}

// Singleton instance
let apiGatewayService: APIGatewayService | null = null;

export function initializeAPIGateway(): APIGatewayService {
  if (!apiGatewayService) {
    apiGatewayService = new APIGatewayService();
  }
  return apiGatewayService;
}

export function getAPIGatewayService(): APIGatewayService | null {
  return apiGatewayService;
}

// Convenience functions
export async function processAPIRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: any,
  query?: Record<string, string>
) {
  const gateway = getAPIGatewayService();
  return gateway?.processRequest(method, path, headers, body, query);
}

export function registerAPIRoute(route: APIRoute): void {
  const gateway = getAPIGatewayService();
  gateway?.registerRoute(route);
}

export function registerAPIKey(apiKey: APIKey): void {
  const gateway = getAPIGatewayService();
  gateway?.registerAPIKey(apiKey);
}
