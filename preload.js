/* eslint-disable @typescript-eslint/no-var-requires */
const { contextBridge, ipcRenderer } = require("electron");

const watchHandlers = new Map();

contextBridge.exposeInMainWorld("electronAPI", {
  // --- File System ---
  openFolderDialog: () => ipcRenderer.invoke("files:open-folder-dialog"),
  openFileDialog: () => ipcRenderer.invoke("files:open-file-dialog"),
  saveFileContent: (filePath, content) =>
    ipcRenderer.invoke("files:save-file", filePath, content),
  formatContent: (filePath, content) =>
    ipcRenderer.invoke("files:format", filePath, content),
  createFile: (projectPath) =>
    ipcRenderer.invoke("files:create-file", projectPath),
  deleteFile: (projectPath, fileIdentifier) =>
    ipcRenderer.invoke("files:delete-file", projectPath, fileIdentifier),
  // Safe wrappers for reading file/folder data from main process
  readFile: (absolutePath) =>
    ipcRenderer.invoke("files:read-file", absolutePath),
  writeFile: (filePath, content, encoding) =>
    ipcRenderer.invoke("files:write-file", filePath, content, encoding),
  readDirectory: (dirPath, recursive) =>
    ipcRenderer.invoke("files:read-directory", dirPath, recursive),
  createDirectory: (dirPath) =>
    ipcRenderer.invoke("files:create-directory", dirPath),
  deleteDirectory: (dirPath, recursive) =>
    ipcRenderer.invoke("files:delete-directory", dirPath, recursive),
  renameFile: (oldPath, newPath) =>
    ipcRenderer.invoke("files:rename", oldPath, newPath),
  copyFile: (sourcePath, destPath) =>
    ipcRenderer.invoke("files:copy", sourcePath, destPath),
  moveFile: (sourcePath, destPath) =>
    ipcRenderer.invoke("files:move", sourcePath, destPath),
  getFileStats: (filePath) => ipcRenderer.invoke("files:get-stats", filePath),
  getFolderTree: (folderPath) =>
    ipcRenderer.invoke("files:get-folder-tree", folderPath),
  watchDirectory: async (dirPath, listener) => {
    let watchId;
    const handler = (_event, payload) => {
      if (!payload || payload.watchId !== watchId) return;
      if (typeof listener === "function") listener(payload);
    };

    ipcRenderer.on("files:watch-event", handler);

    try {
      const result = await ipcRenderer.invoke("files:watch-directory", dirPath);
      if (!result || result.error || !result.watchId) {
        ipcRenderer.removeListener("files:watch-event", handler);
        return result;
      }

      watchId = result.watchId;
      watchHandlers.set(watchId, handler);

      const dispose = async () => {
        if (watchId) {
          ipcRenderer.removeListener("files:watch-event", handler);
          watchHandlers.delete(watchId);
          await ipcRenderer.invoke("files:unwatch-directory", watchId);
        }
      };

      return { watchId, dispose };
    } catch (error) {
      ipcRenderer.removeListener("files:watch-event", handler);
      throw error;
    }
  },
  unwatchDirectory: async (watchId) => {
    const handler = watchHandlers.get(watchId);
    if (handler) {
      ipcRenderer.removeListener("files:watch-event", handler);
      watchHandlers.delete(watchId);
    }
    await ipcRenderer.invoke("files:unwatch-directory", watchId);
  },
  searchFiles: (dirPath, pattern, options) =>
    ipcRenderer.invoke("files:search", dirPath, pattern, options),
  getProjectStats: (projectPath) =>
    ipcRenderer.invoke("files:get-project-stats", projectPath),
  revealInExplorer: (filePath) =>
    ipcRenderer.invoke("files:reveal-in-explorer", filePath),
  openInDefaultApp: (filePath) =>
    ipcRenderer.invoke("files:open-in-default-app", filePath),
  getRecentProjects: () => ipcRenderer.invoke("files:get-recent-projects"),
  addRecentProject: (name, projectPath, type) =>
    ipcRenderer.invoke("files:add-recent-project", name, projectPath, type),
  removeRecentProject: (projectPath) =>
    ipcRenderer.invoke("files:remove-recent-project", projectPath),
  getProjectRoot: () => ipcRenderer.invoke("files:get-project-root"),

  // --- Terminal ---
  runCommand: (command, cwd) => {
    const payload = typeof command === "string" ? { command, cwd } : command;
    return ipcRenderer.invoke("terminal:run-command", payload);
  },

  // --- PTY (Interactive Terminal) ---
  pty: {
    spawn: (cwd, cols, rows) =>
      ipcRenderer.invoke("pty:spawn", cwd, cols, rows),
    write: (id, data) => ipcRenderer.invoke("pty:write", id, data),
    resize: (id, cols, rows) =>
      ipcRenderer.invoke("pty:resize", id, cols, rows),
    kill: (id) => ipcRenderer.invoke("pty:kill", id),
    onData: (listener) => {
      const handler = (_e, payload) => listener(payload);
      ipcRenderer.on("pty:data", handler);
      return () => ipcRenderer.removeListener("pty:data", handler);
    },
    onExit: (listener) => {
      const handler = (_e, payload) => listener(payload);
      ipcRenderer.on("pty:exit", handler);
      return () => ipcRenderer.removeListener("pty:exit", handler);
    },
  },

  // --- Gemini Services ---
  gemini: {
    isAvailable: () => ipcRenderer.invoke("gemini:is-available"),
    chat: (...args) => ipcRenderer.invoke("gemini:chat", ...args),
    explainCode: (...args) => ipcRenderer.invoke("gemini:explainCode", ...args),
    findSimilarCode: (...args) =>
      ipcRenderer.invoke("gemini:findSimilarCode", ...args),
    summarizePlaceholders: (...args) =>
      ipcRenderer.invoke("gemini:summarizePlaceholders", ...args),
    refactorCode: (...args) =>
      ipcRenderer.invoke("gemini:refactorCode", ...args),
    aiTeamRefactorCode: (...args) =>
      ipcRenderer.invoke("gemini:aiTeamRefactorCode", ...args),
    continueAITeamRefactor: (...args) =>
      ipcRenderer.invoke("gemini:continueAITeamRefactor", ...args),
    aiTeamProjectRefactor: (...args) =>
      ipcRenderer.invoke("gemini:aiTeamProjectRefactor", ...args),
    suggestSnippets: (...args) =>
      ipcRenderer.invoke("gemini:suggestSnippets", ...args),
    debugError: (...args) => ipcRenderer.invoke("gemini:debugError", ...args),
    generateUnitTests: (...args) =>
      ipcRenderer.invoke("gemini:generateUnitTests", ...args),
    generateDocumentation: (...args) =>
      ipcRenderer.invoke("gemini:generateDocumentation", ...args),
    analyzeDependencies: (...args) =>
      ipcRenderer.invoke("gemini:analyzeDependencies", ...args),
    projectSearch: (...args) =>
      ipcRenderer.invoke("gemini:projectSearch", ...args),
  },
  // --- Provider-agnostic AI Bridge ---
  ai: {
    chat: (payload) => ipcRenderer.invoke("ai:chat", payload),
  },
  // --- Project Utilities ---
  project: {
    create: () => ipcRenderer.invoke("project:create"),
  },
  // --- Git Services ---
  git: {
    status: (repoPath) => ipcRenderer.invoke("git:status", repoPath),
    stage: (repoPath, files) =>
      ipcRenderer.invoke("git:stage", repoPath, files),
    unstage: (repoPath, files) =>
      ipcRenderer.invoke("git:unstage", repoPath, files),
    commit: (repoPath, message) =>
      ipcRenderer.invoke("git:commit", repoPath, message),
    aiCommitMessage: (repoPath, settings, modelId) =>
      ipcRenderer.invoke("git:aiCommitMessage", repoPath, settings, modelId),
  },
  // --- Database Services ---
  db: {
    listSnippets: () => ipcRenderer.invoke("db:snippets:list"),
    createSnippet: (data) => ipcRenderer.invoke("db:snippets:create", data),
    updateSnippet: (id, data) =>
      ipcRenderer.invoke("db:snippets:update", id, data),
    deleteSnippet: (id) => ipcRenderer.invoke("db:snippets:delete", id),

    // Providers
    listProviders: () => ipcRenderer.invoke("db:providers:list"),
    createProvider: (data) => ipcRenderer.invoke("db:providers:create", data),
    updateProvider: (id, data) =>
      ipcRenderer.invoke("db:providers:update", id, data),
    deleteProvider: (id) => ipcRenderer.invoke("db:providers:delete", id),

    // Workflows
    listWorkflows: () => ipcRenderer.invoke("db:workflows:list"),
    createWorkflow: (data) => ipcRenderer.invoke("db:workflows:create", data),
    updateWorkflow: (id, data) =>
      ipcRenderer.invoke("db:workflows:update", id, data),
    deleteWorkflow: (id) => ipcRenderer.invoke("db:workflows:delete", id),

    // Agent model mapping
    listAgentMaps: (workflowId) =>
      ipcRenderer.invoke("db:agentMap:list", workflowId),
    setAgentMap: (data) => ipcRenderer.invoke("db:agentMap:set", data),
  },
});
