/**
 * Windsurf Bridge Service
 * Enables REAL communication between AI agents and Windsurf IDE
 * Uses Electron IPC to actually launch Windsurf and interact with files
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS - REAL INTEGRATION
 */

import { getElectronAPI, isElectronAvailable } from '../utils/electronBridge';

/**
 * File content with metadata
 */
export interface WindsurfFile {
  path: string;
  content: string;
  language: string;
  lastModified: Date;
}

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

/**
 * Windsurf connection status
 */
export interface WindsurfStatus {
  detected: boolean;
  path: string | null;
  version: string | null;
  lastChecked: Date;
  canLaunch: boolean;
  canReadFiles: boolean;
  canWriteFiles: boolean;
}

/**
 * Windsurf Bridge Service - REAL IMPLEMENTATION
 */
export class WindsurfBridge {
  private isConnected: boolean = false;
  private windsurfPath: string | null = null;
  private windsurfVersion: string | null = null;
  private detectionPromise: Promise<void> | null = null;
  
  constructor() {
    console.log('[WindsurfBridge] Initializing bridge service with REAL Electron integration');
    this.detectionPromise = this.detectWindsurf();
  }
  
  /**
   * Wait for detection to complete
   */
  public async waitForDetection(): Promise<void> {
    if (this.detectionPromise) {
      await this.detectionPromise;
    }
  }
  
  /**
   * Detect Windsurf installation using Electron APIs
   */
  private async detectWindsurf(): Promise<void> {
    if (!isElectronAvailable()) {
      console.warn('[WindsurfBridge] Electron not available - Windsurf integration disabled');
      this.isConnected = false;
      this.windsurfPath = null;
      return;
    }

    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      this.isConnected = false;
      return;
    }

    // Detect platform from navigator (works in renderer process)
    const isWindows = navigator.platform.toLowerCase().includes('win');
    const isMac = navigator.platform.toLowerCase().includes('mac');
    
    // Check common Windsurf installation paths using Electron's file system
    const username = await this.getUsername();
    
    // Build platform-specific paths
    const possiblePaths: string[] = [];
    
    if (isWindows) {
      // Windows paths - various installation locations
      possiblePaths.push(
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\Windsurf\\Windsurf.exe`,
        `C:\\Users\\${username}\\AppData\\Local\\Windsurf\\Windsurf.exe`,
        `C:\\Users\\${username}\\.windsurf\\Windsurf.exe`,
        'C:\\Program Files\\Windsurf\\Windsurf.exe',
        'C:\\Program Files (x86)\\Windsurf\\Windsurf.exe',
        'C:\\Windsurf\\Windsurf.exe',
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\windsurf\\Windsurf.exe`,
        `C:\\Users\\${username}\\AppData\\Local\\Codeium\\Windsurf\\Windsurf.exe`,
        `C:\\Users\\${username}\\scoop\\apps\\windsurf\\current\\Windsurf.exe`
      );
    } else if (isMac) {
      // macOS paths
      possiblePaths.push(
        '/Applications/Windsurf.app/Contents/MacOS/Windsurf',
        '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf',
        `/Users/${username}/Applications/Windsurf.app/Contents/MacOS/Windsurf`
      );
    } else {
      // Linux paths
      possiblePaths.push(
        '/usr/local/bin/windsurf',
        '/usr/bin/windsurf',
        '/opt/windsurf/windsurf',
        `/home/${username}/.local/bin/windsurf`,
        '/snap/bin/windsurf'
      );
    }
    
    console.log('[WindsurfBridge] Platform:', isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux');
    console.log('[WindsurfBridge] Checking', possiblePaths.length, 'paths for user:', username);

    for (const path of possiblePaths) {
      try {
        console.log('[WindsurfBridge] Checking path:', path);
        const stats = await electronAPI.getFileStats?.(path);
        if (stats && !stats.isDirectory) {
          this.windsurfPath = path;
          this.isConnected = true;
          console.log('[WindsurfBridge] ✅ Windsurf FOUND at:', path);
          
          // Try to get version
          await this.getWindsurfVersion();
          return;
        }
      } catch (err) {
        // Path doesn't exist, continue checking
        console.log('[WindsurfBridge] Path not found:', path);
      }
    }

    // Also try running 'where windsurf' or 'which windsurf' to find it
    try {
      const result = await electronAPI.runCommand?.(
        isWindows ? 'where windsurf' : 'which windsurf'
      );
      if (result?.success && result.output?.trim()) {
        this.windsurfPath = result.output.trim().split('\n')[0];
        this.isConnected = true;
        console.log('[WindsurfBridge] Windsurf found via PATH:', this.windsurfPath);
        await this.getWindsurfVersion();
        return;
      }
    } catch {
      // Command failed
    }

    console.log('[WindsurfBridge] Windsurf NOT FOUND - integration unavailable');
    this.isConnected = false;
    this.windsurfPath = null;
  }

  /**
   * Get current username for path resolution
   */
  private async getUsername(): Promise<string> {
    const electronAPI = getElectronAPI();
    if (!electronAPI?.runCommand) return 'User';
    
    // Detect platform from navigator (works in renderer process)
    const isWindows = navigator.platform.toLowerCase().includes('win');
    
    try {
      const result = await electronAPI.runCommand(
        isWindows ? 'echo %USERNAME%' : 'whoami'
      );
      return result?.output?.trim() || 'User';
    } catch {
      return 'User';
    }
  }

  /**
   * Get Windsurf version
   */
  private async getWindsurfVersion(): Promise<void> {
    if (!this.windsurfPath) return;
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.runCommand) return;

    try {
      const result = await electronAPI.runCommand(`"${this.windsurfPath}" --version`);
      if (result?.success && result.output) {
        this.windsurfVersion = result.output.trim();
        console.log('[WindsurfBridge] Windsurf version:', this.windsurfVersion);
      }
    } catch {
      // Version check failed
    }
  }
  
  /**
   * Open Windsurf IDE - REAL IMPLEMENTATION
   */
  public async openWindsurf(filePath?: string): Promise<boolean> {
    console.log('[WindsurfBridge] Opening Windsurf:', filePath || 'new window');
    
    if (!this.isConnected || !this.windsurfPath) {
      throw new Error('Windsurf is not installed or not detected. Please install Windsurf IDE.');
    }

    const electronAPI = getElectronAPI();
    if (!electronAPI?.runCommand) {
      throw new Error('Electron API not available for launching Windsurf');
    }
    
    try {
      const command = filePath 
        ? `"${this.windsurfPath}" "${filePath}"`
        : `"${this.windsurfPath}"`;
      
      const result = await electronAPI.runCommand(command);
      
      if (!result?.success) {
        console.error('[WindsurfBridge] Failed to launch Windsurf:', result?.error);
        return false;
      }
      
      console.log('[WindsurfBridge] Windsurf launched successfully');
      return true;
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to open Windsurf:', error);
      return false;
    }
  }

  /**
   * Open file in Windsurf at specific line
   */
  public async openFileAtLine(filePath: string, line: number): Promise<boolean> {
    console.log('[WindsurfBridge] Opening file at line:', filePath, line);
    
    if (!this.isConnected || !this.windsurfPath) {
      throw new Error('Windsurf is not installed');
    }

    const electronAPI = getElectronAPI();
    if (!electronAPI?.runCommand) {
      throw new Error('Electron API not available');
    }

    try {
      // Windsurf uses VS Code-style line navigation: file:line
      const command = `"${this.windsurfPath}" --goto "${filePath}:${line}"`;
      const result = await electronAPI.runCommand(command);
      return result?.success ?? false;
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to open file at line:', error);
      return false;
    }
  }
  
  /**
   * Read file using Electron API - REAL IMPLEMENTATION
   */
  public async readFile(filePath: string): Promise<WindsurfFile> {
    console.log('[WindsurfBridge] Reading file:', filePath);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.readFile) {
      throw new Error('Electron file API not available');
    }
    
    try {
      const result = await electronAPI.readFile(filePath);
      
      if (!result || result.error) {
        throw new Error(result?.error || 'Failed to read file');
      }
      
      return {
        path: filePath,
        content: result.content,
        language: this.detectLanguage(filePath),
        lastModified: new Date()
      };
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to read file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
  
  /**
   * Write file using Electron API - REAL IMPLEMENTATION
   */
  public async writeFile(filePath: string, content: string): Promise<boolean> {
    console.log('[WindsurfBridge] Writing file:', filePath);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.writeFile) {
      throw new Error('Electron file API not available');
    }
    
    try {
      const result = await electronAPI.writeFile(filePath, content);
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to write file');
      }
      
      console.log('[WindsurfBridge] File written successfully');
      return true;
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to write file:', error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Save file with backup - creates backup before overwriting
   */
  public async saveFileWithBackup(filePath: string, content: string): Promise<{ success: boolean; backupPath?: string }> {
    console.log('[WindsurfBridge] Saving file with backup:', filePath);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.writeFile || !electronAPI?.copyFile) {
      throw new Error('Electron file API not available');
    }

    try {
      // Create backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup-${timestamp}`;
      
      // Try to backup existing file (may not exist)
      try {
        await electronAPI.copyFile(filePath, backupPath);
        console.log('[WindsurfBridge] Backup created:', backupPath);
      } catch {
        // File may not exist yet, that's OK
      }

      // Write new content
      const result = await electronAPI.writeFile(filePath, content);
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to write file');
      }

      return { success: true, backupPath };
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to save file:', error);
      return { success: false };
    }
  }
  
  /**
   * Execute command using Electron API - REAL IMPLEMENTATION
   */
  public async executeCommand(command: string, cwd?: string): Promise<CommandResult> {
    console.log('[WindsurfBridge] Executing command:', command);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.runCommand) {
      return {
        success: false,
        output: '',
        error: 'Electron command API not available',
        exitCode: 1
      };
    }
    
    try {
      const result = await electronAPI.runCommand(
        cwd ? { command, cwd } : command
      );
      
      return {
        success: result?.success ?? false,
        output: result?.output ?? '',
        error: result?.error,
        exitCode: result?.exitCode ?? (result?.success ? 0 : 1)
      };
    } catch (error: any) {
      console.error('[WindsurfBridge] Command execution failed:', error);
      return {
        success: false,
        output: '',
        error: error.message,
        exitCode: 1
      };
    }
  }
  
  /**
   * Get list of files using Electron API - REAL IMPLEMENTATION
   */
  public async getWorkspaceFiles(directory: string = '.'): Promise<string[]> {
    console.log('[WindsurfBridge] Listing files in:', directory);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.readDirectory) {
      return [];
    }
    
    try {
      const entries = await electronAPI.readDirectory(directory, true);
      return entries
        .filter(entry => entry.type === 'file')
        .map(entry => entry.path);
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to list files:', error);
      return [];
    }
  }
  
  /**
   * Create new file using Electron API
   */
  public async createFile(filePath: string, content: string): Promise<boolean> {
    console.log('[WindsurfBridge] Creating file:', filePath);
    return this.writeFile(filePath, content);
  }
  
  /**
   * Delete file using Electron API - REAL IMPLEMENTATION
   */
  public async deleteFile(filePath: string): Promise<boolean> {
    console.log('[WindsurfBridge] Deleting file:', filePath);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.deleteFile) {
      return false;
    }
    
    try {
      // deleteFile expects projectPath and fileIdentifier
      const result = await electronAPI.deleteFile('', filePath);
      return result?.success ?? false;
    } catch (error: any) {
      console.error('[WindsurfBridge] Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get full connection status
   */
  public getStatus(): WindsurfStatus {
    return {
      detected: this.isConnected,
      path: this.windsurfPath,
      version: this.windsurfVersion,
      lastChecked: new Date(),
      canLaunch: this.isConnected && isElectronAvailable(),
      canReadFiles: isElectronAvailable(),
      canWriteFiles: isElectronAvailable()
    };
  }
  
  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'md': 'markdown'
    };
    
    return languageMap[ext || ''] || 'text';
  }
  
  /**
   * Check if Windsurf is connected
   */
  public isWindsurfConnected(): boolean {
    return this.isConnected;
  }
  
  /**
   * Get Windsurf path
   */
  public getWindsurfPath(): string | null {
    return this.windsurfPath;
  }

  /**
   * Re-detect Windsurf (useful after installation)
   */
  public async redetect(): Promise<boolean> {
    this.detectionPromise = this.detectWindsurf();
    await this.detectionPromise;
    return this.isConnected;
  }

  /**
   * Manually set Windsurf path (for cases where auto-detection fails)
   */
  public async setWindsurfPath(path: string): Promise<boolean> {
    console.log('[WindsurfBridge] Manually setting Windsurf path:', path);
    
    const electronAPI = getElectronAPI();
    if (!electronAPI?.getFileStats) {
      console.error('[WindsurfBridge] Cannot verify path - Electron not available');
      return false;
    }

    try {
      const stats = await electronAPI.getFileStats(path);
      if (stats && !stats.isDirectory) {
        this.windsurfPath = path;
        this.isConnected = true;
        await this.getWindsurfVersion();
        console.log('[WindsurfBridge] Windsurf path set successfully:', path);
        return true;
      } else {
        console.error('[WindsurfBridge] Path is not a valid file:', path);
        return false;
      }
    } catch (error) {
      console.error('[WindsurfBridge] Failed to verify path:', error);
      return false;
    }
  }

  /**
   * Get common Windsurf installation paths for user reference
   */
  public getCommonPaths(): string[] {
    return [
      'C:\\Users\\<username>\\AppData\\Local\\Programs\\Windsurf\\Windsurf.exe',
      'C:\\Program Files\\Windsurf\\Windsurf.exe',
      '/Applications/Windsurf.app/Contents/MacOS/Windsurf',
      '/usr/local/bin/windsurf'
    ];
  }
}

// Singleton instance
let bridgeInstance: WindsurfBridge | null = null;

/**
 * Get Windsurf bridge instance
 */
export function getWindsurfBridge(): WindsurfBridge {
  if (!bridgeInstance) {
    bridgeInstance = new WindsurfBridge();
  }
  return bridgeInstance;
}
