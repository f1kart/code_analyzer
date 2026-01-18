import { AppFile } from '../utils/sessionManager';
import { isDesktopApp } from '../utils/env';
import { getElectronAPI } from '../utils/electronBridge';

export interface FileSystemEntry {
  name: string;
  path: string;
  relativePath: string;
  absolutePath?: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: number;
  isHidden?: boolean;
  extension?: string;
  children?: FileSystemEntry[];
  isDirectory?: boolean;
  isFile?: boolean;
}

export interface FileWatchEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;
  timestamp: number;
  eventType?: string;
}

export interface FileSystemStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  fileTypes: Record<string, number>;
}

const watcherDisposers = new Map<string, () => Promise<void>>();

/**
 * Opens a native folder selection dialog and reads all files recursively.
 * This is only available in the Electron desktop environment.
 * @returns An object containing the folder path and an array of AppFile objects, or null if canceled.
 */
export const openFolderDialog = async (): Promise<{
  folderPath: string;
  files: AppFile[];
} | null> => {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.openFolderDialog) {
    alert('This feature is only available in the desktop application.');
    return null;
  }
  return electronAPI.openFolderDialog();
};

/**
 * Saves file content to the local file system.
 * This is only available in the Electron desktop environment.
 * @param filePath The full, absolute path of the file to save.
 * @param content The content to write to the file.
 */
export const saveFileContent = async (
  filePath: string,
  content: string,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.saveFileContent) {
    alert('This feature is only available in the desktop application.');
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.saveFileContent(filePath, content);
};

/**
 * Opens a native save dialog to create a new empty file.
 * Only available in the Electron desktop environment.
 * @param projectPath The root path of the current project to default the dialog to.
 * @returns An AppFile object for the new file, or null if canceled.
 */
export const createFile = async (projectPath: string): Promise<AppFile | null> => {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.createFile) {
    alert('This feature is only available in the desktop application.');
    return null;
  }
  return electronAPI.createFile(projectPath);
};

/**
 * Deletes a file from the local file system after confirmation.
 * Only available in the Electron desktop environment.
 * @param projectPath The root path of the current project.
 * @param fileIdentifier The relative path of the file to delete.
 * @returns An object indicating success or failure.
 */
export const deleteFile = async (
  projectPath: string,
  fileIdentifier: string,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.deleteFile) {
    alert('This feature is only available in the desktop application.');
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.deleteFile(projectPath, fileIdentifier);
};

// Enhanced File System Methods

/**
 * Opens a native file selection dialog
 */
export const openFileDialog = async (options?: {
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<{ filePath: string } | null> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.openFileDialog) {
    alert('This feature is only available in the desktop application.');
    return null;
  }
  return electronAPI.openFileDialog(options);
};

/**
 * Reads file content from the file system
 */
export const readFile = async (
  filePath: string,
): Promise<{ content: string; encoding?: string; success?: boolean; error?: string } | null> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.readFile) {
    console.warn('File system access not available');
    return null;
  }
  return electronAPI.readFile(filePath);
};

/**
 * Writes content to a file
 */
export const writeFile = async (
  filePath: string,
  content: string,
  encoding: string = 'utf8',
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.writeFile) {
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.writeFile(filePath, content, encoding);
};

/**
 * Reads directory contents with optional recursion
 */
export const readDirectory = async (
  dirPath: string,
  recursive: boolean = false,
): Promise<FileSystemEntry[]> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.readDirectory) {
    console.warn('File system access not available');
    return [];
  }
  return electronAPI.readDirectory(dirPath, recursive);
};

/**
 * Creates a new directory
 */
export const createDirectory = async (
  dirPath: string,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.createDirectory) {
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.createDirectory(dirPath);
};

/**
 * Deletes a directory with optional recursion
 */
export const deleteDirectory = async (
  dirPath: string,
  recursive: boolean = false,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.deleteDirectory) {
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.deleteDirectory(dirPath, recursive);
};

/**
 * Renames a file or directory
 */
export const renameFile = async (
  oldPath: string,
  newPath: string,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.renameFile) {
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.renameFile(oldPath, newPath);
};

/**
 * Copies a file
 */
export const copyFile = async (
  sourcePath: string,
  destPath: string,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.copyFile) {
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.copyFile(sourcePath, destPath);
};

/**
 * Moves a file
 */
export const moveFile = async (
  sourcePath: string,
  destPath: string,
): Promise<{ success: boolean; error?: string }> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.moveFile) {
    return { success: false, error: 'File system access not available.' };
  }
  return electronAPI.moveFile(sourcePath, destPath);
};

/**
 * Gets file statistics
 */
export const getFileStats = async (
  filePath: string,
): Promise<{ size: number; lastModified: number; isDirectory: boolean } | null> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.getFileStats) {
    console.warn('File system access not available');
    return null;
  }
  return electronAPI.getFileStats(filePath);
};

/**
 * Watches a directory for changes
 */
export const watchDirectory = async (
  dirPath: string,
  callback: (event: FileWatchEvent) => void,
): Promise<{ watchId?: string } | null> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.watchDirectory) {
    console.warn('File watching not available');
    return null;
  }
  const result = await electronAPI.watchDirectory(dirPath, callback);
  if (result?.watchId && result?.dispose) {
    watcherDisposers.set(result.watchId, result.dispose);
  }
  return result?.watchId ? { watchId: result.watchId } : result;
};

/**
 * Stops watching a directory
 */
export const unwatchDirectory = async (watchId: string): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.unwatchDirectory) {
    console.warn('File watching not available');
    return;
  }
  const disposer = watcherDisposers.get(watchId);
  if (disposer) {
    try {
      await disposer();
    } catch (error) {
      console.warn('Watcher dispose failed:', error);
    }
    watcherDisposers.delete(watchId);
  }
  return electronAPI.unwatchDirectory(watchId);
};

/**
 * Searches for files matching a pattern
 */
export const searchFiles = async (
  dirPath: string,
  pattern: string,
  options?: { includeContent?: boolean; maxResults?: number },
): Promise<
  Array<{ path: string; matches?: Array<{ line: number; content: string; column: number }> }>
> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.searchFiles) {
    console.warn('File search not available');
    return [];
  }
  return electronAPI.searchFiles(dirPath, pattern, options);
};

/**
 * Gets project statistics
 */
export const getProjectStats = async (projectPath: string): Promise<FileSystemStats | null> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.getProjectStats) {
    console.warn('Project stats not available');
    return null;
  }
  return electronAPI.getProjectStats(projectPath);
};

/**
 * Reveals a file in the system file explorer
 */
export const revealInExplorer = async (filePath: string): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.revealInExplorer) {
    console.warn('Reveal in explorer not available');
    return;
  }
  return electronAPI.revealInExplorer(filePath);
};

/**
 * Opens a file with the default system application
 */
export const openInDefaultApp = async (filePath: string): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.openInDefaultApp) {
    console.warn('Open in default app not available');
    return;
  }
  return electronAPI.openInDefaultApp(filePath);
};

/**
 * Gets the list of recent projects
 */
export const getRecentProjects = async (): Promise<
  Array<{ name: string; path: string; lastOpened: number; type: 'folder' | 'file' }>
> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.getRecentProjects) {
    console.warn('Recent projects not available');
    return [];
  }
  return electronAPI.getRecentProjects();
};

/**
 * Adds a project to the recent projects list
 */
export const addRecentProject = async (
  name: string,
  path: string,
  type: 'folder' | 'file',
): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.addRecentProject) {
    console.warn('Recent projects not available');
    return;
  }
  return electronAPI.addRecentProject(name, path, type);
};

/**
 * Removes a project from the recent projects list
 */
export const removeRecentProject = async (path: string): Promise<void> => {
  const electronAPI = getElectronAPI();
  if (!isDesktopApp() || !electronAPI?.removeRecentProject) {
    console.warn('Recent projects not available');
    return;
  }
  return electronAPI.removeRecentProject(path);
};

// Utility functions for file operations

/**
 * Gets the file extension from a file path
 */
export const getFileExtension = (filePath: string): string => {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastDot > lastSlash ? filePath.substring(lastDot + 1).toLowerCase() : '';
};

/**
 * Gets the file name without extension
 */
export const getFileNameWithoutExtension = (filePath: string): string => {
  const fileName = getFileName(filePath);
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
};

/**
 * Gets the file name from a path
 */
export const getFileName = (filePath: string): string => {
  return filePath.split(/[\\/]/).pop() || '';
};

/**
 * Gets the directory path from a file path
 */
export const getDirectoryPath = (filePath: string): string => {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
};

/**
 * Joins path segments
 */
export const joinPath = (...segments: string[]): string => {
  return segments
    .filter((segment) => segment && segment.length > 0)
    .join('/')
    .replace(/\/+/g, '/');
};

/**
 * Normalizes a file path
 */
export const normalizePath = (filePath: string): string => {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
};

/**
 * Checks if a file path is absolute
 */
export const isAbsolutePath = (filePath: string): boolean => {
  return /^([a-zA-Z]:[\\/]|[\\/])/.test(filePath);
};

/**
 * Makes a path relative to a base path
 */
export const makeRelativePath = (filePath: string, basePath: string): string => {
  const normalizedFile = normalizePath(filePath);
  const normalizedBase = normalizePath(basePath);

  if (normalizedFile.startsWith(normalizedBase)) {
    return normalizedFile.substring(normalizedBase.length).replace(/^\//, '');
  }

  return normalizedFile;
};

/**
 * Checks if a file is a text file based on extension
 */
export const isTextFile = (filePath: string): boolean => {
  const textExtensions = [
    'txt',
    'md',
    'js',
    'ts',
    'jsx',
    'tsx',
    'html',
    'css',
    'scss',
    'sass',
    'less',
    'json',
    'xml',
    'yaml',
    'yml',
    'toml',
    'ini',
    'conf',
    'config',
    'env',
    'py',
    'rb',
    'php',
    'java',
    'c',
    'cpp',
    'h',
    'hpp',
    'cs',
    'go',
    'rs',
    'sh',
    'bash',
    'zsh',
    'fish',
    'ps1',
    'bat',
    'cmd',
    'dockerfile',
    'makefile',
    'sql',
    'graphql',
    'vue',
    'svelte',
    'astro',
    'prisma',
    'proto',
  ];

  const extension = getFileExtension(filePath);
  return textExtensions.includes(extension);
};

/**
 * Checks if a file is an image file based on extension
 */
export const isImageFile = (filePath: string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'];
  const extension = getFileExtension(filePath);
  return imageExtensions.includes(extension);
};

/**
 * Gets a human-readable file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Formats a timestamp to a human-readable date
 */
export const formatLastModified = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};
