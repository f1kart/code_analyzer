import { describe, it, expect, beforeEach, jest } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import ProvidersTab from '../ProvidersTab';
import * as adminQueries from '../../hooks/adminQueries';
import { mockProviders } from '../../../test/utils/test-utils';

// Mock the hooks
jest.mock('../../hooks/adminQueries');
const mockAdminQueries = adminQueries as jest.Mocked<typeof adminQueries>;

describe('ProvidersTab', () => {
  const mockShowToast = jest.fn();
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAdminQueries.useProvidersQuery.mockReturnValue({
      data: mockProviders,
      isLoading: false,
      refetch: mockRefetch,
    } as any);

    mockAdminQueries.useCreateProviderMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(mockProviders[0]),
      isPending: false,
    } as any);

    mockAdminQueries.useDeleteProviderMutation.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
    } as any);
  });

  it('should render providers list', () => {
    render(<ProvidersTab showToast={mockShowToast} />);

    expect(screen.getByText('Model Providers')).toBeInTheDocument();
    expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument();
    expect(screen.getByText('Gemini Pro')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockAdminQueries.useProvidersQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: mockRefetch,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    expect(screen.getByText('Loading providers…')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    mockAdminQueries.useProvidersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    expect(screen.getByText('No providers configured yet.')).toBeInTheDocument();
  });

  it('should create new provider', async () => {
    const user = userEvent.setup();
    const mockCreate = jest.fn().mockResolvedValue(mockProviders[0]);
    mockAdminQueries.useCreateProviderMutation.mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    // Fill form
    await user.type(screen.getByPlaceholderText('Provider name'), 'New Provider');
    await user.selectOptions(screen.getByDisplayValue('OpenAI'), 'openai');
    await user.type(screen.getByPlaceholderText('Model ID'), 'gpt-3.5-turbo');

    // Submit form
    await user.click(screen.getByText('Add Provider'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'New Provider',
        provider: 'openai',
        modelId: 'gpt-3.5-turbo',
        baseUrl: '',
        apiKeyRef: '',
      });
    });

    expect(mockShowToast).toHaveBeenCalledWith('success', 'Provider \'OpenAI GPT-4\' added.');
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    
    render(<ProvidersTab showToast={mockShowToast} />);

    // Try to submit without required fields
    await user.click(screen.getByText('Add Provider'));

    expect(mockShowToast).toHaveBeenCalledWith('warning', 'Provider name and model ID are required.');
  });

  it('should handle create provider error', async () => {
    const user = userEvent.setup();
    const mockCreate = jest.fn().mockRejectedValue(new Error('Creation failed'));
    mockAdminQueries.useCreateProviderMutation.mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    await user.type(screen.getByPlaceholderText('Provider name'), 'New Provider');
    await user.type(screen.getByPlaceholderText('Model ID'), 'gpt-3.5-turbo');
    await user.click(screen.getByText('Add Provider'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'Failed to create provider: Creation failed');
    });
  });

  it('should delete provider', async () => {
    const user = userEvent.setup();
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    mockAdminQueries.useDeleteProviderMutation.mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    // Click delete button
    await user.click(screen.getAllByText('×')[0]);

    // Confirm dialog should appear
    expect(screen.getByText('Delete Provider?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();

    // Confirm deletion
    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1);
    });

    expect(mockShowToast).toHaveBeenCalledWith('success', 'Provider deleted.');
  });

  it('should cancel provider deletion', async () => {
    const user = userEvent.setup();
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    mockAdminQueries.useDeleteProviderMutation.mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    await user.click(screen.getAllByText('×')[0]);
    await user.click(screen.getByText('Cancel'));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should handle delete provider error', async () => {
    const user = userEvent.setup();
    const mockDelete = jest.fn().mockRejectedValue(new Error('Delete failed'));
    mockAdminQueries.useDeleteProviderMutation.mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    await user.click(screen.getAllByText('×')[0]);
    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'Failed to delete provider: Delete failed');
    });
  });

  it('should clear form after successful creation', async () => {
    const user = userEvent.setup();
    const mockCreate = jest.fn().mockResolvedValue(mockProviders[0]);
    mockAdminQueries.useCreateProviderMutation.mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    } as any);

    render(<ProvidersTab showToast={mockShowToast} />);

    await user.type(screen.getByPlaceholderText('Provider name'), 'New Provider');
    await user.type(screen.getByPlaceholderText('Model ID'), 'gpt-3.5-turbo');
    await user.click(screen.getByText('Add Provider'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Provider name')).toHaveValue('');
      expect(screen.getByPlaceholderText('Model ID')).toHaveValue('');
    });
  });

  it('should refresh providers list', async () => {
    render(<ProvidersTab showToast={mockShowToast} />);

    await userEvent.click(screen.getByTitle('Refresh providers'));

    expect(mockRefetch).toHaveBeenCalled();
  });
});
