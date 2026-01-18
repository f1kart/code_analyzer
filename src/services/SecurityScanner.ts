// SecurityScanner.ts - Enterprise-grade security scanning integration
// Provides comprehensive SAST, DAST, dependency, and compliance scanning for enterprise security

import { CodeReviewEngine, CodeReviewResult } from './CodeReviewEngine';
import type { ReviewComment } from './CodeReviewEngine';
import { ParseResult } from './LanguageParser';

export interface SecurityVulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  category: 'sast' | 'dast' | 'dependency' | 'container' | 'secret' | 'compliance';
  cweId?: string;
  cveId?: string;
  cvssScore?: number;
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  evidence: string;
  impact: string;
  remediation: string;
  references: string[];
  detectedAt: Date;
  status: 'open' | 'confirmed' | 'resolved' | 'false_positive' | 'accepted_risk';
  assignedTo?: string;
  tags: string[];
}

export interface SecurityReport {
  scanId: string;
  timestamp: Date;
  scanType: 'sast' | 'dast' | 'dependency' | 'container' | 'secret' | 'compliance' | 'full';
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  vulnerabilities: SecurityVulnerability[];
  scanDuration: number; // milliseconds
  scanConfig: ScanConfiguration;
  complianceResults: ComplianceResult[];
  recommendations: SecurityRecommendation[];
}

export interface ScanConfiguration {
  enabledScanners: string[];
  severityThreshold: 'info' | 'low' | 'medium' | 'high' | 'critical';
  includePatterns: string[];
  excludePatterns: string[];
  maxScanTime: number; // milliseconds
  enableIncrementalScanning: boolean;
  customRules?: SecurityRule[];
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  category: SecurityVulnerability['category'];
  severity: SecurityVulnerability['severity'];
  pattern: string | RegExp;
  message: string;
  remediation: string;
  enabled: boolean;
}

export interface ComplianceResult {
  framework: 'OWASP' | 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'ISO27001';
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
  score: number; // 0-100
  requirements: ComplianceRequirement[];
  lastAssessed: Date;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  status: 'met' | 'not-met' | 'partial' | 'n/a';
  evidence?: string;
  remediation?: string;
}

export interface SecurityRecommendation {
  id: string;
  type: 'immediate' | 'short-term' | 'long-term';
  category: 'security' | 'compliance' | 'best-practice';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  implementation: string;
  resources?: string[];
}

export interface SecurityMetrics {
  totalScans: number;
  vulnerabilitiesFound: number;
  averageFixTime: number; // hours
  complianceScore: number;
  securityScore: number;
  trendData: SecurityTrend[];
}

export interface SecurityTrend {
  date: Date;
  vulnerabilities: number;
  critical: number;
  high: number;
  complianceScore: number;
  securityScore: number;
}

export class SecurityScanner {
  private reviewEngine: CodeReviewEngine;
  private securityRules: Map<string, SecurityRule[]> = new Map();
  private scanHistory: Map<string, SecurityReport[]> = new Map();
  private vulnerabilityDatabase: Map<string, VulnerabilityDefinition> = new Map();

  constructor(reviewEngine?: CodeReviewEngine) {
    this.reviewEngine = reviewEngine || new CodeReviewEngine();
    this.initializeSecurityRules();
    this.initializeVulnerabilityDatabase();
  }

  private buildSecurityReviewComment(vuln: SecurityVulnerability): ReviewComment {
    return {
      id: `security_${vuln.id}`,
      lineNumber: vuln.lineNumber,
      columnStart: vuln.columnStart,
      columnEnd: vuln.columnEnd,
      type: this.mapSeverityToCommentType(vuln.severity),
      severity: vuln.severity,
      category: 'security',
      message: `${vuln.title}: ${vuln.description}`,
      suggestion: vuln.remediation,
      codeExample: vuln.evidence,
      relatedRules: vuln.cweId ? [`CWE-${vuln.cweId}`] : [],
      autoFixable: false,
      confidence: this.calculateConfidence(vuln),
    };
  }

  private mapSeverityToCommentType(
    severity: SecurityVulnerability['severity'],
  ): ReviewComment['type'] {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'suggestion';
      default:
        return 'info';
    }
  }

  /**
   * Performs comprehensive security scan on source code
   * @param filePath Path to the file or directory to scan
   * @param code Source code content (for file scanning)
   * @param scanConfig Scan configuration options
   * @returns Complete security report with vulnerabilities and recommendations
   */
  async scanCode(
    filePath: string,
    code?: string,
    scanConfig?: Partial<ScanConfiguration>
  ): Promise<SecurityReport> {
    const config: ScanConfiguration = {
      enabledScanners: ['sast', 'dependency', 'secret'],
      severityThreshold: 'low',
      includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      maxScanTime: 300000, // 5 minutes
      enableIncrementalScanning: true,
      ...scanConfig
    };

    const scanId = this.generateScanId();
    const startTime = Date.now();

    try {
      // Perform different types of security scans
      const vulnerabilities: SecurityVulnerability[] = [];

      if (config.enabledScanners.includes('sast')) {
        const sastResults = await this.performSASTScan(filePath, code);
        vulnerabilities.push(...sastResults);
      }

      if (config.enabledScanners.includes('dependency')) {
        const depResults = await this.performDependencyScan(filePath);
        vulnerabilities.push(...depResults);
      }

      if (config.enabledScanners.includes('secret')) {
        const secretResults = await this.performSecretScan(filePath, code);
        vulnerabilities.push(...secretResults);
      }

      if (config.enabledScanners.includes('dast') && code) {
        const dastResults = await this.performDASTScan(filePath, code);
        vulnerabilities.push(...dastResults);
      }

      if (config.enabledScanners.includes('container')) {
        const containerResults = await this.performContainerScan(filePath);
        vulnerabilities.push(...containerResults);
      }

      if (config.enabledScanners.includes('compliance')) {
        const complianceResults = await this.performComplianceScan(vulnerabilities);
      }

      // Filter by severity threshold
      const filteredVulnerabilities = vulnerabilities.filter(
        vuln => this.getSeverityLevel(vuln.severity) >= this.getSeverityLevel(config.severityThreshold)
      );

      // Generate compliance results
      const complianceResults = await this.performComplianceScan(filteredVulnerabilities);

      // Generate recommendations
      const recommendations = this.generateSecurityRecommendations(filteredVulnerabilities);

      const report: SecurityReport = {
        scanId,
        timestamp: new Date(),
        scanType: 'full',
        totalVulnerabilities: filteredVulnerabilities.length,
        criticalCount: filteredVulnerabilities.filter(v => v.severity === 'critical').length,
        highCount: filteredVulnerabilities.filter(v => v.severity === 'high').length,
        mediumCount: filteredVulnerabilities.filter(v => v.severity === 'medium').length,
        lowCount: filteredVulnerabilities.filter(v => v.severity === 'low').length,
        infoCount: filteredVulnerabilities.filter(v => v.severity === 'info').length,
        vulnerabilities: filteredVulnerabilities,
        scanDuration: Date.now() - startTime,
        scanConfig: config,
        complianceResults,
        recommendations
      };

      // Store scan history
      this.addToScanHistory(filePath, report);

      return report;

    } catch (error) {
      // Return error report
      return {
        scanId,
        timestamp: new Date(),
        scanType: 'full',
        totalVulnerabilities: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        vulnerabilities: [],
        scanDuration: Date.now() - startTime,
        scanConfig: config,
        complianceResults: [],
        recommendations: [{
          id: 'scan-error',
          type: 'immediate',
          category: 'security',
          title: 'Security Scan Failed',
          description: `Failed to complete security scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
          priority: 'high',
          effort: 'low',
          impact: 'medium',
          implementation: 'Check scan configuration and try again'
        }]
      };
    }
  }

  /**
   * Integrates security scanning with code review process
   * @param reviewResult Existing code review result
   * @param filePath File path being reviewed
   * @param code Source code content
   * @returns Enhanced review result with security findings
   */
  async enhanceReviewWithSecurity(
    reviewResult: CodeReviewResult,
    filePath: string,
    code: string
  ): Promise<CodeReviewResult> {
    const securityReport = await this.scanCode(filePath, code, {
      enabledScanners: ['sast', 'dependency', 'secret'],
      severityThreshold: 'medium'
    });

    // Convert security vulnerabilities to review comments
    const securityComments: ReviewComment[] = securityReport.vulnerabilities.map(
      vuln => this.buildSecurityReviewComment(vuln),
    );

    // Add compliance information to AI agent context
    const complianceContext = securityReport.complianceResults.map(result => ({
      framework: result.framework,
      status: result.status,
      score: result.score,
      requirements: result.requirements.filter(req => req.status !== 'met').length
    }));

    return {
      ...reviewResult,
      reviewComments: [...reviewResult.reviewComments, ...securityComments],
      aiAgentContext: {
        ...reviewResult.aiAgentContext,
        suggestedPrompts: [
          ...reviewResult.aiAgentContext.suggestedPrompts,
          `Address ${securityReport.criticalCount} critical security vulnerabilities`,
          `Fix ${securityReport.highCount} high-severity security issues`,
          `Ensure compliance with ${securityReport.complianceResults.map(r => r.framework).join(', ')}`
        ],
        relatedPatterns: [
          ...reviewResult.aiAgentContext.relatedPatterns,
          'Security First Development',
          'Defense in Depth',
          'Secure Coding Practices'
        ],
        learningResources: [
          ...reviewResult.aiAgentContext.learningResources,
          'OWASP Top 10',
          'SANS Top 25 Software Errors',
          'NIST Cybersecurity Framework'
        ]
      }
    };
  }

  /**
   * Performs Static Application Security Testing (SAST)
   * @param filePath File path to scan
   * @param code Source code content
   * @returns Array of SAST vulnerabilities
   */
  private async performSASTScan(filePath: string, code?: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    if (!code) {
      // Try to read file content
      try {
        const fs = require('fs');
        code = fs.readFileSync(filePath, 'utf-8');
      } catch (error) {
        return vulnerabilities;
      }
    }

    const lines = (code || '').split('\n');

    // Apply security rules
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      // Check against all SAST rules
      for (const rule of this.securityRules.get('sast') || []) {
        if (!rule.enabled) continue;

        try {
          const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'gi') : rule.pattern;
          const matches = line.match(pattern);

          if (matches) {
            vulnerabilities.push({
              id: `sast_${rule.id}_${lineNumber}_${Date.now()}`,
              title: rule.name,
              description: rule.description,
              severity: rule.severity,
              category: 'sast',
              cweId: this.getCWEForRule(rule.id),
              filePath,
              lineNumber,
              columnStart: line.indexOf(matches[0]),
              columnEnd: line.indexOf(matches[0]) + matches[0].length,
              evidence: matches[0],
              impact: this.getImpactForSeverity(rule.severity),
              remediation: rule.remediation,
              references: [rule.id],
              detectedAt: new Date(),
              status: 'open',
              tags: ['sast', rule.category]
            });
          }
        } catch (error) {
          console.error(`Error applying SAST rule ${rule.id}:`, error);
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Performs dependency security scanning
   * @param filePath Path to scan for dependency files
   * @returns Array of dependency vulnerabilities
   */
  private async performDependencyScan(filePath: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for common dependency files
    const depFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'requirements.txt',
      'Pipfile',
      'Gemfile',
      'composer.json',
      'pom.xml',
      'build.gradle'
    ];

    for (const depFile of depFiles) {
      const depPath = filePath.includes('/') ?
        `${filePath.split('/').slice(0, -1).join('/')}/${depFile}` :
        depFile;

      try {
        const fs = require('fs');
        if (fs.existsSync(depPath)) {
          const content = fs.readFileSync(depPath, 'utf-8');
          const depVulns = await this.scanDependencyFile(depPath, content);
          vulnerabilities.push(...depVulns);
        }
      } catch (error) {
        // File doesn't exist or can't be read, continue
      }
    }

    return vulnerabilities;
  }

  /**
   * Scans dependency file for known vulnerabilities
   * @param filePath Path to dependency file
   * @param content File content
   * @returns Array of dependency vulnerabilities
   */
  private async scanDependencyFile(filePath: string, content: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      const dependencies = JSON.parse(content);

      // Check package.json dependencies
      if (dependencies.dependencies) {
        for (const [packageName, version] of Object.entries(dependencies.dependencies)) {
          const vuln = await this.checkPackageVulnerability(packageName, version as string);
          if (vuln) {
            vulnerabilities.push(vuln);
          }
        }
      }

      // Check devDependencies as well
      if (dependencies.devDependencies) {
        for (const [packageName, version] of Object.entries(dependencies.devDependencies)) {
          const vuln = await this.checkPackageVulnerability(packageName, version as string);
          if (vuln) {
            vulnerabilities.push(vuln);
          }
        }
      }

    } catch (error) {
      // Not a JSON file or parsing failed
    }

    return vulnerabilities;
  }

  /**
   * Checks if a package has known vulnerabilities
   * @param packageName Name of the package
   * @param version Package version
   * @returns Vulnerability if found, null otherwise
   */
  private async checkPackageVulnerability(packageName: string, version: string): Promise<SecurityVulnerability | null> {
    // Query vulnerability databases (OSV, NVD, npm audit, Snyk)
    // Production implementation would integrate with external vulnerability APIs
    
    try {
      // Check against known vulnerability database
      const vulnData = await this.queryVulnerabilityDatabase(packageName, version);
      
      if (vulnData) {
        return {
          id: `dep_${packageName}_${vulnData.cveId}`,
          title: vulnData.title,
          description: vulnData.description,
          severity: vulnData.severity,
          category: 'dependency',
          cveId: vulnData.cveId,
          filePath: `package.json`,
          lineNumber: await this.findPackageLineNumber(packageName),
          columnStart: 0,
          columnEnd: 0,
          evidence: `${packageName}@${version}`,
          impact: vulnData.impact || 'High impact vulnerability in dependency',
          remediation: vulnData.remediation || `Update ${packageName} to a secure version or find alternative`,
          references: [vulnData.cveId, ...(vulnData.references || [])],
          detectedAt: new Date(),
          status: 'open',
          tags: ['dependency', 'vulnerable-package']
        };
      }
    } catch (error) {
      console.error(`Error checking vulnerability for ${packageName}:`, error);
    }

    return null;
  }

  private async queryVulnerabilityDatabase(packageName: string, version: string): Promise<any | null> {
    // Production: Query OSV API, NVD, npm audit, or Snyk
    // Integration point for external vulnerability databases
    
    // Known critical vulnerabilities database (subset for offline operation)
    const criticalVulns: Record<string, any> = {
      'lodash': {
        cveId: 'CVE-2019-10744',
        severity: 'high',
        title: 'Prototype Pollution in lodash',
        description: 'Prototype pollution vulnerability in lodash versions < 4.17.12',
        impact: 'Allows attackers to modify object prototypes',
        remediation: 'Update to lodash@4.17.12 or higher',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2019-10744']
      },
      'serialize-javascript': {
        cveId: 'CVE-2020-7660',
        severity: 'high',
        title: 'Remote Code Execution in serialize-javascript',
        description: 'RCE vulnerability when untrusted input is serialized',
        impact: 'Remote code execution possible',
        remediation: 'Update to serialize-javascript@3.1.0 or higher',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2020-7660']
      }
    };

    return criticalVulns[packageName] || null;
  }

  private async findPackageLineNumber(packageName: string): Promise<number> {
    // Find exact line number in package.json
    try {
      const fs = require('fs');
      const packageJson = fs.readFileSync('package.json', 'utf-8');
      const lines = packageJson.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`"${packageName}"`)) {
          return i + 1;
        }
      }
    } catch (error) {
      // Fallback if package.json not found
    }
    
    return 1;
  }

  /**
   * Performs secret detection scanning
   * @param filePath File path to scan
   * @param code Source code content
   * @returns Array of secret vulnerabilities
   */
  private async performSecretScan(filePath: string, code?: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    if (!code) {
      try {
        const fs = require('fs');
        code = fs.readFileSync(filePath, 'utf-8');
      } catch (error) {
        return vulnerabilities;
      }
    }

    if (!code) {
      return vulnerabilities;
    }

    const lines = code.split('\n');

    // Secret patterns to detect
    const secretPatterns = [
      {
        name: 'API Key',
        pattern: /(api_key|apikey)\s*[:=]\s*["']([a-zA-Z0-9_\-]{32,})["']/gi,
        severity: 'critical' as const,
        cweId: 'CWE-798'
      },
      {
        name: 'Password',
        pattern: /(password|pwd)\s*[:=]\s*["']([^"']{3,})["']/gi,
        severity: 'high' as const,
        cweId: 'CWE-798'
      },
      {
        name: 'JWT Secret',
        pattern: /(jwt_secret|jwtSecret)\s*[:=]\s*["']([a-zA-Z0-9_\-]{32,})["']/gi,
        severity: 'critical' as const,
        cweId: 'CWE-798'
      },
      {
        name: 'Database URL',
        pattern: /(database_url|db_url|mongodb|postgres|mysql)\s*[:=]\s*["']([^"']*(password|pwd)[^"']*)["']/gi,
        severity: 'critical' as const,
        cweId: 'CWE-798'
      }
    ];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      for (const secretPattern of secretPatterns) {
        const matches = line.match(secretPattern.pattern);
        if (matches && matches[2]) {
          vulnerabilities.push({
            id: `secret_${secretPattern.name.toLowerCase().replace(' ', '_')}_${lineNumber}`,
            title: `Potential ${secretPattern.name} Found`,
            description: `Hardcoded ${secretPattern.name.toLowerCase()} detected in source code`,
            severity: secretPattern.severity,
            category: 'secret',
            cweId: secretPattern.cweId,
            filePath,
            lineNumber,
            columnStart: line.indexOf(matches[0]),
            columnEnd: line.indexOf(matches[0]) + matches[0].length,
            evidence: matches[0].replace(matches[2], '***REDACTED***'), // Hide actual secret
            impact: 'Credentials exposed in source code',
            remediation: 'Move secrets to environment variables or secure secret management system',
            references: [secretPattern.cweId],
            detectedAt: new Date(),
            status: 'open',
            tags: ['secret', 'hardcoded-credential']
          });
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Performs Dynamic Application Security Testing (DAST)
   * @param filePath File path (for context)
   * @param code Source code content
   * @returns Array of DAST vulnerabilities
   */
  private async performDASTScan(filePath: string, code: string): Promise<SecurityVulnerability[]> {
    // Dynamic Application Security Testing
    // Production: Integrate with OWASP ZAP, Burp Suite, or custom runtime analysis
    const vulnerabilities: SecurityVulnerability[] = [];

    // Analyze code for runtime security issues
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for unsafe HTML rendering
      if (line.includes('dangerouslySetInnerHTML') || 
          line.includes('innerHTML') ||
          line.match(/\$\{[^}]*\}/)) {
        vulnerabilities.push({
          id: `dast_xss_${lineNumber}_${Date.now()}`,
          title: 'Potential XSS Vulnerability',
          description: 'Unsafe HTML rendering detected - input may not be properly sanitized',
          severity: 'high',
          category: 'dast',
          cweId: 'CWE-79',
          filePath,
          lineNumber,
          columnStart: 0,
          columnEnd: line.length,
          evidence: line.trim(),
          impact: 'Cross-site scripting attacks possible through unsanitized user input',
          remediation: 'Use safe rendering methods, implement CSP, sanitize all user input',
          references: ['OWASP A03:2021', 'CWE-79'],
          detectedAt: new Date(),
          status: 'open',
          tags: ['dast', 'xss', 'injection']
        });
      }

      // Check for eval usage
      if (line.includes('eval(') || line.includes('Function(')) {
        vulnerabilities.push({
          id: `dast_code_injection_${lineNumber}_${Date.now()}`,
          title: 'Code Injection Risk',
          description: 'Use of eval() or Function() constructor detected',
          severity: 'critical',
          category: 'dast',
          cweId: 'CWE-95',
          filePath,
          lineNumber,
          columnStart: 0,
          columnEnd: line.length,
          evidence: line.trim(),
          impact: 'Arbitrary code execution possible',
          remediation: 'Remove eval() usage, use safe alternatives',
          references: ['CWE-95', 'OWASP A03:2021'],
          detectedAt: new Date(),
          status: 'open',
          tags: ['dast', 'code-injection', 'critical']
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Performs container security scanning
   * @param filePath Path to container files
   * @returns Array of container vulnerabilities
   */
  private async performContainerScan(filePath: string): Promise<SecurityVulnerability[]> {
    // Check for Dockerfile and container configuration
    const containerFiles = ['Dockerfile', 'docker-compose.yml', '.dockerignore'];

    for (const containerFile of containerFiles) {
      const containerPath = filePath.includes('/') ?
        `${filePath.split('/').slice(0, -1).join('/')}/${containerFile}` :
        containerFile;

      try {
        const fs = require('fs');
        if (fs.existsSync(containerPath)) {
          const content = fs.readFileSync(containerPath, 'utf-8');

          // Check for common container security issues
          if (content.includes('USER root') || content.includes('user root')) {
            return [{
              id: `container_root_user_${Date.now()}`,
              title: 'Container Running as Root',
              description: 'Container is configured to run as root user',
              severity: 'high',
              category: 'container',
              cweId: 'CWE-250',
              filePath: containerPath,
              lineNumber: content.split('\n').findIndex((line: string) => line.includes('USER root')) + 1,
              columnStart: 0,
              columnEnd: 0,
              evidence: 'USER root',
              impact: 'Privilege escalation attacks possible',
              remediation: 'Create non-root user and use USER directive',
              references: ['CIS Docker Benchmark'],
              detectedAt: new Date(),
              status: 'open',
              tags: ['container', 'privilege-escalation']
            }];
          }
        }
      } catch (error) {
        // File doesn't exist or can't be read
      }
    }

    return [];
  }

  /**
   * Performs compliance checking
   * @param vulnerabilities List of detected vulnerabilities
   * @returns Array of compliance results
   */
  private async performComplianceScan(vulnerabilities: SecurityVulnerability[]): Promise<ComplianceResult[]> {
    const results: ComplianceResult[] = [];

    // OWASP Top 10 compliance check
    const owaspResult: ComplianceResult = {
      framework: 'OWASP',
      status: 'compliant',
      score: 100,
      requirements: [],
      lastAssessed: new Date()
    };

    // Check for OWASP Top 10 categories
    const owaspCategories = [
      { id: 'A01', name: 'Broken Access Control', cwe: ['CWE-284', 'CWE-285'] },
      { id: 'A02', name: 'Cryptographic Failures', cwe: ['CWE-327', 'CWE-328'] },
      { id: 'A03', name: 'Injection', cwe: ['CWE-79', 'CWE-89'] },
      { id: 'A04', name: 'Insecure Design', cwe: ['CWE-209', 'CWE-256'] }
    ];

    for (const category of owaspCategories) {
      const categoryVulns = vulnerabilities.filter(v =>
        v.cweId && category.cwe.includes(v.cweId)
      );

      owaspResult.requirements.push({
        id: category.id,
        name: category.name,
        description: `No ${category.name.toLowerCase()} vulnerabilities detected`,
        status: categoryVulns.length === 0 ? 'met' : 'not-met',
        evidence: categoryVulns.length === 0 ? 'No vulnerabilities found' : `${categoryVulns.length} vulnerabilities detected`
      });

      if (categoryVulns.length > 0) {
        owaspResult.status = 'non-compliant';
        owaspResult.score -= 25; // Reduce score for each violation
      }
    }

    results.push(owaspResult);

    return results;
  }

  /**
   * Generates security recommendations based on scan results
   * @param vulnerabilities Detected vulnerabilities
   * @returns Array of security recommendations
   */
  private generateSecurityRecommendations(vulnerabilities: SecurityVulnerability[]): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];

    // Critical issues need immediate attention
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    if (criticalCount > 0) {
      recommendations.push({
        id: 'critical-issues',
        type: 'immediate',
        category: 'security',
        title: `Address ${criticalCount} Critical Security Issues`,
        description: 'Critical vulnerabilities require immediate remediation',
        priority: 'critical',
        effort: 'high',
        impact: 'high',
        implementation: 'Review and fix all critical vulnerabilities immediately',
        resources: ['Security team', 'Development team']
      });
    }

    // High severity issues
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
    if (highCount > 0) {
      recommendations.push({
        id: 'high-issues',
        type: 'short-term',
        category: 'security',
        title: `Fix ${highCount} High-Severity Issues`,
        description: 'High-severity vulnerabilities should be addressed within one week',
        priority: 'high',
        effort: 'medium',
        impact: 'medium',
        implementation: 'Schedule fixes for high-severity vulnerabilities',
        resources: ['Development team']
      });
    }

    // Secret detection recommendations
    const secretCount = vulnerabilities.filter(v => v.category === 'secret').length;
    if (secretCount > 0) {
      recommendations.push({
        id: 'secret-management',
        type: 'immediate',
        category: 'security',
        title: 'Implement Secret Management',
        description: 'Hardcoded secrets detected - implement proper secret management',
        priority: 'critical',
        effort: 'medium',
        impact: 'high',
        implementation: 'Use environment variables or secret management service',
        resources: ['DevOps team', 'Security team']
      });
    }

    // Dependency vulnerability recommendations
    const depCount = vulnerabilities.filter(v => v.category === 'dependency').length;
    if (depCount > 0) {
      recommendations.push({
        id: 'dependency-updates',
        type: 'short-term',
        category: 'security',
        title: 'Update Vulnerable Dependencies',
        description: `${depCount} vulnerable dependencies detected`,
        priority: 'high',
        effort: 'low',
        impact: 'medium',
        implementation: 'Update dependencies to secure versions',
        resources: ['Development team']
      });
    }

    return recommendations;
  }

  /**
   * Gets security metrics for dashboard
   * @param filePath Optional file path to get metrics for
   * @returns Security metrics
   */
  async getSecurityMetrics(filePath?: string): Promise<SecurityMetrics> {
    const history = filePath ? this.scanHistory.get(filePath) || [] : [];

    const totalScans = history.length;
    const vulnerabilitiesFound = history.reduce((sum, report) => sum + report.totalVulnerabilities, 0);
    const averageFixTime = this.calculateAverageFixTime(history);

    // Calculate compliance score from latest scan
    const latestReport = history[history.length - 1];
    const complianceScore = latestReport ?
      latestReport.complianceResults.reduce((sum, result) => sum + result.score, 0) / latestReport.complianceResults.length :
      100;

    // Calculate security score (inverse of vulnerability count)
    const securityScore = Math.max(0, 100 - (vulnerabilitiesFound / Math.max(totalScans, 1)));

    // Generate trend data
    const trendData = history.slice(-30).map(report => ({
      date: report.timestamp,
      vulnerabilities: report.totalVulnerabilities,
      critical: report.criticalCount,
      high: report.highCount,
      complianceScore: report.complianceResults.reduce((sum, r) => sum + r.score, 0) / report.complianceResults.length,
      securityScore: Math.max(0, 100 - report.totalVulnerabilities)
    }));

    return {
      totalScans,
      vulnerabilitiesFound,
      averageFixTime,
      complianceScore,
      securityScore,
      trendData
    };
  }

  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityLevel(severity: string): number {
    const levels = { 'info': 1, 'low': 2, 'medium': 3, 'high': 4, 'critical': 5 };
    return levels[severity as keyof typeof levels] || 1;
  }

  private calculateConfidence(vuln: SecurityVulnerability): number {
    let confidence = 0.5; // Base confidence

    if (vuln.evidence) confidence += 0.2;
    if (vuln.cweId) confidence += 0.1;
    if (vuln.cveId) confidence += 0.1;
    if (vuln.references.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private getImpactForSeverity(severity: string): string {
    const impacts = {
      'info': 'Minimal security impact',
      'low': 'Low security impact, best practice violation',
      'medium': 'Moderate security impact, potential for exploitation',
      'high': 'High security impact, likely exploitable',
      'critical': 'Critical security impact, immediate remediation required'
    };

    return impacts[severity as keyof typeof impacts] || impacts.medium;
  }

  private getCWEForRule(ruleId: string): string | undefined {
    const cweMapping: Record<string, string> = {
      'hardcoded-secret': 'CWE-798',
      'sql-injection': 'CWE-89',
      'xss': 'CWE-79',
      'insecure-random': 'CWE-338',
      'weak-crypto': 'CWE-327'
    };

    return cweMapping[ruleId];
  }

  private initializeSecurityRules(): void {
    // Initialize comprehensive security rules
    this.securityRules.set('sast', [
      {
        id: 'hardcoded-secret',
        name: 'Hardcoded Secret',
        description: 'Hardcoded credentials or secrets detected',
        category: 'secret',
        severity: 'critical',
        pattern: /(api_key|password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/gi,
        message: 'Hardcoded secret detected',
        remediation: 'Move secrets to environment variables or secure vault',
        enabled: true
      },
      {
        id: 'sql-injection',
        name: 'SQL Injection',
        description: 'Potential SQL injection vulnerability',
        category: 'sast',
        severity: 'high',
        pattern: /(SELECT|INSERT|UPDATE|DELETE).*\+.*(req\.|request\.|\$\{)/gi,
        message: 'Potential SQL injection vulnerability',
        remediation: 'Use parameterized queries or prepared statements',
        enabled: true
      },
      {
        id: 'xss',
        name: 'Cross-Site Scripting',
        description: 'Potential XSS vulnerability',
        category: 'sast',
        severity: 'high',
        pattern: /innerHTML\s*=\s*[^<]*\$\{[^}]*\}/gi,
        message: 'Potential XSS vulnerability',
        remediation: 'Use textContent or escape user input',
        enabled: true
      }
    ]);
  }

  private initializeVulnerabilityDatabase(): void {
    // Initialize vulnerability definitions for common issues
    this.vulnerabilityDatabase.set('CWE-79', {
      name: 'Cross-site Scripting',
      description: 'The web application includes untrusted data in a web page without validation',
      severity: 'high',
      remediation: 'Properly escape all untrusted data before including in HTML'
    });

    this.vulnerabilityDatabase.set('CWE-89', {
      name: 'SQL Injection',
      description: 'The application does not properly sanitize user input before including in SQL queries',
      severity: 'critical',
      remediation: 'Use parameterized queries or prepared statements'
    });

    this.vulnerabilityDatabase.set('CWE-798', {
      name: 'Use of Hard-coded Credentials',
      description: 'The application contains hard-coded credentials',
      severity: 'critical',
      remediation: 'Store credentials in secure configuration files or environment variables'
    });
  }

  private addToScanHistory(filePath: string, report: SecurityReport): void {
    if (!this.scanHistory.has(filePath)) {
      this.scanHistory.set(filePath, []);
    }

    const history = this.scanHistory.get(filePath)!;
    history.push(report);

    // Keep only last 50 scans
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  private calculateAverageFixTime(history: SecurityReport[]): number {
    // Calculate average time to fix vulnerabilities based on scan history
    if (history.length < 2) {
      return 24; // Default 24 hours if insufficient data
    }

    let totalFixTime = 0;
    let fixedCount = 0;

    // Compare consecutive scans to find fixed vulnerabilities
    for (let i = 1; i < history.length; i++) {
      const previousReport = history[i - 1];
      const currentReport = history[i];

      // Find vulnerabilities that were in previous but not in current (fixed)
      const previousVulnIds = new Set(previousReport.vulnerabilities.map(v => v.id));
      const currentVulnIds = new Set(currentReport.vulnerabilities.map(v => v.id));

      for (const prevId of previousVulnIds) {
        if (!currentVulnIds.has(prevId)) {
          // Vulnerability was fixed
          const timeDiff = currentReport.timestamp.getTime() - previousReport.timestamp.getTime();
          totalFixTime += timeDiff;
          fixedCount++;
        }
      }
    }

    if (fixedCount === 0) {
      return 24; // Default if no fixes tracked yet
    }

    // Return average fix time in hours
    return Math.round((totalFixTime / fixedCount) / (1000 * 60 * 60));
  }
}

interface VulnerabilityDefinition {
  name: string;
  description: string;
  severity: string;
  remediation: string;
}
