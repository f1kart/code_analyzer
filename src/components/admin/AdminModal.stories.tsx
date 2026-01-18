import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
import AdminModal from './StorybookAdminModal';

// Mock data for stories
const mockProviders = [
  {
    id: '1',
    name: 'OpenAI GPT-4',
    type: 'openai',
    config: { apiKey: 'sk-...', model: 'gpt-4' },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Anthropic Claude',
    type: 'anthropic',
    config: { apiKey: 'sk-ant-...', model: 'claude-3' },
    enabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockWorkflows = [
  {
    id: '1',
    name: 'Code Review Assistant',
    description: 'Automated code review and suggestions',
    providerId: '1',
    config: { prompt: 'Review this code for issues...', temperature: 0.3 },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Documentation Generator',
    description: 'Generate comprehensive documentation',
    providerId: '1',
    config: { prompt: 'Generate docs for...', temperature: 0.5 },
    enabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const meta: Meta<typeof AdminModal> = {
  title: 'Admin/AdminModal',
  component: AdminModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The AdminModal component provides a comprehensive admin interface for managing AI providers and workflows.
It features tabbed navigation, CRUD operations, real-time search, filtering, and responsive design.

## Features
- **Tabbed Interface**: Switch between Providers and Workflows management
- **CRUD Operations**: Create, read, update, and delete providers and workflows
- **Real-time Search**: Instant filtering of items
- **Advanced Filtering**: Filter by type, status, and other properties
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Accessibility**: Full WCAG 2.1 AA compliance
- **Error Handling**: Graceful error states and user feedback
- **Loading States**: Visual feedback during operations

## Usage
\`\`\`tsx
<AdminModal
  isOpen={isOpen}
  onClose={handleClose}
  providers={providers}
  workflows={workflows}
  onProviderCreate={handleProviderCreate}
  onProviderUpdate={handleProviderUpdate}
  onProviderDelete={handleProviderDelete}
  onWorkflowCreate={handleWorkflowCreate}
  onWorkflowUpdate={handleWorkflowUpdate}
  onWorkflowDelete={handleWorkflowDelete}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when modal is closed',
    },
    providers: {
      description: 'Array of provider objects',
    },
    workflows: {
      description: 'Array of workflow objects',
    },
    onProviderCreate: {
      action: 'providerCreated',
      description: 'Callback when a provider is created',
    },
    onProviderUpdate: {
      action: 'providerUpdated',
      description: 'Callback when a provider is updated',
    },
    onProviderDelete: {
      action: 'providerDeleted',
      description: 'Callback when a provider is deleted',
    },
    onWorkflowCreate: {
      action: 'workflowCreated',
      description: 'Callback when a workflow is created',
    },
    onWorkflowUpdate: {
      action: 'workflowUpdated',
      description: 'Callback when a workflow is updated',
    },
    onWorkflowDelete: {
      action: 'workflowDeleted',
      description: 'Callback when a workflow is deleted',
    },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    providers: mockProviders,
    workflows: mockWorkflows,
    onProviderCreate: fn(),
    onProviderUpdate: fn(),
    onProviderDelete: fn(),
    onWorkflowCreate: fn(),
    onWorkflowUpdate: fn(),
    onWorkflowDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default state of the AdminModal with both providers and workflows loaded.',
      },
    },
  },
  render: (args: any) => <AdminModal {...args} />,
};

// Empty state
export const Empty: Story = {
  args: {
    providers: [],
    workflows: [],
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminModal showing empty state when no providers or workflows are available.',
      },
    },
  },
  render: (args: any) => <AdminModal {...args} />,
};

// Loading state
export const Loading: Story = {
  args: {
    providers: mockProviders,
    workflows: mockWorkflows,
  },
  render: (args: any) => (
    <div className="animate-pulse">
      <AdminModal {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'AdminModal in loading state with skeleton placeholders.',
      },
    },
  },
};

// Error state
export const Error: Story = {
  render: (args) => (
    <AdminModal
      {...args}
      providers={mockProviders}
      workflows={mockWorkflows}
      error="Failed to load data. Please try again."
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'AdminModal showing error state with retry functionality.',
      },
    },
  },
};

// Mobile view
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    docs: {
      description: {
        story: 'AdminModal optimized for mobile devices with responsive layout.',
      },
    },
  },
};

// Dark theme
export const Dark: Story = {
  parameters: {
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        story: 'AdminModal with dark theme applied.',
      },
    },
  },
};

// Large dataset
export const LargeDataset: Story = {
  args: {
    providers: Array.from({ length: 50 }, (_, i) => ({
      id: `provider-${i}`,
      name: `Provider ${i + 1}`,
      type: ['openai', 'anthropic', 'google'][i % 3],
      config: { apiKey: `sk-${i}...`, model: `model-${i}` },
      enabled: i % 2 === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    workflows: Array.from({ length: 100 }, (_, i) => ({
      id: `workflow-${i}`,
      name: `Workflow ${i + 1}`,
      description: `Description for workflow ${i + 1}`,
      providerId: `provider-${i % 10}`,
      config: { prompt: `Prompt for workflow ${i}`, temperature: 0.5 },
      enabled: i % 3 === 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminModal handling large datasets with virtualization and pagination.',
      },
    },
  },
};

// With search active
export const WithSearch: Story = {
  render: (args: any) => {
    const SearchWrapper = () => {
      const [searchTerm, setSearchTerm] = React.useState('OpenAI');
      
      const filteredProviders = args.providers.filter((p: any) => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      return (
        <div>
          <div className="mb-4 p-4 bg-gray-100 rounded">
            <label className="block text-sm font-medium mb-2">Search Term:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border rounded"
              placeholder="Search providers..."
            />
          </div>
          <AdminModal {...args} providers={filteredProviders} />
        </div>
      );
    };
    
    return <SearchWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminModal with active search filtering.',
      },
    },
  },
};

// With filters applied
export const WithFilters: Story = {
  render: (args: any) => {
    const FiltersWrapper = () => {
      const [filterType, setFilterType] = React.useState('openai');
      
      const filteredProviders = args.providers.filter((p: any) => 
        p.type === filterType
      );
      
      return (
        <div>
          <div className="mb-4 p-4 bg-gray-100 rounded">
            <label className="block text-sm font-medium mb-2">Filter by Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded"
              title="Filter providers by type"
              aria-label="Filter providers by type"
            >
              <option value="all">All Types</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </div>
          <AdminModal {...args} providers={filteredProviders} />
        </div>
      );
    };
    
    return <FiltersWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminModal with type filters applied.',
      },
    },
  },
};

// Form validation
export const FormValidation: Story = {
  render: (args: any) => {
    const FormValidationWrapper = () => {
      const [_formData, _setFormData] = React.useState({
        name: '',
        type: 'openai',
        config: { apiKey: '', model: 'gpt-4' },
      });
      
      const [_errors, _setErrors] = React.useState({
        name: 'Name is required',
        'config.apiKey': 'API key is required',
      });
      
      return (
        <div>
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
            <h3 className="font-medium text-red-800 mb-2">Form Validation Errors:</h3>
            <ul className="text-sm text-red-700">
              {Object.entries(_errors).map(([field, error]) => (
                <li key={field}>{field}: {error}</li>
              ))}
            </ul>
          </div>
          <AdminModal {...args} />
        </div>
      );
    };
    
    return <FormValidationWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminModal showing form validation errors.',
      },
    },
  },
};

// Success state
export const Success: Story = {
  render: (args: any) => {
    const SuccessWrapper = () => {
      const [showSuccess, setShowSuccess] = React.useState(true);
      
      return (
        <div>
          {showSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-800">Provider created successfully!</span>
                </div>
                <button
                  onClick={() => setShowSuccess(false)}
                  className="text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <AdminModal {...args} />
        </div>
      );
    };
    
    return <SuccessWrapper />;
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminModal showing success message after operation.',
      },
    },
  },
};
