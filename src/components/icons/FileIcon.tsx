import React from 'react';
import {
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  CodeBracketIcon,
  CogIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  CubeIcon,
  DocumentArrowDownIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  CircleStackIcon,
  BeakerIcon,
  BookOpenIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { getFileExtension } from '../../services/fileSystemService';

interface FileIconProps {
  filePath: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface FileTypeConfig {
  icon: React.ComponentType<any>;
  color: string;
  category: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// Comprehensive file type mapping
const fileTypeMap: Record<string, FileTypeConfig> = {
  // Programming Languages
  js: { icon: CodeBracketIcon, color: 'text-yellow-500', category: 'code' },
  jsx: { icon: CodeBracketIcon, color: 'text-blue-400', category: 'code' },
  ts: { icon: CodeBracketIcon, color: 'text-blue-600', category: 'code' },
  tsx: { icon: CodeBracketIcon, color: 'text-blue-500', category: 'code' },
  vue: { icon: CodeBracketIcon, color: 'text-green-500', category: 'code' },
  svelte: { icon: CodeBracketIcon, color: 'text-orange-500', category: 'code' },
  astro: { icon: CodeBracketIcon, color: 'text-purple-500', category: 'code' },
  py: { icon: CodeBracketIcon, color: 'text-blue-600', category: 'code' },
  rb: { icon: CodeBracketIcon, color: 'text-red-600', category: 'code' },
  php: { icon: CodeBracketIcon, color: 'text-purple-600', category: 'code' },
  java: { icon: CodeBracketIcon, color: 'text-orange-600', category: 'code' },
  c: { icon: CodeBracketIcon, color: 'text-blue-700', category: 'code' },
  cpp: { icon: CodeBracketIcon, color: 'text-blue-800', category: 'code' },
  cc: { icon: CodeBracketIcon, color: 'text-blue-800', category: 'code' },
  cxx: { icon: CodeBracketIcon, color: 'text-blue-800', category: 'code' },
  h: { icon: CodeBracketIcon, color: 'text-gray-600', category: 'code' },
  hpp: { icon: CodeBracketIcon, color: 'text-gray-600', category: 'code' },
  cs: { icon: CodeBracketIcon, color: 'text-green-600', category: 'code' },
  go: { icon: CodeBracketIcon, color: 'text-cyan-600', category: 'code' },
  rs: { icon: CodeBracketIcon, color: 'text-orange-700', category: 'code' },
  swift: { icon: CodeBracketIcon, color: 'text-orange-500', category: 'code' },
  kt: { icon: CodeBracketIcon, color: 'text-purple-700', category: 'code' },
  scala: { icon: CodeBracketIcon, color: 'text-red-700', category: 'code' },
  dart: { icon: CodeBracketIcon, color: 'text-blue-500', category: 'code' },
  r: { icon: BeakerIcon, color: 'text-blue-600', category: 'code' },
  matlab: { icon: BeakerIcon, color: 'text-orange-600', category: 'code' },
  m: { icon: BeakerIcon, color: 'text-orange-600', category: 'code' },

  // Web Technologies
  html: { icon: GlobeAltIcon, color: 'text-orange-500', category: 'web' },
  htm: { icon: GlobeAltIcon, color: 'text-orange-500', category: 'web' },
  css: { icon: PaintBrushIcon, color: 'text-blue-500', category: 'web' },
  scss: { icon: PaintBrushIcon, color: 'text-pink-500', category: 'web' },
  sass: { icon: PaintBrushIcon, color: 'text-pink-600', category: 'web' },
  less: { icon: PaintBrushIcon, color: 'text-blue-600', category: 'web' },
  stylus: { icon: PaintBrushIcon, color: 'text-green-600', category: 'web' },

  // Data & Configuration
  json: { icon: CogIcon, color: 'text-yellow-600', category: 'data' },
  yaml: { icon: CogIcon, color: 'text-red-500', category: 'data' },
  yml: { icon: CogIcon, color: 'text-red-500', category: 'data' },
  toml: { icon: CogIcon, color: 'text-orange-600', category: 'data' },
  xml: { icon: CogIcon, color: 'text-green-600', category: 'data' },
  ini: { icon: CogIcon, color: 'text-gray-600', category: 'data' },
  conf: { icon: CogIcon, color: 'text-gray-600', category: 'data' },
  config: { icon: CogIcon, color: 'text-gray-600', category: 'data' },
  env: { icon: KeyIcon, color: 'text-green-500', category: 'data' },
  properties: { icon: CogIcon, color: 'text-blue-600', category: 'data' },

  // Database
  sql: { icon: CircleStackIcon, color: 'text-blue-700', category: 'database' },
  db: { icon: CircleStackIcon, color: 'text-gray-700', category: 'database' },
  sqlite: { icon: CircleStackIcon, color: 'text-blue-600', category: 'database' },
  sqlite3: { icon: CircleStackIcon, color: 'text-blue-600', category: 'database' },
  prisma: { icon: CircleStackIcon, color: 'text-indigo-600', category: 'database' },

  // Scripts & Shell
  sh: { icon: CommandLineIcon, color: 'text-green-700', category: 'script' },
  bash: { icon: CommandLineIcon, color: 'text-green-700', category: 'script' },
  zsh: { icon: CommandLineIcon, color: 'text-green-600', category: 'script' },
  fish: { icon: CommandLineIcon, color: 'text-blue-600', category: 'script' },
  ps1: { icon: CommandLineIcon, color: 'text-blue-700', category: 'script' },
  bat: { icon: CommandLineIcon, color: 'text-gray-700', category: 'script' },
  cmd: { icon: CommandLineIcon, color: 'text-gray-700', category: 'script' },

  // Images
  jpg: { icon: PhotoIcon, color: 'text-green-500', category: 'image' },
  jpeg: { icon: PhotoIcon, color: 'text-green-500', category: 'image' },
  png: { icon: PhotoIcon, color: 'text-blue-500', category: 'image' },
  gif: { icon: PhotoIcon, color: 'text-purple-500', category: 'image' },
  svg: { icon: PhotoIcon, color: 'text-orange-500', category: 'image' },
  webp: { icon: PhotoIcon, color: 'text-yellow-500', category: 'image' },
  bmp: { icon: PhotoIcon, color: 'text-gray-500', category: 'image' },
  ico: { icon: PhotoIcon, color: 'text-blue-600', category: 'image' },
  tiff: { icon: PhotoIcon, color: 'text-indigo-500', category: 'image' },
  tif: { icon: PhotoIcon, color: 'text-indigo-500', category: 'image' },
  heic: { icon: PhotoIcon, color: 'text-purple-600', category: 'image' },
  heif: { icon: PhotoIcon, color: 'text-purple-600', category: 'image' },

  // Video
  mp4: { icon: VideoCameraIcon, color: 'text-red-500', category: 'video' },
  avi: { icon: VideoCameraIcon, color: 'text-blue-500', category: 'video' },
  mov: { icon: VideoCameraIcon, color: 'text-gray-600', category: 'video' },
  wmv: { icon: VideoCameraIcon, color: 'text-blue-600', category: 'video' },
  flv: { icon: VideoCameraIcon, color: 'text-red-600', category: 'video' },
  webm: { icon: VideoCameraIcon, color: 'text-green-600', category: 'video' },
  mkv: { icon: VideoCameraIcon, color: 'text-purple-600', category: 'video' },
  m4v: { icon: VideoCameraIcon, color: 'text-gray-500', category: 'video' },

  // Audio
  mp3: { icon: MusicalNoteIcon, color: 'text-green-500', category: 'audio' },
  wav: { icon: MusicalNoteIcon, color: 'text-blue-500', category: 'audio' },
  flac: { icon: MusicalNoteIcon, color: 'text-purple-500', category: 'audio' },
  aac: { icon: MusicalNoteIcon, color: 'text-orange-500', category: 'audio' },
  ogg: { icon: MusicalNoteIcon, color: 'text-red-500', category: 'audio' },
  m4a: { icon: MusicalNoteIcon, color: 'text-gray-500', category: 'audio' },
  wma: { icon: MusicalNoteIcon, color: 'text-blue-600', category: 'audio' },

  // Archives
  zip: { icon: ArchiveBoxIcon, color: 'text-yellow-600', category: 'archive' },
  rar: { icon: ArchiveBoxIcon, color: 'text-red-600', category: 'archive' },
  '7z': { icon: ArchiveBoxIcon, color: 'text-blue-600', category: 'archive' },
  tar: { icon: ArchiveBoxIcon, color: 'text-brown-600', category: 'archive' },
  gz: { icon: ArchiveBoxIcon, color: 'text-gray-600', category: 'archive' },
  bz2: { icon: ArchiveBoxIcon, color: 'text-orange-600', category: 'archive' },
  xz: { icon: ArchiveBoxIcon, color: 'text-purple-600', category: 'archive' },

  // Documents
  pdf: { icon: DocumentArrowDownIcon, color: 'text-red-600', category: 'document' },
  doc: { icon: DocumentTextIcon, color: 'text-blue-600', category: 'document' },
  docx: { icon: DocumentTextIcon, color: 'text-blue-600', category: 'document' },
  xls: { icon: ClipboardDocumentListIcon, color: 'text-green-600', category: 'document' },
  xlsx: { icon: ClipboardDocumentListIcon, color: 'text-green-600', category: 'document' },
  ppt: { icon: DocumentTextIcon, color: 'text-orange-600', category: 'document' },
  pptx: { icon: DocumentTextIcon, color: 'text-orange-600', category: 'document' },
  odt: { icon: DocumentTextIcon, color: 'text-blue-500', category: 'document' },
  ods: { icon: ClipboardDocumentListIcon, color: 'text-green-500', category: 'document' },
  odp: { icon: DocumentTextIcon, color: 'text-orange-500', category: 'document' },

  // Text & Markup
  txt: { icon: DocumentTextIcon, color: 'text-gray-600', category: 'text' },
  md: { icon: BookOpenIcon, color: 'text-blue-600', category: 'text' },
  markdown: { icon: BookOpenIcon, color: 'text-blue-600', category: 'text' },
  rst: { icon: DocumentTextIcon, color: 'text-purple-600', category: 'text' },
  tex: { icon: DocumentTextIcon, color: 'text-green-700', category: 'text' },
  rtf: { icon: DocumentTextIcon, color: 'text-blue-500', category: 'text' },

  // Special Files
  dockerfile: { icon: CubeIcon, color: 'text-blue-500', category: 'special' },
  makefile: { icon: WrenchScrewdriverIcon, color: 'text-orange-600', category: 'special' },
  cmake: { icon: WrenchScrewdriverIcon, color: 'text-red-600', category: 'special' },
  gitignore: { icon: ShieldCheckIcon, color: 'text-gray-600', category: 'special' },
  gitattributes: { icon: CogIcon, color: 'text-gray-600', category: 'special' },
  editorconfig: { icon: CogIcon, color: 'text-purple-600', category: 'special' },
  npmignore: { icon: ShieldCheckIcon, color: 'text-red-600', category: 'special' },
  eslintrc: { icon: CogIcon, color: 'text-purple-600', category: 'special' },
  prettierrc: { icon: CogIcon, color: 'text-pink-600', category: 'special' },
  babelrc: { icon: CogIcon, color: 'text-yellow-600', category: 'special' },
  tsconfig: { icon: CogIcon, color: 'text-blue-600', category: 'special' },
  package: { icon: CogIcon, color: 'text-green-600', category: 'special' },
  lock: { icon: KeyIcon, color: 'text-yellow-600', category: 'special' },

  // 3D & Design
  obj: { icon: CubeIcon, color: 'text-purple-600', category: '3d' },
  fbx: { icon: CubeIcon, color: 'text-blue-600', category: '3d' },
  dae: { icon: CubeIcon, color: 'text-green-600', category: '3d' },
  blend: { icon: CubeIcon, color: 'text-orange-600', category: '3d' },
  max: { icon: CubeIcon, color: 'text-red-600', category: '3d' },
  maya: { icon: CubeIcon, color: 'text-cyan-600', category: '3d' },
  psd: { icon: PaintBrushIcon, color: 'text-blue-600', category: 'design' },
  ai: { icon: PaintBrushIcon, color: 'text-orange-600', category: 'design' },
  sketch: { icon: PaintBrushIcon, color: 'text-yellow-600', category: 'design' },
  fig: { icon: PaintBrushIcon, color: 'text-purple-600', category: 'design' },
  xd: { icon: PaintBrushIcon, color: 'text-pink-600', category: 'design' },
};

// Special filename patterns
const specialFiles: Record<string, FileTypeConfig> = {
  dockerfile: { icon: CubeIcon, color: 'text-blue-500', category: 'special' },
  makefile: { icon: WrenchScrewdriverIcon, color: 'text-orange-600', category: 'special' },
  'cmakelists.txt': { icon: WrenchScrewdriverIcon, color: 'text-red-600', category: 'special' },
  '.gitignore': { icon: ShieldCheckIcon, color: 'text-gray-600', category: 'special' },
  '.gitattributes': { icon: CogIcon, color: 'text-gray-600', category: 'special' },
  '.editorconfig': { icon: CogIcon, color: 'text-purple-600', category: 'special' },
  '.npmignore': { icon: ShieldCheckIcon, color: 'text-red-600', category: 'special' },
  '.eslintrc.js': { icon: CogIcon, color: 'text-purple-600', category: 'special' },
  '.eslintrc.json': { icon: CogIcon, color: 'text-purple-600', category: 'special' },
  '.prettierrc': { icon: CogIcon, color: 'text-pink-600', category: 'special' },
  '.babelrc': { icon: CogIcon, color: 'text-yellow-600', category: 'special' },
  'tsconfig.json': { icon: CogIcon, color: 'text-blue-600', category: 'special' },
  'package.json': { icon: CogIcon, color: 'text-green-600', category: 'special' },
  'package-lock.json': { icon: KeyIcon, color: 'text-yellow-600', category: 'special' },
  'yarn.lock': { icon: KeyIcon, color: 'text-blue-600', category: 'special' },
  'composer.json': { icon: CogIcon, color: 'text-purple-600', category: 'special' },
  'composer.lock': { icon: KeyIcon, color: 'text-purple-600', category: 'special' },
  'requirements.txt': {
    icon: ClipboardDocumentListIcon,
    color: 'text-blue-600',
    category: 'special',
  },
  pipfile: { icon: CogIcon, color: 'text-blue-600', category: 'special' },
  'pipfile.lock': { icon: KeyIcon, color: 'text-blue-600', category: 'special' },
  'cargo.toml': { icon: CogIcon, color: 'text-orange-700', category: 'special' },
  'cargo.lock': { icon: KeyIcon, color: 'text-orange-700', category: 'special' },
  'go.mod': { icon: CogIcon, color: 'text-cyan-600', category: 'special' },
  'go.sum': { icon: KeyIcon, color: 'text-cyan-600', category: 'special' },
  'readme.md': { icon: BookOpenIcon, color: 'text-blue-600', category: 'special' },
  license: { icon: ShieldCheckIcon, color: 'text-green-600', category: 'special' },
  'license.txt': { icon: ShieldCheckIcon, color: 'text-green-600', category: 'special' },
  'license.md': { icon: ShieldCheckIcon, color: 'text-green-600', category: 'special' },
  'changelog.md': { icon: ClipboardDocumentListIcon, color: 'text-blue-600', category: 'special' },
  'contributing.md': { icon: BookOpenIcon, color: 'text-green-600', category: 'special' },
};

export const FileIcon: React.FC<FileIconProps> = ({ filePath, className = '', size = 'md' }) => {
  const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
  const extension = getFileExtension(filePath);

  // Check for special filenames first
  let config = specialFiles[fileName];

  // If not found, check by extension
  if (!config) {
    config = fileTypeMap[extension];
  }

  // Default fallback
  if (!config) {
    config = { icon: DocumentIcon, color: 'text-gray-500', category: 'unknown' };
  }

  const IconComponent = config.icon;
  const sizeClass = sizeClasses[size];

  return (
    <IconComponent
      className={`${sizeClass} ${config.color} ${className}`}
      title={`${fileName} (${config.category})`}
    />
  );
};

export default FileIcon;

// Utility function to get file category
export const getFileCategory = (filePath: string): string => {
  const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
  const extension = getFileExtension(filePath);

  let config = specialFiles[fileName];
  if (!config) {
    config = fileTypeMap[extension];
  }

  return config?.category || 'unknown';
};

// Utility function to get file color
export const getFileColor = (filePath: string): string => {
  const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
  const extension = getFileExtension(filePath);

  let config = specialFiles[fileName];
  if (!config) {
    config = fileTypeMap[extension];
  }

  return config?.color || 'text-gray-500';
};
