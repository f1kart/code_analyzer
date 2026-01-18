import { SUPPORTED_LANGUAGES } from '../constants';

const extensionToLanguageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  html: 'html',
  css: 'css',
  scss: 'css',
  vue: 'vue',
  svelte: 'svelte',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  json: 'json',
  md: 'markdown',
  rb: 'ruby',
  php: 'php',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  uc: 'unrealscript',
  ds: 'dazscript',
  dsa: 'dazscript',
};

export const detectLanguage = (fileName: string): string => {
  if (!fileName) return 'plaintext';
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension && extensionToLanguageMap[extension]) {
    return extensionToLanguageMap[extension];
  }
  return 'plaintext'; // Fallback for unknown extensions
};

export const getLanguageLabel = (languageValue: string): string => {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.value === languageValue);
  return lang ? lang.label : languageValue.charAt(0).toUpperCase() + languageValue.slice(1);
};
