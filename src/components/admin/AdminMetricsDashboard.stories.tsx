import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
import AdminMetricsDashboard from './AdminMetricsDashboard';

// Mock metrics data for stories
const mockMetricsData = {
  counters: {
    'requests_total': 1500,
    'errors_total': 23,
    'providers_created': 45,
    'workflows_executed': 89,
    'users_active': 156,
  },
  histograms: {
    'request_duration': {
      count: 1500,
      sum: 75000,
      avg: 50,
      min: 10,
      max: 500,
    },
    'workflow_execution_time': {
      count: 89,
      sum: 44500,
      avg: 500,
      min: 200,
      max: 2000,
    },
  },
  activeSpans: 5,
  completedSpans: 1495,
  timestamp: new Date().toISOString(),
};

const _mockTimeSeriesData = [
  { timestamp: '2024-01-01T00:00:00Z', value: 120 },
  { timestamp: '2024-01-01T01:00:00Z', value: 150 },
  { timestamp: '2024-01-01T02:00:00Z', value: 180 },
  { timestamp: '2024-01-01T03:00:00Z', value: 140 },
  { timestamp: '2024-01-01T04:00:00Z', value: 200 },
];

const meta: Meta<typeof AdminMetricsDashboard> = {
  title: 'Admin/AdminMetricsDashboard',
  component: AdminMetricsDashboard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The AdminMetricsDashboard component provides comprehensive monitoring and visualization of system metrics.
It displays real-time performance data, charts, and analytics for the Gemini IDE backend.

## Features
- **Real-time Metrics**: Live updates of system performance
- **Interactive Charts**: Visual representations of metrics over time
- **Time Range Selection**: Filter data by different time periods
- **Resource Monitoring**: Track providers, workflows, and user activity
- **Performance Analytics**: Response times, error rates, and throughput
- **Auto-refresh**: Configurable automatic data updates
- **Responsive Design**: Optimized for all screen sizes
- **Accessibility**: WCAG 2.1 AA compliant

## Usage
\`\`\`tsx
<AdminMetricsDashboard
  timeRange="24h"
  autoRefresh={true}
  refreshInterval={30}
  onTimeRangeChange={handleTimeRangeChange}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    timeRange: {
      control: 'select',
      options: ['1h', '24h', '7d', '30d'],
      description: 'Time range for metrics display',
    },
    autoRefresh: {
      control: 'boolean',
      description: 'Whether to auto-refresh metrics',
    },
    refreshInterval: {
      control: 'select',
      options: [10, 30, 60, 300],
      description: 'Auto-refresh interval in seconds',
    },
    onTimeRangeChange: {
      action: 'timeRangeChanged',
      description: 'Callback when time range changes',
    },
  },
  args: {
    timeRange: '24h',
    autoRefresh: true,
    refreshInterval: 30,
    onTimeRangeChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default state of the AdminMetricsDashboard showing 24-hour metrics.',
      },
    },
  },
  render: (args: any) => <AdminMetricsDashboard {...args} />,
};

// Loading state
export const Loading: Story = {
  render: (args: any) => (
    <div className="animate-pulse">
      <AdminMetricsDashboard {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard in loading state with skeleton placeholders.',
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
          <p className="text-red-700">Failed to load metrics data</p>
        </div>
      </div>
      <AdminMetricsDashboard {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing error state with retry functionality.',
      },
    },
  },
};

// No data state
export const NoData: Story = {
  render: (args: any) => (
    <div className="p-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center mb-6">
        <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">No metrics data available</p>
      </div>
      <AdminMetricsDashboard {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard when no metrics data is available.',
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
        story: 'AdminMetricsDashboard optimized for mobile devices.',
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
        story: 'AdminMetricsDashboard with dark theme applied.',
      },
    },
  },
};

// 1 hour time range
export const Hourly: Story = {
  args: {
    timeRange: '1h',
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing metrics for the last hour.',
      },
    },
  },
};

// 7 day time range
export const Weekly: Story = {
  args: {
    timeRange: '7d',
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing metrics for the last 7 days.',
      },
    },
  },
};

// 30 day time range
export const Monthly: Story = {
  args: {
    timeRange: '30d',
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing metrics for the last 30 days.',
      },
    },
  },
};

// Auto-refresh disabled
export const NoAutoRefresh: Story = {
  args: {
    autoRefresh: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard with auto-refresh disabled.',
      },
    },
  },
};

// High activity metrics
export const HighActivity: Story = {
  render: (args: any) => {
    const _highActivityData = {
      ...mockMetricsData,
      counters: {
        'requests_total': 15000,
        'errors_total': 230,
        'providers_created': 450,
        'workflows_executed': 890,
        'users_active': 1560,
      },
      activeSpans: 50,
      completedSpans: 14950,
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">High activity detected - showing elevated metrics</p>
        </div>
        <AdminMetricsDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing high system activity.',
      },
    },
  },
};

// Error spike
export const ErrorSpike: Story = {
  render: (args: any) => {
    const _errorSpikeData = {
      ...mockMetricsData,
      counters: {
        'requests_total': 1500,
        'errors_total': 450, // High error rate
        'providers_created': 45,
        'workflows_executed': 89,
        'users_active': 156,
      },
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800">Error spike detected - 30% error rate</p>
        </div>
        <AdminMetricsDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing error spike in metrics.',
      },
    },
  },
};

// Performance issues
export const PerformanceIssues: Story = {
  render: (args: any) => {
    const _slowPerformanceData = {
      ...mockMetricsData,
      histograms: {
        'request_duration': {
          count: 1500,
          sum: 750000, // Much slower
          avg: 500, // 10x slower
          min: 100,
          max: 5000,
        },
        'workflow_execution_time': {
          count: 89,
          sum: 445000, // Much slower
          avg: 5000, // 10x slower
          min: 2000,
          max: 20000,
        },
      },
    };
    
    return (
      <div className="p-6">
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded">
          <p className="text-orange-800">Performance degradation detected - high response times</p>
        </div>
        <AdminMetricsDashboard {...args} />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard showing performance issues.',
      },
    },
  },
};

// With custom refresh interval
export const CustomRefresh: Story = {
  args: {
    refreshInterval: 10, // 10 seconds
  },
  parameters: {
    docs: {
      description: {
        story: 'AdminMetricsDashboard with custom 10-second refresh interval.',
      },
    },
  },
};
