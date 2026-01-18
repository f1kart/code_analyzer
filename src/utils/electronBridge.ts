export type ElectronBridge = Window['electronAPI'];

export const getElectronAPI = (): ElectronBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.electronAPI;
};

export const requireElectronAPI = (): ElectronBridge => {
  const api = getElectronAPI();
  if (!api) {
    throw new Error('Electron API is not available in this environment.');
  }
  return api;
};

export const isElectronAvailable = (): boolean => getElectronAPI() !== undefined;
