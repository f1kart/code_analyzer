import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as adminSvc from '../../../services/adminService';

const PROVIDERS_QUERY_KEY = ['admin', 'providers'] as const;
export const WORKFLOWS_QUERY_KEY = ['admin', 'workflows'] as const;

const agentMapsKey = (workflowId: number) => ['admin', 'agentMaps', workflowId] as const;

// Providers -----------------------------------------------------------------

export const useProvidersQuery = () => {
  return useQuery<adminSvc.ModelProvider[]>({
    queryKey: PROVIDERS_QUERY_KEY,
    queryFn: () => adminSvc.listProviders(),
  });
};

export const useCreateProviderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<adminSvc.ModelProvider, Error, adminSvc.CreateProviderInput>({
    mutationFn: (input: adminSvc.CreateProviderInput) => adminSvc.createProvider(input),
    onSuccess: (created: adminSvc.ModelProvider) => {
      queryClient.setQueryData<adminSvc.ModelProvider[] | undefined>(
        PROVIDERS_QUERY_KEY,
        (prev: adminSvc.ModelProvider[] | undefined) => (prev ? [created, ...prev] : [created]),
      );
    },
  });
};

export const useDeleteProviderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id: number) => adminSvc.deleteProvider(id),
    onSuccess: (_data: void, id: number) => {
      queryClient.setQueryData<adminSvc.ModelProvider[] | undefined>(
        PROVIDERS_QUERY_KEY,
        (prev: adminSvc.ModelProvider[] | undefined) =>
          prev?.filter((provider) => provider.id !== id) ?? [],
      );
    },
  });
};

// Workflows ------------------------------------------------------------------

export const useWorkflowsQuery = () => {
  return useQuery<adminSvc.Workflow[]>({
    queryKey: WORKFLOWS_QUERY_KEY,
    queryFn: () => adminSvc.listWorkflows(),
  });
};

export const useCreateWorkflowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<adminSvc.Workflow, Error, adminSvc.CreateWorkflowInput>({
    mutationFn: (input: adminSvc.CreateWorkflowInput) => adminSvc.createWorkflow(input),
    onSuccess: (created: adminSvc.Workflow) => {
      queryClient.setQueryData<adminSvc.Workflow[] | undefined>(
        WORKFLOWS_QUERY_KEY,
        (prev: adminSvc.Workflow[] | undefined) => (prev ? [created, ...prev] : [created]),
      );
    },
  });
};

export const useUpdateWorkflowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<
    adminSvc.Workflow,
    Error,
    { id: number; input: adminSvc.UpdateWorkflowInput }
  >({
    mutationFn: (variables) => adminSvc.updateWorkflow(variables.id, variables.input),
    onSuccess: (updated: adminSvc.Workflow) => {
      queryClient.setQueryData<adminSvc.Workflow[] | undefined>(
        WORKFLOWS_QUERY_KEY,
        (prev: adminSvc.Workflow[] | undefined) =>
          prev?.map((workflow) => (workflow.id === updated.id ? updated : workflow)) ?? [updated],
      );
    },
  });
};

export const useDeleteWorkflowMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id: number) => adminSvc.deleteWorkflow(id),
    onSuccess: (_data: void, id: number) => {
      queryClient.setQueryData<adminSvc.Workflow[] | undefined>(
        WORKFLOWS_QUERY_KEY,
        (prev: adminSvc.Workflow[] | undefined) =>
          prev?.filter((workflow) => workflow.id !== id) ?? [],
      );
      queryClient.removeQueries({ queryKey: agentMapsKey(id) });
    },
  });
};

// Agent maps -----------------------------------------------------------------

export const useAgentMapsQuery = (workflowId: number | null) => {
  return useQuery<adminSvc.AgentModelMap[]>({
    queryKey: workflowId != null ? agentMapsKey(workflowId) : ['admin', 'agentMaps', 'none'],
    enabled: workflowId != null,
    queryFn: () => adminSvc.listAgentMaps(workflowId as number),
  });
};

export const useSetAgentMapMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<adminSvc.AgentModelMap, Error, adminSvc.SetAgentMapInput>({
    mutationFn: (input: adminSvc.SetAgentMapInput) => adminSvc.setAgentMap(input),
    onSuccess: (updated: adminSvc.AgentModelMap, variables: adminSvc.SetAgentMapInput) => {
      const key = agentMapsKey(variables.workflowId);
      queryClient.setQueryData<adminSvc.AgentModelMap[] | undefined>(
        key,
        (prev: adminSvc.AgentModelMap[] | undefined) => {
          const others = (prev ?? []).filter((map) => map.agentRole !== updated.agentRole);
          return [...others, updated];
        },
      );
    },
  });
};
