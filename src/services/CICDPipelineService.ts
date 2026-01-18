interface PipelineConfig {
  platform: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'circleci' | 'travis';
  projectType: 'nodejs' | 'python' | 'java' | 'dotnet' | 'go' | 'rust';
  buildSteps?: string[];
  testCommands?: string[];
  deploymentTargets?: string[];
  environmentVariables?: Record<string, string>;
  secrets?: string[];
  branches?: string[];
  triggers?: Array<'push' | 'pull_request' | 'schedule' | 'manual'>;
  notifications?: {
    email?: string[];
    slack?: string;
    teams?: string;
  };
  cache?: {
    enabled: boolean;
    paths?: string[];
  };
  artifacts?: {
    paths?: string[];
    expiry?: string;
  };
}

interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  platform: PipelineConfig['platform'];
  projectType: PipelineConfig['projectType'];
  config: Omit<PipelineConfig, 'platform' | 'projectType'>;
  tags: string[];
}

export class CICDPipelineService {
  private templates: PipelineTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate CI/CD pipeline configuration
   */
  generatePipeline(config: PipelineConfig): string {
    switch (config.platform) {
      case 'github':
        return this.generateGitHubActions(config);
      case 'gitlab':
        return this.generateGitLabCI(config);
      case 'azure':
        return this.generateAzureDevOps(config);
      case 'jenkins':
        return this.generateJenkinsPipeline(config);
      case 'circleci':
        return this.generateCircleCI(config);
      case 'travis':
        return this.generateTravisCI(config);
      default:
        throw new Error(`Unsupported platform: ${config.platform}`);
    }
  }

  /**
   * Generate pipeline for a specific template
   */
  generateFromTemplate(templateId: string, overrides: Partial<PipelineConfig> = {}): string {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const config: PipelineConfig = {
      platform: template.platform,
      projectType: template.projectType,
      ...template.config,
      ...overrides,
    };

    return this.generatePipeline(config);
  }

  /**
   * Get available templates
   */
  getTemplates(): PipelineTemplate[] {
    return [...this.templates];
  }

  /**
   * Get templates for a specific platform
   */
  getTemplatesForPlatform(platform: PipelineConfig['platform']): PipelineTemplate[] {
    return this.templates.filter(t => t.platform === platform);
  }

  /**
   * Get templates for a specific project type
   */
  getTemplatesForProjectType(projectType: PipelineConfig['projectType']): PipelineTemplate[] {
    return this.templates.filter(t => t.projectType === projectType);
  }

  /**
   * Validate pipeline configuration
   */
  validateConfig(config: PipelineConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.platform) {
      errors.push('Platform is required');
    }

    if (!config.projectType) {
      errors.push('Project type is required');
    }

    if (!config.testCommands || config.testCommands.length === 0) {
      errors.push('Test commands are required');
    }

    if (config.buildSteps && config.buildSteps.length === 0) {
      errors.push('Build steps cannot be empty if provided');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * GitHub Actions pipeline generation
   */
  private generateGitHubActions(config: PipelineConfig): string {
    const steps: string[] = [];

    // Setup steps
    if (config.projectType === 'nodejs') {
      steps.push(`      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'`);
    } else if (config.projectType === 'python') {
      steps.push(`      - uses: actions/setup-python@v4
        with:
          python-version: '3.9'`);
    }

    // Install dependencies
    steps.push(`      - name: Install dependencies
        run: ${this.getInstallCommand(config.projectType)}`);

    // Build step
    if (config.buildSteps && config.buildSteps.length > 0) {
      config.buildSteps.forEach(step => {
        steps.push(`      - name: Build
        run: ${step}`);
      });
    }

    // Test step
    if (config.testCommands && config.testCommands.length > 0) {
      config.testCommands.forEach(command => {
        steps.push(`      - name: Run tests
        run: ${command}`);
      });
    }

    // Environment variables
    const envVars = this.formatEnvironmentVariables(config.environmentVariables);

    let workflow = `name: CI/CD Pipeline

on:
  ${this.formatTriggers(config.triggers || ['push', 'pull_request'])}

jobs:
  test:
    runs-on: ubuntu-latest
    ${envVars}

    steps:
${steps.join('\n')}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy to production
        run: |
          echo "Deploying to production..."
          # Add your deployment commands here
`;

    if (config.notifications) {
      workflow += this.generateGitHubNotifications(config.notifications);
    }

    return workflow;
  }

  /**
   * GitLab CI pipeline generation
   */
  private generateGitLabCI(config: PipelineConfig): string {
    let pipeline = `stages:
  - test
  - deploy

variables:
${Object.entries(config.environmentVariables || {})
  .map(([key, value]) => `  ${key}: "${value}"`)
  .join('\n')}

test:
  stage: test
  image: ${this.getDockerImage(config.projectType)}
  script:
    - ${this.getInstallCommand(config.projectType)}
`;

    if (config.buildSteps) {
      config.buildSteps.forEach(step => {
        pipeline += `    - ${step}\n`;
      });
    }

    if (config.testCommands) {
      config.testCommands.forEach(command => {
        pipeline += `    - ${command}\n`;
      });
    }

    if (config.cache?.enabled) {
      pipeline += `
  cache:
    paths:
${(config.cache.paths || []).map(path => `      - ${path}`).join('\n')}
`;
    }

    pipeline += `
deploy:
  stage: deploy
  image: ${this.getDockerImage(config.projectType)}
  script:
    - echo "Deploying to production..."
    # Add your deployment commands here
  only:
    - main
`;

    return pipeline;
  }

  /**
   * Azure DevOps pipeline generation
   */
  private generateAzureDevOps(config: PipelineConfig): string {
    const steps: string[] = [];

    steps.push(`    - script: ${this.getInstallCommand(config.projectType)}
      displayName: 'Install dependencies'`);

    if (config.buildSteps) {
      config.buildSteps.forEach(step => {
        steps.push(`    - script: ${step}
      displayName: 'Build'`);
      });
    }

    if (config.testCommands) {
      config.testCommands.forEach(command => {
        steps.push(`    - script: ${command}
      displayName: 'Run tests'`);
      });
    }

    let pipeline = `trigger:
${(config.branches || ['main']).map(branch => `  - ${branch}`).join('\n')}

pool:
  vmImage: 'ubuntu-latest'

steps:
${steps.join('\n')}

- deployment: DeployWeb
  displayName: Deploy to production
  environment: 'production'
  strategy:
    runOnce:
      deploy:
        steps:
        - script: |
            echo "Deploying to production..."
            # Add your deployment commands here
`;

    return pipeline;
  }

  /**
   * Jenkins pipeline generation
   */
  private generateJenkinsPipeline(config: PipelineConfig): string {
    let pipeline = `pipeline {
    agent any

    environment {
${Object.entries(config.environmentVariables || {})
  .map(([key, value]) => `        ${key} = "${value}"`)
  .join('\n')}
    }

    stages {
        stage('Install') {
            steps {
                sh '${this.getInstallCommand(config.projectType)}'
            }
        }
`;

    if (config.buildSteps) {
      pipeline += `
        stage('Build') {
            steps {
${config.buildSteps.map(step => `                sh '${step}'`).join('\n')}
            }
        }
`;
    }

    if (config.testCommands) {
      pipeline += `
        stage('Test') {
            steps {
${config.testCommands.map(command => `                sh '${command}'`).join('\n')}
            }
        }
`;
    }

    pipeline += `
        stage('Deploy') {
            steps {
                sh '''
                    echo "Deploying to production..."
                    # Add your deployment commands here
                '''
            }
        }
    }
}`;

    return pipeline;
  }

  /**
   * CircleCI pipeline generation
   */
  private generateCircleCI(config: PipelineConfig): string {
    const envVars = Object.entries(config.environmentVariables || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n      ');

    let pipeline = `version: 2.1

orbs:
  node: circleci/node@5.0

workflows:
  test-and-deploy:
    jobs:
      - test
      - deploy:
          requires:
            - test

jobs:
  test:
    docker:
      - image: ${this.getDockerImage(config.projectType)}

    working_directory: ~/repo

    steps:
      - checkout
      - run:
          name: Install dependencies
          command: ${this.getInstallCommand(config.projectType)}
`;

    if (config.buildSteps) {
      config.buildSteps.forEach(step => {
        pipeline += `      - run:
          name: Build
          command: ${step}\n`;
      });
    }

    if (config.testCommands) {
      config.testCommands.forEach(command => {
        pipeline += `      - run:
          name: Run tests
          command: ${command}\n`;
      });
    }

    pipeline += `
  deploy:
    docker:
      - image: ${this.getDockerImage(config.projectType)}

    steps:
      - checkout
      - run:
          name: Deploy to production
          command: |
            echo "Deploying to production..."
            # Add your deployment commands here
`;

    return pipeline;
  }

  /**
   * Travis CI pipeline generation
   */
  private generateTravisCI(config: PipelineConfig): string {
    const envVars = Object.entries(config.environmentVariables || {})
      .map(([key, value]) => `  - ${key}="${value}"`)
      .join('\n');

    let pipeline = `language: ${this.getTravisLanguage(config.projectType)}

${envVars ? `env:\n${envVars}\n` : ''}script:
  - ${this.getInstallCommand(config.projectType)}
`;

    if (config.buildSteps) {
      config.buildSteps.forEach(step => {
        pipeline += `  - ${step}\n`;
      });
    }

    if (config.testCommands) {
      config.testCommands.forEach(command => {
        pipeline += `  - ${command}\n`;
      });
    }

    pipeline += `
deploy:
  provider: script
  script: |
    echo "Deploying to production..."
    # Add your deployment commands here
  on:
    branch: main
`;

    return pipeline;
  }

  /**
   * Helper methods
   */
  private formatTriggers(triggers: PipelineConfig['triggers']): string {
    if (!triggers || triggers.length === 0) return '  push:\n  pull_request:';

    return triggers.map(trigger => `  ${trigger}:`).join('\n');
  }

  private formatEnvironmentVariables(vars?: Record<string, string>): string {
    if (!vars || Object.keys(vars).length === 0) return '';

    return `env:\n${Object.entries(vars)
      .map(([key, value]) => `      ${key}: ${value}`)
      .join('\n')}`;
  }

  private generateGitHubNotifications(notifications: PipelineConfig['notifications']): string {
    if (!notifications) return '';

    let notificationConfig = '';

    if (notifications.email) {
      notificationConfig += `  notify-email:
    runs-on: ubuntu-latest
    if: failure()
    steps:
      - name: Send email notification
        run: |
          echo "Sending email to ${notifications.email?.join(', ')}"
`;
    }

    return notificationConfig;
  }

  private getDockerImage(projectType: PipelineConfig['projectType']): string {
    const images: Record<string, string> = {
      nodejs: 'node:18',
      python: 'python:3.9',
      java: 'openjdk:11',
      dotnet: 'mcr.microsoft.com/dotnet/sdk:6.0',
      go: 'golang:1.19',
      rust: 'rust:1.70',
    };

    return images[projectType] || 'node:18';
  }

  private getTravisLanguage(projectType: PipelineConfig['projectType']): string {
    const languages: Record<string, string> = {
      nodejs: 'node_js',
      python: 'python',
      java: 'java',
      dotnet: 'csharp',
      go: 'go',
      rust: 'rust',
    };

    return languages[projectType] || 'node_js';
  }

  private getInstallCommand(projectType: PipelineConfig['projectType']): string {
    const commands: Record<string, string> = {
      nodejs: 'npm ci',
      python: 'pip install -r requirements.txt',
      java: './gradlew build',
      dotnet: 'dotnet restore',
      go: 'go mod download',
      rust: 'cargo build',
    };

    return commands[projectType] || 'npm ci';
  }

  private initializeTemplates(): void {
    this.templates = [
      {
        id: 'nodejs-github-basic',
        name: 'Node.js GitHub Actions Basic',
        description: 'Basic CI/CD pipeline for Node.js projects using GitHub Actions',
        platform: 'github',
        projectType: 'nodejs',
        config: {
          testCommands: ['npm test'],
          branches: ['main', 'develop'],
          triggers: ['push', 'pull_request'],
          environmentVariables: {
            NODE_ENV: 'test',
          },
          cache: {
            enabled: true,
            paths: ['node_modules', '~/.npm'],
          },
        },
        tags: ['nodejs', 'github', 'basic'],
      },
      {
        id: 'python-gitlab-full',
        name: 'Python GitLab CI Full',
        description: 'Complete CI/CD pipeline for Python projects using GitLab CI',
        platform: 'gitlab',
        projectType: 'python',
        config: {
          buildSteps: ['python setup.py build'],
          testCommands: ['python -m pytest --cov=src'],
          deploymentTargets: ['production', 'staging'],
          triggers: ['push', 'pull_request'],
          environmentVariables: {
            PYTHONPATH: '${CI_PROJECT_DIR}/src',
          },
          cache: {
            enabled: true,
            paths: ['.venv', '.pytest_cache'],
          },
          artifacts: {
            paths: ['coverage.xml', 'dist/'],
            expiry: '30 days',
          },
        },
        tags: ['python', 'gitlab', 'full'],
      },
      {
        id: 'java-azure-enterprise',
        name: 'Java Azure DevOps Enterprise',
        description: 'Enterprise-grade CI/CD pipeline for Java projects using Azure DevOps',
        platform: 'azure',
        projectType: 'java',
        config: {
          buildSteps: ['./gradlew build', './gradlew test'],
          testCommands: ['./gradlew test --info'],
          deploymentTargets: ['production', 'staging'],
          branches: ['main', 'release/*'],
          triggers: ['push', 'pull_request'],
          environmentVariables: {
            JAVA_HOME: '/usr/lib/jvm/java-11-openjdk-amd64',
          },
          secrets: ['AZURE_CREDENTIALS', 'DOCKER_PASSWORD'],
        },
        tags: ['java', 'azure', 'enterprise'],
      },
    ];
  }
}

// Singleton instance
let pipelineService: CICDPipelineService | null = null;

export function initializeCICDPipelineService(): CICDPipelineService {
  if (!pipelineService) {
    pipelineService = new CICDPipelineService();
  }
  return pipelineService;
}

export function getCICDPipelineService(): CICDPipelineService | null {
  return pipelineService;
}

// Convenience functions
export function generatePipelineConfig(config: PipelineConfig): string {
  const service = getCICDPipelineService();
  return service?.generatePipeline(config) || '';
}

export function getPipelineTemplates(): PipelineTemplate[] {
  const service = getCICDPipelineService();
  return service?.getTemplates() || [];
}
