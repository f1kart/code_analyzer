import React, { useCallback } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

import { AgentConfig, AppSettings } from '../../../utils/sessionManager';
import { RESERVED_ROLES, getIntegratorsOrder, computeDraggableAgents, SettingsAction } from '../adminModalShared';

interface TeamTabProps {
  localSettings: AppSettings;
  dispatch: React.Dispatch<SettingsAction>;
}

const TeamTab: React.FC<TeamTabProps> = ({ localSettings, dispatch }) => {
  const draggableAgents = computeDraggableAgents(localSettings.aiTeamConfiguration);

  const handleAgentToggle = useCallback(
    (role: string, enabled: boolean) => {
      const updated = localSettings.aiTeamConfiguration.map((agent) =>
        agent.role === role ? { ...agent, enabled } : agent,
      );
      dispatch({ type: 'REORDER_AGENTS', payload: updated });
    },
    [dispatch, localSettings.aiTeamConfiguration],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const ordered = computeDraggableAgents(localSettings.aiTeamConfiguration);
      const [moved] = ordered.splice(result.source.index, 1);
      ordered.splice(result.destination.index, 0, moved);

      const updated = localSettings.aiTeamConfiguration.map((agent) => {
        if (agent.role === RESERVED_ROLES.BRAINSTORMER) {
          return { ...agent, order: 0 };
        }
        if (agent.role === RESERVED_ROLES.INTEGRATOR) {
          return { ...agent, order: getIntegratorsOrder(localSettings.aiTeamConfiguration) };
        }
        const replacement = ordered.find((candidate) => candidate.role === agent.role);
        return replacement ? { ...agent, order: ordered.indexOf(replacement) + 1 } : agent;
      });

      dispatch({
        type: 'REORDER_AGENTS',
        payload: updated.sort((a, b) => a.order - b.order),
      });
    },
    [dispatch, localSettings.aiTeamConfiguration],
  );

  const renderToggleRow = (agent: AgentConfig, label: string, lockPosition?: string) => (
    <div className="flex items-center justify-between p-2 rounded bg-gray-900/60">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-200">{label}</span>
        {lockPosition && <span className="text-xs text-gray-400">{lockPosition}</span>}
      </div>
      <input
        id={`locked-agent-toggle-${agent.role}`}
        type="checkbox"
        className="h-4 w-4 rounded"
        checked={agent.enabled}
        onChange={(event) => handleAgentToggle(agent.role, event.target.checked)}
        title={`Toggle ${agent.role} agent`}
        aria-label={`Enable or disable ${agent.role} agent`}
      />
    </div>
  );

  const brainstormer = localSettings.aiTeamConfiguration.find(
    (agent) => agent.role === RESERVED_ROLES.BRAINSTORMER,
  );
  const integrator = localSettings.aiTeamConfiguration.find(
    (agent) => agent.role === RESERVED_ROLES.INTEGRATOR,
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Enable the personas that should participate in the refactoring workflow. Drag agents to
        adjust their execution order. The Brainstormer always leads, and the Integrator always wraps
        up the process.
      </p>

      {brainstormer &&
        renderToggleRow(brainstormer, `${brainstormer.role}`, 'Always first in the workflow')}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="ai-team-droppable">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {draggableAgents.map((agent, index) => (
                <Draggable draggableId={agent.role} index={index} key={agent.role}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`flex items-center justify-between p-2 rounded border transition-colors ${
                        snapshot.isDragging
                          ? 'border-brand-blue bg-gray-800'
                          : 'border-transparent bg-gray-900/60'
                      }`}
                    >
                      <span className="text-sm text-gray-200">{agent.role}</span>
                      <input
                        id={`draggable-agent-toggle-${agent.role}`}
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={agent.enabled}
                        onChange={(event) => handleAgentToggle(agent.role, event.target.checked)}
                        title={`Toggle ${agent.role} agent`}
                        aria-label={`Enable or disable ${agent.role} agent`}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {integrator &&
        renderToggleRow(integrator, `${integrator.role}`, 'Always last in the workflow')}
    </div>
  );
};

export default TeamTab;
