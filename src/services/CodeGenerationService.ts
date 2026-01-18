/**
 * Intelligent Code Generation Service
 * Generates functions, classes, CRUD operations, REST endpoints, API clients
 * Production-ready with multiple frameworks and AI-powered generation
 */

export interface GenerationRequest {
  type: 'function' | 'class' | 'crud' | 'rest-endpoint' | 'api-client' | 'component';
  language: 'typescript' | 'javascript' | 'python' | 'rust' | 'go';
  framework?: string;
  specification: string | GenerationSpec;
  context?: string;
}

export interface GenerationSpec {
  name: string;
  description: string;
  parameters?: Parameter[];
  returnType?: string;
  properties?: Property[];
  methods?: Method[];
  endpoints?: Endpoint[];
  database?: DatabaseConfig;
}

export interface Parameter {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface Property {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  readonly?: boolean;
  description?: string;
}

export interface Method {
  name: string;
  parameters: Parameter[];
  returnType: string;
  async?: boolean;
  description?: string;
}

export interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description: string;
  requestBody?: any;
  responseType?: string;
}

export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'mongodb' | 'sqlite';
  table: string;
  fields: Array<{ name: string; type: string; required?: boolean }>;
}

export interface GenerationResult {
  code: string;
  tests?: string;
  documentation?: string;
  dependencies?: string[];
  imports?: string[];
}

export class CodeGenerationService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || localStorage.getItem('geminiApiKey') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }

  /**
   * Generate code based on request
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    switch (request.type) {
      case 'function':
        return this.generateFunction(request);
      case 'class':
        return this.generateClass(request);
      case 'crud':
        return this.generateCRUD(request);
      case 'rest-endpoint':
        return this.generateRESTEndpoint(request);
      case 'api-client':
        return this.generateAPIClient(request);
      case 'component':
        return this.generateComponent(request);
      default:
        throw new Error(`Unknown generation type: ${request.type}`);
    }
  }

  /**
   * Generate function from comment or description
   */
  private async generateFunction(request: GenerationRequest): Promise<GenerationResult> {
    const spec = typeof request.specification === 'string' ? 
      this.parseSpecification(request.specification) : 
      request.specification;

    const prompt = `Generate a complete, production-ready ${request.language} function.

Name: ${spec.name}
Description: ${spec.description}
${spec.parameters ? `Parameters: ${JSON.stringify(spec.parameters)}` : ''}
${spec.returnType ? `Return Type: ${spec.returnType}` : ''}
${request.context ? `Context:\n${request.context}` : ''}

Requirements:
1. Full error handling with try-catch
2. Input validation
3. TypeScript strict types
4. JSDoc documentation
5. Unit tests
6. Production-ready, no placeholders
7. Include all imports

Generate: main code, tests, documentation.`;

    const response = await this.callAI(prompt);
    return this.parseGenerationResponse(response);
  }

  /**
   * Generate class with properties and methods
   */
  private async generateClass(request: GenerationRequest): Promise<GenerationResult> {
    const spec = typeof request.specification === 'string' ? 
      this.parseSpecification(request.specification) : 
      request.specification;

    const prompt = `Generate a complete, production-ready ${request.language} class.

Name: ${spec.name}
Description: ${spec.description}
Properties: ${JSON.stringify(spec.properties || [])}
Methods: ${JSON.stringify(spec.methods || [])}
${request.framework ? `Framework: ${request.framework}` : ''}

Requirements:
1. Full constructor with validation
2. Getters/setters where appropriate
3. Private methods for internal logic
4. Error handling in all methods
5. TypeScript strict types
6. Full JSDoc comments
7. Unit tests
8. Production-ready code only

Generate: class code, tests, usage examples.`;

    const response = await this.callAI(prompt);
    return this.parseGenerationResponse(response);
  }

  /**
   * Generate complete CRUD operations
   */
  private async generateCRUD(request: GenerationRequest): Promise<GenerationResult> {
    const spec = typeof request.specification === 'string' ? 
      this.parseSpecification(request.specification) : 
      request.specification;

    // Validate database config exists
    if (!spec.database || !spec.database.type) {
      throw new Error('CRUD generation requires database configuration with type, table, and fields');
    }

    const dbConfig = spec.database;

    const prompt = `Generate complete CRUD operations for ${dbConfig.type} database.

Entity: ${spec.name}
Table: ${dbConfig.table}
Fields: ${JSON.stringify(dbConfig.fields)}
Framework: ${request.framework || 'Express + TypeORM'}

Generate production-ready code including:
1. Entity/Model definition
2. Repository/DAO layer
3. Service layer with business logic
4. Controller/Route handlers
5. Input validation schemas
6. Error handling
7. Transaction support
8. Unit tests
9. Integration tests
10. API documentation

Language: ${request.language}
No placeholders, no TODOs - complete implementation only.`;

    const response = await this.callAI(prompt);
    return this.parseGenerationResponse(response);
  }

  /**
   * Generate REST endpoint
   */
  private async generateRESTEndpoint(request: GenerationRequest): Promise<GenerationResult> {
    const spec = typeof request.specification === 'string' ? 
      this.parseSpecification(request.specification) : 
      request.specification;

    const endpoints = spec.endpoints || [];

    const prompt = `Generate complete REST API endpoints.

Endpoints: ${JSON.stringify(endpoints)}
Framework: ${request.framework || 'Express'}
Language: ${request.language}

Generate production-ready code including:
1. Route definitions
2. Controllers with full logic
3. Request validation middleware
4. Error handling middleware
5. Authentication/Authorization
6. Rate limiting
7. OpenAPI/Swagger documentation
8. Unit tests
9. Integration tests

Requirements:
- Full error handling
- Input sanitization
- Proper HTTP status codes
- CORS configuration
- Security headers
- No placeholders or TODOs`;

    const response = await this.callAI(prompt);
    return this.parseGenerationResponse(response);
  }

  /**
   * Generate API client from OpenAPI spec
   */
  private async generateAPIClient(request: GenerationRequest): Promise<GenerationResult> {
    const spec = request.specification as string;

    const prompt = `Generate a complete, type-safe API client from this OpenAPI specification:

${spec}

Language: ${request.language}
Framework: ${request.framework || 'axios'}

Generate production-ready code including:
1. Client class with all endpoints
2. TypeScript interfaces for all models
3. Request/response interceptors
4. Error handling
5. Retry logic
6. Rate limiting
7. Authentication support
8. Full unit tests
9. Usage documentation

Requirements:
- Strict TypeScript types
- Comprehensive error handling
- Production-ready only`;

    const response = await this.callAI(prompt);
    return this.parseGenerationResponse(response);
  }

  /**
   * Generate React/Vue component
   */
  private async generateComponent(request: GenerationRequest): Promise<GenerationResult> {
    const spec = typeof request.specification === 'string' ? 
      this.parseSpecification(request.specification) : 
      request.specification;

    const prompt = `Generate a complete, production-ready ${request.framework || 'React'} component.

Name: ${spec.name}
Description: ${spec.description}
Props: ${JSON.stringify(spec.parameters || [])}

Requirements:
1. TypeScript with strict types
2. Props validation
3. Error boundaries
4. Loading states
5. Accessibility (ARIA)
6. Responsive design
7. Unit tests with React Testing Library
8. Storybook stories
9. Full documentation

Generate: component code, tests, stories, styles.`;

    const response = await this.callAI(prompt);
    return this.parseGenerationResponse(response);
  }

  /**
   * Parse specification string into structured format
   */
  private parseSpecification(spec: string): GenerationSpec {
    const lines = spec.split('\n');
    const name = lines[0].replace(/^(function|class|const|let|var)\s+/, '').split(/[(\s{]/)[0];
    
    return {
      name,
      description: spec,
    };
  }

  /**
   * Call AI for code generation
   */
  private async callAI(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key is required. Please set VITE_GEMINI_API_KEY in .env or in localStorage.');
    }

    console.log('[CodeGeneration] Calling Gemini API...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CodeGeneration] API Error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[CodeGeneration] API Response received');
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[CodeGeneration] No text in response:', JSON.stringify(data, null, 2));
      throw new Error('No content generated by AI');
    }
    
    return text;
  }

  /**
   * Parse AI response into structured result
   */
  private parseGenerationResponse(response: string): GenerationResult {
    const codeBlocks = response.match(/```[\w]*\n([\s\S]*?)```/g) || [];
    
    const code = codeBlocks[0]?.replace(/```[\w]*\n?/g, '').trim() || response;
    const tests = codeBlocks[1]?.replace(/```[\w]*\n?/g, '').trim();
    const documentation = codeBlocks[2]?.replace(/```[\w]*\n?/g, '').trim();

    const imports = this.extractImports(code);
    const dependencies = this.extractDependencies(code);

    return {
      code,
      tests,
      documentation,
      imports,
      dependencies,
    };
  }

  /**
   * Extract import statements from code
   */
  private extractImports(code: string): string[] {
    const importRegex = /^import\s+.*?from\s+['"](.+?)['"];?$/gm;
    const matches = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      matches.push(match[0]);
    }
    
    return matches;
  }

  /**
   * Extract dependencies from imports
   */
  private extractDependencies(code: string): string[] {
    const importRegex = /from\s+['"]([^./][^'"]+)['"]/g;
    const deps = new Set<string>();
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      const pkg = match[1].split('/')[0];
      if (pkg && !pkg.startsWith('.')) {
        deps.add(pkg);
      }
    }
    
    return Array.from(deps);
  }
}
