import { isDesktopApp } from '../utils/env';
import {
  readFile as desktopReadFile,
  readDirectory as desktopReadDirectory,
  FileSystemEntry,
  isTextFile,
} from './fileSystemService';

const resolveFileServiceBaseUrl = (): string | null => {
  const globalObject = typeof window !== 'undefined' ? (window as any) : undefined;
  const runtimeBase = globalObject?.FILE_SERVICE_BASE_URL || globalObject?.API_BASE_URL;
  const envBase =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env.VITE_FILE_SERVICE_BASE_URL as string | undefined)
      : undefined;

  return envBase || runtimeBase || null;
};

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

export const fetchRemoteTextFile = async (filePath: string): Promise<string | null> => {
  const baseUrl = resolveFileServiceBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const url = `${normalizeBaseUrl(baseUrl)}/content?path=${encodeURIComponent(filePath)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain' },
    });

    if (!response.ok) {
      console.warn(`Remote file fetch failed (${response.status}): ${url}`);
      return null;
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      if (payload && typeof payload.content === 'string') {
        return payload.content;
      }
      if (payload && typeof payload === 'string') {
        return payload;
      }
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn('Remote file fetch threw an error:', error);
    return null;
  }
};

export const fetchRemoteDirectoryListing = async (
  projectPath: string,
): Promise<string[] | null> => {
  const baseUrl = resolveFileServiceBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const url = `${normalizeBaseUrl(baseUrl)}/list?path=${encodeURIComponent(projectPath)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Remote directory listing failed (${response.status}): ${url}`);
      return null;
    }

    const payload = await response.json();
    if (Array.isArray(payload)) {
      return payload.filter((entry) => typeof entry === 'string');
    }

    if (payload && Array.isArray(payload.files)) {
      return payload.files.filter((entry: unknown): entry is string => typeof entry === 'string');
    }

    return null;
  } catch (error) {
    console.warn('Remote directory listing threw an error:', error);
    return null;
  }
};

export const readTextFile = async (filePath: string): Promise<string> => {
  if (isDesktopApp()) {
    const file = await desktopReadFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }
    return file.content;
  }

  const remoteContent = await fetchRemoteTextFile(filePath);
  if (remoteContent !== null) {
    return remoteContent;
  }

  throw new Error(
    'No available file access provider. Configure a file content endpoint or use the desktop application.',
  );
};

export const listProjectTextFiles = async (projectPath: string): Promise<string[]> => {
  if (!projectPath) {
    throw new Error('Project path is required for indexing.');
  }

  if (isDesktopApp()) {
    const entries = await desktopReadDirectory(projectPath, true);
    return entries
      .filter((entry: FileSystemEntry) => entry.type === 'file' && isTextFile(entry.path))
      .map((entry) => entry.path);
  }

  const remoteEntries = await fetchRemoteDirectoryListing(projectPath);
  if (remoteEntries) {
    return remoteEntries.filter((entry) => isTextFile(entry));
  }

  throw new Error(
    'Project file listing requires the desktop application or a configured project files API endpoint.',
  );
};
