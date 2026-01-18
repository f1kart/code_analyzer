import React from 'react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: any[];
  workflows: any[];
  onProviderCreate?: (provider: any) => void;
  onProviderUpdate?: (provider: any) => void;
  onProviderDelete?: (id: string) => void;
  onWorkflowCreate?: (workflow: any) => void;
  onWorkflowUpdate?: (workflow: any) => void;
  onWorkflowDelete?: (id: string) => void;
  error?: string;
}

// Simple AdminModal component for Storybook documentation
const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  providers,
  workflows,
  onProviderCreate,
  onProviderUpdate,
  onProviderDelete,
  onWorkflowCreate,
  onWorkflowUpdate,
  onWorkflowDelete,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Admin Panel</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                title="Close admin panel"
                aria-label="Close admin panel"
              >
                ×
              </button>
            </div>
          </div>
          
          {error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-200">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="p-6">
            <div className="space-y-6">
              {/* Providers Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Providers ({providers.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers.map((provider) => (
                    <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{provider.name}</h4>
                      <p className="text-sm text-gray-600">{provider.type}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => onProviderUpdate?.(provider)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onProviderDelete?.(provider.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflows Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Workflows ({workflows.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workflows.map((workflow) => (
                    <div key={workflow.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{workflow.name}</h4>
                      <p className="text-sm text-gray-600">{workflow.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {workflow.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => onWorkflowUpdate?.(workflow)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onWorkflowDelete?.(workflow.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => onProviderCreate?.({ name: 'New Provider', type: 'openai' })}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Provider
              </button>
              <button
                onClick={() => onWorkflowCreate?.({ name: 'New Workflow', description: 'New workflow description' })}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add Workflow
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
