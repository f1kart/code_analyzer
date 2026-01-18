import React from 'react';

import { Toast } from './adminModalShared';

interface ToastStackProps {
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
}

const ToastStack: React.FC<ToastStackProps> = ({ toasts, onRemoveToast }) => (
  <div className="fixed bottom-4 right-4 space-y-2">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`relative px-4 py-3 rounded-md shadow-lg text-white text-sm flex items-center gap-3 ${
          toast.type === 'success'
            ? 'bg-green-600'
            : toast.type === 'error'
              ? 'bg-red-600'
              : toast.type === 'warning'
                ? 'bg-yellow-600'
                : 'bg-blue-600'
        }`}
      >
        <span>{toast.message}</span>
        <button
          type="button"
          onClick={() => onRemoveToast(toast.id)}
          className="absolute top-1 right-1 text-lg leading-none px-2 py-1 rounded-full hover:bg-white/20"
          aria-label="Dismiss toast"
        >
          &times;
        </button>
      </div>
    ))}
  </div>
);

export default ToastStack;
