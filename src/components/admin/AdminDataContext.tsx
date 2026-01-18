import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as adminSvc from '../../services/adminService';
import { ToastType } from './adminModalShared';

interface AdminDataContextValue {
  providers: adminSvc.ModelProvider[] | null;
  isLoadingProviders: boolean;
  loadProviders: () => Promise<void>;
  setProviders: React.Dispatch<React.SetStateAction<adminSvc.ModelProvider[] | null>>;
}

interface AdminDataProviderProps {
  isModalOpen: boolean;
  showToast: (type: ToastType, message: string, duration?: number) => void;
  children: React.ReactNode;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export const AdminDataProvider: React.FC<AdminDataProviderProps> = ({
  isModalOpen,
  showToast,
  children,
}) => {
  const [providers, setProviders] = useState<adminSvc.ModelProvider[] | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  const loadProviders = useCallback(async () => {
    try {
      setIsLoadingProviders(true);
      const providerItems = await adminSvc.listProviders();
      setProviders(providerItems);
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders([]);
      showToast('error', `Failed to load providers: ${(error as Error).message}`);
    } finally {
      setIsLoadingProviders(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }
    loadProviders().catch((error) => console.error(error));
  }, [isModalOpen, loadProviders]);

  const value = useMemo(
    () => ({ providers, isLoadingProviders, loadProviders, setProviders }),
    [providers, isLoadingProviders, loadProviders],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
};

export const useAdminData = (): AdminDataContextValue => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
};
