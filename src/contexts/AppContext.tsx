import React, { createContext, useContext, ReactNode } from 'react';
import { ToastMessage } from '../components/ToastNotification';
import { AppSettings } from '../utils/sessionManager';

// Global Context Types
interface AppContextType {
  // Toast Management
  addToast: (message: string, type: ToastMessage['type']) => void;

  // Loading State Management
  setLoadingState: (action: string, value: boolean) => void;
  isGlobalLoading: boolean;

  // App Settings
  appSettings: AppSettings;
  setAppSettings: (settings: AppSettings) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
  value: AppContextType;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, value }) => {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
