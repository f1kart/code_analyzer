import React from 'react';

import { ConfirmDialogState } from './adminModalShared';

interface ConfirmDialogProps {
  dialog: ConfirmDialogState | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ dialog, onConfirm, onCancel }) => {
  if (!dialog?.isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-100">{dialog.title}</h3>
        <p className="text-sm text-gray-300">{dialog.message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium bg-gray-600 hover:bg-gray-700 rounded-md"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 rounded-md"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
