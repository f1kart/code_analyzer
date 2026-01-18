import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminService } from '../../../services/adminService';
import { useProvidersQuery, useWorkflowsQuery } from '../hooks/adminQueries';

const OperationsTab: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminService.getStats(),
  });

  const { data: alerts } = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: () => adminService.getAlerts(),
  });

  const { data: providers } = useProvidersQuery();
  const { data: workflows } = useWorkflowsQuery();

  return (
    <div className="space-y-4">
      <section className="bg-panel border border-border rounded-md p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Infrastructure Health</h3>
        {!stats ? (
          <p className="text-xs text-text-secondary">Loading infrastructure stats…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-xs text-text-primary">
            <div>
              <div className="font-medium">System Health</div>
              <div className="text-text-secondary capitalize">{stats.systemHealth}</div>
            </div>
            <div>
              <div className="font-medium">Uptime</div>
              <div className="text-text-secondary">{stats.uptime}</div>
            </div>
            <div>
              <div className="font-medium">API Requests</div>
              <div className="text-text-secondary">{stats.apiRequests}</div>
            </div>
            <div>
              <div className="font-medium">Error Rate</div>
              <div className="text-text-secondary">{stats.errorRate.toFixed(2)}%</div>
            </div>
            <div>
              <div className="font-medium">CPU Usage</div>
              <div className="text-text-secondary">{stats.cpuUsage.toFixed(1)}%</div>
            </div>
            <div>
              <div className="font-medium">Memory Usage</div>
              <div className="text-text-secondary">{stats.memoryUsage.toFixed(1)}%</div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-panel border border-border rounded-md p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Diagnostics</h3>
        {!alerts ? (
          <p className="text-xs text-text-secondary">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <p className="text-xs text-text-secondary">No active alerts.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="bg-panel-light rounded p-2 flex justify-between items-start"
              >
                <div>
                  <div className="font-medium">
                    [{alert.type.toUpperCase()}] {alert.title}
                  </div>
                  <div className="text-text-secondary">{alert.message}</div>
                </div>
                <span className="text-[10px] text-text-secondary">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-panel border border-border rounded-md p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Cost Optimization</h3>
        <p className="text-xs text-text-secondary">
          Overview of configured providers and workflows to help you tune cost and complexity.
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs text-text-primary">
          <div>
            <div className="font-medium">Providers</div>
            <div className="text-text-secondary">
              {providers ? providers.length : '…'} configured
            </div>
          </div>
          <div>
            <div className="font-medium">Workflows</div>
            <div className="text-text-secondary">
              {workflows ? workflows.length : '…'} defined
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OperationsTab;
