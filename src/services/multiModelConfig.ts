export interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'azure' | 'local' | 'custom';
  baseUrl: string;
  apiKey: string;
  models: AIModel[];
  isActive: boolean;
  rateLimits: RateLimit;
  settings: ProviderSettings;
  metadata: ProviderMetadata;
}

export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  type: 'completion' | 'chat' | 'embedding' | 'image' | 'audio' | 'multimodal';
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  pricing: ModelPricing;
  performance: ModelPerformance;
  isActive: boolean;
  settings: ModelSettings;
}

export interface ModelCapabilities {
  maxTokens: number;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsCodeGeneration: boolean;
  supportsReasoning: boolean;
  languages: string[];
  specialties: string[];
}

export interface ModelLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay: number;
  maxConcurrentRequests: number;
  timeoutMs: number;
}

export interface ModelPricing {
  inputTokenPrice: number;
  outputTokenPrice: number;
  currency: string;
  billingUnit: 'token' | 'request' | 'minute';
}

export interface ModelPerformance {
  averageLatency: number;
  successRate: number;
  qualityScore: number;
  lastBenchmark: number;
  benchmarkResults: BenchmarkResult[];
}

export interface BenchmarkResult {
  task: string;
  score: number;
  timestamp: number;
  details: Record<string, any>;
}

export interface ModelSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  systemPrompt?: string;
  customParameters: Record<string, any>;
}

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  windowSize: number;
}

export interface ProviderSettings {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  enableMetrics: boolean;
  enableCaching: boolean;
  cacheExpiry: number;
  customHeaders: Record<string, string>;
}

export interface ProviderMetadata {
  description: string;
  website: string;
  documentation: string;
  supportEmail: string;
  version: string;
  lastUpdated: number;
  features: string[];
  limitations: string[];
}

export interface ModelProfile {
  id: string;
  name: string;
  description: string;
  models: ModelAssignment[];
  fallbackChain: string[];
  loadBalancing: LoadBalancingConfig;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ModelAssignment {
  task: 'completion' | 'chat' | 'embedding' | 'analysis' | 'generation' | 'reasoning';
  modelId: string;
  weight: number;
  conditions: AssignmentCondition[];
}

export interface AssignmentCondition {
  type: 'context_length' | 'complexity' | 'language' | 'domain' | 'performance' | 'cost';
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'matches';
  value: any;
}

export interface LoadBalancingConfig {
  strategy: 'round_robin' | 'weighted' | 'least_latency' | 'least_cost' | 'random';
  healthCheck: boolean;
  failoverEnabled: boolean;
  circuitBreaker: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenRequests: number;
}

export interface ModelUsageStats {
  modelId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  averageLatency: number;
  lastUsed: number;
  usageByDay: DailyUsage[];
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
}

export class MultiModelConfigManager {
  private providers = new Map<string, AIProvider>();
  private models = new Map<string, AIModel>();
  private profiles = new Map<string, ModelProfile>();
  private usageStats = new Map<string, ModelUsageStats>();
  private activeProfile: ModelProfile | null = null;
  private configCallbacks = new Set<() => void>();

  constructor() {
    this.loadConfiguration();
    this.initializeDefaultProviders();
  }

  // Provider Management
  async addProvider(provider: Omit<AIProvider, 'id'>): Promise<AIProvider> {
    const newProvider: AIProvider = {
      ...provider,
      id: `provider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Validate provider connection
    await this.validateProvider(newProvider);

    this.providers.set(newProvider.id, newProvider);

    // Add models to global models map
    for (const model of newProvider.models) {
      this.models.set(model.id, { ...model, providerId: newProvider.id });
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
    return newProvider;
  }

  async updateProvider(providerId: string, updates: Partial<AIProvider>): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found`);

    const updatedProvider = { ...provider, ...updates };

    // Validate if connection details changed
    if (updates.apiKey || updates.baseUrl) {
      await this.validateProvider(updatedProvider);
    }

    this.providers.set(providerId, updatedProvider);
    this.saveConfiguration();
    this.notifyConfigChanged();
  }

  async removeProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    // Remove associated models
    for (const model of provider.models) {
      this.models.delete(model.id);
    }

    this.providers.delete(providerId);
    this.saveConfiguration();
    this.notifyConfigChanged();
  }

  async validateProvider(provider: AIProvider): Promise<boolean> {
    try {
      // Test connection with a simple request
      const testModel = provider.models.find((m) => m.type === 'chat');
      if (!testModel) return true; // Skip validation if no chat model

      const response = await this.makeTestRequest(provider, testModel);
      return response.success;
    } catch (error) {
      throw new Error(`Provider validation failed: ${error}`);
    }
  }

  // Model Management
  async addModel(model: Omit<AIModel, 'id'>): Promise<AIModel> {
    const newModel: AIModel = {
      ...model,
      id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.models.set(newModel.id, newModel);

    // Add to provider's models list
    const provider = this.providers.get(newModel.providerId);
    if (provider) {
      provider.models.push(newModel);
      this.providers.set(provider.id, provider);
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
    return newModel;
  }

  async updateModel(modelId: string, updates: Partial<AIModel>): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);

    const updatedModel = { ...model, ...updates };
    this.models.set(modelId, updatedModel);

    // Update in provider's models list
    const provider = this.providers.get(model.providerId);
    if (provider) {
      const modelIndex = provider.models.findIndex((m) => m.id === modelId);
      if (modelIndex >= 0) {
        provider.models[modelIndex] = updatedModel;
        this.providers.set(provider.id, provider);
      }
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
  }

  async removeModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    this.models.delete(modelId);

    // Remove from provider's models list
    const provider = this.providers.get(model.providerId);
    if (provider) {
      provider.models = provider.models.filter((m) => m.id !== modelId);
      this.providers.set(provider.id, provider);
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
  }

  // Profile Management
  async createProfile(
    profile: Omit<ModelProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ModelProfile> {
    const newProfile: ModelProfile = {
      ...profile,
      id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(newProfile.id, newProfile);

    if (newProfile.isDefault) {
      // Unset other default profiles
      for (const [id, existingProfile] of this.profiles) {
        if (existingProfile.isDefault && id !== newProfile.id) {
          existingProfile.isDefault = false;
          this.profiles.set(id, existingProfile);
        }
      }
      this.activeProfile = newProfile;
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
    return newProfile;
  }

  async updateProfile(profileId: string, updates: Partial<ModelProfile>): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: Date.now(),
    };

    this.profiles.set(profileId, updatedProfile);

    if (updatedProfile.isDefault) {
      // Unset other default profiles
      for (const [id, existingProfile] of this.profiles) {
        if (existingProfile.isDefault && id !== profileId) {
          existingProfile.isDefault = false;
          this.profiles.set(id, existingProfile);
        }
      }
      this.activeProfile = updatedProfile;
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
  }

  async removeProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    this.profiles.delete(profileId);

    if (this.activeProfile?.id === profileId) {
      // Set another profile as active
      const remainingProfiles = Array.from(this.profiles.values());
      this.activeProfile =
        remainingProfiles.find((p) => p.isDefault) || remainingProfiles[0] || null;
    }

    this.saveConfiguration();
    this.notifyConfigChanged();
  }

  async setActiveProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    this.activeProfile = profile;
    this.notifyConfigChanged();
  }

  // Model Selection
  async selectModel(
    task: string,
    context?: {
      contextLength?: number;
      complexity?: 'low' | 'medium' | 'high';
      language?: string;
      domain?: string;
      maxCost?: number;
      maxLatency?: number;
    },
  ): Promise<AIModel | null> {
    const profile = this.activeProfile;
    if (!profile) return this.getDefaultModel(task);

    // Find assignment for task
    const assignment = profile.models.find((a) => a.task === task);
    if (!assignment) return this.getDefaultModel(task);

    // Check conditions
    const model = this.models.get(assignment.modelId);
    if (!model || !model.isActive) return this.getFallbackModel(profile, task);

    // Validate context requirements
    if (context) {
      if (context.contextLength && context.contextLength > model.capabilities.contextWindow) {
        return this.getFallbackModel(profile, task);
      }
      if (context.maxLatency && model.performance.averageLatency > context.maxLatency) {
        return this.getFallbackModel(profile, task);
      }
    }

    return model;
  }

  // Usage Tracking
  async recordUsage(
    modelId: string,
    usage: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      latency: number;
      success: boolean;
      cost?: number;
    },
  ): Promise<void> {
    let stats = this.usageStats.get(modelId);

    if (!stats) {
      stats = {
        modelId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        lastUsed: Date.now(),
        usageByDay: [],
      };
    }

    // Update stats
    stats.totalRequests += usage.requests;
    if (usage.success) {
      stats.successfulRequests += usage.requests;
    } else {
      stats.failedRequests += usage.requests;
    }

    stats.inputTokens += usage.inputTokens;
    stats.outputTokens += usage.outputTokens;
    stats.totalTokens += usage.inputTokens + usage.outputTokens;
    stats.totalCost += usage.cost || 0;
    stats.averageLatency = (stats.averageLatency + usage.latency) / 2;
    stats.lastUsed = Date.now();

    // Update daily usage
    const today = new Date().toISOString().split('T')[0];
    let dailyUsage = stats.usageByDay.find((d) => d.date === today);

    if (!dailyUsage) {
      dailyUsage = { date: today, requests: 0, tokens: 0, cost: 0, errors: 0 };
      stats.usageByDay.push(dailyUsage);
    }

    dailyUsage.requests += usage.requests;
    dailyUsage.tokens += usage.inputTokens + usage.outputTokens;
    dailyUsage.cost += usage.cost || 0;
    if (!usage.success) dailyUsage.errors += usage.requests;

    // Keep only last 30 days
    stats.usageByDay = stats.usageByDay
      .filter((d) => Date.now() - new Date(d.date).getTime() < 30 * 24 * 60 * 60 * 1000)
      .sort((a, b) => a.date.localeCompare(b.date));

    this.usageStats.set(modelId, stats);
    this.saveUsageStats();
  }

  // Configuration Management
  private loadConfiguration(): void {
    try {
      const config = localStorage.getItem('multi_model_config');
      if (config) {
        const data = JSON.parse(config);

        if (data.providers) {
          this.providers = new Map(data.providers);
        }
        if (data.models) {
          this.models = new Map(data.models);
        }
        if (data.profiles) {
          this.profiles = new Map(data.profiles);
          this.activeProfile = Array.from(this.profiles.values()).find((p) => p.isDefault) || null;
        }
      }
    } catch (error) {
      console.warn('Failed to load multi-model configuration:', error);
    }

    try {
      const usage = localStorage.getItem('model_usage_stats');
      if (usage) {
        this.usageStats = new Map(JSON.parse(usage));
      }
    } catch (error) {
      console.warn('Failed to load usage stats:', error);
    }
  }

  private saveConfiguration(): void {
    try {
      const config = {
        providers: Array.from(this.providers.entries()),
        models: Array.from(this.models.entries()),
        profiles: Array.from(this.profiles.entries()),
      };
      localStorage.setItem('multi_model_config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save multi-model configuration:', error);
    }
  }

  private saveUsageStats(): void {
    try {
      const usage = Array.from(this.usageStats.entries());
      localStorage.setItem('model_usage_stats', JSON.stringify(usage));
    } catch (error) {
      console.warn('Failed to save usage stats:', error);
    }
  }

  private initializeDefaultProviders(): void {
    if (this.providers.size > 0) return;

    // Add default OpenAI provider
    const openaiProvider: AIProvider = {
      id: 'openai-default',
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        {
          id: 'gpt-4',
          name: 'gpt-4',
          displayName: 'GPT-4',
          providerId: 'openai-default',
          type: 'chat',
          capabilities: {
            maxTokens: 4096,
            contextWindow: 8192,
            supportsStreaming: true,
            supportsFunctions: true,
            supportsVision: false,
            supportsAudio: false,
            supportsCodeGeneration: true,
            supportsReasoning: true,
            languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
            specialties: ['general', 'coding', 'analysis', 'writing'],
          },
          limits: {
            requestsPerMinute: 200,
            tokensPerMinute: 40000,
            requestsPerDay: 10000,
            maxConcurrentRequests: 10,
            timeoutMs: 30000,
          },
          pricing: {
            inputTokenPrice: 0.03,
            outputTokenPrice: 0.06,
            currency: 'USD',
            billingUnit: 'token',
          },
          performance: {
            averageLatency: 2000,
            successRate: 0.99,
            qualityScore: 0.95,
            lastBenchmark: Date.now(),
            benchmarkResults: [],
          },
          isActive: false,
          settings: {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 1,
            topK: 0,
            frequencyPenalty: 0,
            presencePenalty: 0,
            stopSequences: [],
            customParameters: {},
          },
        },
      ],
      isActive: false,
      rateLimits: {
        requestsPerMinute: 200,
        tokensPerMinute: 40000,
        requestsPerHour: 12000,
        requestsPerDay: 10000,
        burstLimit: 50,
        windowSize: 60,
      },
      settings: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableLogging: true,
        enableMetrics: true,
        enableCaching: false,
        cacheExpiry: 3600,
        customHeaders: {},
      },
      metadata: {
        description: 'OpenAI GPT models for various AI tasks',
        website: 'https://openai.com',
        documentation: 'https://platform.openai.com/docs',
        supportEmail: 'support@openai.com',
        version: '1.0.0',
        lastUpdated: Date.now(),
        features: ['Chat completion', 'Function calling', 'Streaming'],
        limitations: ['Rate limits', 'Token limits'],
      },
    };

    this.providers.set(openaiProvider.id, openaiProvider);
    for (const model of openaiProvider.models) {
      this.models.set(model.id, model);
    }

    // Create default profile
    const defaultProfile: ModelProfile = {
      id: 'default-profile',
      name: 'Default Profile',
      description: 'Default model assignments for all tasks',
      models: [
        {
          task: 'chat',
          modelId: 'gpt-4',
          weight: 1,
          conditions: [],
        },
        {
          task: 'completion',
          modelId: 'gpt-4',
          weight: 1,
          conditions: [],
        },
      ],
      fallbackChain: ['gpt-4'],
      loadBalancing: {
        strategy: 'round_robin',
        healthCheck: true,
        failoverEnabled: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 60000,
          halfOpenRequests: 3,
        },
      },
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(defaultProfile.id, defaultProfile);
    this.activeProfile = defaultProfile;
    this.saveConfiguration();
  }

  private async makeTestRequest(
    provider: AIProvider,
    model: AIModel,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a minimal test request to validate API connectivity
      const testPrompt =
        "Hello, this is a test message. Please respond with 'OK' if you receive this.";
      const requestBody = this.buildAPITestRequest(provider, model, testPrompt);

      const response = await fetch(`${provider.baseUrl}${this.getAPIEndpoint(provider, model)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthHeader(provider),
          ...provider.settings.customHeaders,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(provider.settings.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Validate response structure based on provider type
      return this.validateAPIResponse(provider, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `API test failed: ${errorMessage}`,
      };
    }
  }

  private buildAPITestRequest(provider: AIProvider, model: AIModel, prompt: string): any {
    switch (provider.type) {
      case 'openai':
        return {
          model: model.name,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 10,
          temperature: 0,
        };

      case 'anthropic':
        return {
          model: model.name,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 10,
          temperature: 0,
        };

      case 'google':
        return {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0,
          },
        };

      case 'azure':
        return {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 10,
          temperature: 0,
        };

      default:
        // Generic structure for custom providers
        return {
          prompt: prompt,
          max_tokens: 10,
          temperature: 0,
        };
    }
  }

  private getAPIEndpoint(provider: AIProvider, model: AIModel): string {
    switch (provider.type) {
      case 'openai':
        return '/chat/completions';
      case 'anthropic':
        return '/messages';
      case 'google':
        return `/models/${model.name}:generateContent`;
      case 'azure':
        return '/chat/completions';
      default:
        return '/completions'; // Fallback for custom providers
    }
  }

  private getAuthHeader(provider: AIProvider): string {
    switch (provider.type) {
      case 'openai':
        return `Bearer ${provider.apiKey}`;
      case 'anthropic':
        return `Bearer ${provider.apiKey}`;
      case 'google':
        return `Bearer ${provider.apiKey}`;
      case 'azure':
        return `Bearer ${provider.apiKey}`;
      default:
        return provider.apiKey; // Custom auth for custom providers
    }
  }

  private validateAPIResponse(
    provider: AIProvider,
    response: any,
  ): { success: boolean; error?: string } {
    try {
      switch (provider.type) {
        case 'openai':
          if (response.choices && response.choices[0] && response.choices[0].message) {
            return { success: true };
          }
          break;

        case 'anthropic':
          if (response.content && response.content[0] && response.content[0].text) {
            return { success: true };
          }
          break;

        case 'google':
          if (
            response.candidates &&
            response.candidates[0] &&
            response.candidates[0].content &&
            response.candidates[0].content.parts
          ) {
            return { success: true };
          }
          break;

        case 'azure':
          if (response.choices && response.choices[0] && response.choices[0].message) {
            return { success: true };
          }
          break;

        default:
          // For custom providers, just check if we got any response
          if (response && Object.keys(response).length > 0) {
            return { success: true };
          }
      }

      return {
        success: false,
        error: 'Invalid API response format',
      };
    } catch (error) {
      return {
        success: false,
        error: `Response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private getDefaultModel(task: string): AIModel | null {
    const models = Array.from(this.models.values()).filter(
      (m) => m.isActive && (m.type === task || m.capabilities.specialties.includes(task)),
    );
    return models[0] || null;
  }

  private getFallbackModel(profile: ModelProfile, task: string): AIModel | null {
    for (const modelId of profile.fallbackChain) {
      const model = this.models.get(modelId);
      if (model && model.isActive) {
        return model;
      }
    }
    return this.getDefaultModel(task);
  }

  private notifyConfigChanged(): void {
    this.configCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn('Config callback failed:', error);
      }
    });
  }

  // Public API
  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getModels(): AIModel[] {
    return Array.from(this.models.values());
  }

  getProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  getActiveProfile(): ModelProfile | null {
    return this.activeProfile;
  }

  getUsageStats(): ModelUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  getProvider(providerId: string): AIProvider | null {
    return this.providers.get(providerId) || null;
  }

  getModel(modelId: string): AIModel | null {
    return this.models.get(modelId) || null;
  }

  getProfile(profileId: string): ModelProfile | null {
    return this.profiles.get(profileId) || null;
  }

  onConfigChanged(callback: () => void): () => void {
    this.configCallbacks.add(callback);
    return () => this.configCallbacks.delete(callback);
  }

  exportConfiguration(): string {
    return JSON.stringify(
      {
        providers: Array.from(this.providers.entries()),
        models: Array.from(this.models.entries()),
        profiles: Array.from(this.profiles.entries()),
        usageStats: Array.from(this.usageStats.entries()),
        timestamp: Date.now(),
      },
      null,
      2,
    );
  }

  async importConfiguration(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);

      if (config.providers) {
        this.providers = new Map(config.providers);
      }
      if (config.models) {
        this.models = new Map(config.models);
      }
      if (config.profiles) {
        this.profiles = new Map(config.profiles);
        this.activeProfile = Array.from(this.profiles.values()).find((p) => p.isDefault) || null;
      }
      if (config.usageStats) {
        this.usageStats = new Map(config.usageStats);
      }

      this.saveConfiguration();
      this.saveUsageStats();
      this.notifyConfigChanged();
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`);
    }
  }

  clearAllData(): void {
    this.providers.clear();
    this.models.clear();
    this.profiles.clear();
    this.usageStats.clear();
    this.activeProfile = null;

    localStorage.removeItem('multi_model_config');
    localStorage.removeItem('model_usage_stats');

    this.initializeDefaultProviders();
    this.notifyConfigChanged();
  }
}

export const multiModelConfig = new MultiModelConfigManager();
