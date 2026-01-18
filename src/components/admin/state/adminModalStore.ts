import { create } from 'zustand';
import { TABS, type Toast, type ToastType, type ConfirmDialogState } from '../adminModalShared';

interface AdminModalStore {
  activeTab: string;
  selectedAgent: string | null;
  toasts: Toast[];
  confirmDialog: ConfirmDialogState | null;
  setActiveTab: (tabId: string) => void;
  setSelectedAgent: (role: string | null) => void;
  showToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  showConfirmDialog: (params: {
    title: string;
    message: string;
    onConfirm: () => void;
  }) => void;
  closeConfirmDialog: () => void;
  resetUiState: () => void;
}

const generateToastId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useAdminModalStore = create<AdminModalStore>((set, get) => ({
  activeTab: TABS.GENERAL,
  selectedAgent: null,
  toasts: [],
  confirmDialog: null,
  setActiveTab: (tabId) => set({ activeTab: tabId }),
  setSelectedAgent: (role) => set({ selectedAgent: role }),
  showToast: (type, message, duration = 4000) => {
    const id = generateToastId();
    const toast: Toast = { id, type, message, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (duration > 0) {
      setTimeout(() => {
        const { removeToast } = get();
        removeToast(id);
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  showConfirmDialog: ({ title, message, onConfirm }) => {
    const handleClose = () => set({ confirmDialog: null });
    const wrappedOnConfirm = () => {
      try {
        onConfirm();
      } finally {
        handleClose();
      }
    };

    set({
      confirmDialog: {
        isOpen: true,
        title,
        message,
        onConfirm: wrappedOnConfirm,
        onCancel: handleClose,
      },
    });
  },
  closeConfirmDialog: () => set({ confirmDialog: null }),
  resetUiState: () =>
    set({
      activeTab: TABS.GENERAL,
      selectedAgent: null,
      toasts: [],
      confirmDialog: null,
    }),
}));
