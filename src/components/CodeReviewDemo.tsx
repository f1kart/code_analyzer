// CodeReviewDemo.tsx - Comprehensive demo of the AI-powered code review system
// Shows how to integrate all components for a complete development workflow

import React, { useState, useEffect } from 'react';
import { CodeReviewPanel } from './CodeReviewPanel';
import { CodeReviewEngine } from '../services/CodeReviewEngine';

export interface DemoProps {
  initialCode?: string;
  className?: string;
}

export const CodeReviewDemo: React.FC<DemoProps> = ({
  initialCode,
  className = ''
}) => {
  const [code, setCode] = useState(initialCode || getSampleCode());
  const [filePath, setFilePath] = useState('demo/sample.ts');
  const [activeView, setActiveView] = useState<'editor' | 'review' | 'split'>('split');

  /**
   * Handle code changes from the review system
   */
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  /**
   * Save code to file (demo implementation)
   */
  const saveCode = () => {
    // In production, this would save to the actual file system
    console.log('Saving code:', code);
    alert('Code saved! (Demo - would save to file system)');
  };

  /**
   * Load sample code for different scenarios
   */
  const loadSample = (type: 'clean' | 'buggy' | 'complex') => {
    setCode(getSampleCode(type));
    setFilePath(`demo/sample-${type}.ts`);
  };

  return (
    <div className={`code-review-demo ${className}`}>
      {/* Demo Header */}
      <div className="demo-header">
        <h1>🚀 AI-Powered Code Review Demo</h1>
        <p className="demo-description">
          Experience autonomous code review with senior developer-level analysis,
          one-click fixes, and seamless AI agent integration.
        </p>

        <div className="demo-controls">
          <div className="sample-buttons">
            <button
              className="sample-button"
              onClick={() => loadSample('clean')}
            >
              ✨ Load Clean Code
            </button>
            <button
              className="sample-button"
              onClick={() => loadSample('buggy')}
            >
              🐛 Load Buggy Code
            </button>
            <button
              className="sample-button"
              onClick={() => loadSample('complex')}
            >
              🔧 Load Complex Code
            </button>
          </div>

          <div className="view-controls">
            <button
              className={`view-button ${activeView === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveView('editor')}
            >
              📝 Editor Only
            </button>
            <button
              className={`view-button ${activeView === 'review' ? 'active' : ''}`}
              onClick={() => setActiveView('review')}
            >
              🔍 Review Only
            </button>
            <button
              className={`view-button ${activeView === 'split' ? 'active' : ''}`}
              onClick={() => setActiveView('split')}
            >
              ⬜ Split View
            </button>
          </div>

          <button className="save-button" onClick={saveCode}>
            💾 Save Code
          </button>
        </div>
      </div>

      {/* Main Demo Area */}
      <div className="demo-content">
        {activeView === 'editor' && (
          <div className="editor-view">
            <CodeEditor
              code={code}
              onChange={setCode}
              filePath={filePath}
            />
          </div>
        )}

        {activeView === 'review' && (
          <div className="review-view">
            <CodeReviewPanel
              filePath={filePath}
              code={code}
              onCodeChange={handleCodeChange}
              autoReview={true}
              reviewInterval={10000} // 10 seconds for demo
            />
          </div>
        )}

        {activeView === 'split' && (
          <div className="split-view">
            <div className="editor-panel">
              <div className="panel-header">
                <h3>📝 Code Editor</h3>
                <span className="file-path">{filePath}</span>
              </div>
              <div className="panel-content">
                <CodeEditor
                  code={code}
                  onChange={setCode}
                  filePath={filePath}
                />
              </div>
            </div>

            <div className="review-panel">
              <CodeReviewPanel
                filePath={filePath}
                code={code}
                onCodeChange={handleCodeChange}
                autoReview={true}
                reviewInterval={10000}
              />
            </div>
          </div>
        )}
      </div>

      {/* Demo Instructions */}
      <div className="demo-instructions">
        <h3>🎯 How to Use</h3>
        <div className="instructions-grid">
          <div className="instruction-card">
            <h4>1️⃣ Load Sample Code</h4>
            <p>Click the sample buttons above to load different types of code for testing.</p>
          </div>

          <div className="instruction-card">
            <h4>2️⃣ Edit Code</h4>
            <p>Make changes in the editor and watch as the AI automatically reviews your code.</p>
          </div>

          <div className="instruction-card">
            <h4>3️⃣ Review Issues</h4>
            <p>View inline comments, quality metrics, and AI agent feedback in the review panel.</p>
          </div>

          <div className="instruction-card">
            <h4>4️⃣ Apply Fixes</h4>
            <p>Use one-click fixes for automatic bug resolution and code improvements.</p>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="system-status">
        <h3>📊 System Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Code Review Engine:</span>
            <span className="status-value active">✅ Active</span>
          </div>

          <div className="status-item">
            <span className="status-label">Bug Detection:</span>
            <span className="status-value active">✅ Active</span>
          </div>

          <div className="status-item">
            <span className="status-label">One-Click Fixes:</span>
            <span className="status-value active">✅ Active</span>
          </div>

          <div className="status-item">
            <span className="status-label">AI Agent Integration:</span>
            <span className="status-value active">✅ Active</span>
          </div>

          <div className="status-item">
            <span className="status-label">Auto-Review:</span>
            <span className="status-value active">✅ Active (10s interval)</span>
          </div>

          <div className="status-item">
            <span className="status-label">CLI Integration:</span>
            <span className="status-value active">✅ Ready</span>
          </div>
        </div>
      </div>

      <style>{`
        .code-review-demo {
          min-height: 100vh;
          background: #f8f9fa;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .demo-header {
          background: white;
          padding: 24px;
          border-bottom: 1px solid #e9ecef;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .demo-header h1 {
          margin: 0 0 8px 0;
          color: #212529;
          font-size: 28px;
          font-weight: 700;
        }

        .demo-description {
          margin: 0 0 20px 0;
          color: #6c757d;
          font-size: 16px;
          line-height: 1.5;
        }

        .demo-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .sample-buttons {
          display: flex;
          gap: 8px;
        }

        .sample-button {
          padding: 8px 16px;
          border: 1px solid #007bff;
          background: white;
          color: #007bff;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sample-button:hover {
          background: #007bff;
          color: white;
        }

        .view-controls {
          display: flex;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 4px;
        }

        .view-button {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          color: #6c757d;
          transition: all 0.2s;
        }

        .view-button:hover {
          background: #f8f9fa;
          color: #495057;
        }

        .view-button.active {
          background: #007bff;
          color: white;
        }

        .save-button {
          padding: 8px 16px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .save-button:hover {
          background: #218838;
        }

        .demo-content {
          height: calc(100vh - 300px);
        }

        .editor-view,
        .review-view {
          height: 100%;
        }

        .split-view {
          display: grid;
          grid-template-columns: 1fr 1fr;
          height: 100%;
          gap: 1px;
          background: #e9ecef;
        }

        .editor-panel,
        .review-panel {
          background: white;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          color: #212529;
        }

        .file-path {
          font-size: 12px;
          color: #6c757d;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .panel-content {
          flex: 1;
          overflow: hidden;
        }

        .demo-instructions {
          background: white;
          padding: 24px;
          margin-top: 24px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .demo-instructions h3 {
          margin: 0 0 16px 0;
          color: #212529;
        }

        .instructions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .instruction-card {
          padding: 16px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid #007bff;
        }

        .instruction-card h4 {
          margin: 0 0 8px 0;
          color: #212529;
          font-size: 14px;
        }

        .instruction-card p {
          margin: 0;
          color: #6c757d;
          font-size: 13px;
          line-height: 1.4;
        }

        .system-status {
          background: white;
          padding: 24px;
          margin-top: 24px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .system-status h3 {
          margin: 0 0 16px 0;
          color: #212529;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .status-label {
          font-size: 13px;
          color: #495057;
        }

        .status-value {
          font-size: 13px;
          font-weight: 600;
        }

        .status-value.active {
          color: #28a745;
        }

        @media (max-width: 768px) {
          .demo-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .split-view {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr;
          }

          .instructions-grid {
            grid-template-columns: 1fr;
          }

          .status-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

// Simple Code Editor Component for Demo
interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  filePath: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, filePath }) => {
  return (
    <div className="code-editor">
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        className="editor-textarea"
        placeholder="Enter your code here..."
        spellCheck={false}
      />

      <style>{`
        .code-editor {
          height: 100%;
          position: relative;
        }

        .editor-textarea {
          width: 100%;
          height: 100%;
          padding: 16px;
          border: none;
          outline: none;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
          background: #1e1e1e;
          color: #d4d4d4;
          resize: none;
        }

        .editor-textarea::placeholder {
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};

// Sample code for different scenarios
function getSampleCode(type: 'clean' | 'buggy' | 'complex' = 'clean'): string {
  switch (type) {
    case 'clean':
      return `// Clean, well-structured TypeScript code
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: Map<number, User> = new Map();

  constructor() {
    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers(): void {
    const defaultUsers: User[] = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ];

    defaultUsers.forEach(user => {
      this.users.set(user.id, user);
    });
  }

  public getUserById(id: number): User | undefined {
    return this.users.get(id);
  }

  public getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  public addUser(user: User): void {
    if (this.users.has(user.id)) {
      throw new Error(\`User with id \${user.id} already exists\`);
    }
    this.users.set(user.id, user);
  }

  public updateUser(id: number, updates: Partial<User>): User | undefined {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return undefined;
    }

    const updatedUser = { ...existingUser, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
}

// Usage example
const userService = new UserService();
console.log('All users:', userService.getAllUsers());`;

    case 'buggy':
      return `// Code with various bugs and issues
function processUserData(data) {
  // Missing input validation
  if (data.name) {
    // Potential XSS vulnerability
    document.getElementById('username').innerHTML = data.name;
  }

  // Insecure random number generation
  const userId = Math.random() * 1000000;

  // Memory leak - event listener not removed
  window.addEventListener('resize', function() {
    console.log('Window resized');
  });

  // Infinite loop potential
  for (let i = 0; i < data.items.length; ) {
    console.log(data.items[i]);
    // Missing increment
  }

  // Null pointer risk
  const result = data.preferences.theme.toUpperCase();

  // Unused variable
  const temp = 'temporary value';

  return {
    processed: true,
    userId: userId
  };
}

// SQL injection vulnerability
const query = "SELECT * FROM users WHERE name = '" + userInput + "'";

// Missing error handling
try {
  riskyOperation();
} catch (error) {
  // Error not properly handled
}

// Resource not cleaned up
const file = openFile('data.txt');
// File never closed`;

    case 'complex':
      return `// Complex code with multiple patterns and potential issues
class ComplexDataProcessor {
  private cache: Map<string, any> = new Map();
  private listeners: Function[] = [];
  private config: ComplexConfig;

  constructor(config: ComplexConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadConfiguration();
    this.setupEventListeners();
    this.preloadCache();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const response = await fetch(this.config.endpoint);
      const data = await response.json();

      // Deep object mutation without validation
      Object.assign(this.config, data);

      // Complex nested conditions
      if (this.config.features?.ai?.enabled && this.config.features?.ai?.models?.length > 0) {
        for (const model of this.config.features.ai.models) {
          if (model.version && model.version.startsWith('v2')) {
            await this.initializeAIModel(model);
          }
        }
      }
    } catch (error) {
      // Generic error handling
      console.error('Failed to load configuration');
    }
  }

  private setupEventListeners(): void {
    // Multiple event listeners without cleanup tracking
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });
  }

  private preloadCache(): void {
    // Synchronous operations in loop
    for (let i = 0; i < 1000; i++) {
      this.cache.set(\`key_\${i}\`, this.generateComplexObject(i));
    }
  }

  private generateComplexObject(index: number): any {
    // Complex object creation with potential memory issues
    return {
      id: index,
      data: Array.from({ length: 100 }, (_, i) => ({
        index: i,
        value: Math.random() * 1000,
        nested: {
          deep: {
            value: \`item_\${index}_\${i}\`
          }
        }
      })),
      metadata: {
        created: new Date(),
        tags: ['complex', 'demo', 'performance-test']
      }
    };
  }

  public async processData(input: any): Promise<ProcessedResult> {
    // Long method with multiple responsibilities
    const startTime = Date.now();

    // Input validation (incomplete)
    if (!input) throw new Error('Input required');

    // Caching logic
    const cacheKey = this.generateCacheKey(input);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Complex data transformation
    const transformed = await this.transformData(input);

    // Multiple conditional branches
    let result: ProcessedResult;
    if (this.config.strategy === 'batch') {
      result = await this.processBatch(transformed);
    } else if (this.config.strategy === 'stream') {
      result = await this.processStream(transformed);
    } else {
      result = await this.processDefault(transformed);
    }

    // Notification logic
    this.notifyListeners('data-processed', result);

    // Performance tracking
    const duration = Date.now() - startTime;
    this.trackPerformance('processData', duration);

    return result;
  }

  private generateCacheKey(input: any): string {
    // Potential performance issue with JSON serialization
    return JSON.stringify(input);
  }

  private async transformData(input: any): Promise<any> {
    // Complex transformation logic
    const promises = input.items?.map(async (item: any) => {
      // Async operations without proper error handling
      const processed = await this.processItem(item);
      return processed;
    }) || [];

    return Promise.all(promises);
  }

  private async processItem(item: any): Promise<any> {
    // Item processing with potential issues
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    if (Math.random() > 0.8) {
      throw new Error('Random processing error');
    }

    return {
      ...item,
      processed: true,
      timestamp: new Date()
    };
  }

  private processBatch(data: any): ProcessedResult {
    // Batch processing implementation
    return {
      type: 'batch',
      count: data.length,
      results: data,
      duration: Date.now()
    };
  }

  private async processStream(data: any): Promise<ProcessedResult> {
    // Stream processing implementation
    const results = [];
    for (const item of data) {
      results.push(item);
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return {
      type: 'stream',
      count: results.length,
      results,
      duration: Date.now()
    };
  }

  private processDefault(data: any): ProcessedResult {
    // Default processing implementation
    return {
      type: 'default',
      count: data.length,
      results: data,
      duration: Date.now()
    };
  }

  private notifyListeners(event: string, data: any): void {
    // Notification without error handling
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  private trackPerformance(operation: string, duration: number): void {
    // Performance tracking (simplified)
    console.log(\`\${operation} took \${duration}ms\`);
  }

  public addListener(listener: Function): void {
    this.listeners.push(listener);
  }

  public removeListener(listener: Function): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  public cleanup(): void {
    // Cleanup implementation
    this.cache.clear();
    this.listeners.length = 0;

    // Remove event listeners
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  }
}

// Configuration interface
interface ComplexConfig {
  endpoint: string;
  strategy: 'batch' | 'stream' | 'default';
  features?: {
    ai?: {
      enabled: boolean;
      models?: Array<{
        name: string;
        version: string;
      }>;
    };
  };
}

// Result interface
interface ProcessedResult {
  type: string;
  count: number;
  results: any[];
  duration: number;
}`;

    default:
      return '// Start coding...';
  }
}
