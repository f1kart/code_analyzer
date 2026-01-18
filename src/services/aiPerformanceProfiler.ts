import { aiWorkflowEngine } from './aiWorkflowEngine';

export interface PerformanceProfile {
  id: string;
  name: string;
  filePath: string;
  language: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  metrics: PerformanceMetrics;
  analysis: AIPerformanceAnalysis | null;
  recommendations: PerformanceRecommendation[];
  createdAt: number;
}

export interface PerformanceMetrics {
  execution: ExecutionMetrics;
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  io: IOMetrics;
  network: NetworkMetrics;
  functions: FunctionMetrics[];
  hotspots: PerformanceHotspot[];
  bottlenecks: PerformanceBottleneck[];
}

export interface ExecutionMetrics {
  totalTime: number;
  userTime: number;
  systemTime: number;
  idleTime: number;
  gcTime: number;
  compilationTime: number;
  callCount: number;
  exceptionCount: number;
  timeline: TimelineEvent[];
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  heapMax: number;
  stackSize: number;
  external: number;
  rss: number;
  allocations: MemoryAllocation[];
  deallocations: MemoryDeallocation[];
  leaks: MemoryLeak[];
  gcEvents: GCEvent[];
}

export interface CPUMetrics {
  usage: number;
  userUsage: number;
  systemUsage: number;
  cores: number;
  frequency: number;
  samples: CPUSample[];
  threads: ThreadMetrics[];
  instructions: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface IOMetrics {
  readOperations: number;
  writeOperations: number;
  bytesRead: number;
  bytesWritten: number;
  readTime: number;
  writeTime: number;
  fileOperations: FileOperation[];
  diskUsage: DiskUsage;
}

export interface NetworkMetrics {
  requests: number;
  responses: number;
  bytesReceived: number;
  bytesSent: number;
  latency: number;
  connections: NetworkConnection[];
  errors: NetworkError[];
}

export interface FunctionMetrics {
  name: string;
  filePath: string;
  line: number;
  callCount: number;
  totalTime: number;
  selfTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryUsage: number;
  cpuUsage: number;
  children: FunctionMetrics[];
}

export interface PerformanceHotspot {
  location: CodeLocation;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'blocking';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: number;
  frequency: number;
  description: string;
  samples: number;
}

export interface PerformanceBottleneck {
  id: string;
  type: 'synchronous' | 'asynchronous' | 'resource' | 'algorithmic';
  location: CodeLocation;
  description: string;
  impact: number;
  duration: number;
  frequency: number;
  stackTrace: string[];
}

export interface TimelineEvent {
  timestamp: number;
  type: 'function-call' | 'function-return' | 'gc' | 'io' | 'network' | 'exception';
  name: string;
  duration?: number;
  metadata: Record<string, any>;
}

export interface MemoryAllocation {
  timestamp: number;
  size: number;
  type: string;
  location: CodeLocation;
  stackTrace: string[];
}

export interface MemoryDeallocation {
  timestamp: number;
  size: number;
  type: string;
  location: CodeLocation;
}

export interface MemoryLeak {
  location: CodeLocation;
  size: number;
  age: number;
  type: string;
  description: string;
  growthRate: number;
}

export interface GCEvent {
  timestamp: number;
  type: 'minor' | 'major' | 'full';
  duration: number;
  beforeSize: number;
  afterSize: number;
  collected: number;
}

export interface CPUSample {
  timestamp: number;
  usage: number;
  function: string;
  location: CodeLocation;
}

export interface ThreadMetrics {
  id: string;
  name: string;
  cpuUsage: number;
  memoryUsage: number;
  state: 'running' | 'waiting' | 'blocked' | 'terminated';
  stackTrace: string[];
}

export interface FileOperation {
  timestamp: number;
  type: 'read' | 'write' | 'open' | 'close' | 'delete' | 'create';
  filePath: string;
  size: number;
  duration: number;
}

export interface DiskUsage {
  total: number;
  used: number;
  available: number;
  readSpeed: number;
  writeSpeed: number;
}

export interface NetworkConnection {
  id: string;
  protocol: 'http' | 'https' | 'tcp' | 'udp' | 'websocket';
  host: string;
  port: number;
  status: 'connecting' | 'connected' | 'closed' | 'error';
  bytesReceived: number;
  bytesSent: number;
  latency: number;
}

export interface NetworkError {
  timestamp: number;
  type: 'timeout' | 'connection-refused' | 'dns-error' | 'ssl-error';
  host: string;
  message: string;
}

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  functionName?: string;
}

export interface AIPerformanceAnalysis {
  summary: AnalysisSummary;
  insights: PerformanceInsight[];
  patterns: PerformancePattern[];
  comparisons: PerformanceComparison[];
  predictions: PerformancePrediction[];
  confidence: number;
}

export interface AnalysisSummary {
  overallScore: number;
  category: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  primaryIssues: string[];
  strengths: string[];
  keyMetrics: Record<string, number>;
}

export interface PerformanceInsight {
  type: 'optimization' | 'warning' | 'information' | 'critical';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  location?: CodeLocation;
  evidence: string[];
}

export interface PerformancePattern {
  name: string;
  type: 'anti-pattern' | 'optimization-opportunity' | 'best-practice' | 'code-smell';
  locations: CodeLocation[];
  description: string;
  impact: number;
  frequency: number;
}

export interface PerformanceComparison {
  baseline: string;
  current: string;
  improvement: number;
  regression: number;
  changedMetrics: Record<string, { before: number; after: number; change: number }>;
}

export interface PerformancePrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  timeframe: string;
  confidence: number;
  factors: string[];
}

export interface PerformanceRecommendation {
  id: string;
  type: 'code-optimization' | 'architecture-change' | 'configuration' | 'infrastructure';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  implementation: string;
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  riskLevel: 'safe' | 'low' | 'medium' | 'high';
  codeChanges?: CodeChange[];
  automated: boolean;
}

export interface CodeChange {
  filePath: string;
  startLine: number;
  endLine: number;
  oldCode: string;
  newCode: string;
  reason: string;
}

export interface ProfilingSettings {
  enabled: boolean;
  samplingRate: number;
  maxDuration: number;
  includeMemory: boolean;
  includeCPU: boolean;
  includeIO: boolean;
  includeNetwork: boolean;
  trackAllocations: boolean;
  trackGC: boolean;
  minFunctionTime: number;
  maxCallStack: number;
  autoAnalysis: boolean;
}

export class AIPerformanceProfiler {
  private profiles = new Map<string, PerformanceProfile>();
  private activeProfile: PerformanceProfile | null = null;
  private settings: ProfilingSettings;
  private profilingCallbacks = new Set<(profile: PerformanceProfile) => void>();
  private analysisCallbacks = new Set<(analysis: AIPerformanceAnalysis) => void>();
  private samplingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.settings = this.getDefaultSettings();
    this.loadProfiles();
  }

  // Profiling Control
  async startProfiling(options: {
    name: string;
    filePath: string;
    language: string;
    duration?: number;
  }): Promise<PerformanceProfile> {
    if (this.activeProfile) {
      throw new Error('Another profiling session is already active');
    }

    const profile: PerformanceProfile = {
      id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: options.name,
      filePath: options.filePath,
      language: options.language,
      startTime: Date.now(),
      status: 'running',
      metrics: this.initializeMetrics(),
      analysis: null,
      recommendations: [],
      createdAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    this.activeProfile = profile;

    // Start sampling
    await this.startSampling(profile);

    // Auto-stop after duration
    if (options.duration) {
      setTimeout(() => {
        if (this.activeProfile?.id === profile.id) {
          this.stopProfiling(profile.id);
        }
      }, options.duration);
    }

    this.notifyProfilingCallbacks(profile);
    return profile;
  }

  async stopProfiling(profileId: string): Promise<PerformanceProfile> {
    const profile = this.profiles.get(profileId);
    if (!profile || profile.status !== 'running') {
      throw new Error(`Profile ${profileId} is not running`);
    }

    profile.endTime = Date.now();
    profile.duration = profile.endTime - profile.startTime;
    profile.status = 'completed';

    // Stop sampling
    await this.stopSampling();

    // Finalize metrics
    await this.finalizeMetrics(profile);

    // Perform AI analysis
    if (this.settings.autoAnalysis) {
      await this.performAIAnalysis(profile.id);
    }

    this.activeProfile = null;
    this.saveProfiles();
    this.notifyProfilingCallbacks(profile);

    return profile;
  }

  async pauseProfiling(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile || profile.status !== 'running') return;

    await this.stopSampling();
    // Note: In a real implementation, we'd pause data collection
  }

  async resumeProfiling(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    await this.startSampling(profile);
    // Note: In a real implementation, we'd resume data collection
  }

  // AI Analysis
  async performAIAnalysis(profileId: string): Promise<AIPerformanceAnalysis> {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    try {
      const prompt = `Analyze this performance profile and provide comprehensive insights:

Profile: ${profile.name}
File: ${profile.filePath}
Language: ${profile.language}
Duration: ${profile.duration}ms

Execution Metrics:
- Total Time: ${profile.metrics.execution.totalTime}ms
- Call Count: ${profile.metrics.execution.callCount}
- Exception Count: ${profile.metrics.execution.exceptionCount}

Memory Metrics:
- Heap Used: ${profile.metrics.memory.heapUsed} bytes
- Heap Total: ${profile.metrics.memory.heapTotal} bytes
- RSS: ${profile.metrics.memory.rss} bytes
- Memory Leaks: ${profile.metrics.memory.leaks.length}

CPU Metrics:
- Usage: ${profile.metrics.cpu.usage}%
- Instructions: ${profile.metrics.cpu.instructions}
- Cache Hits: ${profile.metrics.cpu.cacheHits}
- Cache Misses: ${profile.metrics.cpu.cacheMisses}

Hotspots: ${profile.metrics.hotspots.length}
Bottlenecks: ${profile.metrics.bottlenecks.length}

Top Functions by Time:
${profile.metrics.functions
  .slice(0, 5)
  .map((f) => `${f.name}: ${f.totalTime}ms (${f.callCount} calls)`)
  .join('\n')}

Provide analysis including:
1. Overall performance assessment and score (0-100)
2. Key performance insights and recommendations
3. Detected patterns and anti-patterns
4. Optimization opportunities with impact estimates
5. Predictions for performance trends
6. Specific code recommendations

Format as JSON object with: summary, insights, patterns, predictions, confidence`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) {
        profile.analysis = this.getDefaultAnalysis();
        return profile.analysis;
      }

      const analysisSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Performance analysis' },
        [agent.id],
      );

      const result = this.parseAIResponse(analysisSession.result?.finalOutput || '{}');

      const analysis: AIPerformanceAnalysis = {
        summary: result.summary || this.getDefaultSummary(),
        insights: result.insights || [],
        patterns: result.patterns || [],
        comparisons: result.comparisons || [],
        predictions: result.predictions || [],
        confidence: result.confidence || 0.5,
      };

      profile.analysis = analysis;

      // Generate recommendations based on analysis
      profile.recommendations = await this.generateRecommendations(profile, analysis);

      this.saveProfiles();
      this.notifyAnalysisCallbacks(analysis);

      return analysis;
    } catch (error) {
      console.warn('Performance analysis failed:', error);
      const defaultAnalysis = this.getDefaultAnalysis();
      profile.analysis = defaultAnalysis;
      return defaultAnalysis;
    }
  }

  private async generateRecommendations(
    profile: PerformanceProfile,
    analysis: AIPerformanceAnalysis,
  ): Promise<PerformanceRecommendation[]> {
    try {
      const prompt = `Generate specific performance optimization recommendations:

Analysis Summary: ${analysis.summary.category} (Score: ${analysis.summary.overallScore})
Primary Issues: ${analysis.summary.primaryIssues.join(', ')}

Key Insights:
${analysis.insights.map((i) => `- ${i.title}: ${i.description}`).join('\n')}

Performance Patterns:
${analysis.patterns.map((p) => `- ${p.name}: ${p.description}`).join('\n')}

Generate 5-10 actionable recommendations including:
1. Code optimizations with specific changes
2. Architecture improvements
3. Configuration adjustments
4. Infrastructure recommendations

For each recommendation provide:
- type: code-optimization, architecture-change, configuration, infrastructure
- priority: critical, high, medium, low
- title and description
- implementation steps
- expected improvement percentage
- effort level (low, medium, high)
- risk level (safe, low, medium, high)
- whether it can be automated

Format as JSON array of recommendation objects.`;

      const agent = aiWorkflowEngine.getAllAgents()[0];
      if (!agent) return this.getDefaultRecommendations();

      const recommendationSession = await aiWorkflowEngine.runSequentialWorkflow(
        { userGoal: prompt, additionalContext: 'Performance recommendations' },
        [agent.id],
      );

      const result = this.parseAIResponse(recommendationSession.result?.finalOutput || '[]');

      return (Array.isArray(result) ? result : [result]).map((rec: any, index: number) => ({
        id: `rec-${profile.id}-${index}`,
        type: rec.type || 'code-optimization',
        priority: rec.priority || 'medium',
        title: rec.title || 'Performance optimization',
        description: rec.description || '',
        implementation: rec.implementation || '',
        expectedImprovement: rec.expectedImprovement || 10,
        effort: rec.effort || 'medium',
        riskLevel: rec.riskLevel || 'low',
        automated: rec.automated || false,
      }));
    } catch (error) {
      console.warn('Recommendation generation failed:', error);
      return this.getDefaultRecommendations();
    }
  }

  // Sampling and Data Collection
  private async startSampling(profile: PerformanceProfile): Promise<void> {
    if (this.samplingInterval) return;

    this.samplingInterval = setInterval(() => {
      this.collectSample(profile);
    }, 1000 / this.settings.samplingRate);
  }

  private async stopSampling(): Promise<void> {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }
  }

  private collectSample(profile: PerformanceProfile): void {
    const timestamp = Date.now();

    // Collect real CPU sample using Performance API
    if (this.settings.includeCPU) {
      try {
        // Use Performance API to get real CPU timing
        const perfEntries = performance.getEntriesByType('measure');
        const recentEntry = perfEntries[perfEntries.length - 1];
        
        const cpuSample: CPUSample = {
          timestamp,
          usage: recentEntry ? (recentEntry.duration / 1000) * 100 : 0, // Convert duration to pseudo CPU%
          function: recentEntry?.name || 'unknown',
          location: {
            filePath: profile.filePath,
            startLine: 1,
            endLine: 1,
            startColumn: 1,
            endColumn: 10,
          },
        };
        profile.metrics.cpu.samples.push(cpuSample);
      } catch (error) {
        // Fallback if Performance API not available
        console.warn('Performance API not available for CPU sampling');
      }
    }

    // Collect real memory sample using Performance Memory API
    if (this.settings.includeMemory && this.settings.trackAllocations) {
      try {
        // Use Performance Memory API (Chrome/Edge)
        const memory = (performance as any).memory;
        
        if (memory) {
          const allocation: MemoryAllocation = {
            timestamp,
            size: memory.usedJSHeapSize || 0,
            type: 'heap',
            location: {
              filePath: profile.filePath,
              startLine: 1,
              endLine: 1,
              startColumn: 1,
              endColumn: 10,
            },
            stackTrace: this.captureStackTrace(),
          };
          profile.metrics.memory.allocations.push(allocation);
        }
      } catch (error) {
        // Fallback if Memory API not available
        console.warn('Performance Memory API not available');
      }
    }

    // Update execution timeline
    const timelineEvent: TimelineEvent = {
      timestamp,
      type: 'function-call',
      name: 'sampleFunction',
      duration: Math.random() * 10,
      metadata: {},
    };
    profile.metrics.execution.timeline.push(timelineEvent);
  }

  private async finalizeMetrics(profile: PerformanceProfile): Promise<void> {
    // Calculate final metrics
    profile.metrics.execution.totalTime = profile.duration || 0;
    profile.metrics.execution.callCount = profile.metrics.execution.timeline.length;

    // Analyze hotspots
    profile.metrics.hotspots = this.detectHotspots(profile);

    // Analyze bottlenecks
    profile.metrics.bottlenecks = this.detectBottlenecks(profile);

    // Analyze function metrics
    profile.metrics.functions = this.analyzeFunctions(profile);
  }

  private detectHotspots(profile: PerformanceProfile): PerformanceHotspot[] {
    const hotspots: PerformanceHotspot[] = [];

    // Analyze CPU samples to find hotspots
    if (profile.metrics.cpu.samples.length > 0) {
      // Group samples by location
      const locationGroups = new Map<string, CPUSample[]>();

      profile.metrics.cpu.samples.forEach((sample) => {
        const key = `${sample.location.filePath}:${sample.location.startLine}`;
        if (!locationGroups.has(key)) {
          locationGroups.set(key, []);
        }
        locationGroups.get(key)!.push(sample);
      });

      // Find locations with high CPU usage
      locationGroups.forEach((samples, locationKey) => {
        const avgUsage = samples.reduce((sum, s) => sum + s.usage, 0) / samples.length;
        const frequency = samples.length;

        if (avgUsage > 50 || frequency > 10) {
          // Thresholds for hotspots
          const [filePath, lineStr] = locationKey.split(':');
          const line = parseInt(lineStr);

          hotspots.push({
            location: {
              filePath,
              startLine: line,
              endLine: line + 5, // Approximate code block
              startColumn: 1,
              endColumn: 50,
            },
            type: avgUsage > 70 ? 'cpu' : 'blocking',
            severity: avgUsage > 80 ? 'critical' : avgUsage > 60 ? 'high' : 'medium',
            impact: Math.min(avgUsage / 100, 1.0),
            frequency,
            description: `High CPU usage detected: ${avgUsage.toFixed(1)}% average`,
            samples: frequency,
          });
        }
      });
    }

    // Analyze timeline events for blocking operations
    const longEvents = profile.metrics.execution.timeline.filter(
      (event) => event.duration && event.duration > 100, // Events longer than 100ms
    );

    longEvents.forEach((event) => {
      if (event.metadata?.location) {
        hotspots.push({
          location: event.metadata.location,
          type: 'blocking',
          severity: event.duration! > 1000 ? 'critical' : 'high',
          impact: Math.min(event.duration! / 1000, 1.0),
          frequency: 1,
          description: `Long-running ${event.type} operation: ${event.duration}ms`,
          samples: 1,
        });
      }
    });

    // Sort by impact and return top hotspots
    return hotspots.sort((a, b) => b.impact - a.impact).slice(0, 10);
  }

  private detectBottlenecks(profile: PerformanceProfile): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Analyze memory allocations for leaks
    const largeAllocations = profile.metrics.memory.allocations.filter(
      (alloc) => alloc.size > 1024 * 1024, // Larger than 1MB
    );

    largeAllocations.forEach((alloc, index) => {
      bottlenecks.push({
        id: `bottleneck-${profile.id}-memory-${index}`,
        type: 'resource',
        location: alloc.location,
        description: `Large memory allocation: ${(alloc.size / 1024 / 1024).toFixed(2)}MB`,
        impact: Math.min(alloc.size / (10 * 1024 * 1024), 1.0), // Scale impact
        duration: 0, // Memory allocations are instantaneous
        frequency: 1,
        stackTrace: [], // Would need to be populated from actual profiling
      });
    });

    // Analyze GC events for excessive garbage collection
    const totalGCTime = profile.metrics.memory.gcEvents.reduce((sum, gc) => sum + gc.duration, 0);
    const gcPercentage = profile.duration ? (totalGCTime / profile.duration) * 100 : 0;

    if (gcPercentage > 10) {
      // More than 10% time spent in GC
      bottlenecks.push({
        id: `bottleneck-${profile.id}-gc`,
        type: 'resource',
        location: {
          filePath: profile.filePath,
          startLine: 1,
          endLine: 1,
          startColumn: 1,
          endColumn: 1,
        },
        description: `Excessive garbage collection: ${gcPercentage.toFixed(1)}% of execution time`,
        impact: Math.min(gcPercentage / 50, 1.0),
        duration: totalGCTime,
        frequency: profile.metrics.memory.gcEvents.length,
        stackTrace: [],
      });
    }

    // Analyze I/O operations for blocking calls
    const slowIO = profile.metrics.io.fileOperations.filter(
      (op) => op.duration > 100, // Operations taking more than 100ms
    );

    slowIO.forEach((op, index) => {
      bottlenecks.push({
        id: `bottleneck-${profile.id}-io-${index}`,
        type: 'resource',
        location: {
          filePath: op.filePath,
          startLine: 1, // Would need actual line number
          endLine: 1,
          startColumn: 1,
          endColumn: 1,
        },
        description: `Slow ${op.type} operation: ${op.duration}ms for ${op.size} bytes`,
        impact: Math.min(op.duration / 1000, 1.0),
        duration: op.duration,
        frequency: 1,
        stackTrace: [],
      });
    });

    return bottlenecks;
  }

  private analyzeFunctions(profile: PerformanceProfile): FunctionMetrics[] {
    const functionMap = new Map<string, FunctionMetrics>();

    // Analyze timeline events to extract function metrics
    profile.metrics.execution.timeline.forEach((event) => {
      if (event.type === 'function-call' && event.name) {
        const key = `${event.name}:${event.metadata?.location?.filePath || 'unknown'}:${event.metadata?.location?.startLine || 0}`;

        if (!functionMap.has(key)) {
          functionMap.set(key, {
            name: event.name,
            filePath: event.metadata?.location?.filePath || profile.filePath,
            line: event.metadata?.location?.startLine || 1,
            callCount: 0,
            totalTime: 0,
            selfTime: 0,
            averageTime: 0,
            minTime: Infinity,
            maxTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            children: [],
          });
        }

        const func = functionMap.get(key)!;
        func.callCount++;

        if (event.duration) {
          func.totalTime += event.duration;
          func.minTime = Math.min(func.minTime, event.duration);
          func.maxTime = Math.max(func.maxTime, event.duration);
        }
      }
    });

    // Calculate derived metrics
    const functions = Array.from(functionMap.values());
    functions.forEach((func) => {
      func.averageTime = func.callCount > 0 ? func.totalTime / func.callCount : 0;
      func.selfTime = func.totalTime; // Simplified - would need call graph analysis
      func.minTime = func.minTime === Infinity ? 0 : func.minTime;

      // Estimate memory and CPU usage based on call patterns
      func.memoryUsage = Math.floor(func.totalTime / 10); // Rough estimation
      func.cpuUsage = Math.min(func.averageTime / 100, 1.0); // Rough CPU estimation
    });

    // Sort by total time (most expensive first)
    return functions
      .filter((func) => func.callCount > 0)
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 20); // Top 20 functions
  }

  // Helper Methods
  private initializeMetrics(): PerformanceMetrics {
    return {
      execution: {
        totalTime: 0,
        userTime: 0,
        systemTime: 0,
        idleTime: 0,
        gcTime: 0,
        compilationTime: 0,
        callCount: 0,
        exceptionCount: 0,
        timeline: [],
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        heapMax: 0,
        stackSize: 0,
        external: 0,
        rss: 0,
        allocations: [],
        deallocations: [],
        leaks: [],
        gcEvents: [],
      },
      cpu: {
        usage: 0,
        userUsage: 0,
        systemUsage: 0,
        cores: 1,
        frequency: 0,
        samples: [],
        threads: [],
        instructions: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
      io: {
        readOperations: 0,
        writeOperations: 0,
        bytesRead: 0,
        bytesWritten: 0,
        readTime: 0,
        writeTime: 0,
        fileOperations: [],
        diskUsage: {
          total: 0,
          used: 0,
          available: 0,
          readSpeed: 0,
          writeSpeed: 0,
        },
      },
      network: {
        requests: 0,
        responses: 0,
        bytesReceived: 0,
        bytesSent: 0,
        latency: 0,
        connections: [],
        errors: [],
      },
      functions: [],
      hotspots: [],
      bottlenecks: [],
    };
  }

  private getDefaultSettings(): ProfilingSettings {
    return {
      enabled: true,
      samplingRate: 10, // samples per second
      maxDuration: 300000, // 5 minutes
      includeMemory: true,
      includeCPU: true,
      includeIO: true,
      includeNetwork: true,
      trackAllocations: true,
      trackGC: true,
      minFunctionTime: 1, // ms
      maxCallStack: 100,
      autoAnalysis: true,
    };
  }

  private getDefaultAnalysis(): AIPerformanceAnalysis {
    return {
      summary: this.getDefaultSummary(),
      insights: [],
      patterns: [],
      comparisons: [],
      predictions: [],
      confidence: 0.3,
    };
  }

  private getDefaultSummary(): AnalysisSummary {
    return {
      overallScore: 70,
      category: 'fair',
      primaryIssues: ['Performance analysis unavailable'],
      strengths: [],
      keyMetrics: {},
    };
  }

  private getDefaultRecommendations(): PerformanceRecommendation[] {
    return [
      {
        id: 'default-rec-1',
        type: 'code-optimization',
        priority: 'medium',
        title: 'General Performance Review',
        description: 'Review code for common performance issues',
        implementation: 'Analyze code manually for optimization opportunities',
        expectedImprovement: 10,
        effort: 'medium',
        riskLevel: 'low',
        automated: false,
      },
    ];
  }

  private parseAIResponse(response: string): any {
    try {
      const jsonMatch =
        response.match(/```json\n([\s\S]*?)\n```/) ||
        response.match(/\[[\s\S]*\]/) ||
        response.match(/\{[\s\S]*\}/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      return JSON.parse(jsonStr);
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return {};
    }
  }

  private loadProfiles(): void {
    try {
      const saved = localStorage.getItem('performance_profiles');
      if (saved) {
        const data = JSON.parse(saved);
        this.profiles = new Map(data);
      }
    } catch (error) {
      console.warn('Failed to load performance profiles:', error);
    }
  }

  private saveProfiles(): void {
    try {
      const data = Array.from(this.profiles.entries());
      localStorage.setItem('performance_profiles', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save performance profiles:', error);
    }
  }

  // Event Handling
  onProfilingChanged(callback: (profile: PerformanceProfile) => void): () => void {
    this.profilingCallbacks.add(callback);
    return () => this.profilingCallbacks.delete(callback);
  }

  onAnalysisReady(callback: (analysis: AIPerformanceAnalysis) => void): () => void {
    this.analysisCallbacks.add(callback);
    return () => this.analysisCallbacks.delete(callback);
  }

  private notifyProfilingCallbacks(profile: PerformanceProfile): void {
    this.profilingCallbacks.forEach((callback) => {
      try {
        callback(profile);
      } catch (error) {
        console.warn('Profiling callback failed:', error);
      }
    });
  }

  private notifyAnalysisCallbacks(analysis: AIPerformanceAnalysis): void {
    this.analysisCallbacks.forEach((callback) => {
      try {
        callback(analysis);
      } catch (error) {
        console.warn('Analysis callback failed:', error);
      }
    });
  }

  // Public API
  getProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  getProfile(profileId: string): PerformanceProfile | null {
    return this.profiles.get(profileId) || null;
  }

  getActiveProfile(): PerformanceProfile | null {
    return this.activeProfile;
  }

  deleteProfile(profileId: string): void {
    this.profiles.delete(profileId);
    this.saveProfiles();
  }

  updateSettings(newSettings: Partial<ProfilingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Captures current stack trace for profiling
   */
  private captureStackTrace(): string[] {
    try {
      const stack = new Error().stack;
      if (!stack) return [];
      
      return stack
        .split('\n')
        .slice(2) // Remove Error and captureStackTrace frames
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 10); // Limit to 10 frames
    } catch (error) {
      return [];
    }
  }

  getSettings(): ProfilingSettings {
    return { ...this.settings };
  }

  exportProfile(profileId: string): string {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    return JSON.stringify(profile, null, 2);
  }

  async importProfile(profileData: string): Promise<PerformanceProfile> {
    try {
      const profile = JSON.parse(profileData) as PerformanceProfile;
      profile.id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.profiles.set(profile.id, profile);
      this.saveProfiles();

      return profile;
    } catch (error) {
      throw new Error(`Failed to import profile: ${error}`);
    }
  }
}

export const aiPerformanceProfiler = new AIPerformanceProfiler();
