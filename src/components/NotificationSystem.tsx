import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // in milliseconds, 0 for persistent
  actions?: NotificationAction[];
  dismissible?: boolean;
  timestamp: number;
}

export interface NotificationAction {
  label: string;
  action: () => void | Promise<void>;
  style?: 'primary' | 'secondary' | 'danger';
}

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction: (id: string, action: NotificationAction) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onAction,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  }, [notification.id, onDismiss]);

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notification.duration, handleDismiss]);

  const handleAction = useCallback(
    async (action: NotificationAction) => {
      try {
        await action.action();
        onAction(notification.id, action);
      } catch (error) {
        console.error('Notification action failed:', error);
      }
    },
    [notification.id, onAction],
  );

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return (
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className="w-5 h-5 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'info':
        return 'border-blue-500';
    }
  };

  const getActionButtonStyle = (style?: string) => {
    switch (style) {
      case 'primary':
        return 'bg-brand-blue hover:bg-blue-600 text-white';
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'secondary':
      default:
        return 'bg-panel-light hover:bg-panel text-text-primary border border-border';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out mb-3
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div
        className={`
        bg-panel border-l-4 ${getBorderColor()} rounded-lg shadow-lg p-4 min-w-80 max-w-md
        border border-border backdrop-blur-sm
      `}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-text-primary">{notification.title}</h4>
                {notification.message && (
                  <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                    {notification.message}
                  </p>
                )}
              </div>

              {/* Dismiss Button */}
              {notification.dismissible !== false && (
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 ml-2 p-1 rounded hover:bg-interactive text-text-tertiary hover:text-text-primary transition-colors"
                  title="Dismiss"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {notification.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleAction(action)}
                    className={`
                      px-3 py-1.5 text-xs font-medium rounded transition-colors
                      ${getActionButtonStyle(action.style)}
                    `}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-text-tertiary mt-2">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onAction: (id: string, action: NotificationAction) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
  onAction,
  position = 'top-right',
  maxNotifications = 5,
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
      default:
        return 'top-4 right-4';
    }
  };

  const visibleNotifications = notifications.slice(0, maxNotifications);

  if (visibleNotifications.length === 0) return null;

  const notificationContainer = (
    <div className={`fixed ${getPositionClasses()} z-50 pointer-events-none`}>
      <div className="pointer-events-auto">
        {visibleNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );

  return createPortal(notificationContainer, document.body);
};

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (
      type: Notification['type'],
      title: string,
      options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'timestamp'>>,
    ) => {
      const notification: Notification = {
        id: `notification-${Date.now()}-${Math.random()}`,
        type,
        title,
        timestamp: Date.now(),
        duration: type === 'error' ? 0 : 5000, // Errors persist by default
        dismissible: true,
        ...options,
      };

      setNotifications((prev) => [notification, ...prev]);
      return notification.id;
    },
    [],
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleAction = useCallback(
    (id: string, _action: NotificationAction) => {
      // Optionally remove notification after action
      removeNotification(id);
    },
    [removeNotification],
  );

  // Convenience methods
  const showSuccess = useCallback(
    (
      title: string,
      options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'timestamp'>>,
    ) => {
      return addNotification('success', title, options);
    },
    [addNotification],
  );

  const showError = useCallback(
    (
      title: string,
      options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'timestamp'>>,
    ) => {
      return addNotification('error', title, options);
    },
    [addNotification],
  );

  const showWarning = useCallback(
    (
      title: string,
      options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'timestamp'>>,
    ) => {
      return addNotification('warning', title, options);
    },
    [addNotification],
  );

  const showInfo = useCallback(
    (
      title: string,
      options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'timestamp'>>,
    ) => {
      return addNotification('info', title, options);
    },
    [addNotification],
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    handleAction,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
