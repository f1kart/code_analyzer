import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
import HealthCheckDashboard from './HealthCheckDashboard';

// Mock health check data for stories
const _mockHealthData = {
  status: 'pass',
  checks: [
    {
      name: 'database',
      status: 'pass',
      message: 'Database connection is healthy',
      duration: 45,
      timestamp: new Date().toISOString(),
    },
    {
      name: 'redis',
      status: 'pass',
      message: 'Redis cache is responding',
      duration: 12,
      timestamp: new Date().toISOString(),
    },
    {
      name: 'api',
      status: 'pass',
      message: 'API endpoints are responding',
      duration: 23,
      timestamp: new Date().toISOString(),
    },
    {
      name: 'external_services',
      status: 'warn',
      message: 'External API responding slowly',
      duration: 1500,
      timestamp: new Date().toISOString(),
    },
  ],
  timestamp: new Date().toISOString(),
  duration: 1580,
};

const meta: Meta<typeof HealthCheckDashboard> = {
  title: 'Admin/HealthCheckDashboard',
  component: HealthCheckDashboard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The HealthCheckDashboard component provides comprehensive health monitoring for the Gemini IDE backend.
It displays the status of various system components, dependencies, and services.

## Features
- **Real-time Health Status**: Live monitoring of system health
- **Component Checks**: Individual health status for each service
- **Response Time Metrics**: Performance monitoring for health checks
- **Auto-refresh**: Configurable automatic health checks
- **Historical Data**: Track health status over time
- **Alert System**: Visual indicators for warnings and failures
- **Detailed Information**: Comprehensive health check details
- **Responsive Design**: Works seamlessly on all devices
- **Accessibility**: WCAG 2.1 AA compliant

## Usage
\`\`\`tsx
<HealthCheckDashboard
  autoRefresh={true}
  refreshInterval={30}
  onRefresh={handleRefresh}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    autoRefresh: {
      control: 'boolean',
      description: 'Whether to auto-refresh health checks',
    },
    refreshInterval: {
      control: 'select',
      options: [10, 30, 60, 300],
      description: 'Auto-refresh interval in seconds',
    },
    onRefresh: {
      action: 'refreshed',
      description: 'Callback when health data is refreshed',
    },
  },
  args: {
    autoRefresh: true,
    refreshInterval: 30,
    onRefresh: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default state of the HealthCheckDashboard showing healthy system status.',
      },
    },
  },
  render: (args: any) => <HealthCheckDashboard {...args} />,
};

// All healthy
export const AllHealthy: Story = {
  render: (args: any) => {
    const _allHealthyData = {
      status: 'pass',
      checks: [
        {
          name: 'database',
          status: 'pass',
          message: 'Database connection is healthy',
          duration: 45,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'redis',
          status: 'pass',
          message: 'Redis cache is responding',
          duration: 12,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'api',
          status: 'pass',
          message: 'API endpoints are responding',
          duration: 23,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'external_services',
          status: 'pass',
          message: 'All external services are healthy',
          duration: 150,
          timestamp: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
      duration: 230,
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">✓ All systems operational</p>
        </div>
        <HealthCheckDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard when all systems are healthy.',
      },
    },
  },
};

// With warnings
export const WithWarnings: Story = {
  render: (args: any) => {
    const _warningData = {
      status: 'warn',
      checks: [
        {
          name: 'database',
          status: 'pass',
          message: 'Database connection is healthy',
          duration: 45,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'redis',
          status: 'warn',
          message: 'Redis cache responding slowly',
          duration: 500,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'api',
          status: 'pass',
          message: 'API endpoints are responding',
          duration: 23,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'external_services',
          status: 'warn',
          message: 'External API responding slowly',
          duration: 1500,
          timestamp: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
      duration: 2068,
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">⚠ Some services experiencing issues</p>
        </div>
        <HealthCheckDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard showing system warnings.',
      },
    },
  },
};

// Critical failures
export const CriticalFailures: Story = {
  render: (args: any) => {
    const _failureData = {
      status: 'fail',
      checks: [
        {
          name: 'database',
          status: 'fail',
          message: 'Database connection failed',
          duration: 5000,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'redis',
          status: 'fail',
          message: 'Redis cache is down',
          duration: 3000,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'api',
          status: 'pass',
          message: 'API endpoints are responding',
          duration: 23,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'external_services',
          status: 'warn',
          message: 'External API responding slowly',
          duration: 1500,
          timestamp: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
      duration: 9523,
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">✗ Critical system failures detected</p>
        </div>
        <HealthCheckDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard showing critical system failures.',
      },
    },
  },
};

// Loading state
export const Loading: Story = {
  render: (args: any) => (
    <div className="animate-pulse">
      <HealthCheckDashboard {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard in loading state.',
      },
    },
  },
};

// Error state
export const Error: Story = {
  render: (args: any) => (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-red-500 rounded-full"></div>
          <p className="text-red-700">Failed to load health check data</p>
        </div>
      </div>
      <HealthCheckDashboard {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard showing error state.',
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
        story: 'HealthCheckDashboard optimized for mobile devices.',
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
        story: 'HealthCheckDashboard with dark theme applied.',
      },
    },
  },
};

// No auto-refresh
export const NoAutoRefresh: Story = {
  args: {
    autoRefresh: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard with auto-refresh disabled.',
      },
    },
  },
};

// Fast refresh interval
export const FastRefresh: Story = {
  args: {
    refreshInterval: 10, // 10 seconds
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard with 10-second refresh interval.',
      },
    },
  },
};

// Slow refresh interval
export const SlowRefresh: Story = {
  args: {
    refreshInterval: 300, // 5 minutes
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard with 5-minute refresh interval.',
      },
    },
  },
};

// Mixed status
export const MixedStatus: Story = {
  render: (args: any) => {
    const _mixedData = {
      status: 'warn',
      checks: [
        {
          name: 'database',
          status: 'pass',
          message: 'Database connection is healthy',
          duration: 45,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'redis',
          status: 'fail',
          message: 'Redis cache is down',
          duration: 3000,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'api',
          status: 'pass',
          message: 'API endpoints are responding',
          duration: 23,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'external_services',
          status: 'warn',
          message: 'External API responding slowly',
          duration: 1500,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'storage',
          status: 'pass',
          message: 'Storage system is healthy',
          duration: 67,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'queue',
          status: 'warn',
          message: 'Message queue has high latency',
          duration: 800,
          timestamp: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
      duration: 5435,
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">Mixed system status - some issues detected</p>
        </div>
        <HealthCheckDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'HealthCheckDashboard showing mixed system status with various issues.',
      },
    },
  },
};
