import React, { useState, useCallback } from 'react';
import * as fs from 'fs';
import * as path from 'path';

interface CICDConfig {
  platform: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'circleci';
  projectType: 'node' | 'python' | 'java' | 'dotnet' | 'go' | 'rust' | 'php';
  buildSteps: string[];
  testFrameworks: string[];
  deploymentTargets: string[];
  environmentVariables: { [key: string]: string };
  triggers: string[];
  notifications: string[];
}

interface CICDTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;
  projectType: string;
  template: string;
  features: string[];
}

interface AICICDGeneratorProps {
  projectPath: string | null;
  onGenerateConfig: (config: CICDConfig, template: string) => void;
  isVisible: boolean;
}

const CICD_PLATFORMS = {
  github: {
    name: 'GitHub Actions',
    icon: '🐙',
    fileExtension: '.yml',
    directory: '.github/workflows',
  },
  gitlab: {
    name: 'GitLab CI/CD',
    icon: '🦊',
    fileExtension: '.yml',
    directory: '.',
  },
  azure: {
    name: 'Azure DevOps',
    icon: '☁️',
    fileExtension: '.yml',
    directory: '.',
  },
  jenkins: {
    name: 'Jenkins',
    icon: '🔧',
    fileExtension: 'Jenkinsfile',
    directory: '.',
  },
  circleci: {
    name: 'CircleCI',
    icon: '⭕',
    fileExtension: '.yml',
    directory: '.circleci',
  },
};

const PROJECT_TYPES = {
  node: {
    name: 'Node.js',
    icon: '🟢',
    defaultCommands: ['npm install', 'npm test', 'npm run build'],
    testFrameworks: ['Jest', 'Mocha', 'Vitest', 'Cypress'],
    deployTargets: ['Vercel', 'Netlify', 'AWS', 'Heroku'],
  },
  python: {
    name: 'Python',
    icon: '🐍',
    defaultCommands: ['pip install -r requirements.txt', 'pytest', 'python setup.py build'],
    testFrameworks: ['pytest', 'unittest', 'nose2'],
    deployTargets: ['AWS', 'Google Cloud', 'Heroku', 'PythonAnywhere'],
  },
  java: {
    name: 'Java',
    icon: '☕',
    defaultCommands: ['mvn install', 'mvn test', 'mvn package'],
    testFrameworks: ['JUnit', 'TestNG', 'Mockito'],
    deployTargets: ['AWS', 'Google Cloud', 'Heroku', 'Tomcat'],
  },
  dotnet: {
    name: '.NET',
    icon: '🔷',
    defaultCommands: ['dotnet restore', 'dotnet test', 'dotnet build'],
    testFrameworks: ['xUnit', 'NUnit', 'MSTest'],
    deployTargets: ['Azure', 'AWS', 'IIS'],
  },
  go: {
    name: 'Go',
    icon: '🐹',
    defaultCommands: ['go mod download', 'go test ./...', 'go build'],
    testFrameworks: ['testing', 'Testify', 'Ginkgo'],
    deployTargets: ['AWS', 'Google Cloud', 'Docker'],
  },
  rust: {
    name: 'Rust',
    icon: '🦀',
    defaultCommands: ['cargo build', 'cargo test', 'cargo build --release'],
    testFrameworks: ['built-in', 'proptest', 'quickcheck'],
    deployTargets: ['AWS', 'Docker', 'Heroku'],
  },
  php: {
    name: 'PHP',
    icon: '🐘',
    defaultCommands: ['composer install', 'php artisan test', 'php artisan build'],
    testFrameworks: ['PHPUnit', 'PHPSpec', 'Behat'],
    deployTargets: ['AWS', 'Google Cloud', 'Heroku', 'Shared Hosting'],
  },
};

const CICD_TEMPLATES: CICDTemplate[] = [
  {
    id: 'node-basic',
    name: 'Node.js Basic Pipeline',
    description: 'Basic CI/CD for Node.js with testing and deployment',
    platform: 'github',
    projectType: 'node',
    features: ['Install Dependencies', 'Run Tests', 'Build', 'Deploy'],
    template: `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run linting
      run: npm run lint
    
    - name: Build application
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build for production
      run: npm run build
    
    - name: Deploy to production
      run: npm run deploy
      env:
        DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}`,
  },
  {
    id: 'python-advanced',
    name: 'Python Advanced Pipeline',
    description: 'Advanced Python CI/CD with multiple environments and security scanning',
    platform: 'github',
    projectType: 'python',
    features: ['Multi-Python Versions', 'Security Scan', 'Code Coverage', 'Docker Build'],
    template: `name: Python CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        python-version: ['3.8', '3.9', '3.10', '3.11']
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python \${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: \${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Lint with flake8
      run: |
        flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
        flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
    
    - name: Test with pytest
      run: |
        pytest --cov=./ --cov-report=xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security scan
      uses: pypa/gh-action-pip-audit@v1.0.8
    
    - name: Run Bandit security linter
      run: |
        pip install bandit
        bandit -r . -f json -o bandit-report.json

  docker:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: docker build -t myapp:latest .
    
    - name: Push to registry
      run: |
        echo \${{ secrets.DOCKER_PASSWORD }} | docker login -u \${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push myapp:latest`,
  },
];

export const AICICDGenerator: React.FC<AICICDGeneratorProps> = ({
  projectPath,
  onGenerateConfig,
  isVisible,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof CICD_PLATFORMS>('github');
  const [selectedProjectType, setSelectedProjectType] =
    useState<keyof typeof PROJECT_TYPES>('node');
  const [buildSteps, setBuildSteps] = useState<string[]>([]);
  const [testFrameworks, setTestFrameworks] = useState<string[]>([]);
  const [deploymentTargets, setDeploymentTargets] = useState<string[]>([]);
  const [environmentVariables, setEnvironmentVariables] = useState<{ [key: string]: string }>({});
  const [selectedTemplate, setSelectedTemplate] = useState<CICDTemplate | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const detectProjectType = useCallback(async (): Promise<keyof typeof PROJECT_TYPES> => {
    if (!projectPath) return 'node';

    try {
      // Analyze project files to detect type
      const packageJsonPath = path.join(projectPath, 'package.json');
      const setupPyPath = path.join(projectPath, 'setup.py');
      const requirementsPath = path.join(projectPath, 'requirements.txt');
      const pomXmlPath = path.join(projectPath, 'pom.xml');
      const csprojPath = path.join(projectPath, 'Directory.Build.props');
      const goModPath = path.join(projectPath, 'go.mod');
      const cargoTomlPath = path.join(projectPath, 'Cargo.toml');

      // Check for Node.js project
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.dependencies || packageJson.devDependencies) {
          return 'node';
        }
      }

      // Check for Python project
      if (fs.existsSync(setupPyPath) || fs.existsSync(requirementsPath)) {
        return 'python';
      }

      // Check for Java project
      if (fs.existsSync(pomXmlPath)) {
        return 'java';
      }

      // Check for .NET project
      if (fs.existsSync(csprojPath)) {
        return 'dotnet';
      }

      // Check for Go project
      if (fs.existsSync(goModPath)) {
        return 'go';
      }

      // Check for Rust project
      if (fs.existsSync(cargoTomlPath)) {
        return 'rust';
      }

      // Default fallback
      return 'node';
    } catch (error) {
      console.warn('Failed to detect project type:', error);
      return 'node';
    }
  }, [projectPath]);

  const generateCICDConfig = useCallback(async () => {
    setIsGenerating(true);

    try {
      // Auto-detect project type if not set
      let projectType = selectedProjectType;
      if (selectedProjectType === 'node') {
        // Default, so try to detect
        projectType = await detectProjectType();
        setSelectedProjectType(projectType);
      }

      const config: CICDConfig = {
        platform: selectedPlatform,
        projectType,
        buildSteps: buildSteps.length > 0 ? buildSteps : PROJECT_TYPES[projectType].defaultCommands,
        testFrameworks,
        deploymentTargets,
        environmentVariables,
        triggers: ['push', 'pull_request'],
        notifications: ['email', 'slack'],
      };

      // Generate template based on configuration
      let template = '';

      if (selectedTemplate) {
        template = selectedTemplate.template;
      } else {
        // Generate custom template based on configuration
        template = generateCustomTemplate(config);
      }

      setGeneratedConfig(template);
      onGenerateConfig(config, template);
    } catch (error) {
      console.error('Error generating CI/CD config:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedPlatform,
    selectedProjectType,
    buildSteps,
    testFrameworks,
    deploymentTargets,
    environmentVariables,
    selectedTemplate,
    detectProjectType,
    onGenerateConfig,
  ]);
  const generateCustomTemplate = (config: CICDConfig): string => {
    const _platformConfig = CICD_PLATFORMS[config.platform];
    const projectType = PROJECT_TYPES[config.projectType];

    if (config.platform === 'github') {
      let template = `name: ${projectType.name} CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup ${projectType.name}
      uses: actions/setup-node@v3
      with:
        node-version: '18.x'
        cache: 'npm'
    `;

      // Add build steps
      config.buildSteps.forEach((step) => {
        template += `    - name: ${step}
      run: ${step}
    
`;
      });

      template += `    - name: Run tests
      run: ${config.testFrameworks.length > 0 ? config.testFrameworks[0] : 'npm test'}

  deploy:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to ${config.deploymentTargets[0] || 'production'}
      run: echo "Deploying to production"`;

      // Add environment variables
      if (Object.keys(config.environmentVariables).length > 0) {
        template += `
      env:`;
        Object.entries(config.environmentVariables).forEach(([key, _val]) => {
          template += `
        ${key}: \${{ secrets.${key} }}`;
        });
      }

      return template;
    }

    // Default fallback template
    return `name: CI/CD Pipeline

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build
      run: echo "Building ${projectType.name} project"`;
  };

  const addEnvironmentVariable = () => {
    const key = prompt('Environment variable name:');
    const val = prompt('Environment variable value (will be stored as secret):');

    if (key && val) {
      setEnvironmentVariables((prev) => ({ ...prev, [key]: val }));
    }
  };

  const removeEnvironmentVariable = (_key: string) => {
    setEnvironmentVariables((prev) => {
      const newVars = { ...prev };
      delete newVars[_key];
      return newVars;
    });
  };

  if (!isVisible) return null;

  return (
    <div className="h-full bg-panel flex">
      {/* Configuration Panel */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-2">AI CI/CD Generator</h2>
          <p className="text-sm text-text-secondary">
            Generate optimized CI/CD pipelines for your project
          </p>
        </div>

        {/* Configuration Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              CI/CD Platform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CICD_PLATFORMS).map(([key, platform]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPlatform(key as keyof typeof CICD_PLATFORMS)}
                  className={`flex items-center space-x-2 p-2 rounded border transition-colors ${
                    selectedPlatform === key
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-border bg-panel-light text-text-primary hover:border-gray-400'
                  }`}
                  title={platform.name}
                >
                  <span>{platform.icon}</span>
                  <span className="text-xs">{platform.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Project Type</label>
            <select
              value={selectedProjectType}
              onChange={(e) => setSelectedProjectType(e.target.value as keyof typeof PROJECT_TYPES)}
              className="w-full bg-panel-light border border-border rounded px-3 py-2 text-sm text-text-primary"
              title="Select project type"
            >
              {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                <option key={key} value={key}>
                  {type.icon} {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Build Steps */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Build Steps</label>
            <div className="space-y-2">
              {PROJECT_TYPES[selectedProjectType].defaultCommands.map((command, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={buildSteps.includes(command)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBuildSteps((prev) => [...prev, command]);
                      } else {
                        setBuildSteps((prev) => prev.filter((step) => step !== command));
                      }
                    }}
                    className="rounded"
                    title={`Include ${command}`}
                  />
                  <span className="text-sm text-text-primary font-mono">{command}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Test Frameworks */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Test Frameworks
            </label>
            <div className="space-y-2">
              {PROJECT_TYPES[selectedProjectType].testFrameworks.map((framework) => (
                <div key={framework} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={testFrameworks.includes(framework)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTestFrameworks((prev) => [...prev, framework]);
                      } else {
                        setTestFrameworks((prev) => prev.filter((f) => f !== framework));
                      }
                    }}
                    className="rounded"
                    title={`Include ${framework}`}
                  />
                  <span className="text-sm text-text-primary">{framework}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deployment Targets */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Deployment Targets
            </label>
            <div className="space-y-2">
              {PROJECT_TYPES[selectedProjectType].deployTargets.map((target) => (
                <div key={target} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={deploymentTargets.includes(target)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDeploymentTargets((prev) => [...prev, target]);
                      } else {
                        setDeploymentTargets((prev) => prev.filter((t) => t !== target));
                      }
                    }}
                    className="rounded"
                    title={`Deploy to ${target}`}
                  />
                  <span className="text-sm text-text-primary">{target}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">Environment Variables</label>
              <button
                onClick={addEnvironmentVariable}
                className="text-xs text-brand-blue hover:text-blue-400"
                title="Add environment variable"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(environmentVariables).map(([key, _val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-panel-light p-2 rounded"
                >
                  <span className="text-sm font-mono text-text-primary">{key}</span>
                  <button
                    onClick={() => removeEnvironmentVariable(key)}
                    className="text-xs text-red-400 hover:text-red-300"
                    title="Remove variable"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-border">
          <button
            onClick={generateCICDConfig}
            disabled={isGenerating}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-brand-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
            title="Generate CI/CD configuration"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>🤖</span>
                <span>Generate CI/CD Config</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Templates and Preview Panel */}
      <div className="flex-1 flex flex-col">
        {/* Templates */}
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Quick Templates</h3>
          <div className="grid grid-cols-2 gap-3">
            {CICD_TEMPLATES.filter((t) => t.platform === selectedPlatform).map((template) => (
              <div
                key={template.id}
                className={`p-3 border rounded cursor-pointer transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'border-brand-blue bg-brand-blue/10'
                    : 'border-border bg-panel-light hover:border-gray-400'
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <h4 className="font-medium text-text-primary text-sm mb-1">{template.name}</h4>
                <p className="text-xs text-text-secondary mb-2">{template.description}</p>
                <div className="flex flex-wrap gap-1">
                  {template.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs bg-gray-600 text-gray-200 px-1.5 py-0.5 rounded"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generated Config Preview */}
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">Generated Configuration</h3>
            {generatedConfig && (
              <button
                onClick={() => navigator.clipboard.writeText(generatedConfig)}
                className="text-xs text-brand-blue hover:text-blue-400"
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
            )}
          </div>

          {generatedConfig ? (
            <pre className="bg-gray-900 p-4 rounded text-sm text-gray-300 overflow-auto h-full">
              <code>{generatedConfig}</code>
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              <div className="text-center">
                <div className="text-4xl mb-4">⚙️</div>
                <p className="text-lg font-medium mb-2">AI CI/CD Configuration</p>
                <p className="text-sm">
                  Configure your settings and generate an optimized CI/CD pipeline
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICICDGenerator;
