import React, { useState, useRef, useEffect, useCallback } from "react";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createReactQueryClient } from './components/admin/hooks/reactQueryConfig';
import { AppProvider } from "./contexts/AppContext";
import { useAppReducer } from "./hooks/useAppReducer";
import { TabbedMainView, Tab } from "./components/TabbedMainView";
import { Header } from "./components/Header";
import { LeftPanel } from "./components/LeftPanel";
import { OptimizedProjectExplorer } from "./components/OptimizedProjectExplorer";
import { AdminModal } from "./components/AdminModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { EditableFileView } from "./components/EditableFileView";
import { ChatPanel } from "./components/ChatPanel";
import { AICodingToolsPanel } from "./components/AICodingToolsPanel";
import { InteractiveTerminalPanel } from "./components/InteractiveTerminalPanel";
import { SnippetsPanel } from "./components/SnippetsPanel";
import { SourceControlPanel } from "./components/SourceControlPanel";
import { EnterpriseToolsPanel } from "./components/EnterpriseToolsPanel";
import type { AppliedChangeHistoryEntry } from "./components/MultiAgentPipelinePanel";
import { ProjectExplorerContext } from "./components/ProjectExplorerContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { statePersistence } from "./services/StatePersistenceService";
import { getElectronAPI, isElectronAvailable } from "./utils/electronBridge";
import { isDesktopApp } from "./utils/env";
import {
  TestingProvider,
  TestingDashboard,
} from "./components/TestingComponents";
import AuthComponent from "./auth/AuthComponent";
const AppContent: React.FC = () => {
  const [queryClient] = useState(() => createReactQueryClient());
  const [state, dispatch] = useAppReducer();
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "welcome",
      title: "Welcome",
      content: (
        <WelcomeScreen
          onOpenFolder={async () => {
            if (!isDesktopApp()) {
              console.warn("Electron API not available: onOpenFolder");
              return;
            }
            const api = getElectronAPI();
            if (api?.openFolderDialog) {
              const result = await api.openFolderDialog();
              if (result?.folderPath) {
                console.log(
                  "[App] Opening folder:",
                  result.folderPath,
                  "with",
                  result.files?.length || 0,
                  "files",
                );
                dispatch({
                  type: "SET_PROJECT_PATH",
                  payload: result.folderPath,
                });
                if (result.files && result.files.length > 0) {
                  dispatch({
                    type: "SET_UPLOADED_FILES",
                    payload: result.files,
                  });
                  console.log(
                    "[App] Dispatched SET_UPLOADED_FILES with",
                    result.files.length,
                    "files",
                  );
                }
              }
            }
          }}
          onOpenFile={async () => {
            if (!isDesktopApp()) {
              console.warn("Electron API not available: onOpenFile");
              return;
            }

            const api = getElectronAPI();
            if (!api?.openFileDialog) {
              console.warn("openFileDialog bridge not available");
              return;
            }

            const result = await api.openFileDialog();
            if (!result?.filePath) {
              return;
            }

            let content = "";
            if (api.readFile) {
              try {
                const fileResponse = await api.readFile(result.filePath);
                if (typeof fileResponse === "string") {
                  content = fileResponse;
                } else if (fileResponse?.content) {
                  content = fileResponse.content;
                }
              } catch (error) {
                console.error("Failed to read selected file:", error);
              }
            }

            const fileName = result.filePath.split(/[/\\]/).pop() ?? result.filePath;

            dispatch({
              type: "SET_UPLOADED_FILES",
              payload: [
                {
                  name: fileName,
                  identifier: result.filePath,
                  content,
                },
              ],
            });
          }}
          onCreateProject={async () => {
            if (!isDesktopApp()) {
              console.warn("Electron API not available: onCreateProject");
              return;
            }
            const api = getElectronAPI();
            if (api?.project?.create) {
              const result = await api.project.create();
              if (result?.success && result?.projectPath) {
                dispatch({
                  type: "SET_PROJECT_PATH",
                  payload: result.projectPath,
                });
              }
            }
          }}
          onOpenAITools={() => {
            dispatch({ type: "SET_RIGHT_PANEL_VIEW", payload: "ai" });
            dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: true });
          }}
          onOpenEnterpriseTools={() => {
            dispatch({ type: "SET_RIGHT_PANEL_VIEW", payload: "enterprise" });
            dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: true });
          }}
          onOpenChat={() => {
            dispatch({ type: "SET_RIGHT_PANEL_VIEW", payload: "chat" });
            dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: true });
          }}
        />
      ),
      type: "welcome",
      isClosable: false,
    },
    {
      id: "testing",
      title: "Testing Platform",
      content: (
        <TestingDashboard
          testSuites={[]}
          onRunTests={(suiteId: string) => {
            console.log("Running test suite:", suiteId);
          }}
          onCreateSuite={(suite: any) => {
            console.log("Creating new test suite:", suite);
          }}
          onDeleteSuite={(suiteId: string) => {
            console.log("Deleting test suite:", suiteId);
          }}
        />
      ),
      type: "testing",
      isClosable: true,
    },
    {
      id: "auth",
      title: "Authentication",
      content: <AuthComponent />,
      type: "auth",
      isClosable: true,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("welcome");
  const undoStackRef = useRef<Record<string, { identifier: string; previousContent?: string }[]>>({});
  const pendingTabsRef = useRef<Set<string>>(new Set());
  const createdTabsRef = useRef<Set<string>>(new Set(["welcome"])); // Track all created tabs

  // Initialize state persistence
  useEffect(() => {
    const initializeStatePersistence = async () => {
      try {
        await statePersistence.initialize({
          maxChatHistory: 100,
          maxSnippets: 200,
          maxProjects: 10,
          autoSaveInterval: 5000,
          maxBackupFiles: 5,
          encryptionEnabled: false,
        });

        // Load saved state
        const savedState = await statePersistence.loadState();
        if (savedState) {
          console.log("📂 Loading saved state...");
          // Apply saved state to current state
          Object.entries(savedState).forEach(([key, value]) => {
            if (value === undefined || value === null) {
              return;
            }

            switch (key) {
              case "projectPath": {
                if (typeof value === "string") {
                  dispatch({ type: "SET_PROJECT_PATH", payload: value });
                }
                break;
              }
              case "openFolders": {
                if (Array.isArray(value) && value.every((folder) => typeof folder === "string")) {
                  dispatch({ type: "SET_OPEN_FOLDERS", payload: value });
                }
                break;
              }
              case "chatHistory": {
                if (Array.isArray(value)) {
                  dispatch({ type: "SET_CHAT_HISTORY", payload: value });
                }
                break;
              }
              case "codeSnippets": {
                if (Array.isArray(value)) {
                  dispatch({ type: "SET_CODE_SNIPPETS", payload: value });
                }
                break;
              }
              case "appSettings": {
                if (typeof value === "object") {
                  dispatch({ type: "SET_APP_SETTINGS", payload: value });
                }
                break;
              }
              case "selectedModelId": {
                if (typeof value === "string") {
                  dispatch({ type: "SET_SELECTED_MODEL_ID", payload: value });
                }
                break;
              }
              default:
                break;
            }
          });
        }
      } catch (error) {
        console.error("❌ Failed to initialize state persistence:", error);
      }
    };

    initializeStatePersistence();
  }, [dispatch]);

  // Auto-save state periodically
  useEffect(() => {
    const autoSaveInterval = setInterval(async () => {
      try {
        await statePersistence.saveState(state);
      } catch (error) {
        console.error("❌ Auto-save failed:", error);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [state]);

  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ide-log-verbosity", state.appSettings.logVerbosity);
      }
    } catch (error) {
      console.error("Failed to persist log verbosity setting:", error);
    }
  }, [state.appSettings.logVerbosity]);

  // Multi-agent apply/undo event handlers
  const handleMultiAgentUndoReady = useCallback(
    (
      event: CustomEvent<{
        runId: string;
        historyEntry: AppliedChangeHistoryEntry;
        undoPayload: { identifier: string; previousContent?: string }[];
      }>,
    ) => {
      const { runId, undoPayload, historyEntry } = event.detail;
      if (!runId || !undoPayload || !historyEntry) {
        return;
      }

      undoStackRef.current[runId] = undoPayload;
    },
    [],
  );

  const handleUndoEnterpriseFix = useCallback(
    async (event: CustomEvent<{ historyEntry: AppliedChangeHistoryEntry }>) => {
      const { historyEntry } = event.detail;
      if (!historyEntry) {
        return;
      }

      const undoPayload = undoStackRef.current[historyEntry.runId];
      if (!undoPayload || undoPayload.length === 0) {
        console.warn("[App] Undo payload missing for run", historyEntry.runId);
        return;
      }

      try {
        for (const item of undoPayload) {
          if (item.previousContent === undefined) {
            // File was newly created; remove from state
            dispatch({ type: "REMOVE_FILE", payload: item.identifier });
          } else {
            dispatch({
              type: "UPDATE_FILE_CONTENT",
              payload: { identifier: item.identifier, content: item.previousContent },
            });
          }
        }

        delete undoStackRef.current[historyEntry.runId];

        window.dispatchEvent(
          new CustomEvent("ide:multi-agent-undo-completed", {
            detail: { runId: historyEntry.runId },
          }),
        );
      } catch (error) {
        console.error("[App] Undo failed", error);
        window.dispatchEvent(
          new CustomEvent("ide:multi-agent-undo-failed", {
            detail: {
              runId: historyEntry.runId,
              error: error instanceof Error ? error.message : String(error),
            },
          }),
        );
      }
    },
    [dispatch],
  );

  useEffect(() => {
    const undoReadyHandler = (
      event: Event,
    ) => {
      handleMultiAgentUndoReady(
        event as CustomEvent<{
          runId: string;
          historyEntry: AppliedChangeHistoryEntry;
          undoPayload: { identifier: string; previousContent?: string }[];
        }>,
      );
    };

    const undoEnterpriseHandler = (event: Event) => {
      void handleUndoEnterpriseFix(
        event as CustomEvent<{ historyEntry: AppliedChangeHistoryEntry }>,
      );
    };

    window.addEventListener("ide:multi-agent-undo-ready", undoReadyHandler);
    window.addEventListener("ide:undo-enterprise-fix", undoEnterpriseHandler);

    return () => {
      window.removeEventListener("ide:multi-agent-undo-ready", undoReadyHandler);
      window.removeEventListener("ide:undo-enterprise-fix", undoEnterpriseHandler);
    };
  }, [handleMultiAgentUndoReady, handleUndoEnterpriseFix]);

  // Keyboard shortcuts integration (placeholder implementations)
  const _handleCommandPalette = () => {
    console.log("Command palette triggered");
    // This would open a command palette modal
  };

  const _handleGlobalSearch = () => {
    console.log("Global search triggered");
    // This would open a search modal
  };

  const _handleToggleTerminal = () => {
    dispatch({ type: "SET_TERMINAL_OPEN", payload: !state.isTerminalOpen });
  };

  const _handleFocusEditor = () => {
    // Focus the main editor area
    const editorElement = document.querySelector(
      "[data-editor]",
    ) as HTMLElement;
    editorElement?.focus();
  };

  const _handleFocusExplorer = () => {
    // Focus the project explorer
    const explorerElement = document.querySelector(
      "[data-explorer]",
    ) as HTMLElement;
    explorerElement?.focus();
  };

  const _handleFocusAI = () => {
    // Focus the AI panel
    dispatch({ type: "SET_RIGHT_PANEL_VIEW", payload: "ai" });
    dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: true });
  };

  const _handleNewFile = () => {
    // Create new file
    console.log("New file triggered");
  };

  const _handleSaveFile = () => {
    // Save current file
    console.log("Save file triggered");
  };

  const _handleOpenFolder = () => {
    // Open folder dialog
    console.log("Open folder triggered");
  };

  const handleFileSelect = async (
    filePath: string,
    selectionState?: {
      activeEntry?: {
        absolutePath?: string;
        relativePath?: string;
        isDirectory?: boolean;
      };
      selectedEntries?: Array<{
        absolutePath?: string;
        relativePath?: string;
        isDirectory?: boolean;
      }>;
    },
  ) => {
    console.log("File selected:", filePath, selectionState);

    const activeEntry = selectionState?.activeEntry || {
      absolutePath: selectionState?.selectedEntries?.[0]?.absolutePath || filePath,
      relativePath: selectionState?.selectedEntries?.[0]?.relativePath || filePath,
      isDirectory: Boolean(selectionState?.selectedEntries?.[0]?.isDirectory),
    };

    const absolutePath = activeEntry.absolutePath || filePath;
    const relativePath = activeEntry.relativePath || filePath;
    const selectedEntries =
      selectionState?.selectedEntries?.length
        ? selectionState.selectedEntries
        : [
            {
              absolutePath,
              relativePath,
              isDirectory: Boolean(activeEntry.isDirectory),
            },
          ];

    const dispatchSelection = () => {
      dispatch({
        type: "HANDLE_FILE_SELECTION",
        payload: {
          activeFileIdentifier: relativePath,
          selectedIdentifiers: selectedEntries.map((entry) => entry.relativePath || relativePath),
          uploadedFiles: state.uploadedFiles,
          activeFileAbsolutePath: absolutePath,
          selectedAbsolutePaths: selectedEntries.map((entry) => entry.absolutePath || absolutePath),
          explorerSelection: {
            active: {
              relativePath,
              absolutePath,
              isDirectory: Boolean(activeEntry.isDirectory),
            },
            selected: selectedEntries.map((entry) => ({
              relativePath: entry.relativePath || relativePath,
              absolutePath: entry.absolutePath || absolutePath,
              isDirectory: Boolean(entry.isDirectory),
            })),
          },
        },
      });
    };

    // Check if tab is already pending or created (synchronous checks prevent all race conditions)
    if (
      pendingTabsRef.current.has(filePath) ||
      createdTabsRef.current.has(filePath)
    ) {
      console.log(
        "Tab already exists or being created, ignoring duplicate request",
      );
      setActiveTabId(filePath); // Switch to existing tab
      dispatchSelection();
      return;
    }

    // Check if file already exists in tabs (fallback for tabs created outside this function)
    const existingTab = tabs.find((t) => t.id === filePath);
    if (existingTab) {
      console.log("File already open in tab, switching to it");
      setActiveTabId(existingTab.id);
      createdTabsRef.current.add(filePath); // Add to tracking
      dispatchSelection();
      return;
    }

    // Mark as pending
    pendingTabsRef.current.add(filePath);

    try {
      // Try to find file in uploaded files
      let file = state.uploadedFiles.find((f) => f.identifier === filePath);

      // If not found, load it from disk
      if (!file && state.projectPath && isElectronAvailable()) {
        console.log("File not in state, loading from disk:", filePath);
        try {
          const api = getElectronAPI();
          if (api?.readFile) {
            // Build full path - handle both Windows and Unix paths
            const fullPath = filePath.startsWith(state.projectPath)
              ? filePath
              : `${state.projectPath}\\${filePath.replace(/\//g, "\\")}`;

            console.log("Reading file from:", fullPath);
            const result = await api.readFile(fullPath);
            console.log("readFile result:", result);

            // Handle different return formats
            let content = "";
            if (typeof result === "string") {
              content = result;
            } else if (result?.content) {
              content = result.content;
            } else if (result?.error) {
              console.error("Error reading file:", result.error);
              return;
            }

            console.log("File content loaded, length:", content.length);

            // Extract file name from path
            const fileName =
              filePath.split("/").pop() ||
              filePath.split("\\").pop() ||
              filePath;

            // Create file object
            file = {
              name: fileName,
              identifier: filePath,
              content: content,
            };

            // Add to state
            dispatch({ type: "ADD_FILE", payload: file });
          } else {
            console.error("readFile API not available");
            return;
          }
        } catch (error: any) {
          console.error("Failed to load file:", error);
          return;
        }
      }

      if (!file) {
        console.warn("File not found:", filePath);
        return;
      }

      console.log("Creating tab for file:", file.name);
      const newTab: Tab = {
        id: file.identifier,
        title: file.name,
        content: null, // Will be rendered dynamically below
        type: "file",
        filePath: file.identifier,
        isDirty: false,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      createdTabsRef.current.add(file.identifier); // Mark as created synchronously
      console.log("Tab created and activated");

      dispatchSelection();
    } finally {
      // Always remove from pending set, even if there was an error
      pendingTabsRef.current.delete(filePath);
    }
  };

  // Add console logs to verify button clicks
  const handleAdminClick = () => {
    console.log("Admin button clicked!");
    dispatch({ type: "SET_ADMIN_MODAL_OPEN", payload: true });
  };

  const handleTerminalClick = () => {
    console.log("Terminal button clicked!");
    dispatch({ type: "SET_TERMINAL_OPEN", payload: !state.isTerminalOpen });
  };

  const handleLeftPanelToggle = () => {
    console.log("Left panel toggle clicked!");
    dispatch({ type: "SET_LEFT_PANEL_OPEN", payload: !state.isLeftPanelOpen });
  };

  return (
    <QueryClientProvider client={queryClient}>
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      {/* Header with ALL required props matching HeaderProps interface */}
      <Header
        onNewSessionClick={() => {
          setTabs([tabs[0]]);
          setActiveTabId("welcome");
          dispatch({ type: "CLEAR_AI_RESULTS" });
        }}
        onOpenFolderClick={async () => {
          console.log("Open Folder clicked!");
          if (!isDesktopApp()) {
            console.warn("Electron API not available: onOpenFolderClick");
            return;
          }
          const api = getElectronAPI();
          if (api?.openFolderDialog) {
            const result = await api.openFolderDialog();
            console.log("Folder dialog result:", result);
            if (result?.folderPath) {
              console.log("Setting project path:", result.folderPath);
              dispatch({
                type: "SET_PROJECT_PATH",
                payload: result.folderPath,
              });
              dispatch({ type: "SET_LEFT_PANEL_OPEN", payload: true });

              // Auto-load all files for AI context (with limits to prevent crashes and API quota issues)
              console.log("Auto-loading all files for AI context...");
              if (api?.getFolderTree && api?.readFile) {
                try {
                  const treeResult = await api.getFolderTree(result.folderPath);
                  if (treeResult?.tree) {
                    // Recursively collect all file paths from tree
                    const collectFilePaths = (nodes: any[]): string[] => {
                      const paths: string[] = [];
                      for (const node of nodes) {
                        if (node.type === "file") {
                          paths.push(node.path);
                        } else if (node.type === "directory" && node.children) {
                          paths.push(...collectFilePaths(node.children));
                        }
                      }
                      return paths;
                    };

                    const allFilePaths = collectFilePaths(treeResult.tree);
                    console.log(`Found ${allFilePaths.length} files to load`);

                    // Limit to prevent crashes and API quota issues (max 30 files)
                    const MAX_FILES = 30;
                    const filesToLoad = allFilePaths.slice(0, MAX_FILES);
                    if (allFilePaths.length > MAX_FILES) {
                      console.warn(
                        `Limiting to ${MAX_FILES} files (found ${allFilePaths.length})`,
                      );
                    }

                    // Load files with error handling
                    let loadedCount = 0;
                    let errorCount = 0;

                    for (const filePath of filesToLoad) {
                      try {
                        const fullPath = `${result.folderPath}\\${filePath.replace(/\//g, "\\")}`;
                        const fileResult = await api.readFile(fullPath);

                        if (fileResult?.success && fileResult?.content) {
                          const fileName =
                            filePath.split("/").pop() ||
                            filePath.split("\\").pop() ||
                            filePath;
                          const file = {
                            name: fileName,
                            identifier: filePath,
                            content: fileResult.content,
                          };

                          dispatch({ type: "ADD_FILE", payload: file });
                          loadedCount++;

                          // Log progress every 10 files
                          if (loadedCount % 10 === 0) {
                            console.log(
                              `Progress: ${loadedCount}/${filesToLoad.length} files loaded`,
                            );
                          }
                        } else if (fileResult?.error) {
                          console.warn(
                            `Skipping ${filePath}: ${fileResult.error}`,
                          );
                          errorCount++;
                        }
                      } catch (error: any) {
                        console.warn(
                          `Failed to load file ${filePath}:`,
                          error?.message || error,
                        );
                        errorCount++;
                      }
                    }

                    console.log(
                      `✅ Successfully loaded ${loadedCount} files for AI context`,
                    );
                    if (errorCount > 0) {
                      console.warn(`⚠️ Failed to load ${errorCount} files`);
                    }
                  }
                } catch (error: any) {
                  console.error(
                    "❌ Failed to auto-load files:",
                    error?.message || error,
                  );
                }
              }
            }
          }
        }}
        onChatClick={() => {
          // Toggle separate chat column
          dispatch({
            type: "SET_CHAT_COLUMN_OPEN",
            payload: !state.isChatColumnOpen,
          });
        }}
        onToggleTools={() => {
          dispatch({ type: "SET_RIGHT_PANEL_VIEW", payload: "ai" });
          dispatch({
            type: "SET_RIGHT_PANEL_OPEN",
            payload: !state.isRightPanelOpen,
          });
          // Ensure left panel (Project Explorer) is open when using AI Tools
          if (!state.isLeftPanelOpen) {
            dispatch({ type: "SET_LEFT_PANEL_OPEN", payload: true });
          }
        }}
        onToggleEnterpriseTools={() => {
          // If already on enterprise view and panel is open, close it
          // Otherwise, switch to enterprise view and ensure panel is open
          if (state.rightPanelView === "enterprise" && state.isRightPanelOpen) {
            dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: false });
          } else {
            dispatch({ type: "SET_RIGHT_PANEL_VIEW", payload: "enterprise" });
            dispatch({ type: "SET_RIGHT_PANEL_OPEN", payload: true });
            if (!state.isLeftPanelOpen) {
              dispatch({ type: "SET_LEFT_PANEL_OPEN", payload: true });
            }
          }
        }}
        onAdminClick={handleAdminClick}
        onHelpClick={() => {
          console.log("Help clicked!");
          dispatch({ type: "SET_HELP_MODAL_OPEN", payload: true });
        }}
        onTerminalClick={handleTerminalClick}
        toggleLeftPanel={handleLeftPanelToggle}
        toggleRightPanel={() => {
          console.log("Right panel toggle clicked!");
          dispatch({
            type: "SET_RIGHT_PANEL_OPEN",
            payload: !state.isRightPanelOpen,
          });
        }}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Panel with correct LeftPanelProps interface */}
        {state.isLeftPanelOpen && (
          <div
            style={{
              width: "280px",
              borderRight: "1px solid #4a5568",
              backgroundColor: "#2d3748",
            }}
          >
            <LeftPanel
              activeTab={state.leftPanelTab}
              onTabChange={(tab) =>
                dispatch({ type: "SET_LEFT_PANEL_TAB", payload: tab })
              }
              projectContent={
                <OptimizedProjectExplorer
                  projectPath={state.projectPath}
                  onFileSelect={handleFileSelect}
                  onFolderToggle={(path, isExpanded) => {
                    if (isExpanded) {
                      dispatch({
                        type: "SET_OPEN_FOLDERS",
                        payload: [...state.openFolders, path],
                      });
                    } else {
                      dispatch({
                        type: "SET_OPEN_FOLDERS",
                        payload: state.openFolders.filter((f) => f !== path),
                      });
                    }
                  }}
                  onFilesUploaded={(files) => {
                    console.log("[App] Web upload received", files.length, "files");
                    dispatch({ type: "SET_UPLOADED_FILES", payload: files });
                    // Auto-select first file
                    if (files.length > 0) {
                      handleFileSelect(files[0].identifier);
                    }
                  }}
                  onProjectPathSet={(path) => {
                    dispatch({ type: "SET_PROJECT_PATH", payload: path });
                  }}
                />
              }
              snippetsContent={<SnippetsPanel />}
              sourceContent={
                <SourceControlPanel
                  repoPath={state.projectPath || ""}
                  onDiffRequest={(file) => console.log("Diff requested:", file)}
                />
              }
              alwaysShowProject={true}
            />
          </div>
        )}

        {/* Main Content with Tabs */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <TabbedMainView
            tabs={tabs.map((tab) => {
              // Dynamically render file tab content with current state
              if (tab.type === "file" && tab.filePath) {
                const file = state.uploadedFiles.find(
                  (f) => f.identifier === tab.filePath,
                );
                return {
                  ...tab,
                  content: file ? (
                    <EditableFileView
                      key={`${file.identifier}-${file.content?.length || 0}`}
                      filePath={file.identifier}
                      content={file.content || ""}
                      onContentChange={(content) => {
                        dispatch({
                          type: "UPDATE_FILE_CONTENT",
                          payload: { identifier: file.identifier, content },
                        });
                      }}
                      onSave={async (filePath, content) => {
                        const api = getElectronAPI();
                        if (api?.saveFileContent) {
                          try {
                            await api.saveFileContent(filePath, content);
                            console.log("[App] File saved:", filePath);
                          } catch (error) {
                            console.error("[App] Failed to save file:", error);
                            throw error;
                          }
                        } else {
                          console.error(
                            "[App] saveFileContent API not available",
                          );
                          throw new Error("Save API not available");
                        }
                      }}
                    />
                  ) : (
                    <div>File not found</div>
                  ),
                };
              }
              return tab;
            })}
            activeTabId={activeTabId}
            onTabChange={setActiveTabId}
            onTabClose={(tabId) => {
              if (tabId === "welcome") return;
              setTabs((prev) => prev.filter((t) => t.id !== tabId));
              if (activeTabId === tabId) {
                const remainingTabs = tabs.filter((t) => t.id !== tabId);
                setActiveTabId(remainingTabs[0]?.id || "welcome");
              }
            }}
            onTabReorder={setTabs}
          />
        </div>

        {/* Right Panel with AI Tools, Chat, and Enterprise */}
        {state.isRightPanelOpen && (
          <div
            style={{
              width: state.rightPanelView === "enterprise" ? "650px" : "380px",
              borderLeft: "1px solid #4a5568",
              backgroundColor: "#2d3748",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {state.rightPanelView === "ai" && (
              <AICodingToolsPanel
                selectedCode={state.originalCode}
                language={state.language}
                filePath={state.activeFileIdentifier || undefined}
                projectPath={state.projectPath || undefined}
              />
            )}
            {state.rightPanelView === "chat" && (
              <ChatPanel
                messages={state.chatHistory}
                onSendMessage={async (content, imageBase64) => {
                  console.log("Chat: Sending message:", content);

                  // Add file context to the message if project is loaded
                  let contextualContent = content;
                  if (state.projectPath && state.uploadedFiles.length > 0) {
                    const fileList = state.uploadedFiles
                      .map((f) => f.identifier)
                      .join(", ");
                    contextualContent = `[Project Context: ${state.projectPath} with ${state.uploadedFiles.length} files: ${fileList}]\n\nUser: ${content}`;
                    console.log("Chat: Added project context");
                  }

                  // Add user message to chat
                  dispatch({
                    type: "ADD_CHAT_MESSAGE",
                    payload: { author: "user", content, image: imageBase64 },
                  });

                  // Set loading state
                  dispatch({
                    type: "SET_LOADING",
                    payload: { key: "chat", value: true },
                  });

                  try {
                    // Call Gemini API through Electron
                    const api = getElectronAPI();
                    if (!api?.gemini?.chat) {
                      throw new Error("Gemini API not available");
                    }

                    console.log("Chat: Calling Gemini API with context...");

                    // Convert chat history to Gemini API format
                    const geminiHistory = [
                      ...state.chatHistory,
                      {
                        author: "user" as const,
                        content: contextualContent,
                        image: imageBase64,
                      },
                    ]
                      .filter((msg) => msg.author !== "system") // Remove system messages
                      .map((msg) => {
                        const role: "user" | "model" = msg.author === "user" ? "user" : "model";
                        return {
                          role,
                          parts: msg.content ? [{ text: msg.content }] : [],
                        };
                      })
                      .filter((msg) => msg.parts.length > 0); // Remove empty messages

                    console.log(
                      "Chat: Converted history with",
                      geminiHistory.length,
                      "messages",
                    );
                    const response = await api.gemini.chat(
                      geminiHistory,
                      state.appSettings,
                      state.selectedModelId,
                    );

                    console.log(
                      "Chat: Got response:",
                      response.substring(0, 100) + "...",
                    );
                    // Add AI response to chat
                    dispatch({
                      type: "ADD_CHAT_MESSAGE",
                      payload: { author: "ai", content: response },
                    });
                  } catch (error: any) {
                    console.error("Chat error:", error);
                    // Show error in chat
                    dispatch({
                      type: "ADD_CHAT_MESSAGE",
                      payload: {
                        author: "system",
                        content: `❌ Error: ${error.message || "Failed to get AI response"}`,
                      },
                    });
                  } finally {
                    // Clear loading state
                    dispatch({
                      type: "SET_LOADING",
                      payload: { key: "chat", value: false },
                    });
                  }
                }}
                isLoading={state.isLoading["chat"] || false}
                onApplyEdit={async (code: string) => {
                  console.log(
                    "Applying code edit from chat:",
                    code.substring(0, 50) + "...",
                  );
                  if (state.activeFileIdentifier) {
                    // Update the active file with the new code
                    const file = state.uploadedFiles.find(
                      (f) => f.identifier === state.activeFileIdentifier,
                    );
                    if (file) {
                      dispatch({
                        type: "UPDATE_FILE_CONTENT",
                        payload: { identifier: file.identifier, content: code },
                      });

                      // Save to disk if Electron API is available
                      const api = getElectronAPI();
                      if (api?.saveFileContent && state.projectPath) {
                        try {
                          const fullPath = `${state.projectPath}/${file.identifier}`;
                          await api.saveFileContent(fullPath, code);
                          console.log("File saved:", fullPath);
                        } catch (error: any) {
                          console.error("Failed to save file:", error);
                        }
                      }
                    }
                  } else {
                    console.warn("No active file to apply edit to");
                  }
                }}
                onInsertSnippet={(code: string) => {
                  console.log(
                    "Inserting snippet from chat:",
                    code.substring(0, 50) + "...",
                  );
                  // For now, just apply it like an edit
                  if (state.activeFileIdentifier) {
                    const file = state.uploadedFiles.find(
                      (f) => f.identifier === state.activeFileIdentifier,
                    );
                    if (file) {
                      // Append to existing content
                      const newContent = file.content + "\n\n" + code;
                      dispatch({
                        type: "UPDATE_FILE_CONTENT",
                        payload: {
                          identifier: file.identifier,
                          content: newContent,
                        },
                      });
                    }
                  }
                }}
                availableModels={state.appSettings.availableModels}
                selectedModelId={state.selectedModelId}
                onModelChange={(modelId) =>
                  dispatch({ type: "SET_SELECTED_MODEL_ID", payload: modelId })
                }
              />
            )}
            {state.rightPanelView === "enterprise" && (
              <EnterpriseToolsPanel
                selectedCode={state.originalCode}
                language={state.language}
                filePath={state.activeFileIdentifier || undefined}
                projectPath={state.projectPath || undefined}
                activeFilePath={state.activeFileIdentifier || undefined}
                uploadedFiles={state.uploadedFiles}
                selectedModelId={state.selectedModelId}
                onFileOpen={(filePath, lineNumber) => {
                  handleFileSelect(filePath);
                  if (lineNumber) {
                    // Scroll to line after file opens
                    setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent("ide:scroll-to-line", {
                          detail: { lineNumber },
                        }),
                      );
                    }, 100);
                  }
                }}
                onAddFile={(file) => {
                  // Add file to state so it can be opened
                  dispatch({ type: "ADD_FILE", payload: file });
                }}
              />
            )}
          </div>
        )}

        {/* SEPARATE CHAT COLUMN */}
        {state.isChatColumnOpen && (
          <div
            style={{
              width: "400px",
              borderLeft: "2px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ChatPanel
              messages={state.chatHistory}
              onSendMessage={async (content, imageBase64) => {
                console.log("Chat: Sending message:", content);

                // Add file context to the message if project is loaded
                let contextualContent = content;
                if (state.projectPath && state.uploadedFiles.length > 0) {
                  const fileList = state.uploadedFiles
                    .map((f) => f.identifier)
                    .join(", ");
                  contextualContent = `[Project Context: ${state.projectPath} with ${state.uploadedFiles.length} files: ${fileList}]\n\nUser: ${content}`;
                  console.log("Chat: Added project context");
                }

                // Add user message to chat
                dispatch({
                  type: "ADD_CHAT_MESSAGE",
                  payload: { author: "user", content, image: imageBase64 },
                });

                // Set loading state
                dispatch({
                  type: "SET_LOADING",
                  payload: { key: "chat", value: true },
                });

                try {
                  // Call Gemini API through Electron
                  const api = getElectronAPI();
                  if (!api?.gemini?.chat) {
                    throw new Error("Gemini API not available");
                  }

                  console.log("Chat: Calling Gemini API with context...");

                  // Convert chat history to Gemini API format
                  const geminiHistory = [
                    ...state.chatHistory,
                    {
                      author: "user" as const,
                      content: contextualContent,
                      image: imageBase64,
                    },
                  ]
                    .filter((msg) => msg.author !== "system") // Remove system messages
                    .map((msg) => {
                      const role: "user" | "model" = msg.author === "user" ? "user" : "model";
                      return {
                        role,
                        parts: msg.content ? [{ text: msg.content }] : [],
                      };
                    })
                    .filter((msg) => msg.parts.length > 0); // Remove empty messages

                  console.log(
                    "Chat: Converted history with",
                    geminiHistory.length,
                    "messages",
                  );
                  const response = await api.gemini.chat(
                    geminiHistory,
                    state.appSettings,
                    state.selectedModelId,
                  );

                  console.log(
                    "Chat: Got response:",
                    response.substring(0, 100) + "...",
                  );
                  // Add AI response to chat
                  dispatch({
                    type: "ADD_CHAT_MESSAGE",
                    payload: { author: "ai", content: response },
                  });
                } catch (error: any) {
                  console.error("Chat error:", error);
                  // Show error in chat
                  dispatch({
                    type: "ADD_CHAT_MESSAGE",
                    payload: {
                      author: "system",
                      content: `❌ Error: ${error.message || "Failed to get AI response"}`,
                    },
                  });
                } finally {
                  // Clear loading state
                  dispatch({
                    type: "SET_LOADING",
                    payload: { key: "chat", value: false },
                  });
                }
              }}
              isLoading={state.isLoading["chat"] || false}
              onApplyEdit={async (code: string) => {
                console.log(
                  "Applying code edit from chat:",
                  code.substring(0, 50) + "...",
                );
                if (state.activeFileIdentifier) {
                  const file = state.uploadedFiles.find(
                    (f) => f.identifier === state.activeFileIdentifier,
                  );
                  if (file) {
                    dispatch({
                      type: "UPDATE_FILE_CONTENT",
                      payload: { identifier: file.identifier, content: code },
                    });

                    const api = getElectronAPI();
                    if (api?.saveFileContent && state.projectPath) {
                      try {
                        const fullPath = `${state.projectPath}/${file.identifier}`;
                        await api.saveFileContent(fullPath, code);
                        console.log("File saved:", fullPath);
                      } catch (error: any) {
                        console.error("Failed to save file:", error);
                      }
                    }
                  }
                } else {
                  console.warn("No active file to apply edit to");
                }
              }}
              onInsertSnippet={(code: string) => {
                console.log("Inserting snippet from chat");
                dispatch({
                  type: "ADD_SNIPPET",
                  payload: {
                    id: Date.now().toString(),
                    title: "From Chat",
                    language: state.language,
                    code,
                    tags: [],
                  },
                });
              }}
              availableModels={state.appSettings.availableModels || []}
              selectedModelId={state.selectedModelId}
              onModelChange={(modelId: string) => {
                dispatch({ type: "SET_SELECTED_MODEL_ID", payload: modelId });
              }}
            />
          </div>
        )}
      </div>

      {/* Terminal Panel */}
      {state.isTerminalOpen && (
        <div style={{ height: "250px", borderTop: "1px solid #4a5568" }}>
          <InteractiveTerminalPanel projectPath={state.projectPath || ""} />
        </div>
      )}

      {/* Admin Modal with correct AdminModalProps interface */}
      {state.isAdminModalOpen && (
        <AdminModal
          isOpen={state.isAdminModalOpen}
          onClose={() =>
            dispatch({ type: "SET_ADMIN_MODAL_OPEN", payload: false })
          }
          settings={state.appSettings}
          onSave={(settings) => {
            dispatch({ type: "SET_APP_SETTINGS", payload: settings });
            dispatch({ type: "SET_ADMIN_MODAL_OPEN", payload: false });
          }}
        />
      )}

      {/* Toast Notifications */}
      <div
        style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1000 }}
      >
        {state.toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              backgroundColor:
                toast.type === "error"
                  ? "#fc8181"
                  : toast.type === "success"
                    ? "#68d391"
                    : "#63b3ed",
              color: "white",
              padding: "12px 16px",
              borderRadius: "6px",
              marginBottom: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </div>
    </QueryClientProvider>
  );
};

const App: React.FC = () => {
  // Keyboard shortcuts integration (App-level handlers)
  const _handleCommandPalette = () => {
    console.log("Command palette triggered");
    // This would open a command palette modal
  };

  const _handleGlobalSearch = () => {
    console.log("Global search triggered");
    // This would open a search modal
  };

  const _handleToggleTerminal = () => {
    console.log("Toggle terminal triggered");
    // This would dispatch terminal toggle action
  };

  const _handleFocusEditor = () => {
    console.log("Focus editor triggered");
    // This would focus the editor
  };

  const _handleFocusExplorer = () => {
    console.log("Focus explorer triggered");
    // This would focus the project explorer
  };

  const _handleFocusAI = () => {
    console.log("Focus AI triggered");
    // This would focus the AI panel
  };

  const _handleNewFile = () => {
    console.log("New file triggered");
    // This would create a new file
  };

  const _handleSaveFile = () => {
    console.log("Save file triggered");
    // This would save the current file
  };

  const _handleOpenFolder = () => {
    console.log("Open folder triggered");
    // This would open folder dialog
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-lg border border-red-500/20 p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Application Error
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              The application encountered an unexpected error and is attempting
              to recover.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error("🚨 App Error:", error, errorInfo);
        // In production, send to error reporting service
      }}
    >
      <KeyboardShortcuts
        onCommand={console.log}
        onShowCommandPalette={_handleCommandPalette}
        onGlobalSearch={_handleGlobalSearch}
        onToggleTerminal={_handleToggleTerminal}
        onFocusEditor={_handleFocusEditor}
        onFocusExplorer={_handleFocusExplorer}
        onFocusAI={_handleFocusAI}
        onNewFile={_handleNewFile}
        onSaveFile={_handleSaveFile}
        onOpenFolder={_handleOpenFolder}
      >
        <TestingProvider>
          <ProjectExplorerContext.Provider
            value={{ rootPath: "/default/path" }}
          >
            <AppProvider
              value={{
                addToast: (message, type) =>
                  console.log(`Toast: ${message} (${type})`),
                setLoadingState: (action, value) =>
                  console.log(`Loading ${action}: ${value}`),
                isGlobalLoading: false,
                appSettings: {
                  aiPersona: "You are an expert AI programming assistant.",
                  customRules: "",
                  explorerStyle: "list",
                  availableModels: [
                    {
                      id: "gemini-2.5-flash",
                      name: "Gemini 2.5 Flash (Recommended)",
                      isLocal: false,
                    },
                    {
                      id: "gemini-2.0-flash",
                      name: "Gemini 2.0 Flash",
                      isLocal: false,
                    },
                    {
                      id: "gemini-2.0-flash-001",
                      name: "Gemini 2.0 Flash (Stable)",
                      isLocal: false,
                    },
                  ],
                  desktopSettings: { fileSystem: true, database: false },
                  aiTools: {
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
                  aiTeamConfiguration: [],
                  logVerbosity: "normal",
                },
                setAppSettings: (settings) => {
                  localStorage.setItem("appSettings", JSON.stringify(settings));
                },
              }}
            >
              <AppContent />
            </AppProvider>
          </ProjectExplorerContext.Provider>
        </TestingProvider>
      </KeyboardShortcuts>
    </ErrorBoundary>
  );
};

export default App;
