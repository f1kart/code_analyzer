import type { LogVerbosity } from './sessionManager';

const LOG_VERBOSITY_STORAGE_KEY = 'ide-log-verbosity';

const parseLogVerbosity = (value: unknown): LogVerbosity | null => {
  if (value === 'debug' || value === 'normal') {
    return value;
  }
  return null;
};

export const getCurrentLogVerbosity = (): LogVerbosity => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return 'normal';
    }
    const stored = localStorage.getItem(LOG_VERBOSITY_STORAGE_KEY);
    const parsed = parseLogVerbosity(stored);
    return parsed ?? 'normal';
  } catch {
    return 'normal';
  }
};

export const isDebugLoggingEnabled = (): boolean =>
  getCurrentLogVerbosity() === 'debug';

export const logDebug = (...args: unknown[]): void => {
  if (!isDebugLoggingEnabled()) {
    return;
  }
  console.log(...args);
};

export const logInfo = (...args: unknown[]): void => {
  console.log(...args);
};

export const logWarn = (...args: unknown[]): void => {
  console.warn(...args);
};

export const logError = (...args: unknown[]): void => {
  console.error(...args);
};

export const LOG_VERBOSITY_KEY = LOG_VERBOSITY_STORAGE_KEY;
