import * as fs from 'fs';
import * as path from 'path';

export interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'module' | 'package' | 'function' | 'class' | 'variable';
  filePath: string;
  version?: string;
  isExternal: boolean;
  size: number;
  complexity: number;
  lastModified: number;
  metadata: {
    language: string;
    framework?: string;
    category?: string;
    description?: string;
  };
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'require' | 'include' | 'call' | 'inheritance' | 'composition';
  weight: number;
  isCircular: boolean;
  lineNumber?: number;
  importType?: 'default' | 'named' | 'namespace' | 'dynamic';
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, DependencyEdge>;
  clusters: DependencyCluster[];
  metrics: GraphMetrics;
}

export interface DependencyCluster {
  id: string;
  name: string;
  nodes: string[];
  type: 'module' | 'feature' | 'layer' | 'package';
  cohesion: number;
  coupling: number;
  stability: number;
}

export interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  circularDependencies: number;
  maxDepth: number;
  avgDegree: number;
  density: number;
  modularity: number;
  complexity: number;
}

export interface DependencyReport {
  id: string;
  projectPath: string;
  timestamp: number;
  graph: DependencyGraph;
  issues: DependencyIssue[];
  recommendations: string[];
  security: SecurityAnalysis;
  performance: PerformanceAnalysis;
}

export interface DependencyIssue {
  id: string;
  type: 'circular' | 'unused' | 'outdated' | 'vulnerable' | 'heavy' | 'duplicate';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedNodes: string[];
  solution: string;
  autoFixAvailable: boolean;
}

export interface SecurityAnalysis {
  vulnerabilities: Vulnerability[];
  riskScore: number;
  recommendations: string[];
}

export interface Vulnerability {
  id: string;
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  fixedIn?: string;
  cve?: string;
}

export interface PerformanceAnalysis {
  bundleSize: number;
  loadTime: number;
  heavyDependencies: string[];
  optimizationOpportunities: string[];
}

export class DependencyAnalyzer {
  private analysisCache = new Map<string, DependencyReport>();
  private isAnalyzing = false;
  private analysisProgress = 0;
  private progressCallbacks = new Set<(progress: number) => void>();

  async analyzeProject(projectPath: string): Promise<DependencyReport> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    this.analysisProgress = 0;
    this.notifyProgress(0);

    try {
      const report: DependencyReport = {
        id: `dep-analysis-${Date.now()}`,
        projectPath,
        timestamp: Date.now(),
        graph: {
          nodes: new Map(),
          edges: new Map(),
          clusters: [],
          metrics: this.getEmptyMetrics(),
        },
        issues: [],
        recommendations: [],
        security: { vulnerabilities: [], riskScore: 0, recommendations: [] },
        performance: {
          bundleSize: 0,
          loadTime: 0,
          heavyDependencies: [],
          optimizationOpportunities: [],
        },
      };

      // Step 1: Discover files and packages (20%)
      const files = await this.discoverProjectFiles(projectPath);
      this.analysisProgress = 20;
      this.notifyProgress(20);

      // Step 2: Parse dependencies (40%)
      await this.parseDependencies(files, report.graph);
      this.analysisProgress = 40;
      this.notifyProgress(40);

      // Step 3: Build dependency graph (60%)
      await this.buildDependencyGraph(report.graph);
      this.analysisProgress = 60;
      this.notifyProgress(60);

      // Step 4: Analyze issues and security (80%)
      report.issues = await this.analyzeIssues(report.graph);
      report.security = await this.analyzeSecurity(report.graph);
      this.analysisProgress = 80;
      this.notifyProgress(80);

      // Step 5: Performance analysis and recommendations (100%)
      report.performance = await this.analyzePerformance(report.graph);
      report.recommendations = await this.generateRecommendations(report);

      this.analysisProgress = 100;
      this.notifyProgress(100);

      this.analysisCache.set(projectPath, report);
      return report;
    } finally {
      this.isAnalyzing = false;
    }
  }

  async analyzeDependencyPath(
    fromNode: string,
    toNode: string,
    graph: DependencyGraph,
  ): Promise<string[][]> {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const findPaths = (current: string, target: string, path: string[]) => {
      if (current === target) {
        paths.push([...path, current]);
        return;
      }

      if (visited.has(current) || path.length > 10) return; // Prevent infinite loops and deep paths

      visited.add(current);

      for (const [_edgeId, edge] of graph.edges) {
        if (edge.source === current) {
          findPaths(edge.target, target, [...path, current]);
        }
      }

      visited.delete(current);
    };

    findPaths(fromNode, toNode, []);
    return paths.slice(0, 5); // Return top 5 paths
  }

  async getNodeDependents(nodeId: string, graph: DependencyGraph): Promise<DependencyNode[]> {
    const dependents: DependencyNode[] = [];

    for (const [_edgeId, edge] of graph.edges) {
      if (edge.target === nodeId) {
        const dependent = graph.nodes.get(edge.source);
        if (dependent) {
          dependents.push(dependent);
        }
      }
    }

    return dependents;
  }

  async getNodeDependencies(nodeId: string, graph: DependencyGraph): Promise<DependencyNode[]> {
    const dependencies: DependencyNode[] = [];

    for (const [_edgeId, edge] of graph.edges) {
      if (edge.source === nodeId) {
        const dependency = graph.nodes.get(edge.target);
        if (dependency) {
          dependencies.push(dependency);
        }
      }
    }

    return dependencies;
  }

  // Private Analysis Methods
  private async discoverProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          // Skip common directories that shouldn't be analyzed
          if (entry.isDirectory()) {
            if (
              !['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage'].includes(
                entry.name,
              )
            ) {
              scanDirectory(fullPath);
            }
          } else {
            // Check for supported file extensions
            const ext = path.extname(entry.name).toLowerCase();
            if (
              [
                '.js',
                '.ts',
                '.jsx',
                '.tsx',
                '.py',
                '.java',
                '.cs',
                '.cpp',
                '.c',
                '.php',
                '.rb',
                '.go',
                '.rs',
                '.json',
              ].includes(ext)
            ) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${dirPath}:`, error);
      }
    };

    scanDirectory(projectPath);
    return files;
  }

  private async parseDependencies(files: string[], graph: DependencyGraph): Promise<void> {
    for (const filePath of files) {
      try {
        const content = await this.readFile(filePath);
        const language = this.detectLanguage(filePath);

        // Parse file-level node
        const fileNode = await this.createFileNode(filePath, content, language);
        graph.nodes.set(fileNode.id, fileNode);

        // Parse imports/requires
        const imports = await this.parseImports(content, language, filePath);

        for (const importInfo of imports) {
          // Create dependency node if not exists
          if (!graph.nodes.has(importInfo.target)) {
            const depNode = await this.createDependencyNode(
              importInfo.target,
              importInfo.isExternal,
            );
            graph.nodes.set(depNode.id, depNode);
          }

          // Create edge
          const edge: DependencyEdge = {
            id: `${fileNode.id}->${importInfo.target}`,
            source: fileNode.id,
            target: importInfo.target,
            type: importInfo.type,
            weight: 1,
            isCircular: false,
            lineNumber: importInfo.lineNumber,
            importType: importInfo.importType,
          };

          graph.edges.set(edge.id, edge);
        }
      } catch (error) {
        console.warn(`Failed to parse dependencies for ${filePath}:`, error);
      }
    }
  }

  private async buildDependencyGraph(graph: DependencyGraph): Promise<void> {
    // Detect circular dependencies
    this.detectCircularDependencies(graph);

    // Calculate metrics
    graph.metrics = this.calculateGraphMetrics(graph);

    // Create clusters
    graph.clusters = await this.createClusters(graph);
  }

  private detectCircularDependencies(graph: DependencyGraph): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularEdges = new Set<string>();

    const dfs = (nodeId: string, path: string[]) => {
      if (recursionStack.has(nodeId)) {
        // Found cycle - mark all edges in cycle as circular
        const cycleStart = path.indexOf(nodeId);
        for (let i = cycleStart; i < path.length; i++) {
          const edgeId = `${path[i]}->${path[(i + 1) % path.length]}`;
          const edge = graph.edges.get(edgeId);
          if (edge) {
            edge.isCircular = true;
            circularEdges.add(edgeId);
          }
        }
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const [_edgeId, edge] of graph.edges) {
        if (edge.source === nodeId) {
          dfs(edge.target, [...path, nodeId]);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }
  }

  private calculateGraphMetrics(graph: DependencyGraph): GraphMetrics {
    const totalNodes = graph.nodes.size;
    const totalEdges = graph.edges.size;
    const circularDependencies = Array.from(graph.edges.values()).filter(
      (e) => e.isCircular,
    ).length;

    // Calculate max depth
    let maxDepth = 0;
    for (const nodeId of graph.nodes.keys()) {
      const depth = this.calculateNodeDepth(nodeId, graph);
      maxDepth = Math.max(maxDepth, depth);
    }

    // Calculate average degree
    const degrees = new Map<string, number>();
    for (const edge of graph.edges.values()) {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
    }
    const avgDegree =
      totalNodes > 0 ? Array.from(degrees.values()).reduce((sum, d) => sum + d, 0) / totalNodes : 0;

    // Calculate density
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    return {
      totalNodes,
      totalEdges,
      circularDependencies,
      maxDepth,
      avgDegree,
      density,
      modularity: this.calculateModularity(graph),
      complexity: this.calculateComplexity(graph),
    };
  }

  private calculateNodeDepth(
    nodeId: string,
    graph: DependencyGraph,
    visited = new Set<string>(),
  ): number {
    if (visited.has(nodeId)) return 0; // Circular dependency

    visited.add(nodeId);
    let maxDepth = 0;

    for (const edge of graph.edges.values()) {
      if (edge.source === nodeId) {
        const depth = 1 + this.calculateNodeDepth(edge.target, graph, new Set(visited));
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth;
  }

  private calculateModularity(graph: DependencyGraph): number {
    // Simplified modularity calculation
    return graph.clusters.length > 0
      ? graph.clusters.reduce((sum, c) => sum + c.cohesion, 0) / graph.clusters.length
      : 0;
  }

  private calculateComplexity(graph: DependencyGraph): number {
    // Cyclomatic complexity based on edges and nodes
    return graph.edges.size - graph.nodes.size + 2;
  }

  private async createClusters(graph: DependencyGraph): Promise<DependencyCluster[]> {
    const clusters: DependencyCluster[] = [];

    // Group by file directory
    const dirGroups = new Map<string, string[]>();

    for (const [nodeId, node] of graph.nodes) {
      if (node.type === 'file') {
        const dir = node.filePath.split('/').slice(0, -1).join('/');
        if (!dirGroups.has(dir)) {
          dirGroups.set(dir, []);
        }
        dirGroups.get(dir)!.push(nodeId);
      }
    }

    // Create clusters from directory groups
    for (const [dir, nodeIds] of dirGroups) {
      if (nodeIds.length > 1) {
        clusters.push({
          id: `cluster-${dir.replace(/[^a-zA-Z0-9]/g, '-')}`,
          name: dir.split('/').pop() || 'root',
          nodes: nodeIds,
          type: 'module',
          cohesion: this.calculateCohesion(nodeIds, graph),
          coupling: this.calculateCoupling(nodeIds, graph),
          stability: this.calculateStability(nodeIds, graph),
        });
      }
    }

    return clusters;
  }

  private calculateCohesion(nodeIds: string[], graph: DependencyGraph): number {
    let internalEdges = 0;
    let totalEdges = 0;

    for (const edge of graph.edges.values()) {
      if (nodeIds.includes(edge.source) || nodeIds.includes(edge.target)) {
        totalEdges++;
        if (nodeIds.includes(edge.source) && nodeIds.includes(edge.target)) {
          internalEdges++;
        }
      }
    }

    return totalEdges > 0 ? internalEdges / totalEdges : 0;
  }

  private calculateCoupling(nodeIds: string[], graph: DependencyGraph): number {
    let externalEdges = 0;

    for (const edge of graph.edges.values()) {
      const sourceInCluster = nodeIds.includes(edge.source);
      const targetInCluster = nodeIds.includes(edge.target);

      if (sourceInCluster !== targetInCluster) {
        externalEdges++;
      }
    }

    return externalEdges;
  }

  private calculateStability(nodeIds: string[], graph: DependencyGraph): number {
    let afferent = 0; // Incoming dependencies
    let efferent = 0; // Outgoing dependencies

    for (const edge of graph.edges.values()) {
      if (nodeIds.includes(edge.target) && !nodeIds.includes(edge.source)) {
        afferent++;
      }
      if (nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)) {
        efferent++;
      }
    }

    const total = afferent + efferent;
    return total > 0 ? efferent / total : 0;
  }

  private async analyzeIssues(graph: DependencyGraph): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = [];

    // Circular dependency issues
    const circularEdges = Array.from(graph.edges.values()).filter((e) => e.isCircular);
    if (circularEdges.length > 0) {
      issues.push({
        id: 'circular-deps',
        type: 'circular',
        severity: 'high',
        title: 'Circular Dependencies Detected',
        description: `Found ${circularEdges.length} circular dependencies that can cause build issues and runtime problems.`,
        affectedNodes: [...new Set(circularEdges.flatMap((e) => [e.source, e.target]))],
        solution:
          'Refactor code to break circular dependencies by extracting shared functionality or using dependency injection.',
        autoFixAvailable: false,
      });
    }

    // Heavy dependencies
    const heavyNodes = Array.from(graph.nodes.values())
      .filter((n) => n.size > 1000000) // > 1MB
      .sort((a, b) => b.size - a.size);

    if (heavyNodes.length > 0) {
      issues.push({
        id: 'heavy-deps',
        type: 'heavy',
        severity: 'medium',
        title: 'Heavy Dependencies',
        description: `Found ${heavyNodes.length} large dependencies that may impact bundle size and performance.`,
        affectedNodes: heavyNodes.map((n) => n.id),
        solution: 'Consider using lighter alternatives or lazy loading for heavy dependencies.',
        autoFixAvailable: false,
      });
    }

    // Unused dependencies (simplified detection)
    const unusedNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.isExternal && !Array.from(graph.edges.values()).some((e) => e.target === n.id),
    );

    if (unusedNodes.length > 0) {
      issues.push({
        id: 'unused-deps',
        type: 'unused',
        severity: 'low',
        title: 'Unused Dependencies',
        description: `Found ${unusedNodes.length} dependencies that appear to be unused.`,
        affectedNodes: unusedNodes.map((n) => n.id),
        solution: 'Remove unused dependencies to reduce bundle size.',
        autoFixAvailable: true,
      });
    }

    return issues;
  }

  private async analyzeSecurity(graph: DependencyGraph): Promise<SecurityAnalysis> {
    const vulnerabilities: Vulnerability[] = [];

    // Analyze external package dependencies for known vulnerabilities
    const externalNodes = Array.from(graph.nodes.values()).filter((n) => n.isExternal);

    // In a production environment, this would integrate with vulnerability databases like:
    // - National Vulnerability Database (NVD)
    // - GitHub Security Advisories
    // - Snyk Vulnerability Database
    // - OWASP Dependency Check

    // For now, implement basic checks for common vulnerable packages and versions
    for (const node of externalNodes) {
      const vuln = this.checkKnownVulnerabilities(node);
      if (vuln) {
        vulnerabilities.push(vuln);
      }
    }

    const riskScore = vulnerabilities.reduce((score, vuln) => {
      const severityScores = { critical: 10, high: 7, medium: 4, low: 1 };
      return score + severityScores[vuln.severity];
    }, 0);

    const recommendations = this.generateSecurityRecommendations(vulnerabilities, riskScore);

    return {
      vulnerabilities,
      riskScore,
      recommendations,
    };
  }

  private checkKnownVulnerabilities(node: DependencyNode): Vulnerability | null {
    // Basic vulnerability database - in production, this would be much more comprehensive
    const knownVulnerabilities: Record<string, Vulnerability[]> = {
      lodash: [
        {
          id: 'lodash-prototype-pollution',
          package: 'lodash',
          version: '<4.17.12',
          severity: 'high' as const,
          title: 'Prototype Pollution in lodash',
          description:
            'Versions of lodash prior to 4.17.12 are vulnerable to prototype pollution attacks.',
          fixedIn: '4.17.12',
          cve: 'CVE-2019-10744',
        },
      ],
      express: [
        {
          id: 'express-open-redirect',
          package: 'express',
          version: '<4.0.0',
          severity: 'medium' as const,
          title: 'Open Redirect in Express',
          description: 'Older versions of Express may be vulnerable to open redirect attacks.',
          fixedIn: '4.0.0',
          cve: 'CVE-2014-6394',
        },
      ],
      react: [
        {
          id: 'react-xss-vulnerability',
          package: 'react',
          version: '<16.0.0',
          severity: 'high' as const,
          title: 'XSS Vulnerability in React',
          description: 'Older React versions have known XSS vulnerabilities.',
          fixedIn: '16.0.0',
          cve: 'CVE-2017-11215',
        },
      ],
    };

    const packageVulns = knownVulnerabilities[node.name];
    if (!packageVulns || !node.version) return null;

    // Check if the current version is vulnerable
    for (const vuln of packageVulns) {
      if (this.isVersionVulnerable(node.version, vuln.version)) {
        return {
          ...vuln,
          version: node.version,
        };
      }
    }

    return null;
  }

  private isVersionVulnerable(currentVersion: string, vulnerableRange: string): boolean {
    // Simple version comparison - in production, use semver library
    try {
      // Remove common prefixes
      const cleanCurrent = currentVersion.replace(/^[~^=<>]/, '');
      const cleanVulnerable = vulnerableRange.replace(/^[~^=<>]/, '');

      // For ranges like "<4.17.12", check if current version is less than the specified version
      if (vulnerableRange.startsWith('<')) {
        const targetVersion = vulnerableRange.substring(1);
        return this.compareVersions(cleanCurrent, targetVersion) < 0;
      }

      // For exact matches or other patterns
      return cleanCurrent === cleanVulnerable;
    } catch (error) {
      console.warn(`Failed to compare versions: ${currentVersion} vs ${vulnerableRange}`, error);
      return false;
    }
  }

  private compareVersions(version1: string, version2: string): number {
    // Simple version comparison - split by dots and compare numerically
    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  private generateSecurityRecommendations(
    vulnerabilities: Vulnerability[],
    riskScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (vulnerabilities.length > 0) {
      recommendations.push('Update vulnerable dependencies to latest secure versions');
    }

    if (riskScore > 20) {
      recommendations.push('Critical security issues detected - immediate attention required');
      recommendations.push(
        'Consider using security scanning tools like Snyk or OWASP Dependency Check',
      );
    } else if (riskScore > 10) {
      recommendations.push('High-priority security updates recommended');
    }

    recommendations.push('Enable automated security scanning in CI/CD pipeline');
    recommendations.push(
      'Use dependency lock files (package-lock.json, yarn.lock) to ensure consistent versions',
    );
    recommendations.push('Regularly audit dependencies for new vulnerabilities');

    return recommendations;
  }

  private async analyzePerformance(graph: DependencyGraph): Promise<PerformanceAnalysis> {
    const bundleSize = Array.from(graph.nodes.values())
      .filter((n) => n.isExternal)
      .reduce((size, node) => size + node.size, 0);

    const heavyDependencies = Array.from(graph.nodes.values())
      .filter((n) => n.isExternal && n.size > 100000)
      .map((n) => n.name)
      .slice(0, 10);

    return {
      bundleSize,
      loadTime: bundleSize / 1000000, // Rough estimate: 1MB = 1s
      heavyDependencies,
      optimizationOpportunities: [
        'Use tree shaking to eliminate unused code',
        'Consider code splitting for large dependencies',
        'Implement lazy loading for non-critical dependencies',
        'Use CDN for common libraries',
      ],
    };
  }

  private async generateRecommendations(report: DependencyReport): Promise<string[]> {
    const recommendations: string[] = [];

    if (report.graph.metrics.circularDependencies > 0) {
      recommendations.push('Break circular dependencies to improve maintainability');
    }

    if (report.graph.metrics.density > 0.5) {
      recommendations.push('Consider modularizing the codebase to reduce coupling');
    }

    if (report.performance.bundleSize > 5000000) {
      // > 5MB
      recommendations.push('Optimize bundle size through code splitting and tree shaking');
    }

    if (report.security.riskScore > 20) {
      recommendations.push('Address security vulnerabilities in dependencies');
    }

    return recommendations;
  }

  // Helper Methods
  private async createFileNode(
    filePath: string,
    content: string,
    language: string,
  ): Promise<DependencyNode> {
    return {
      id: filePath,
      name: filePath.split('/').pop() || filePath,
      type: 'file',
      filePath,
      isExternal: false,
      size: content.length,
      complexity: this.calculateFileComplexity(content, language),
      lastModified: Date.now(),
      metadata: {
        language,
        description: `${language} source file`,
      },
    };
  }

  private async createDependencyNode(target: string, isExternal: boolean): Promise<DependencyNode> {
    let size = 0;
    let complexity = 0;
    let version: string | undefined;

    if (isExternal) {
      // For external packages, try to estimate size based on common package sizes
      // In production, this would query package registries like npm
      const commonPackageSizes: Record<string, number> = {
        react: 45000,
        lodash: 55000,
        express: 35000,
        axios: 12000,
        moment: 65000,
        jquery: 87000,
        typescript: 120000,
      };

      size = commonPackageSizes[target] || 25000; // Default estimate
      complexity = Math.floor(size / 2000); // Rough complexity estimate

      // Try to read version from package.json if available
      try {
        const packageJsonPath = path.join(process.cwd(), 'node_modules', target, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          version = packageJson.version;
        }
      } catch (error) {
        // Version not available, leave undefined
      }
    }

    return {
      id: target,
      name: target,
      type: isExternal ? 'package' : 'module',
      filePath: isExternal ? '' : target,
      version,
      isExternal,
      size,
      complexity,
      lastModified: Date.now(),
      metadata: {
        language: 'unknown',
        description: isExternal ? 'External package' : 'Internal module',
      },
    };
  }

  private async parseImports(content: string, language: string, _filePath: string): Promise<any[]> {
    const imports: any[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const importMatch = this.matchImportStatement(line, language);

      if (importMatch) {
        imports.push({
          target: importMatch.module,
          type: importMatch.type,
          isExternal: importMatch.isExternal,
          lineNumber: i + 1,
          importType: importMatch.importType,
        });
      }
    }

    return imports;
  }

  private matchImportStatement(line: string, language: string): any | null {
    const patterns = {
      javascript: [/import\s+.*\s+from\s+['"]([^'"]+)['"]/, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/],
      typescript: [/import\s+.*\s+from\s+['"]([^'"]+)['"]/, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/],
      python: [/import\s+([^\s]+)/, /from\s+([^\s]+)\s+import/],
    };

    const langPatterns = patterns[language as keyof typeof patterns] || [];

    for (const pattern of langPatterns) {
      const match = line.match(pattern);
      if (match) {
        const module = match[1];
        return {
          module,
          type: line.includes('import') ? 'import' : 'require',
          isExternal: !module.startsWith('.') && !module.startsWith('/'),
          importType: this.determineImportType(line),
        };
      }
    }

    return null;
  }

  private determineImportType(line: string): 'default' | 'named' | 'namespace' | 'dynamic' {
    if (line.includes('import *')) return 'namespace';
    if (line.includes('{')) return 'named';
    if (line.includes('import(')) return 'dynamic';
    return 'default';
  }

  private calculateFileComplexity(content: string, _language: string): number {
    // Simplified complexity calculation
    const lines = content.split('\n').length;
    const functions = (content.match(/function|def|func/g) || []).length;
    const conditionals = (content.match(/if|else|switch|case/g) || []).length;
    const loops = (content.match(/for|while|do/g) || []).length;

    return lines + functions * 2 + conditionals + loops;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      jsx: 'javascript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
    };
    return languageMap[ext || ''] || 'text';
  }

  private getEmptyMetrics(): GraphMetrics {
    return {
      totalNodes: 0,
      totalEdges: 0,
      circularDependencies: 0,
      maxDepth: 0,
      avgDegree: 0,
      density: 0,
      modularity: 0,
      complexity: 0,
    };
  }

  // File operations
  private async readFile(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
      return '';
    }
  }

  // Progress tracking
  onProgress(callback: (progress: number) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private notifyProgress(progress: number): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback failed:', error);
      }
    });
  }

  // Public getters
  getIsAnalyzing(): boolean {
    return this.isAnalyzing;
  }

  getAnalysisProgress(): number {
    return this.analysisProgress;
  }

  getLastReport(projectPath: string): DependencyReport | null {
    return this.analysisCache.get(projectPath) || null;
  }

  clearCache(): void {
    this.analysisCache.clear();
  }
}

export const dependencyAnalyzer = new DependencyAnalyzer();
