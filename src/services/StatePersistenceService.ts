/**
 * Enterprise State Persistence Service
 * Provides robust state persistence, recovery, and session management
 * Production-ready with error handling, validation, and performance optimization
 */

import { AppState } from '../hooks/useAppReducer';
import { logDebug } from '../utils/logging';

interface PersistedState {
  appSettings: any;
  chatHistory: any[];
  codeSnippets: any[];
  openProjects: string[];
  leftPanelState: {
    isOpen: boolean;
    activeTab: string;
    openFolders: string[];
  };
  rightPanelState: {
    isOpen: boolean;
    activeTab: string;
  };
  activeTabs: string[];
  lastActiveFile: string | null;
  workspaceLayout: any;
  preferences: any;
  timestamp: number;
  version: string;
}

interface StatePersistenceConfig {
  maxChatHistory: number;
  maxSnippets: number;
  maxProjects: number;
  autoSaveInterval: number;
  maxBackupFiles: number;
  encryptionEnabled: boolean;
}

class StatePersistenceService {
  private static instance: StatePersistenceService;
  private config: StatePersistenceConfig;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private readonly settingPrefix = 'ide-setting';
  private lastStateSaveLogAt: number | null = null;
  private readonly stateSaveLogMinIntervalMs = 10_000;

  constructor() {
    this.config = {
      maxChatHistory: 100,
      maxSnippets: 200,
      maxProjects: 10,
      autoSaveInterval: 5000, // 5 seconds
      maxBackupFiles: 5,
      encryptionEnabled: false,
    };
  }

  static getInstance(): StatePersistenceService {
    if (!StatePersistenceService.instance) {
      StatePersistenceService.instance = new StatePersistenceService();
    }
    return StatePersistenceService.instance;
  }

  /**
   * Initialize state persistence with configuration
   */
  async initialize(config?: Partial<StatePersistenceConfig>): Promise<void> {
    if (this.isInitialized) return;

    this.config = { ...this.config, ...config };

    // Create backup directory
    await this.ensureBackupDirectory();

    // Start auto-save
    this.startAutoSave();

    this.isInitialized = true;
    logDebug('✅ State Persistence Service initialized');
  }

  /**
   * Save application state to persistent storage
   */
  async saveState(state: AppState, context?: string): Promise<void> {
    try {
      const persistedState: PersistedState = {
        appSettings: state.appSettings,
        chatHistory: state.chatHistory.slice(-this.config.maxChatHistory),
        codeSnippets: state.codeSnippets.slice(-this.config.maxSnippets),
        openProjects: state.openFolders.slice(-this.config.maxProjects),
        leftPanelState: {
          isOpen: state.isLeftPanelOpen,
          activeTab: state.leftPanelTab,
          openFolders: state.openFolders,
        },
        rightPanelState: {
          isOpen: state.isRightPanelOpen,
          activeTab: state.rightPanelView,
        },
        activeTabs: state.selectedFileIdentifiers,
        lastActiveFile: state.activeFileIdentifier,
        workspaceLayout: {
          leftPanelWidth: 280,
          rightPanelWidth: state.rightPanelView === 'enterprise' ? 650 : 380,
          terminalHeight: state.isTerminalOpen ? 250 : 0,
        },
        preferences: {
          theme: 'dark',
          fontSize: 14,
          lineHeight: 1.6,
          tabSize: 2,
          wordWrap: true,
        },
        timestamp: Date.now(),
        version: '1.0.0',
      };

      // Validate state before saving
      if (!this.validatePersistedState(persistedState)) {
        throw new Error('Invalid state data');
      }

      // Save to localStorage
      const stateKey = context ? `ide-state-${context}` : 'ide-state';
      localStorage.setItem(stateKey, JSON.stringify(persistedState));

      // Create backup
      await this.createBackup(persistedState);
      const now = Date.now();
      const hasContext = typeof context === 'string' && context.trim().length > 0;
      const shouldLogStateSave =
        hasContext ||
        this.lastStateSaveLogAt === null ||
        now - this.lastStateSaveLogAt >= this.stateSaveLogMinIntervalMs;

      if (shouldLogStateSave) {
        const contextSuffix = hasContext ? ` (context: ${context})` : '';
        logDebug(`💾 State saved successfully${contextSuffix}`);
        this.lastStateSaveLogAt = now;
      }
    } catch (error) {
      console.error('❌ Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Build a deterministic storage key for scoped settings
   */
  private buildSettingKey(key: string, scope?: string): string {
    const sanitizedKey = key.trim();
    if (!sanitizedKey) {
      throw new Error('Setting key cannot be empty');
    }

    const normalizedScope = scope && scope.trim().length > 0 ? scope.trim() : 'global';
    return `${this.settingPrefix}:${normalizedScope}:${sanitizedKey}`;
  }

  /**
   * Persist an arbitrary JSON-serializable setting with optional project scoping
   */
  setScopedSetting<T>(key: string, value: T, scope?: string): void {
    const storageKey = this.buildSettingKey(key, scope);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ value, savedAt: Date.now() }));
    } catch (error) {
      console.error(`[StatePersistenceService] Failed to persist setting "${storageKey}":`, error);
      throw error;
    }
  }

  /**
   * Retrieve a scoped setting. Returns undefined when missing or malformed.
   */
  getScopedSetting<T>(key: string, scope?: string): T | undefined {
    const storageKey = this.buildSettingKey(key, scope);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return undefined;
      }

      const parsed = JSON.parse(raw);
      if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'value')) {
        return parsed.value as T;
      }
      console.warn(`[StatePersistenceService] Malformed setting payload for "${storageKey}". Clearing entry.`);
      localStorage.removeItem(storageKey);
      return undefined;
    } catch (error) {
      console.error(`[StatePersistenceService] Failed to read setting "${storageKey}":`, error);
      return undefined;
    }
  }

  /**
   * Remove a scoped setting from persistence
   */
  clearScopedSetting(key: string, scope?: string): void {
    const storageKey = this.buildSettingKey(key, scope);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`[StatePersistenceService] Failed to clear setting "${storageKey}":`, error);
    }
  }

  /**
   * Load application state from persistent storage
   */
  async loadState(context?: string): Promise<Partial<AppState> | null> {
    try {
      const stateKey = context ? `ide-state-${context}` : 'ide-state';
      const savedState = localStorage.getItem(stateKey);

      if (!savedState) {
        logDebug('📭 No saved state found');
        return null;
      }

      const persistedState: PersistedState = JSON.parse(savedState);

      // Validate loaded state
      if (!this.validatePersistedState(persistedState)) {
        console.warn('⚠️ Invalid saved state, using defaults');
        return null;
      }

      // Check version compatibility
      if (!this.isVersionCompatible(persistedState.version)) {
        console.warn('⚠️ State version incompatible, migrating...');
        return this.migrateState(persistedState);
      }

      // Convert to AppState format
      const appState: Partial<AppState> = {
        appSettings: persistedState.appSettings,
        chatHistory: persistedState.chatHistory,
        codeSnippets: persistedState.codeSnippets,
        openFolders: persistedState.openProjects,
        isLeftPanelOpen: persistedState.leftPanelState.isOpen,
        leftPanelTab: persistedState.leftPanelState.activeTab as any,
        isRightPanelOpen: persistedState.rightPanelState.isOpen,
        rightPanelView: persistedState.rightPanelState.activeTab as any,
        activeFileIdentifier: persistedState.lastActiveFile,
        selectedFileIdentifiers: persistedState.activeTabs,
        uploadedFiles: [], // Will be loaded separately
        projectPath: persistedState.openProjects[0] || null,
        // Initialize new enterprise state properties
        plugins: [],
        pluginErrors: [],
        testSuites: [],
        mockServices: [],
        benchmarks: [],
        isTestingRunning: false,
        cloudIntegrations: [],
        syncStatus: 'idle' as const,
        collaborationSessions: [],
        activeCollaborators: [],
        workspaceShares: [],
        analyticsData: null,
        teamMetrics: null,
        qualityTrends: [],
        securityReports: [],
        complianceStatus: null,
        vulnerabilityAlerts: [],
        debugSessions: [],
        breakpoints: [],
        watchExpressions: [],
        performanceMetrics: null,
        systemHealth: null,
      };

      logDebug('📂 State loaded successfully');
      return appState;
    } catch (error) {
      console.error('❌ Failed to load state:', error);
      return null;
    }
  }

  /**
   * Clear all persisted state
   */
  async clearState(): Promise<void> {
    try {
      // Clear all state keys
      const keys = Object.keys(localStorage).filter(key => key.startsWith('ide-state'));
      keys.forEach(key => localStorage.removeItem(key));

      // Clear backups
      await this.clearBackups();

      logDebug('🗑️ All state cleared');
    } catch (error) {
      console.error('❌ Failed to clear state:', error);
      throw error;
    }
  }

  /**
   * Export state for backup or sharing
   */
  async exportState(): Promise<string> {
    const state = await this.loadState();
    if (!state) throw new Error('No state to export');

    return JSON.stringify(state, null, 2);
  }

  /**
   * Import state from backup
   */
  async importState(stateJson: string): Promise<void> {
    try {
      const state = JSON.parse(stateJson);
      if (!this.validatePersistedState(state)) {
        throw new Error('Invalid state format');
      }

      await this.saveState(state as AppState, 'imported');
      logDebug('📥 State imported successfully');
    } catch (error) {
      console.error('❌ Failed to import state:', error);
      throw error;
    }
  }

  /**
   * Start automatic state saving
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        // Get current state from React context (this would need to be passed in)
        // For now, we'll save basic state
        const basicState = {
          timestamp: Date.now(),
          preferences: { theme: 'dark' },
        };
        localStorage.setItem('ide-autosave', JSON.stringify(basicState));
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop automatic state saving
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Validate persisted state structure
   */
  private validatePersistedState(state: any): boolean {
    try {
      if (!state || typeof state !== 'object') return false;
      if (!state.timestamp || !state.version) return false;
      if (!state.appSettings || !state.chatHistory) return false;

      // Check data types
      if (!Array.isArray(state.chatHistory)) return false;
      if (!Array.isArray(state.codeSnippets)) return false;
      if (!Array.isArray(state.openProjects)) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check version compatibility
   */
  private isVersionCompatible(version: string): boolean {
    const currentVersion = '1.0.0';
    const [major, minor, patch] = version.split('.').map(Number);
    const [currMajor, currMinor, currPatch] = currentVersion.split('.').map(Number);

    // Major version must match
    if (major !== currMajor) return false;

    // Minor version can be migrated
    if (minor < currMinor) return false;

    return true;
  }

  /**
   * Migrate state from older version
   */
  private migrateState(oldState: PersistedState): Partial<AppState> {
    // Basic migration logic - ensure all required properties are present
    const migrated: Partial<AppState> = {
      appSettings: {
        ...oldState.appSettings,
        customRules: oldState.appSettings?.customRules || "1. Always provide clear, concise explanations.\n2. When refactoring, prioritize readability and maintainability.\n3. If you're unsure about something, ask for clarification.",
        desktopSettings: oldState.appSettings?.desktopSettings || {
          fileSystem: false,
          database: false,
        },
        aiTools: oldState.appSettings?.aiTools || {
          webSearch: true,
          projectSearch: true,
          editFile: true,
          createFile: true,
          runTerminalCommand: false,
          visualSnapshot: true,
          autoRunTools: false,
          analyzeDependencies: true,
          projectWideRefactor: true,
          generateDocs: true,
        },
        aiTeamConfiguration: oldState.appSettings?.aiTeamConfiguration || [
          {
            role: 'Brainstormer',
            enabled: true,
            order: 1,
            systemPrompt: 'You are a creative brainstormer who generates innovative solutions and approaches.',
            modelId: 'gemini-2.5-flash',
          },
          {
            role: 'Planner',
            enabled: true,
            order: 2,
            systemPrompt: 'You are a strategic planner who creates detailed implementation plans.',
            modelId: 'gemini-2.5-flash',
          },
          {
            role: 'Coder',
            enabled: true,
            order: 3,
            systemPrompt: 'You are an expert coder who implements solutions with clean, efficient code.',
            modelId: 'gemini-2.5-flash',
          },
          {
            role: 'Critic',
            enabled: true,
            order: 4,
            systemPrompt: 'You are a critical reviewer who identifies potential issues and improvements.',
            modelId: 'gemini-2.5-flash',
          },
        ],
      },
      chatHistory: oldState.chatHistory,
      codeSnippets: oldState.codeSnippets,
      openFolders: oldState.openProjects,
      isLeftPanelOpen: oldState.leftPanelState.isOpen,
      leftPanelTab: oldState.leftPanelState.activeTab as any,
      isRightPanelOpen: oldState.rightPanelState.isOpen,
      rightPanelView: oldState.rightPanelState.activeTab as any,
      activeFileIdentifier: oldState.lastActiveFile,
      selectedFileIdentifiers: oldState.activeTabs,
      uploadedFiles: [], // Will be loaded separately
      projectPath: oldState.openProjects[0] || null,
      // Initialize new enterprise state properties with defaults
      plugins: [],
      pluginErrors: [],
      testSuites: [],
      mockServices: [],
      benchmarks: [],
      isTestingRunning: false,
      cloudIntegrations: [],
      syncStatus: 'idle' as const,
      collaborationSessions: [],
      activeCollaborators: [],
      workspaceShares: [],
      analyticsData: null,
      teamMetrics: null,
      qualityTrends: [],
      securityReports: [],
      complianceStatus: null,
      vulnerabilityAlerts: [],
      debugSessions: [],
      breakpoints: [],
      watchExpressions: [],
      performanceMetrics: null,
      systemHealth: null,
    };

    logDebug('🔄 State migration completed');
    return migrated;
  }

  /**
   * Create state backup
   */
  private async createBackup(state: PersistedState): Promise<void> {
    try {
      const backupKey = `ide-backup-${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(state));

      // Clean up old backups
      await this.cleanupOldBackups();
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
    }
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('ide-backup-'))
        .sort()
        .reverse();

      if (backupKeys.length > this.config.maxBackupFiles) {
        const keysToRemove = backupKeys.slice(this.config.maxBackupFiles);
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.error('❌ Failed to cleanup backups:', error);
    }
  }

  /**
   * Clear all backups
   */
  private async clearBackups(): Promise<void> {
    try {
      const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('ide-backup-'));
      backupKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('❌ Failed to clear backups:', error);
    }
  }

  /**
   * Ensure backup directory exists (for future file-based backups)
   */
  private async ensureBackupDirectory(): Promise<void> {
    // For now, using localStorage
    // In future, could use file system for larger backups
    try {
      // Create backup metadata
      const metadata = {
        created: Date.now(),
        version: '1.0.0',
        backupCount: 0,
      };
      localStorage.setItem('ide-backup-metadata', JSON.stringify(metadata));
    } catch (error) {
      console.error('❌ Failed to initialize backup system:', error);
    }
  }

  /**
   * Get backup history
   */
  async getBackupHistory(): Promise<any[]> {
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('ide-backup-'))
        .sort()
        .reverse();

      return backupKeys.map(key => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      }).filter(Boolean);
    } catch (error) {
      console.error('❌ Failed to get backup history:', error);
      return [];
    }
  }

  /**
   * Restore from specific backup
   */
  async restoreFromBackup(timestamp: number): Promise<Partial<AppState> | null> {
    try {
      const backupKey = `ide-backup-${timestamp}`;
      const backupData = localStorage.getItem(backupKey);

      if (!backupData) {
        throw new Error('Backup not found');
      }

      const state = JSON.parse(backupData);
      return this.migrateState(state);
    } catch (error) {
      console.error('❌ Failed to restore from backup:', error);
      return null;
    }
  }
}

// Export singleton instance
export const statePersistence = StatePersistenceService.getInstance();

// Export types only (no conflicts)
export type { StatePersistenceConfig, PersistedState };
