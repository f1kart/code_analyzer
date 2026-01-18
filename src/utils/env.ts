/**
 * Checks if the application is running in a true Electron desktop environment.
 * It does this by checking if the `electronAPI` object, which is exposed by the
 * preload script, exists on the window object.
 * @returns {boolean} True if in the Electron environment, false otherwise.
 */
import { getElectronAPI } from './electronBridge';

export const isDesktopApp = (): boolean => {
  return getElectronAPI() !== undefined;
};
