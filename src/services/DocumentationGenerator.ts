/**
 * Documentation Generator Service
 * Auto-generates JSDoc/TSDoc, API docs, architecture diagrams, changelogs
 * Production-ready with multiple output formats
 */

export interface DocumentationConfig {
  format: 'markdown' | 'html' | 'json' | 'pdf';
  includePrivate: boolean;
  includeTOC: boolean;
  includeExamples: boolean;
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl?: string;
  endpoints: EndpointDoc[];
  models: ModelDoc[];
  authentication?: AuthDoc;
}

export interface EndpointDoc {
  path: string;
  method: string;
  summary: string;
  description: string;
  parameters: ParameterDoc[];
  requestBody?: RequestBodyDoc;
  responses: ResponseDoc[];
  examples: ExampleDoc[];
}

export interface ParameterDoc {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description: string;
}

export interface RequestBodyDoc {
  contentType: string;
  schema: any;
  example?: any;
}

export interface ResponseDoc {
  statusCode: number;
  description: string;
  schema?: any;
  example?: any;
}

export interface ExampleDoc {
  title: string;
  request: any;
  response: any;
}

export interface ModelDoc {
  name: string;
  description: string;
  properties: PropertyDoc[];
}

export interface PropertyDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface AuthDoc {
  type: 'bearer' | 'apiKey' | 'oauth2';
  description: string;
}

export interface ArchitectureDiagram {
  type: 'component' | 'sequence' | 'class' | 'deployment';
  mermaidCode: string;
  svg?: string;
}

export class DocumentationGenerator {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || localStorage.getItem('geminiApiKey') || '';
  }

  /**
   * Generate JSDoc/TSDoc from code
   */
  async generateJSDoc(code: string, language: 'typescript' | 'javascript'): Promise<string> {
    const functions = this.extractFunctions(code);
    let documented = code;

    for (const func of functions) {
      const doc = await this.generateFunctionDoc(func, language);
      documented = documented.replace(func.code, `${doc}\n${func.code}`);
    }

    return documented;
  }

  /**
   * Generate function documentation
   */
  private async generateFunctionDoc(func: { name: string; code: string }, language: string): Promise<string> {
    const prompt = `Generate ${language === 'typescript' ? 'TSDoc' : 'JSDoc'} for this function:

${func.code}

Include:
- Description
- @param for each parameter with type
- @returns with type
- @throws for errors
- @example with usage

Format as proper ${language === 'typescript' ? 'TSDoc' : 'JSDoc'} comment block.`;

    const response = await this.callAI(prompt);
    return response.trim();
  }

  /**
   * Extract functions from code
   */
  private extractFunctions(code: string): Array<{ name: string; code: string }> {
    const functions: Array<{ name: string; code: string }> = [];
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)[^{]*\{/g;
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1];
      const start = match.index;
      const end = this.findClosingBrace(code, match.index + match[0].length);
      functions.push({
        name,
        code: code.substring(start, end),
      });
    }
    
    return functions;
  }

  /**
   * Generate API documentation from routes
   */
  async generateAPIDoc(routesFile: string, code: string): Promise<APIDocumentation> {
    const prompt = `Analyze this route file and generate complete API documentation:

${code}

Extract:
- All endpoints with paths, methods, parameters
- Request/response schemas
- Authentication requirements
- Examples

Return JSON format with endpoints[], models[], authentication.`;

    const response = await this.callAI(prompt);
    
    try {
      const parsed = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      return {
        title: 'API Documentation',
        version: '1.0.0',
        description: 'Auto-generated API documentation',
        ...parsed,
      };
    } catch {
      return this.fallbackAPIDoc();
    }
  }

  /**
   * Generate architecture diagram
   */
  async generateArchitectureDiagram(
    files: Array<{ path: string; code: string }>,
    type: ArchitectureDiagram['type']
  ): Promise<ArchitectureDiagram> {
    const filesSummary = files.map(f => `${f.path}:\n${f.code.substring(0, 500)}`).join('\n\n');

    const prompt = `Generate a ${type} diagram in Mermaid syntax for this codebase:

${filesSummary}

Create a comprehensive ${type} diagram showing:
${type === 'component' ? '- All major components\n- Component relationships\n- Data flow' : ''}
${type === 'sequence' ? '- Key interactions\n- Message flow\n- Actors' : ''}
${type === 'class' ? '- Classes and interfaces\n- Inheritance\n- Associations' : ''}
${type === 'deployment' ? '- Deployment nodes\n- Artifacts\n- Dependencies' : ''}

Return only valid Mermaid code.`;

    const mermaidCode = await this.callAI(prompt);

    return {
      type,
      mermaidCode: this.cleanMermaidCode(mermaidCode),
    };
  }

  /**
   * Generate changelog from git commits
   */
  async generateChangelog(commits: Array<{ message: string; author: string; date: string }>): Promise<string> {
    const grouped = this.groupCommits(commits);

    let changelog = '# Changelog\n\n';
    
    for (const [type, commitList] of Object.entries(grouped)) {
      if (commitList.length === 0) continue;
      
      const section = type === 'feat' ? '### Features' :
                     type === 'fix' ? '### Bug Fixes' :
                     type === 'docs' ? '### Documentation' :
                     type === 'refactor' ? '### Refactoring' :
                     '### Other Changes';
      
      changelog += `${section}\n\n`;
      commitList.forEach(commit => {
        changelog += `- ${commit.message}\n`;
      });
      changelog += '\n';
    }

    return changelog;
  }

  /**
   * Group commits by type
   */
  private groupCommits(commits: Array<{ message: string; author: string; date: string }>): Record<string, any[]> {
    const grouped: Record<string, any[]> = {
      feat: [],
      fix: [],
      docs: [],
      refactor: [],
      test: [],
      chore: [],
    };

    for (const commit of commits) {
      const match = commit.message.match(/^(feat|fix|docs|refactor|test|chore)(\(.+?\))?:/);
      if (match) {
        const type = match[1];
        grouped[type].push(commit);
      } else {
        grouped.chore.push(commit);
      }
    }

    return grouped;
  }

  /**
   * Generate OpenAPI specification
   */
  async generateOpenAPI(routes: string): Promise<any> {
    const prompt = `Generate OpenAPI 3.0 specification from these routes:

${routes}

Include:
- All paths and operations
- Request/response schemas
- Authentication
- Examples

Return valid OpenAPI 3.0 JSON.`;

    const response = await this.callAI(prompt);
    
    try {
      return JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
    } catch {
      return {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
      };
    }
  }

  /**
   * Export documentation to format
   */
  async exportDocumentation(doc: APIDocumentation, format: DocumentationConfig['format']): Promise<string> {
    switch (format) {
      case 'markdown':
        return this.toMarkdown(doc);
      case 'html':
        return this.toHTML(doc);
      case 'json':
        return JSON.stringify(doc, null, 2);
      default:
        return this.toMarkdown(doc);
    }
  }

  private toMarkdown(doc: APIDocumentation): string {
    let md = `# ${doc.title}\n\n`;
    md += `Version: ${doc.version}\n\n`;
    md += `${doc.description}\n\n`;
    
    if (doc.baseUrl) {
      md += `Base URL: \`${doc.baseUrl}\`\n\n`;
    }

    md += '## Endpoints\n\n';
    for (const endpoint of doc.endpoints) {
      md += `### ${endpoint.method} ${endpoint.path}\n\n`;
      md += `${endpoint.description}\n\n`;
      
      if (endpoint.parameters.length > 0) {
        md += '**Parameters:**\n\n';
        endpoint.parameters.forEach(p => {
          md += `- \`${p.name}\` (${p.type}${p.required ? ', required' : ''}): ${p.description}\n`;
        });
        md += '\n';
      }
    }

    return md;
  }

  private toHTML(doc: APIDocumentation): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${doc.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .method { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
    .get { background: #61affe; color: white; }
    .post { background: #49cc90; color: white; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <p>${doc.description}</p>
  ${doc.endpoints.map(e => `
    <div class="endpoint">
      <span class="method ${e.method.toLowerCase()}">${e.method}</span>
      <span>${e.path}</span>
      <p>${e.description}</p>
    </div>
  `).join('')}
</body>
</html>`;
  }

  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private findClosingBrace(code: string, start: number): number {
    let depth = 1;
    for (let i = start; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    return code.length;
  }

  private cleanMermaidCode(code: string): string {
    return code.replace(/```mermaid\n?|\n?```/g, '').trim();
  }

  private fallbackAPIDoc(): APIDocumentation {
    return {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Auto-generated documentation',
      endpoints: [],
      models: [],
    };
  }
}
