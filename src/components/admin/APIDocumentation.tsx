import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ArrowDownTrayIcon,
  CodeBracketIcon,
  ServerIcon,
  ShieldCheckIcon,
  ClockIcon,
  BookOpenIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

// API endpoint interface
interface APIEndpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: Array<{
    name: string;
    in: string;
    description: string;
    required: boolean;
    type: string;
    example?: any;
  }>;
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: any;
        example?: any;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        'application/json': {
          schema: any;
          example?: any;
        };
      };
    };
  };
}

// API documentation interface
interface APIDocumentation {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: {
      name: string;
      email: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  tags: Array<{
    name: string;
    description: string;
  }>;
  paths: {
    [path: string]: {
      [method: string]: APIEndpoint;
    };
  };
  components: {
    schemas: {
      [name: string]: any;
    };
  };
}

const APIDocumentation: React.FC = () => {
  const [apiDoc, setApiDoc] = useState<APIDocumentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch API documentation
  const fetchAPIDocumentation = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, you would fetch from the API
      // For now, we'll simulate with mock data
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockDoc: APIDocumentation = {
        openapi: '3.0.0',
        info: {
          title: 'Gemini IDE Backend API',
          version: '1.0.0',
          description: 'Comprehensive API for Gemini IDE backend services',
          contact: {
            name: 'Gemini IDE Team',
            email: 'support@gemini-ide.com',
            url: 'https://gemini-ide.com',
          },
        },
        servers: [
          {
            url: 'http://localhost:3001',
            description: 'Development server',
          },
          {
            url: 'https://api.gemini-ide.com',
            description: 'Production server',
          },
        ],
        tags: [
          { name: 'Providers', description: 'AI provider management endpoints' },
          { name: 'Workflows', description: 'Workflow management endpoints' },
          { name: 'Users', description: 'User management endpoints' },
          { name: 'Metrics', description: 'Application metrics and monitoring' },
          { name: 'Health', description: 'Health check endpoints' },
          { name: 'Logging', description: 'Structured logging endpoints' },
        ],
        paths: {
          '/api/admin/providers': {
            get: {
              method: 'GET',
              path: '/api/admin/providers',
              summary: 'Get all AI providers',
              description: 'Retrieve a list of all configured AI providers',
              tags: ['Providers'],
              parameters: [
                {
                  name: 'page',
                  in: 'query',
                  description: 'Page number for pagination',
                  required: false,
                  type: 'integer',
                  example: 1,
                },
                {
                  name: 'limit',
                  in: 'query',
                  description: 'Number of providers per page',
                  required: false,
                  type: 'integer',
                  example: 50,
                },
              ],
              responses: {
                '200': {
                  description: 'Providers retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Provider' },
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' },
                        },
                      },
                    },
                  },
                },
              },
            },
            post: {
              method: 'POST',
              path: '/api/admin/providers',
              summary: 'Create a new AI provider',
              description: 'Add a new AI provider configuration',
              tags: ['Providers'],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'type', 'config'],
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['openai', 'anthropic', 'google', 'custom'] },
                        config: { type: 'object' },
                        enabled: { type: 'boolean' },
                      },
                    },
                    example: {
                      name: 'OpenAI GPT-4',
                      type: 'openai',
                      config: { apiKey: 'sk-...', model: 'gpt-4' },
                      enabled: true,
                    },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Provider created successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: { $ref: '#/components/schemas/Provider' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/api/admin/workflows': {
            get: {
              method: 'GET',
              path: '/api/admin/workflows',
              summary: 'Get all AI workflows',
              description: 'Retrieve a list of all configured AI workflows',
              tags: ['Workflows'],
              responses: {
                '200': {
                  description: 'Workflows retrieved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Workflow' },
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Provider: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                type: { type: 'string', enum: ['openai', 'anthropic', 'google', 'custom'] },
                config: { type: 'object' },
                enabled: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            Workflow: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                description: { type: 'string' },
                providerId: { type: 'string', format: 'uuid' },
                config: { type: 'object' },
                enabled: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            Pagination: {
              type: 'object',
              properties: {
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                total: { type: 'integer' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      };

      setApiDoc(mockDoc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API documentation');
      console.error('API documentation fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAPIDocumentation();
  }, []);

  // Get all endpoints from paths
  const getAllEndpoints = (): APIEndpoint[] => {
    if (!apiDoc?.paths) return [];

    const endpoints: APIEndpoint[] = [];
    for (const path in apiDoc.paths) {
      for (const method in apiDoc.paths[path]) {
        endpoints.push({
          ...apiDoc.paths[path][method],
          method,
          path,
        });
      }
    }
    return endpoints;
  };

  // Filter endpoints
  const filteredEndpoints = getAllEndpoints().filter(endpoint => {
    // Tag filter
    if (selectedTag !== 'all' && !endpoint.tags.includes(selectedTag)) {
      return false;
    }

    // Search filter
    if (searchTerm && !endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !endpoint.path.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Get method color
  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'POST':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'PATCH':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format JSON for display
  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  // Endpoint card component
  const EndpointCard: React.FC<{ endpoint: APIEndpoint }> = ({ endpoint }) => {
    return (
      <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
           onClick={() => setSelectedEndpoint(endpoint)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getMethodColor(endpoint.method)}`}>
              {endpoint.method.toUpperCase()}
            </span>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">{endpoint.path}</code>
          </div>
          <div className="flex items-center space-x-1">
            {endpoint.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-1 bg-gray-100 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <h4 className="font-medium text-gray-900 mb-1">{endpoint.summary}</h4>
        <p className="text-sm text-gray-600">{endpoint.description}</p>
      </div>
    );
  };

  if (loading && !apiDoc) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !apiDoc) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={fetchAPIDocumentation}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!apiDoc) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Documentation</h1>
          <p className="text-gray-600">Interactive API documentation and testing interface</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.open('/api/docs/swagger-ui', '_blank')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <BookOpenIcon className="h-4 w-4" />
            <span>Swagger UI</span>
          </button>
          <button
            onClick={() => window.open('/api/docs/swagger.json', '_blank')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Download JSON</span>
          </button>
          <button
            onClick={fetchAPIDocumentation}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* API Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{apiDoc.info.title}</h2>
        <p className="text-gray-600 mb-4">{apiDoc.info.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Version:</span>
            <span className="ml-2">{apiDoc.info.version}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Contact:</span>
            <span className="ml-2">{apiDoc.info.contact.email}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Servers:</span>
            <span className="ml-2">{apiDoc.servers.length} available</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <FunnelIcon className="h-4 w-4" />
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tag Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Filter by tag"
                aria-label="Filter by tag"
              >
                <option value="all">All Tags</option>
                {apiDoc.tags.map(tag => (
                  <option key={tag.name} value={tag.name}>{tag.name}</option>
                ))}
              </select>
            </div>

            {/* Search Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search endpoints..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Endpoints ({filteredEndpoints.length})
          </h3>
          <div className="space-y-2">
            {filteredEndpoints.length === 0 ? (
              <div className="text-center py-8">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No endpoints found matching your filters</p>
              </div>
            ) : (
              filteredEndpoints.map((endpoint, index) => (
                <EndpointCard key={`${endpoint.method}-${endpoint.path}-${index}`} endpoint={endpoint} />
              ))
            )}
          </div>
        </div>

        {/* Endpoint Details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Endpoint Details</h3>
          {selectedEndpoint ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <span className={`px-3 py-1 rounded text-sm font-medium border ${getMethodColor(selectedEndpoint.method)}`}>
                  {selectedEndpoint.method.toUpperCase()}
                </span>
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">{selectedEndpoint.path}</code>
              </div>

              <h4 className="font-semibold text-gray-900 mb-2">{selectedEndpoint.summary}</h4>
              <p className="text-gray-600 mb-4">{selectedEndpoint.description}</p>

              {/* Parameters */}
              {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">Parameters</h5>
                  <div className="space-y-2">
                    {selectedEndpoint.parameters.map((param, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <div className="flex items-center space-x-2 mb-1">
                          <code className="text-sm">{param.name}</code>
                          <span className="text-xs px-2 py-1 bg-blue-100 rounded">{param.in}</span>
                          {param.required && <span className="text-xs px-2 py-1 bg-red-100 rounded">required</span>}
                        </div>
                        <p className="text-sm text-gray-600">{param.description}</p>
                        {param.example && (
                          <div className="mt-2">
                            <span className="text-xs font-medium">Example:</span>
                            <code className="block mt-1 text-xs bg-white p-2 rounded">{param.example}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Body */}
              {selectedEndpoint.requestBody && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">Request Body</h5>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedEndpoint.requestBody.required ? 'Required' : 'Optional'} request body
                    </p>
                    {selectedEndpoint.requestBody.content['application/json'].example && (
                      <div>
                        <span className="text-xs font-medium">Example:</span>
                        <pre className="mt-2 text-xs bg-white p-3 rounded overflow-x-auto">
                          {formatJSON(selectedEndpoint.requestBody.content['application/json'].example)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Responses */}
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Responses</h5>
                <div className="space-y-2">
                  {Object.entries(selectedEndpoint.responses).map(([statusCode, response]) => (
                    <div key={statusCode} className="bg-gray-50 p-3 rounded">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          statusCode.startsWith('2') ? 'bg-green-100 text-green-800' :
                          statusCode.startsWith('4') ? 'bg-yellow-100 text-yellow-800' :
                          statusCode.startsWith('5') ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {statusCode}
                        </span>
                        <span className="text-sm">{response.description}</span>
                      </div>
                      {response.content?.['application/json']?.example && (
                        <div className="mt-2">
                          <span className="text-xs font-medium">Example:</span>
                          <pre className="mt-1 text-xs bg-white p-3 rounded overflow-x-auto">
                            {formatJSON(response.content['application/json'].example)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select an endpoint to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default APIDocumentation;
