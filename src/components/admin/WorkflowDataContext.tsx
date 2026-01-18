import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as adminSvc from '../../services/adminService';
import { defaultWorkflowDefinition, ToastType } from './adminModalShared';

export interface WorkflowFormState {
  name: string;
  definition: string;
  isSubmitting: boolean;
}

interface WorkflowDataContextValue {
  workflows: adminSvc.Workflow[] | null;
  isLoadingWorkflows: boolean;
  loadWorkflows: () => Promise<void>;
  setWorkflows: React.Dispatch<React.SetStateAction<adminSvc.Workflow[] | null>>;
  selectedWorkflowId: number | null;
  setSelectedWorkflowId: React.Dispatch<React.SetStateAction<number | null>>;
  workflowForm: WorkflowFormState;
  setWorkflowForm: React.Dispatch<React.SetStateAction<WorkflowFormState>>;
  resetWorkflowForm: () => void;
  resetWorkflowState: () => void;
  agentMaps: adminSvc.AgentModelMap[];
  setAgentMaps: React.Dispatch<React.SetStateAction<adminSvc.AgentModelMap[]>>;
}

interface WorkflowDataProviderProps {
  isModalOpen: boolean;
  showToast: (type: ToastType, message: string, duration?: number) => void;
  children: React.ReactNode;
}

const defaultWorkflowForm: WorkflowFormState = {
  name: '',
  definition: defaultWorkflowDefinition,
  isSubmitting: false,
};

const WorkflowDataContext = createContext<WorkflowDataContextValue | null>(null);

export const WorkflowDataProvider: React.FC<WorkflowDataProviderProps> = ({
  isModalOpen,
  showToast,
  children,
}) => {
  const [workflows, setWorkflows] = useState<adminSvc.Workflow[] | null>(null);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>({ ...defaultWorkflowForm });
  const [agentMaps, setAgentMaps] = useState<adminSvc.AgentModelMap[]>([]);

  const resetWorkflowForm = useCallback(
    () => setWorkflowForm({ ...defaultWorkflowForm }),
    [],
  );

  const resetWorkflowState = useCallback(() => {
    setSelectedWorkflowId(null);
    setWorkflowForm({ ...defaultWorkflowForm });
    setAgentMaps([]);
  }, []);

  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoadingWorkflows(true);
      const workflowItems = await adminSvc.listWorkflows();
      setWorkflows(workflowItems);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setWorkflows([]);
      showToast('error', `Failed to load workflows: ${(error as Error).message}`);
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isModalOpen) {
      setWorkflows(null);
      resetWorkflowState();
      return;
    }
    loadWorkflows().catch((error) => console.error(error));
  }, [isModalOpen, loadWorkflows, resetWorkflowState]);
  const value = useMemo(
    () => ({
      workflows,
      isLoadingWorkflows,
      loadWorkflows,
      setWorkflows,
      selectedWorkflowId,
      setSelectedWorkflowId,
      workflowForm,
      setWorkflowForm,
      resetWorkflowForm,
      resetWorkflowState,
      agentMaps,
      setAgentMaps,
    }),
    [
      workflows,
      isLoadingWorkflows,
      loadWorkflows,
      selectedWorkflowId,
      workflowForm,
      resetWorkflowForm,
      resetWorkflowState,
      agentMaps,
    ],
  );

  return <WorkflowDataContext.Provider value={value}>{children}</WorkflowDataContext.Provider>;
};

export const useWorkflowData = (): WorkflowDataContextValue => {
  const context = useContext(WorkflowDataContext);
  if (!context) {
    throw new Error('useWorkflowData must be used within a WorkflowDataProvider');
  }
  return context;
};
