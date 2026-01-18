import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckIcon } from './icons/CheckIcon';
import { CriticIcon } from './icons/CriticIcon'; // Using Critic as an error icon
import { HelpIcon } from './icons/HelpIcon';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastNotificationProps extends ToastMessage {
  onDismiss: (id: number) => void;
}

const icons = {
  success: <CheckIcon className="w-6 h-6 text-brand-green" />,
  error: <CriticIcon className="w-6 h-6 text-brand-red" />,
  info: <HelpIcon className="w-6 h-6 text-brand-blue" />,
};

const bgColor = {
  success: 'bg-green-500/10 border-green-700',
  error: 'bg-red-500/10 border-red-700',
  info: 'bg-blue-500/10 border-blue-700',
};

const textColor = {
  success: 'text-green-300',
  error: 'text-red-300',
  info: 'text-blue-300',
};

const ToastNotification: React.FC<ToastNotificationProps> = ({ id, message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [id, onDismiss]);

  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return null;

  return ReactDOM.createPortal(
    <div
      className={`flex items-start p-4 rounded-lg shadow-lg border ${bgColor[type]} w-80 animate-fade-in-right`}
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <div className="ml-3 w-0 flex-1 pt-0.5">
        <p className={`text-sm font-medium ${textColor[type]}`}>{message}</p>
      </div>
      <div className="ml-4 flex-shrink-0 flex">
        <button
          onClick={() => onDismiss(id)}
          className="inline-flex rounded-md text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue"
        >
          <span className="sr-only">Close</span>
          &times;
        </button>
      </div>
    </div>,
    toastContainer,
  );
};

export default ToastNotification;
