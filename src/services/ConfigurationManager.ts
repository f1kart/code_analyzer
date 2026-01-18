// ConfigurationManager.ts - Enterprise-grade configuration management system
// Provides feature flags, environment management, and dynamic configuration updates

import { AuditLogger } from './AuditLogger';
import { PerformanceMonitor } from './PerformanceMonitor';

export interface Configuration {
  id: string;
  name: string;
  description: string;
  version: string;
  environment: 'development' | 'staging' | 'production' | 'testing';
  settings: ConfigurationSettings;
  featureFlags: FeatureFlag[];
  secrets: ConfigurationSecrets;
  metadata: ConfigurationMetadata;
  status: 'active' | 'inactive' | 'deprecated';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ConfigurationSettings {
  application: ApplicationSettings;
  database: DatabaseSettings;
  cache: CacheSettings;
  monitoring: MonitoringSettings;
  security: SecuritySettings;
  performance: PerformanceSettings;
  custom: Record<string, any>;
}

export interface ApplicationSettings {
  name: string;
  version: string;
  port: number;
  host: string;
  baseUrl: string;
  timezone: string;
  locale: string;
  debug: boolean;
}

export interface DatabaseSettings {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  host: string;
  port: number;
  database: string;
  pool: {
    min: number;
    max: number;
    acquireTimeout: number;
    idleTimeout: number;
  };
  ssl: boolean;
  retry: {
    attempts: number;
    delay: number;
  };
}

export interface CacheSettings {
  enabled: boolean;
  type: 'memory' | 'redis' | 'memcached';
  ttl: number;
  maxSize: number;
  compression: boolean;
}

export interface MonitoringSettings {
  enabled: boolean;
  metrics: boolean;
  tracing: boolean;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    destination: 'console' | 'file' | 'remote';
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    thresholds: Record<string, number>;
  };
}

export interface SecuritySettings {
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
  };
  rateLimiting: {
    enabled: boolean;
    window: number;
    maxRequests: number;
  };
  authentication: {
    required: boolean;
    methods: string[];
    sessionTimeout: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotation: number;
  };
}

export interface PerformanceSettings {
  compression: boolean;
  caching: boolean;
  optimization: {
    minify: boolean;
    bundle: boolean;
    treeShaking: boolean;
  };
  scaling: {
    auto: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  key: string;
  type: 'boolean' | 'string' | 'number' | 'json';
  value: any;
  defaultValue: any;
  rules: FeatureFlagRule[];
  targeting: FeatureFlagTargeting;
  enabled: boolean;
  rollout: {
    percentage: number;
    strategy: 'gradual' | 'immediate' | 'canary';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  value: any;
  priority: number;
  enabled: boolean;
}

export interface RuleCondition {
  attribute: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  negate: boolean;
}

export interface FeatureFlagTargeting {
  users: string[];
  groups: string[];
  environments: string[];
  regions: string[];
  userAttributes: Record<string, string[]>;
}

export interface FeatureFlagContext {
  userId?: string;
  group?: string;
  environment?: string;
  region?: string;
  userAttributes?: Record<string, any>;
}

export interface ConfigurationSecrets {
  database: {
    username: string;
    password: string;
    connectionString?: string;
  };
  api: {
    keys: Record<string, string>;
    tokens: Record<string, string>;
  };
  external: {
    services: Record<string, any>;
    credentials: Record<string, any>;
  };
  encryption: {
    key: string;
    iv?: string;
  };
}

export interface ConfigurationMetadata {
  tags: string[];
  owner: string;
  team: string;
  project: string;
  documentation?: string;
  dependencies: string[];
  compliance: ComplianceInfo[];
}

export interface ComplianceInfo {
  framework: string;
  version: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  lastChecked: Date;
  nextCheck: Date;
}

export interface ConfigurationEnvironment {
  id: string;
  name: string;
  description: string;
  baseConfiguration: string;
  overrides: Record<string, any>;
  variables: Record<string, string>;
  secrets: Record<string, string>;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigurationChange {
  id: string;
  configurationId: string;
  environmentId?: string;
  changeType: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  changes: ConfigurationDiff;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  createdAt: Date;
  rollbackAvailable: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
}

export interface ConfigurationDiff {
  added: Record<string, any>;
  modified: Record<string, any>;
  removed: Record<string, any>;
  conflicts: string[];
}

export interface ConfigurationValidation {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ConfigurationSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ConfigurationSuggestion {
  type: 'optimization' | 'security' | 'performance' | 'compliance';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  implementation: string;
}

export interface ConfigurationAnalytics {
  timeRange: { start: Date; end: Date };
  configurations: {
    total: number;
    active: number;
    byEnvironment: Record<string, number>;
    byType: Record<string, number>;
  };
  changes: {
    total: number;
    approved: number;
    rejected: number;
    rolledBack: number;
    averageApprovalTime: number;
  };
  featureFlags: {
    total: number;
    enabled: number;
    usage: Record<string, number>;
  };
  compliance: {
    score: number;
    frameworks: Record<string, number>;
    violations: number;
  };
}

export class ConfigurationManager {
  private auditLogger: AuditLogger;
  private performanceMonitor: PerformanceMonitor;
  private configurations: Map<string, Configuration> = new Map();
  private environments: Map<string, ConfigurationEnvironment> = new Map();
  private featureFlags: Map<string, FeatureFlag> = new Map();
  private changes: Map<string, ConfigurationChange> = new Map();
  private currentConfiguration: Configuration | null = null;

  constructor(
    auditLogger?: AuditLogger,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.auditLogger = auditLogger || new AuditLogger();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();

    this.initializeConfiguration();
  }

  /**
   * Creates a new configuration
   * @param config Configuration data
   * @param createdBy User creating the configuration
   * @returns Created configuration
   */
  async createConfiguration(config: Omit<Configuration, 'id' | 'createdAt' | 'updatedAt'>, createdBy: string): Promise<Configuration> {
    const configuration: Configuration = {
      id: this.generateConfigurationId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config
    };

    // Validate configuration
    const validation = await this.validateConfiguration(configuration);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.configurations.set(configuration.id, configuration);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Configuration created',
      {
        configurationId: configuration.id,
        configurationName: configuration.name,
        environment: configuration.environment,
        version: configuration.version,
        featureFlags: configuration.featureFlags.length
      },
      { userId: createdBy }
    );

    return configuration;
  }

  /**
   * Updates an existing configuration
   * @param configurationId Configuration ID
   * @param updates Configuration updates
   * @param updatedBy User making updates
   * @returns Updated configuration
   */
  async updateConfiguration(configurationId: string, updates: Partial<Configuration>, updatedBy: string): Promise<Configuration> {
    const configuration = this.configurations.get(configurationId);
    if (!configuration) {
      throw new Error(`Configuration ${configurationId} not found`);
    }

    // Create change record
    const change = await this.createChangeRecord(configurationId, updates, 'update', updatedBy);

    // Apply updates
    const updatedConfiguration = {
      ...configuration,
      ...updates,
      updatedAt: new Date()
    };

    // Validate updated configuration
    const validation = await this.validateConfiguration(updatedConfiguration);
    if (!validation.valid) {
      await this.rejectChange(change.id, 'Validation failed', updatedBy);
      throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.configurations.set(configurationId, updatedConfiguration);

    // Approve and apply change
    await this.approveChange(change.id, updatedBy);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Configuration updated',
      {
        configurationId,
        changes: Object.keys(updates),
        changeId: change.id,
        updatedBy
      },
      { userId: updatedBy }
    );

    return updatedConfiguration;
  }

  /**
   * Gets feature flag value with targeting evaluation
   * @param flagKey Feature flag key
   * @param context Evaluation context
   * @returns Feature flag value
   */
  async getFeatureFlag(flagKey: string, context: FeatureFlagContext = {}): Promise<any> {
    const flag = this.featureFlags.get(flagKey);
    if (!flag || !flag.enabled) {
      return flag?.defaultValue;
    }

    // Check rollout percentage
    if (context.userId && flag.rollout.strategy === 'gradual') {
      const userHash = this.hashString(context.userId);
      const percentage = (userHash % 100) + 1;

      if (percentage > flag.rollout.percentage) {
        return flag.defaultValue;
      }
    }

    // Evaluate targeting rules
    if (flag.targeting.users.length > 0 && !flag.targeting.users.includes(context.userId || '')) {
      return flag.defaultValue;
    }

    if (flag.targeting.groups.length > 0 && !flag.targeting.groups.includes(context.group || '')) {
      return flag.defaultValue;
    }

    if (flag.targeting.environments.length > 0 && !flag.targeting.environments.includes(context.environment || '')) {
      return flag.defaultValue;
    }

    // Evaluate custom rules
    for (const rule of flag.rules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority)) {
      if (this.evaluateRule(rule, context)) {
        return rule.value;
      }
    }

    return flag.value;
  }

  /**
   * Sets feature flag value
   * @param flagKey Feature flag key
   * @param value New value
   * @param updatedBy User making the change
   */
  async setFeatureFlag(flagKey: string, value: any, updatedBy: string): Promise<void> {
    const flag = this.featureFlags.get(flagKey);
    if (!flag) {
      throw new Error(`Feature flag ${flagKey} not found`);
    }

    flag.value = value;
    flag.updatedAt = new Date();

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Feature flag updated',
      {
        flagKey,
        oldValue: flag.value,
        newValue: value,
        updatedBy
      },
      { userId: updatedBy }
    );

    // Record feature flag usage
    this.performanceMonitor.recordMetric(
      'feature_flag_access',
      1,
      'count',
      { flag: flagKey, action: 'set' }
    );
  }

  /**
   * Creates a configuration environment
   * @param environment Environment configuration
   * @param createdBy User creating the environment
   * @returns Created environment
   */
  async createEnvironment(environment: Omit<ConfigurationEnvironment, 'id' | 'createdAt' | 'updatedAt'>, createdBy: string): Promise<ConfigurationEnvironment> {
    const configEnvironment: ConfigurationEnvironment = {
      id: this.generateEnvironmentId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...environment
    };

    this.environments.set(configEnvironment.id, configEnvironment);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Environment created',
      {
        environmentId: configEnvironment.id,
        environmentName: configEnvironment.name,
        baseConfiguration: configEnvironment.baseConfiguration
      },
      { userId: createdBy }
    );

    return configEnvironment;
  }

  /**
   * Activates a configuration
   * @param configurationId Configuration ID
   * @param environmentId Environment ID
   * @param activatedBy User activating the configuration
   */
  async activateConfiguration(configurationId: string, environmentId: string, activatedBy: string): Promise<void> {
    const configuration = this.configurations.get(configurationId);
    const environment = this.environments.get(environmentId);

    if (!configuration) {
      throw new Error(`Configuration ${configurationId} not found`);
    }

    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    // Set as current configuration
    this.currentConfiguration = configuration;

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Configuration activated',
      {
        configurationId,
        configurationName: configuration.name,
        environmentId,
        environmentName: environment.name,
        activatedBy
      },
      { userId: activatedBy }
    );

    this.performanceMonitor.recordMetric(
      'configuration_activation',
      1,
      'count',
      {
        configurationId,
        environmentId,
        activatedBy
      }
    );
  }

  /**
   * Gets current configuration value
   * @param path Configuration path (e.g., 'database.host')
   * @returns Configuration value
   */
  async getConfig(path: string): Promise<any> {
    if (!this.currentConfiguration) {
      throw new Error('No active configuration');
    }

    return this.getNestedValue(this.currentConfiguration.settings, path);
  }

  /**
   * Sets configuration value
   * @param path Configuration path
   * @param value New value
   * @param updatedBy User making the change
   */
  async setConfig(path: string, value: any, updatedBy: string): Promise<void> {
    if (!this.currentConfiguration) {
      throw new Error('No active configuration');
    }

    // Create change record
    const change = await this.createChangeRecord(
      this.currentConfiguration.id,
      { settings: this.setNestedValue(this.currentConfiguration.settings, path, value) },
      'update',
      updatedBy
    );

    // Apply change
    this.currentConfiguration.settings = change.changes.modified as ConfigurationSettings;
    this.currentConfiguration.updatedAt = new Date();

    await this.approveChange(change.id, updatedBy);
  }

  /**
   * Gets configuration analytics
   * @param timeRange Time range for analytics
   * @returns Configuration analytics
   */
  async getConfigurationAnalytics(timeRange: { start: Date; end: Date }): Promise<ConfigurationAnalytics> {
    const configurations = Array.from(this.configurations.values());
    const changes = Array.from(this.changes.values()).filter(c =>
      c.approvedAt >= timeRange.start && c.approvedAt <= timeRange.end
    );

    return {
      timeRange,
      configurations: {
        total: configurations.length,
        active: configurations.filter(c => c.status === 'active').length,
        byEnvironment: configurations.reduce((acc, c) => {
          acc[c.environment] = (acc[c.environment] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byType: configurations.reduce((acc, c) => {
          acc[c.metadata.project] = (acc[c.metadata.project] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      changes: {
        total: changes.length,
        approved: changes.filter(c => c.status === 'applied').length,
        rejected: changes.filter(c => c.status === 'rejected').length,
        rolledBack: changes.filter(c => c.status === 'rolled_back').length,
        averageApprovalTime: changes.length > 0 ?
          changes.reduce((sum, c) => sum + (c.approvedAt.getTime() - c.createdAt.getTime()), 0) / changes.length / (1000 * 60) : 0
      },
      featureFlags: {
        total: this.featureFlags.size,
        enabled: Array.from(this.featureFlags.values()).filter(f => f.enabled).length,
        usage: {} // Would be populated from actual usage data
      },
      compliance: {
        score: 95, // Would be calculated from compliance checks
        frameworks: {
          'GDPR': 100,
          'SOC2': 90,
          'HIPAA': 85
        },
        violations: 2
      }
    };
  }

  /**
   * Validates configuration
   * @param configuration Configuration to validate
   * @returns Validation result
   */
  async validateConfiguration(configuration: Configuration): Promise<ConfigurationValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ConfigurationSuggestion[] = [];

    // Validate required fields
    if (!configuration.name) {
      errors.push({ field: 'name', message: 'Configuration name is required', severity: 'error' });
    }

    if (!configuration.environment) {
      errors.push({ field: 'environment', message: 'Environment is required', severity: 'error' });
    }

    // Validate settings
    if (configuration.settings.database) {
      if (!configuration.settings.database.host) {
        errors.push({ field: 'database.host', message: 'Database host is required', severity: 'error' });
      }

      if (configuration.settings.database.port && (configuration.settings.database.port < 1 || configuration.settings.database.port > 65535)) {
        errors.push({ field: 'database.port', message: 'Database port must be between 1 and 65535', severity: 'error' });
      }
    }

    // Validate feature flags
    for (const flag of configuration.featureFlags) {
      if (!flag.key) {
        errors.push({ field: `featureFlags[${configuration.featureFlags.indexOf(flag)}].key`, message: 'Feature flag key is required', severity: 'error' });
      }

      if (flag.rules.some(rule => rule.conditions.length === 0)) {
        warnings.push({ field: `featureFlags[${configuration.featureFlags.indexOf(flag)}].rules`, message: 'Feature flag rule has no conditions', suggestion: 'Add conditions or remove rule' });
      }
    }

    // Generate suggestions
    if (configuration.settings.security?.rateLimiting?.enabled && configuration.settings.security.rateLimiting.maxRequests > 1000) {
      suggestions.push({
        type: 'security',
        title: 'High Rate Limit',
        description: 'Rate limit is set high, consider if this is appropriate for your use case',
        impact: 'medium',
        effort: 'low',
        implementation: 'Review and adjust rate limiting configuration based on expected traffic'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Exports configuration
   * @param format Export format
   * @param configurationId Optional specific configuration
   * @returns Exported configuration
   */
  async exportConfiguration(format: 'json' | 'yaml' | 'env' | 'dotenv', configurationId?: string): Promise<string> {
    let config: Configuration | ConfigurationEnvironment;

    if (configurationId) {
      config = this.configurations.get(configurationId) || this.environments.get(configurationId)!;
    } else {
      config = this.currentConfiguration!;
    }

    if (!config) {
      throw new Error('No configuration to export');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);

      case 'yaml':
        return this.convertToYAML(config);

      case 'env':
      case 'dotenv':
        return this.convertToEnvFile(config);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private initializeConfiguration(): void {
    // Initialize default configuration
    this.createDefaultConfiguration();
    this.setupConfigurationMonitoring();
  }

  private createDefaultConfiguration(): void {
    const defaultConfig: Omit<Configuration, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'Default Configuration',
      description: 'Default application configuration',
      version: '1.0.0',
      environment: 'development',
      settings: {
        application: {
          name: 'Enterprise Code Review System',
          version: '1.0.0',
          port: 3000,
          host: 'localhost',
          baseUrl: 'http://localhost:3000',
          timezone: 'UTC',
          locale: 'en-US',
          debug: true
        },
        database: {
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'codereview_dev',
          pool: {
            min: 2,
            max: 10,
            acquireTimeout: 60000,
            idleTimeout: 600000
          },
          ssl: false,
          retry: {
            attempts: 3,
            delay: 1000
          }
        },
        cache: {
          enabled: true,
          type: 'memory',
          ttl: 3600,
          maxSize: 100 * 1024 * 1024, // 100MB
          compression: true
        },
        monitoring: {
          enabled: true,
          metrics: true,
          tracing: true,
          logging: {
            level: 'info',
            format: 'json',
            destination: 'console'
          },
          alerting: {
            enabled: true,
            channels: ['console'],
            thresholds: {
              errorRate: 0.05,
              responseTime: 1000
            }
          }
        },
        security: {
          cors: {
            enabled: true,
            origins: ['http://localhost:3000'],
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            headers: ['Content-Type', 'Authorization']
          },
          rateLimiting: {
            enabled: true,
            window: 60,
            maxRequests: 100
          },
          authentication: {
            required: false,
            methods: ['bearer'],
            sessionTimeout: 3600
          },
          encryption: {
            enabled: false,
            algorithm: 'AES256',
            keyRotation: 30
          }
        },
        performance: {
          compression: true,
          caching: true,
          optimization: {
            minify: false,
            bundle: false,
            treeShaking: false
          },
          scaling: {
            auto: false,
            minInstances: 1,
            maxInstances: 3,
            targetCPU: 70,
            targetMemory: 80
          }
        },
        custom: {}
      },
      featureFlags: [
        {
          id: 'ai_review',
          name: 'AI Code Review',
          description: 'Enable AI-powered code review features',
          key: 'ai_review_enabled',
          type: 'boolean',
          value: true,
          defaultValue: false,
          rules: [],
          targeting: {
            users: [],
            groups: [],
            environments: ['development', 'staging'],
            regions: [],
            userAttributes: {}
          },
          enabled: true,
          rollout: {
            percentage: 100,
            strategy: 'immediate'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      secrets: {
        database: {
          username: 'postgres',
          password: 'development_password'
        },
        api: {
          keys: {},
          tokens: {}
        },
        external: {
          services: {},
          credentials: {}
        },
        encryption: {
          key: 'development_encryption_key'
        }
      },
      metadata: {
        tags: ['development', 'default'],
        owner: 'system',
        team: 'platform',
        project: 'code-review',
        dependencies: ['database', 'cache', 'monitoring'],
        compliance: [
          {
            framework: 'GDPR',
            version: '2018',
            status: 'compliant',
            lastChecked: new Date(),
            nextCheck: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      status: 'active',
      createdBy: 'system'
    };

    this.createConfiguration(defaultConfig, 'system').catch(console.error);
  }

  private setupConfigurationMonitoring(): void {
    // Monitor configuration changes
    setInterval(() => {
      this.monitorConfigurationHealth();
    }, 300000); // 5 minutes
  }

  private async createChangeRecord(
    configurationId: string,
    updates: Partial<Configuration>,
    changeType: ConfigurationChange['changeType'],
    changedBy: string
  ): Promise<ConfigurationChange> {
    const change: ConfigurationChange = {
      id: this.generateChangeId(),
      configurationId,
      changeType,
      changes: this.calculateDiff({}, updates),
      reason: 'Configuration update',
      approvedBy: '',
      approvedAt: new Date(),
      createdAt: new Date(),
      rollbackAvailable: true,
      status: 'pending'
    };

    this.changes.set(change.id, change);

    await this.auditLogger.logEvent(
      'configuration_changed',
      'Configuration change recorded',
      {
        changeId: change.id,
        configurationId,
        changeType,
        changedBy
      },
      { userId: changedBy }
    );
    return change;
  }

  private async approveChange(changeId: string, approvedBy: string): Promise<void> {
    const change = this.changes.get(changeId);
    if (change) {
      change.status = 'approved';
      change.approvedBy = approvedBy;
      change.approvedAt = new Date();

      await this.auditLogger.logEvent(
        'configuration_changed',
        'Configuration change approved',
        {
          changeId,
          configurationId: change.configurationId,
          approvedBy
        },
        { userId: approvedBy }
      );
    }
  }

  private async rejectChange(changeId: string, reason: string, rejectedBy: string): Promise<void> {
    const change = this.changes.get(changeId);
    if (change) {
      change.status = 'rejected';
      // Would set rejection details

      await this.auditLogger.logEvent(
        'configuration_changed',
        'Configuration change rejected',
        {
          changeId,
          configurationId: change.configurationId,
          reason,
          rejectedBy
        },
        { userId: rejectedBy }
      );
    }
  }

  private evaluateRule(rule: FeatureFlagRule, context: FeatureFlagContext): boolean {
    for (const condition of rule.conditions) {
      const contextValue = (context as any)[condition.attribute];
      let conditionMet = false;

      switch (condition.operator) {
        case 'equals':
          conditionMet = contextValue === condition.value;
          break;
        case 'contains':
          conditionMet = contextValue && contextValue.includes(condition.value);
          break;
        case 'starts_with':
          conditionMet = contextValue && contextValue.startsWith(condition.value);
          break;
        case 'ends_with':
          conditionMet = contextValue && contextValue.endsWith(condition.value);
          break;
        case 'greater_than':
          conditionMet = contextValue > condition.value;
          break;
        case 'less_than':
          conditionMet = contextValue < condition.value;
          break;
        case 'in':
          conditionMet = Array.isArray(condition.value) && condition.value.includes(contextValue);
          break;
        case 'not_in':
          conditionMet = Array.isArray(condition.value) && !condition.value.includes(contextValue);
          break;
      }

      if (condition.negate) {
        conditionMet = !conditionMet;
      }

      if (!conditionMet) {
        return false;
      }
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);

    target[lastKey] = value;
    return obj;
  }

  private calculateDiff(oldObj: any, newObj: any): ConfigurationDiff {
    // Simplified diff calculation
    return {
      added: {},
      modified: newObj,
      removed: {},
      conflicts: []
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private convertToYAML(obj: any): string {
    // Simplified YAML conversion
    return JSON.stringify(obj, null, 2).replace(/"/g, '');
  }

  private convertToEnvFile(config: Configuration | ConfigurationEnvironment): string {
    let envFile = '';

    // Add application settings
    if ('settings' in config) {
      const settings = config.settings as ConfigurationSettings;
      envFile += `# Application Settings\n`;
      envFile += `APP_NAME=${settings.application.name}\n`;
      envFile += `APP_VERSION=${settings.application.version}\n`;
      envFile += `APP_PORT=${settings.application.port}\n`;
      envFile += `APP_HOST=${settings.application.host}\n`;
      envFile += `APP_BASE_URL=${settings.application.baseUrl}\n`;
      envFile += `DEBUG=${settings.application.debug}\n\n`;
    }

    // Add database settings
    if ('settings' in config) {
      const settings = config.settings as ConfigurationSettings;
      envFile += `# Database Settings\n`;
      envFile += `DB_TYPE=${settings.database.type}\n`;
      envFile += `DB_HOST=${settings.database.host}\n`;
      envFile += `DB_PORT=${settings.database.port}\n`;
      envFile += `DB_NAME=${settings.database.database}\n`;
      envFile += `DB_SSL=${settings.database.ssl}\n\n`;
    }

    // Add custom settings
    if ('variables' in config && config.variables) {
      envFile += `# Environment Variables\n`;
      Object.entries(config.variables).forEach(([key, value]) => {
        envFile += `${key}=${value}\n`;
      });
    }

    return envFile;
  }

  private generateConfigurationId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEnvironmentId(): string {
    return `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private monitorConfigurationHealth(): void {
    // Monitor configuration health and detect issues
    for (const config of this.configurations.values()) {
      if (config.status === 'active') {
        // Check for configuration drift
        // Check for deprecated settings
        // Check for security issues
      }
    }
  }
}
