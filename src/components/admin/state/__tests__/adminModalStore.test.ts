import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdminModalStore } from '../adminModalStore';
import { TABS } from '../../adminModalShared';

describe('AdminModalStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAdminModalStore.setState({
      activeTab: TABS.GENERAL,
      selectedAgent: null,
      toasts: [],
      confirmDialog: null,
    });
  });

  describe('Tab Management', () => {
    it('should set active tab', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.setActiveTab(TABS.PROVIDERS);
      });

      expect(result.current.activeTab).toBe(TABS.PROVIDERS);
    });

    it('should reset tab to default', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.setActiveTab(TABS.WORKFLOWS);
        result.current.resetUiState();
      });

      expect(result.current.activeTab).toBe(TABS.GENERAL);
    });
  });

  describe('Agent Selection', () => {
    it('should set selected agent', () => {
      const { result } = renderHook(() => useAdminModalStore());
      const agent = { id: 'agent-1', role: 'reviewer' };

      act(() => {
        result.current.setSelectedAgent(agent);
      });

      expect(result.current.selectedAgent).toEqual(agent);
    });

    it('should clear selected agent', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.setSelectedAgent({ id: 'agent-1', role: 'reviewer' });
        result.current.setSelectedAgent(null);
      });

      expect(result.current.selectedAgent).toBeNull();
    });
  });

  describe('Toast Management', () => {
    it('should show success toast', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.showToast('success', 'Success message');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        id: expect.any(String),
        type: 'success',
        message: 'Success message',
      });
    });

    it('should show error toast with duration', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.showToast('error', 'Error message', 5000);
      });

      expect(result.current.toasts[0]).toMatchObject({
        type: 'error',
        message: 'Error message',
        duration: 5000,
      });
    });

    it('should remove toast by id', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.showToast('warning', 'Warning message');
        const toastId = result.current.toasts[0].id;
        result.current.removeToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should auto-remove toast after duration', () => {
      const { result } = renderHook(() => useAdminModalStore());
      jest.useFakeTimers();

      act(() => {
        result.current.showToast('info', 'Info message', 1000);
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.toasts).toHaveLength(0);
      jest.useRealTimers();
    });

    it('should not auto-remove toast with no duration', () => {
      const { result } = renderHook(() => useAdminModalStore());
      jest.useFakeTimers();

      act(() => {
        result.current.showToast('info', 'Persistent toast');
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.toasts).toHaveLength(1);
      jest.useRealTimers();
    });
  });

  describe('Confirm Dialog Management', () => {
    it('should show confirm dialog', () => {
      const { result } = renderHook(() => useAdminModalStore());
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      act(() => {
        result.current.showConfirmDialog(
          'Delete item?',
          'Are you sure you want to delete this item?',
          onConfirm,
          onCancel
        );
      });

      expect(result.current.confirmDialog).toMatchObject({
        title: 'Delete item?',
        message: 'Are you sure you want to delete this item?',
        onConfirm,
        onCancel,
      });
    });

    it('should clear confirm dialog', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.showConfirmDialog(
          'Test',
          'Test message',
          jest.fn(),
          jest.fn()
        );
        result.current.clearConfirmDialog();
      });

      expect(result.current.confirmDialog).toBeNull();
    });
  });

  describe('Reset UI State', () => {
    it('should reset all UI state to defaults', () => {
      const { result } = renderHook(() => useAdminModalStore());

      act(() => {
        result.current.setActiveTab(TABS.WORKFLOWS);
        result.current.setSelectedAgent({ id: 'agent-1', role: 'reviewer' });
        result.current.showToast('info', 'Test message');
        result.current.showConfirmDialog('Test', 'Test', jest.fn(), jest.fn());
        result.current.resetUiState();
      });

      expect(result.current.activeTab).toBe(TABS.GENERAL);
      expect(result.current.selectedAgent).toBeNull();
      expect(result.current.toasts).toHaveLength(0);
      expect(result.current.confirmDialog).toBeNull();
    });
  });

  describe('Store Persistence', () => {
    it('should maintain state across hook instances', () => {
      const { result: result1 } = renderHook(() => useAdminModalStore());
      const { result: result2 } = renderHook(() => useAdminModalStore());

      act(() => {
        result1.current.setActiveTab(TABS.PROVIDERS);
      });

      expect(result2.current.activeTab).toBe(TABS.PROVIDERS);
    });
  });
});
