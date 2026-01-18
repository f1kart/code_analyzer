import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

// Swagger definition
const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Gemini IDE Backend API',
    version: '1.0.0',
    description: `
      ## Gemini IDE Backend API Documentation
      
      This API provides comprehensive backend services for the Gemini IDE application including:
      - Admin management for providers and workflows
      - User management and authentication
      - Metrics and observability
      - Health checks and monitoring
      - Structured logging
      
      ### Authentication
      Most endpoints require authentication via JWT tokens. Include the token in the Authorization header:
      \`Authorization: Bearer <your-jwt-token>\`
      
      ### Rate Limiting
      API endpoints are rate-limited to prevent abuse. Rate limit headers are included in responses:
      - \`X-RateLimit-Limit\`: Request limit per window
      - \`X-RateLimit-Remaining\`: Remaining requests
      - \`X-RateLimit-Reset\`: Reset time (Unix timestamp)
      
      ### Error Handling
      The API uses standard HTTP status codes and returns error responses in the following format:
      \`\`\`json
      {
        "success": false,
        "error": "Error type",
        "message": "Detailed error message"
      }
      \`\`\`
      
      ### Correlation IDs
      All requests support correlation ID tracking. Include a correlation ID for request tracing:
      \`X-Correlation-ID: <unique-request-id>\`
    `,
    contact: {
      name: 'Gemini IDE Team',
      email: 'support@gemini-ide.com',
      url: 'https://gemini-ide.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3001',
      description: 'Development server',
    },
    {
      url: process.env.PROD_API_URL || 'https://api.gemini-ide.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'string',
            description: 'Error type or category',
            example: 'ValidationError',
          },
          message: {
            type: 'string',
            description: 'Detailed error message',
            example: 'Invalid input data provided',
          },
          details: {
            type: 'object',
            description: 'Additional error details (optional)',
          },
        },
        required: ['success', 'error', 'message'],
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            description: 'Response data',
          },
          message: {
            type: 'string',
            description: 'Success message (optional)',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Response timestamp',
          },
        },
        required: ['success'],
      },
      Pagination: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Number of items per page',
            example: 50,
          },
          offset: {
            type: 'integer',
            description: 'Number of items to skip',
            example: 0,
          },
          total: {
            type: 'integer',
            description: 'Total number of items',
            example: 150,
          },
          hasMore: {
            type: 'boolean',
            description: 'Whether there are more items',
            example: true,
          },
        },
      },
      Provider: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Provider unique identifier',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          name: {
            type: 'string',
            description: 'Provider name',
            example: 'OpenAI GPT-4',
          },
          type: {
            type: 'string',
            description: 'Provider type',
            enum: ['openai', 'anthropic', 'google', 'custom'],
            example: 'openai',
          },
          config: {
            type: 'object',
            description: 'Provider configuration',
            example: {
              apiKey: 'sk-...',
              model: 'gpt-4',
              temperature: 0.7,
            },
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the provider is enabled',
            example: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
        required: ['id', 'name', 'type', 'enabled'],
      },
      Workflow: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Workflow unique identifier',
            example: '123e4567-e89b-12d3-a456-426614174001',
          },
          name: {
            type: 'string',
            description: 'Workflow name',
            example: 'Code Review Assistant',
          },
          description: {
            type: 'string',
            description: 'Workflow description',
            example: 'Automated code review and suggestions',
          },
          providerId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated provider ID',
          },
          config: {
            type: 'object',
            description: 'Workflow configuration',
            example: {
              prompt: 'Review this code for issues...',
              temperature: 0.3,
            },
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the workflow is enabled',
            example: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
        required: ['id', 'name', 'providerId', 'enabled'],
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User unique identifier',
            example: '123e4567-e89b-12d3-a456-426614174002',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'user@example.com',
          },
          name: {
            type: 'string',
            description: 'User display name',
            example: 'John Doe',
          },
          role: {
            type: 'string',
            description: 'User role',
            enum: ['admin', 'user', 'viewer'],
            example: 'user',
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the user account is enabled',
            example: true,
          },
          lastLogin: {
            type: 'string',
            format: 'date-time',
            description: 'Last login timestamp',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
          },
        },
        required: ['id', 'email', 'name', 'role'],
      },
      LogEntry: {
        type: 'object',
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Log timestamp',
          },
          level: {
            type: 'string',
            description: 'Log level',
            enum: ['debug', 'info', 'warn', 'error', 'fatal'],
            example: 'info',
          },
          message: {
            type: 'string',
            description: 'Log message',
            example: 'User login successful',
          },
          service: {
            type: 'string',
            description: 'Service name',
            example: 'gemini-ide-backend',
          },
          correlationId: {
            type: 'string',
            description: 'Request correlation ID',
            example: 'corr_1234567890_abc123',
          },
          userId: {
            type: 'string',
            description: 'User ID (if applicable)',
            example: '123e4567-e89b-12d3-a456-426614174002',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Log tags',
            example: ['auth', 'success'],
          },
        },
        required: ['timestamp', 'level', 'message', 'service'],
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Health check status',
            enum: ['pass', 'warn', 'fail'],
            example: 'pass',
          },
          message: {
            type: 'string',
            description: 'Health check message',
            example: 'Service is healthy',
          },
          details: {
            type: 'object',
            description: 'Additional health details',
          },
          duration_ms: {
            type: 'integer',
            description: 'Check duration in milliseconds',
            example: 45,
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Check timestamp',
          },
        },
        required: ['status', 'timestamp'],
      },
      Metrics: {
        type: 'object',
        properties: {
          counters: {
            type: 'object',
            description: 'Counter metrics',
            example: {
              'requests_total': 1500,
              'errors_total': 23,
            },
          },
          histograms: {
            type: 'object',
            description: 'Histogram metrics',
            example: {
              'request_duration': {
                count: 1500,
                sum: 75000,
                avg: 50,
              },
            },
          },
          activeSpans: {
            type: 'integer',
            description: 'Number of active tracing spans',
            example: 5,
          },
          completedSpans: {
            type: 'integer',
            description: 'Number of completed tracing spans',
            example: 1495,
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication failed',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'Unauthorized',
              message: 'Invalid or missing authentication token',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Access denied',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'Forbidden',
              message: 'Insufficient permissions to access this resource',
            },
          },
        },
      },
      ValidationError: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'ValidationError',
              message: 'Invalid input data provided',
              details: {
                field: 'email',
                issue: 'Invalid email format',
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'NotFound',
              message: 'Requested resource not found',
            },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'RateLimitExceeded',
              message: 'Too many requests, please try again later',
            },
          },
        },
        headers: {
          'X-RateLimit-Limit': {
            description: 'Request limit per window',
            schema: {
              type: 'integer',
            },
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests',
            schema: {
              type: 'integer',
            },
          },
          'X-RateLimit-Reset': {
            description: 'Reset time (Unix timestamp)',
            schema: {
              type: 'integer',
            },
          },
        },
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'InternalServerError',
              message: 'An unexpected error occurred',
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Providers',
      description: 'AI provider management endpoints',
    },
    {
      name: 'Workflows',
      description: 'Workflow management endpoints',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Metrics',
      description: 'Application metrics and monitoring',
    },
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Logging',
      description: 'Structured logging endpoints',
    },
    {
      name: 'Authentication',
      description: 'Authentication and authorization',
    },
  ],
};

// Options for swagger-jsdoc
const options = {
  definition: swaggerDefinition,
  apis: [
    './src/backend/routes/*.ts',
    './src/backend/controllers/*.ts',
    './src/backend/middleware/*.ts',
    './src/backend/models/*.ts',
  ],
};

// Generate swagger specification
export const swaggerSpec = swaggerJsdoc(options);

// Export swagger configuration
export { swaggerDefinition };

// Helper function to add swagger annotations to routes
export const addSwaggerAnnotations = (app: any) => {
  // Serve swagger documentation
  app.get('/api/docs/swagger.json', (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve swagger UI redirect
  app.get('/api/docs', (req: any, res: any) => {
    res.redirect('/api/docs/swagger-ui');
  });

  // Serve swagger UI (if you have swagger-ui-express installed)
  app.get('/api/docs/swagger-ui', (req: any, res: any) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gemini IDE API Documentation</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
        <style>
          html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
          *, *:before, *:after { box-sizing: inherit; }
          body { margin:0; background: #fafafa; }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            const ui = SwaggerUIBundle({
              url: '/api/docs/swagger.json',
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout",
              tryItOutEnabled: true,
              filter: true,
              supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
              onComplete: function() {
                console.log("Swagger UI loaded");
              }
            });
          };
        </script>
      </body>
      </html>
    `);
  });
};

// Export default for convenience
export default {
  swaggerSpec,
  swaggerDefinition,
  addSwaggerAnnotations,
};
