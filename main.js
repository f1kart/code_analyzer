/* eslint-disable no-console */
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  Menu,
  shell,
} from "electron";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { promises as fs } from "fs";
import fsSync from "fs";
import { exec } from "child_process";
import dotenv from "dotenv";
import chokidar from "chokidar";
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  Type,
} from "@google/genai";
import simpleGit from "simple-git";
import os from "os";
import { randomUUID } from "crypto";
let pty;
try {
  pty = await import("node-pty");
} catch {
  pty = null;
}
let prettier = null;
try {
  // Dynamic import so app still runs if Prettier is not installed
  prettier = await import("prettier");
} catch {
  prettier = null;
}
let PrismaClient = null;
try {
  const prismaModule = await import("@prisma/client");
  PrismaClient = prismaModule.PrismaClient;
} catch (error) {
  console.warn("Prisma client not available:", error?.message || error);
}

// --- Globals ---
let mainWindow;
let ai;
let grokConfig = null;
let prisma = null;
let isDatabaseEnabled = false;
const ptySessions = new Map(); // id -> { pty, cwd }
const directoryWatchers = new Map(); // watchId -> chokidar.FSWatcher
let currentProjectRoot = null;
const RECENT_PROJECTS_LIMIT = 20;
let recentProjectsCache = null;

const getRecentProjectsStorePath = () =>
  path.join(app.getPath("userData"), "recent-projects.json");

async function loadRecentProjects() {
  if (recentProjectsCache) return recentProjectsCache;
  const storePath = getRecentProjectsStorePath();
  try {
    const contents = await fs.readFile(storePath, "utf-8");
    const parsed = JSON.parse(contents);
    if (Array.isArray(parsed)) {
      recentProjectsCache = parsed;
      return recentProjectsCache;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Failed to load recent projects:", error.message);
    }
  }
  recentProjectsCache = [];
  return recentProjectsCache;
}

async function storeRecentProjects(projects) {
  const storePath = getRecentProjectsStorePath();
  try {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(projects, null, 2), "utf-8");
    recentProjectsCache = projects;
  } catch (error) {
    console.error("Failed to persist recent projects:", error.message);
  }
}

// --- Environment & AI Initialization ---
try {
  // Fix dotenv loading for ES modules - use import.meta.url instead of __dirname
  const envPath = path.join(__dirname, ".env");
  const envLocalPath = path.join(__dirname, ".env.local");

  // Load .env file
  if (fsSync.existsSync(envPath)) {
    dotenv.config({ path: envPath });

    // Open a single file via dialog
    ipcMain.handle("files:open-file-dialog", async () => {
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog(
          mainWindow,
          {
            properties: ["openFile"],
            filters: [{ name: "Text & Code", extensions: ["*"] }],
          },
        );
        if (canceled || filePaths.length === 0) return null;
        const filePath = filePaths[0];
        return { filePath };
      } catch (error) {
        console.error("Error in files:open-file-dialog:", error);
        return { error: error.message };
      }
    });

    // Create a minimal project skeleton
    ipcMain.handle("project:create", async () => {
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: "Create New Project Folder",
          buttonLabel: "Create",
          properties: ["createDirectory", "showOverwriteConfirmation"],
        });
        if (canceled || !filePath) return { success: false };

        const projectPath = filePath;
        // Ensure directory exists
        await fs.mkdir(projectPath, { recursive: true });

        // Write minimal files if they don't already exist
        const pkgJsonPath = path.join(projectPath, "package.json");
        const srcDir = path.join(projectPath, "src");
        const indexPath = path.join(srcDir, "index.js");
        const readmePath = path.join(projectPath, "README.md");
        const gitignorePath = path.join(projectPath, ".gitignore");

        const writeIfMissing = async (p, content) => {
          try {
            await fs.access(p);
          } catch {
            await fs.writeFile(p, content, "utf-8");
          }
        };

        await fs.mkdir(srcDir, { recursive: true });
        await writeIfMissing(
          pkgJsonPath,
          JSON.stringify(
            {
              name: path.basename(projectPath),
              version: "1.0.0",
              private: true,
            },
            null,
            2,
          ),
        );
        await writeIfMissing(
          indexPath,
          "console.log('Hello from new project');\n",
        );
        await writeIfMissing(
          readmePath,
          `# ${path.basename(projectPath)}\n\nCreated with Gemini Code IDE.`,
        );
        await writeIfMissing(
          gitignorePath,
          `node_modules\n.dist\n.build\n.env\n.env.local\n`,
        );

        return { success: true, projectPath, readmePath };
      } catch (error) {
        console.error("Error in project:create:", error);
        return { success: false, error: error.message };
      }
    });
    console.log(".env file loaded successfully");
  } else {
    console.log(".env file not found at:", envPath);
  }

  // Load .env.local file
  if (fsSync.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
    console.log(".env.local file loaded successfully");
  } else {
    console.log(".env.local file not found at:", envLocalPath);
  }

  // Check for API keys
  const apiKey =
    process.env.API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  console.log("API Key status:", apiKey ? "Found" : "Not found");
  console.log(
    "Available env vars:",
    Object.keys(process.env).filter(
      (key) =>
        key.includes("API") || key.includes("GEMINI") || key.includes("GOOGLE"),
    ),
  );

  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    console.log("Gemini AI initialized successfully");
  } else {
    console.log(
      "No Gemini API key found. Checked API_KEY, GEMINI_API_KEY, and GOOGLE_API_KEY. Gemini features will be disabled.",
    );
  }

  const grokApiKey =
    process.env.GROK_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROK_BEARER_TOKEN;

  if (grokApiKey) {
    grokConfig = {
      apiKey: grokApiKey,
      endpoint:
        process.env.GROK_API_ENDPOINT ||
        "https://api.x.ai/v1/chat/completions",
      organization: process.env.GROK_ORGANIZATION || undefined,
    };
    console.log("Grok AI configured successfully");
  } else {
    console.log(
      "No Grok API key found. Set GROK_API_KEY or XAI_API_KEY to enable Grok fallback.",
    );
  }
} catch (error) {
  console.error('Error initializing GoogleGenAI:', error);
  ai = null;
}

// Initialize Prisma if available
async function initializePrisma() {
  try {
    console.log("Checking Prisma availability...");
    console.log("PrismaClient available:", !!PrismaClient);
    console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);

    if (
      PrismaClient &&
      typeof PrismaClient === "function" &&
      process.env.DATABASE_URL
    ) {
      console.log("Attempting to initialize Prisma client...");
      prisma = new PrismaClient({
        log: ["error", "warn"],
        errorFormat: "minimal",
      });

      // Test the connection
      await prisma.$connect();
      console.log("Prisma client connected successfully");

      // Test a simple query to ensure it's working
      await prisma.$queryRaw`SELECT 1`;
      console.log("Prisma database connection verified");
      isDatabaseEnabled = true;
    } else {
      if (!PrismaClient)
        console.log("PrismaClient not available; database features disabled.");
      if (typeof PrismaClient !== "function")
        console.log(
          "PrismaClient is not a constructor; database features disabled.",
        );
      if (!process.env.DATABASE_URL)
        console.log("DATABASE_URL not set; database features disabled.");
      prisma = null;
      isDatabaseEnabled = false;
    }
  } catch (error) {
    console.error("Error initializing Prisma:", error.message);
    console.error("Full error:", error);
    console.log(
      "Database features will be disabled. Application will continue without database.",
    );
    prisma = null;
    isDatabaseEnabled = false;
  }
}

// --- Main Window Creation ---
const createWindow = async () => {
  // FORCE CLEAR ALL CACHES ON STARTUP
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData();
    console.log('[CACHE] Cleared all caches and storage');
  } catch (err) {
    console.error('[CACHE] Error clearing cache:', err);
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      cache: false,
    },
  });

  // Global context menu enabling cut/copy/paste in the desktop shell
  mainWindow.webContents.on("context-menu", (event, params) => {
    event.preventDefault();

    const template = [];

    if (params.editFlags.canUndo) {
      template.push({ role: "undo" });
    }
    if (params.editFlags.canRedo) {
      template.push({ role: "redo" });
    }
    if (template.length) {
      template.push({ type: "separator" });
    }

    if (params.selectionText && params.selectionText.trim().length > 0) {
      template.push({ role: "copy" });
    }

    if (params.isEditable) {
      template.push({ role: "cut", enabled: params.editFlags.canCut });
      template.push({ role: "copy", enabled: params.editFlags.canCopy });
      template.push({ role: "paste", enabled: params.editFlags.canPaste });
      template.push({ role: "selectAll" });
    }

    if (template.length === 0) {
      template.push({ role: "copy" });
    }

    if (process.env.NODE_ENV !== "production") {
      template.push({ type: "separator" });
      template.push({ role: "reload" });
      template.push({ role: "forcereload" });
      template.push({ role: "toggleDevTools" });
    }

    Menu.buildFromTemplate(template).popup({ window: mainWindow });
  });

  // --- Content Security Policy - Development-friendly for Vite HMR ---
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self' data: blob:; ` +
          `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5175 http://localhost:5174 ws://localhost:5174; ` +
          `style-src 'self' 'unsafe-inline'; ` +
          `img-src 'self' data: blob:; ` +
          `connect-src 'self' http://localhost:5175 http://localhost:5174 ws://localhost:5174 https://generativelanguage.googleapis.com; ` +
          `font-src 'self' data:;`
        ],
      },
    });
  });

  loadVite(mainWindow);
};

// --- Load Content (Vite for Dev, Static for Prod) ---
const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

const loadVite = async (win, attempt = 1) => {
  // Try multiple common Vite ports
  const possiblePorts = [5175, 5174, 5173, 3000, 8080];
  let viteUrl = null;

  for (const port of possiblePorts) {
    const url = `http://localhost:${port}`;
    try {
      console.log(`Attempting to connect to Vite server at ${url}...`);
      const response = await fetch(url, { method: "HEAD", timeout: 2000 });
      if (response.ok) {
        viteUrl = url;
        console.log(
          `Successfully connected to Vite development server at ${url}`,
        );
        break;
      }
    } catch (error) {
      // Try next port
    }
  }

  if (viteUrl) {
    await win.loadURL(viteUrl);
  } else {
    console.error("Failed to connect to Vite server on any known port");
    if (attempt < MAX_RETRIES) {
      setTimeout(() => loadVite(win, attempt + 1), RETRY_DELAY);
    } else {
      // Fallback to production build
      const indexPath = path.join(__dirname, "dist", "index.html");
      try {
        console.log(`Falling back to production build at ${indexPath}`);
        await win.loadFile(indexPath);
      } catch (e) {
        dialog.showErrorBox(
          "Failed to load application",
          `Could not connect to Vite server and could not load production build at ${indexPath}. Error: ${e.message}`,
        );
        app.quit();
      }
    }
  }
};

// --- Electron App Lifecycle ---
// Global error handlers to prevent crashes
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't crash the app, just log it
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't crash the app, just log it
});

app.whenReady().then(async () => {
  try {
    await initializePrisma();
    await createWindow();

    // Add crash handler for renderer process
    app.on("render-process-gone", (event, webContents, details) => {
      console.error("Renderer process gone:", details);
      if (details.reason !== "clean-exit") {
        console.error("Renderer crashed, attempting to reload...");
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (e) {
    console.error("Startup error:", e);
    dialog.showErrorBox(
      "Application Startup Error",
      `An unexpected error occurred during startup: ${e.message}\n\n${e.stack}`,
    );
    app.quit();
  }
});

ipcMain.handle("files:write-file", async (_event, filePath, content, encoding = "utf-8") => {
  try {
    await fs.writeFile(filePath, content, encoding);
    return { success: true };
  } catch (error) {
    console.error("Error writing file:", error);
    return { success: false, error: error.message };
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- File System IPC Handlers ---

// Helper function for recursive directory reading
async function readDirRecursive(
  dir,
  files,
  maxFiles,
  textExtensions,
  folderPath,
  depth = 0,
) {
  if (files.length >= maxFiles || depth > 10) return; // Prevent infinite recursion and limit files

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path
        .relative(folderPath, fullPath)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        // Skip common directories that cause issues
        if (
          [
            "node_modules",
            ".git",
            ".vscode",
            "dist",
            "build",
            "coverage",
            ".next",
            ".nuxt",
            "target",
            "bin",
            "obj",
          ].includes(entry.name) ||
          entry.name.startsWith(".")
        ) {
          continue;
        }
        await readDirRecursive(
          fullPath,
          files,
          maxFiles,
          textExtensions,
          folderPath,
          depth + 1,
        );
      } else {
        // Only read text files and limit file size
        const ext = path.extname(entry.name).toLowerCase();
        if (textExtensions.includes(ext)) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > 1024 * 1024) {
              // Skip files larger than 1MB
              console.log(
                `Skipping large file: ${fullPath} (${stats.size} bytes)`,
              );
              continue;
            }

            const content = await fs.readFile(fullPath, "utf-8");
            files.push({
              name: entry.name,
              content: content,
              identifier: relativePath,
              size: stats.size,
              modified: stats.mtime,
            });
          } catch (error) {
            console.error(`Could not read file: ${fullPath}`, error.message);
            // Add file entry without content for files that can't be read
            files.push({
              name: entry.name,
              content: `// Error reading file: ${error.message}`,
              identifier: relativePath,
              size: 0,
              modified: new Date(),
              error: true,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Could not read directory: ${dir}`, error.message);
  }
}

// Helper function for building folder tree
async function buildTree(dir, tree, folderPath, depth = 0) {
  if (depth > 10) return; // Prevent infinite recursion

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path
        .relative(folderPath, fullPath)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        // Skip common directories that cause issues
        if (
          [
            "node_modules",
            ".git",
            ".vscode",
            "dist",
            "build",
            "coverage",
            ".next",
            ".nuxt",
            "target",
            "bin",
            "obj",
          ].includes(entry.name) ||
          entry.name.startsWith(".")
        ) {
          continue;
        }

        const dirNode = {
          name: entry.name,
          type: "directory",
          path: relativePath,
          absolutePath: fullPath,
          children: [],
        };

        await buildTree(fullPath, dirNode.children, folderPath, depth + 1);
        tree.push(dirNode);
      } else {
        tree.push({
          name: entry.name,
          type: "file",
          path: relativePath,
          absolutePath: fullPath,
          extension: path.extname(entry.name).toLowerCase(),
        });
      }
    }
  } catch (error) {
    console.error(`Could not read directory: ${dir}`, error.message);
  }
}

const toPosixPath = (inputPath) => inputPath.replace(/\\/g, "/");

async function collectDirectoryEntries(dirPath, recursive = false, basePath = dirPath) {
  const entries = [];
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = path.join(dirPath, dirent.name);
    const relativePath = toPosixPath(path.relative(basePath, fullPath));
    const stats = await fs.stat(fullPath);

    if (dirent.isDirectory()) {
      const entry = {
        name: dirent.name,
        path: relativePath,
        relativePath,
        absolutePath: fullPath,
        type: "directory",
        size: stats.size,
        lastModified: stats.mtimeMs,
        isDirectory: true,
        isHidden: dirent.name.startsWith("."),
      };
      entries.push(entry);
      if (recursive) {
        const children = await collectDirectoryEntries(fullPath, true, basePath);
        entry.children = children;
      }
    } else {
      entries.push({
        name: dirent.name,
        path: relativePath,
        relativePath,
        absolutePath: fullPath,
        type: "file",
        size: stats.size,
        lastModified: stats.mtimeMs,
        extension: path.extname(dirent.name).toLowerCase(),
        isDirectory: false,
        isHidden: dirent.name.startsWith("."),
      });
    }
  }

  return entries;
}

async function computeProjectStats(projectPath) {
  const result = {
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    fileTypes: {},
  };

  const stack = [projectPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const dirents = await fs.readdir(current, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(current, dirent.name);
      if (dirent.isDirectory()) {
        result.totalDirectories += 1;
        if (
          [
            "node_modules",
            ".git",
            "dist",
            "build",
            "coverage",
            ".next",
            ".nuxt",
            "target",
          ].includes(dirent.name)
        ) {
          continue;
        }
        stack.push(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        result.totalFiles += 1;
        result.totalSize += stats.size;
        const ext = path.extname(dirent.name).toLowerCase() || "<no-ext>";
        result.fileTypes[ext] = (result.fileTypes[ext] || 0) + 1;
      }
    }
  }

  return result;
}

ipcMain.handle("files:open-folder-dialog", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (canceled || filePaths.length === 0) return null;

    const folderPath = filePaths[0];
    currentProjectRoot = folderPath;
    const files = [];
    const maxFiles = 1000; // Limit to prevent crashes
    const textExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".json",
      ".html",
      ".css",
      ".scss",
      ".md",
      ".txt",
      ".xml",
      ".yml",
      ".yaml",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".php",
      ".rb",
      ".go",
      ".rs",
      ".sh",
      ".bat",
      ".ps1",
      ".sql",
      ".vue",
      ".svelte",
    ];

    console.log(`Opening folder: ${folderPath}`);
    await readDirRecursive(
      folderPath,
      files,
      maxFiles,
      textExtensions,
      folderPath,
    );
    console.log(`Loaded ${files.length} files from ${folderPath}`);

    const projects = await loadRecentProjects();
    const filtered = projects.filter((project) => project.path !== folderPath);
    filtered.unshift({
      name: path.basename(folderPath),
      path: folderPath,
      lastOpened: Date.now(),
      type: "folder",
    });
    await storeRecentProjects(filtered.slice(0, RECENT_PROJECTS_LIMIT));

    return {
      folderPath,
      files: files.slice(0, maxFiles), // Ensure we don't exceed limit
      totalFiles: files.length,
      truncated: files.length >= maxFiles,
    };
  } catch (error) {
    console.error("Error in files:open-folder-dialog:", error);
    return { error: error.message };
  }
});

// Get folder tree structure without reading file contents
ipcMain.handle("files:get-folder-tree", async (event, folderPath) => {
  try {
    const tree = [];

    await buildTree(folderPath, tree, folderPath);
    return { tree, folderPath };
  } catch (error) {
    console.error("Error in files:get-folder-tree:", error);
    return { error: error.message };
  }
});

// Read individual file content
ipcMain.handle("files:read-file", async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > 10 * 1024 * 1024) {
      // Skip files larger than 10MB
      return {
        error: `File too large: ${stats.size} bytes`,
        size: stats.size,
      };
    }

    const content = await fs.readFile(filePath, "utf-8");
    return {
      content,
      size: stats.size,
      modified: stats.mtime,
      success: true,
    };
  } catch (error) {
    console.error(`Error reading file: ${filePath}`, error);
    return {
      error: error.message,
      success: false,
    };
  }
});

ipcMain.handle("files:save-file", async (event, filePath, content) => {
  try {
    // Try to format via Prettier if available
    try {
      if (prettier && typeof content === "string") {
        content = await prettier.format(content, {
          filepath: filePath || "file.txt",
        });
      }
    } catch (e) {
      console.warn("Prettier format failed:", e?.message || String(e));
    }
    await fs.writeFile(filePath, content, "utf-8");
    return { success: true };
  } catch (error) {
    console.error(`Error saving file: ${filePath}`, error);
    return { success: false, error: error.message };
  }
});

// Allow manual formatting requests from renderer (without saving)
ipcMain.handle("files:format", async (_event, filePath, content) => {
  try {
    if (!prettier) {
      return { success: false, error: "Prettier not installed" };
    }
    const formatted = await prettier.format(String(content ?? ""), {
      filepath: filePath || "file.txt",
    });
    return { success: true, content: formatted };
  } catch (error) {
    console.error("Error in files:format:", error);
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle("files:create-file", async (event, projectPath) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Create New File",
    defaultPath: projectPath,
  });
  if (canceled || !filePath) return null;

  try {
    await fs.writeFile(filePath, "", "utf-8");
    return {
      name: path.basename(filePath),
      content: "",
      identifier: path.relative(projectPath, filePath).replace(/\\/g, "/"),
    };
  } catch (error) {
    console.error("Error creating file:", error);
    dialog.showErrorBox(
      "File Creation Error",
      `Could not create the file: ${error.message}`,
    );
    return null;
  }
});

ipcMain.handle(
  "files:delete-file",
  async (event, projectPath, fileIdentifier) => {
    const filePath = path.join(projectPath, fileIdentifier);
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Cancel", "Delete"],
      defaultId: 1,
      title: "Confirm Deletion",
      message: `Are you sure you want to delete this file?\n\n${fileIdentifier}`,
      detail: "This action cannot be undone.",
    });

    if (response === 1) {
      // Delete button
      try {
        await fs.unlink(filePath);
        return { success: true };
      } catch (error) {
        console.error("Error deleting file:", error);
        return { success: false, error: error.message };
      }
    }
    return { success: false };
  },
);

ipcMain.handle("files:read-directory", async (_event, dirPath, recursive = false) => {
  try {
    const entries = await collectDirectoryEntries(dirPath, recursive);
    return entries;
  } catch (error) {
    console.error("Error in files:read-directory:", error);
    return [];
  }
});

ipcMain.handle("files:create-directory", async (_event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error("Error creating directory:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:delete-directory", async (_event, dirPath, recursive = false) => {
  try {
    if (recursive) {
      await fs.rm(dirPath, { recursive: true, force: true });
    } else {
      await fs.rmdir(dirPath);
    }
    return { success: true };
  } catch (error) {
    console.error("Error deleting directory:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:rename", async (_event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error("Error renaming file:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:copy", async (_event, sourcePath, destPath) => {
  try {
    await fs.copyFile(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error("Error copying file:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:move", async (_event, sourcePath, destPath) => {
  try {
    await fs.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    console.error("Error moving file:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("files:get-stats", async (_event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtimeMs,
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    console.error("Error getting file stats:", error);
    return null;
  }
});

ipcMain.handle("files:watch-directory", async (event, dirPath) => {
  try {
    const watchId = randomUUID();
    const watcher = chokidar.watch(dirPath, {
      ignoreInitial: true,
      persistent: true,
    });

    const sendEvent = (type, targetPath, metadata = {}) => {
      event.sender.send("files:watch-event", {
        watchId,
        type,
        eventType: type,
        path: toPosixPath(targetPath),
        timestamp: Date.now(),
        ...metadata,
      });
    };

    watcher
      .on("add", (filePath) => sendEvent("created", filePath))
      .on("change", (filePath) => sendEvent("modified", filePath))
      .on("unlink", (filePath) => sendEvent("deleted", filePath))
      .on("addDir", (dir) => sendEvent("created", dir))
      .on("unlinkDir", (dir) => sendEvent("deleted", dir))
      .on("error", (error) =>
        sendEvent("error", dirPath, { error: error?.message || String(error) }),
      );

    directoryWatchers.set(watchId, watcher);
    event.sender.once("destroyed", () => {
      watcher
        .close()
        .catch((error) =>
          console.warn("Watcher close after destroy failed:", error.message),
        );
      directoryWatchers.delete(watchId);
    });
    return { watchId };
  } catch (error) {
    console.error("Error setting up watcher:", error);
    return { error: error.message };
  }
});

ipcMain.handle("files:unwatch-directory", async (_event, watchId) => {
  const watcher = directoryWatchers.get(watchId);
  if (watcher) {
    try {
      await watcher.close();
    } catch (error) {
      console.warn("Error closing watcher:", error.message);
    }
    directoryWatchers.delete(watchId);
  }
});

ipcMain.handle("files:search", async (_event, dirPath, pattern, options = {}) => {
  const results = [];
  const regex = new RegExp(pattern, "i");
  const includeContent = options.includeContent ?? false;
  const maxResults = options.maxResults ?? 200;

  async function traverse(currentPath) {
    if (results.length >= maxResults) return;
    const dirents = await fs.readdir(currentPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(currentPath, dirent.name);
      if (dirent.isDirectory()) {
        await traverse(fullPath);
      } else if (regex.test(dirent.name)) {
        const entry = { path: toPosixPath(fullPath) };
        if (includeContent) {
          try {
            const lines = (await fs.readFile(fullPath, "utf-8")).split("\n");
            entry.matches = lines
              .map((line, idx) =>
                regex.test(line)
                  ? { line: idx + 1, column: line.search(regex) + 1, content: line }
                  : null,
              )
              .filter(Boolean);
          } catch (error) {
            console.warn("Error reading file during search:", error.message);
          }
        }
        results.push(entry);
        if (results.length >= maxResults) break;
      }
    }
  }

  try {
    await traverse(dirPath);
  } catch (error) {
    console.error("Error searching files:", error.message);
  }

  return results.slice(0, maxResults);
});

ipcMain.handle("files:get-project-stats", async (_event, projectPath) => {
  try {
    return await computeProjectStats(projectPath);
  } catch (error) {
    console.error("Error computing project stats:", error.message);
    return null;
  }
});

ipcMain.handle("files:reveal-in-explorer", async (_event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
  } catch (error) {
    console.warn("Failed to reveal in explorer:", error.message);
  }
});

ipcMain.handle("files:open-in-default-app", async (_event, filePath) => {
  try {
    const result = await shell.openPath(filePath);
    if (result) {
      console.warn("Open in default app reported:", result);
    }
  } catch (error) {
    console.warn("Failed to open file:", error.message);
  }
});

ipcMain.handle("files:get-recent-projects", async () => {
  return loadRecentProjects();
});

ipcMain.handle("files:add-recent-project", async (_event, name, projectPath, type) => {
  const projects = await loadRecentProjects();
  const filtered = projects.filter((project) => project.path !== projectPath);
  filtered.unshift({
    name,
    path: projectPath,
    lastOpened: Date.now(),
    type,
  });
  await storeRecentProjects(filtered.slice(0, RECENT_PROJECTS_LIMIT));
});

ipcMain.handle("files:remove-recent-project", async (_event, projectPath) => {
  const projects = await loadRecentProjects();
  const filtered = projects.filter((project) => project.path !== projectPath);
  await storeRecentProjects(filtered);
});

ipcMain.handle("files:get-project-root", async () => currentProjectRoot);

// --- Terminal IPC Handler ---
ipcMain.handle("terminal:run-command", async (_event, payload) => {
  const normalized =
    typeof payload === "string" ? { command: payload } : payload || {};
  const cmd = normalized.command || "";
  const cwd =
    normalized.cwd &&
    typeof normalized.cwd === "string" &&
    normalized.cwd.trim().length > 0
      ? normalized.cwd
      : app.getPath("home");
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: `Error: ${error.message}\n${stderr || ""}`.trim(),
          exitCode: error.code ?? 1,
        });
      } else {
        resolve({ success: true, output: stdout, exitCode: 0 });
      }
    });
  });
});

// --- PTY (Interactive Terminal) IPC Handlers ---
ipcMain.handle("pty:spawn", async (event, cwd, cols = 120, rows = 30) => {
  if (!pty)
    return { success: false, error: "PTY not available on this platform." };
  try {
    const shell =
      process.platform === "win32"
        ? process.env.COMSPEC || "powershell.exe"
        : process.env.SHELL || "/bin/bash";
    const instance = pty.spawn(shell, [], {
      name: "xterm-color",
      cols,
      rows,
      cwd: cwd || os.homedir(),
      env: process.env,
    });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ptySessions.set(id, { pty: instance, cwd: cwd || os.homedir() });
    instance.onData((data) => {
      try {
        event.sender.send("pty:data", { id, data });
      } catch (e) {
        /* ignore */
      }
    });
    instance.onExit(({ exitCode, signal }) => {
      try {
        event.sender.send("pty:exit", { id, exitCode, signal });
      } catch (e) {
        /* ignore */
      }
      ptySessions.delete(id);
    });
    return { success: true, id };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("pty:write", async (_event, id, data) => {
  const sess = ptySessions.get(id);
  if (!sess) return { success: false, error: "Invalid PTY session id" };
  try {
    sess.pty.write(data);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("pty:resize", async (_event, id, cols, rows) => {
  const sess = ptySessions.get(id);
  if (!sess) return { success: false, error: "Invalid PTY session id" };
  try {
    sess.pty.resize(cols, rows);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("pty:kill", async (_event, id) => {
  const sess = ptySessions.get(id);
  try {
    sess.pty.kill();
    ptySessions.delete(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- Gemini API Handlers ---

const getModelConfig = (settings, modelId) => {
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];
  return { model: modelId || "gemini-2.5-flash", safetySettings };
};

const getSystemInstruction = (persona, rules, goals) => {
  let instruction = persona || "";
  if (rules) instruction += `\n\nAdhere to these rules:\n${rules}`;
  if (goals && goals.length > 0)
    instruction += `\n\nFocus on these specific goals: ${goals.join(", ")}.`;
  return instruction.trim();
};

const DEFAULT_AI_OPTIONS = {
  temperature: 0.2,
  topP: 0.85,
  maxTokens: 2048,
};

const VALID_PROVIDERS = ["gemini", "grok"];

const normalizeProviderChain = (requestedChain) => {
  const chain = Array.isArray(requestedChain)
    ? requestedChain.map((provider) => String(provider || "").trim().toLowerCase())
    : [];

  const filtered = chain.filter((provider, index) =>
    provider && VALID_PROVIDERS.includes(provider) && chain.indexOf(provider) === index,
  );

  if (!filtered.includes("gemini") && ai) {
    filtered.unshift("gemini");
  }

  if (!filtered.includes("grok") && grokConfig) {
    filtered.push("grok");
  }

  return filtered.length > 0 ? filtered : [ai ? "gemini" : "grok"].filter(Boolean);
};

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) {
    throw new Error("AI request must include a messages array");
  }

  const normalized = [];
  const systemInstructions = [];

  messages.forEach((message, index) => {
    const rawRole = String(message?.role || "").toLowerCase();
    const content =
      message?.content ??
      message?.parts?.[0]?.text ??
      message?.text;

    if (!rawRole) {
      throw new Error(`Message at index ${index} is missing a role`);
    }

    if (content === undefined || content === null || String(content).trim().length === 0) {
      throw new Error(`Message at index ${index} is missing content`);
    }

    const textContent = String(content);

    switch (rawRole) {
      case "system":
        systemInstructions.push(textContent.trim());
        break;
      case "assistant":
      case "model":
        normalized.push({
          role: "model",
          parts: [{ text: textContent }],
        });
        break;
      case "user":
        normalized.push({
          role: "user",
          parts: [{ text: textContent }],
        });
        break;
      default:
        throw new Error(
          `Unsupported message role: ${message?.role}. Valid roles: system, user, model/assistant`,
        );
    }
  });

  if (normalized.length === 0) {
    throw new Error("AI request must include at least one user or model message");
  }

  return {
    messages: normalized,
    systemInstruction:
      systemInstructions.length > 0
        ? systemInstructions.filter(Boolean).join("\n\n").trim()
        : undefined,
  };
};

const callGeminiChat = async ({ messages, model, options, systemInstruction }) => {
  if (!ai) {
    throw new Error("Gemini provider is not configured");
  }

  const response = await ai.models.generateContent({
    model: model || "gemini-2.5-pro-preview-03-25",
    contents: messages,
    systemInstruction: systemInstruction
      ? {
          role: "system",
          parts: [{ text: systemInstruction }],
        }
      : undefined,
    generationConfig: {
      temperature: options?.temperature ?? DEFAULT_AI_OPTIONS.temperature,
      topP: options?.topP ?? DEFAULT_AI_OPTIONS.topP,
      maxOutputTokens: options?.maxTokens ?? DEFAULT_AI_OPTIONS.maxTokens,
    },
  });

  return response.text;
};

const callGrokChat = async ({ messages, model, options, systemInstruction }) => {
  if (!grokConfig?.apiKey) {
    throw new Error("Grok provider is not configured");
  }

  const grokMessages = [
    ...(systemInstruction
      ? [{ role: "system", content: systemInstruction }]
      : []),
    ...messages.map((message) => ({
      role: message.role === "model" ? "assistant" : "user",
      content: message.parts?.map((part) => part.text).join("\n") ?? "",
    })),
  ];

  const response = await fetch(grokConfig.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${grokConfig.apiKey}`,
      ...(grokConfig.organization ? { "X-Org": grokConfig.organization } : {}),
    },
    body: JSON.stringify({
      model: model || "grok-beta",
      temperature: options?.temperature ?? DEFAULT_AI_OPTIONS.temperature,
      top_p: options?.topP ?? DEFAULT_AI_OPTIONS.topP,
      max_tokens: options?.maxTokens ?? DEFAULT_AI_OPTIONS.maxTokens,
      messages: grokMessages,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Grok API error (${response.status}): ${errorPayload}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Grok returned an empty response");
  }

  return Array.isArray(content)
    ? content.map((item) => item.text || item).join("\n")
    : content;
};

ipcMain.handle("ai:chat", async (_event, requestPayload = {}) => {
  const {
    messages,
    providerChain,
    model,
    options,
    systemInstruction,
  } = requestPayload || {};

  const { messages: normalizedMessages, systemInstruction: derivedInstruction } =
    normalizeMessages(messages);
  const mergedSystemInstruction = [
    typeof systemInstruction === "string" ? systemInstruction.trim() : "",
    derivedInstruction || "",
  ]
    .filter((value) => value && value.length > 0)
    .join("\n\n")
    .trim() || undefined;

  const chain = normalizeProviderChain(providerChain);

  let lastError = null;
  for (const provider of chain) {
    try {
      switch (provider) {
        case "gemini":
          return {
            provider,
            content: await callGeminiChat({
              messages: normalizedMessages,
              model,
              options,
              systemInstruction: mergedSystemInstruction,
            }),
          };
        case "grok":
          return {
            provider,
            content: await callGrokChat({
              messages: normalizedMessages,
              model,
              options,
              systemInstruction: mergedSystemInstruction,
            }),
          };
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      lastError = error;
      const message = error?.message || String(error);
      const isRetryable = /429|quota|rate limit|timeout|temporarily unavailable/i.test(message);
      console.warn(`[ai:chat] Provider ${provider} failed: ${message}`);

      if (!isRetryable || provider === chain[chain.length - 1]) {
        throw error;
      }
    }
  }

  throw lastError || new Error("AI bridge exhausted all providers without success");
});

// Simple availability check for renderer
ipcMain.handle("gemini:is-available", async () => {
  try {
    return { available: !!ai };
  } catch {
    return { available: false };
  }
});

// Generic chat handler
ipcMain.handle("gemini:chat", async (event, history, settings, modelId) => {
  if (!ai)
    throw new Error("Gemini AI is not initialized. Please check your API_KEY.");
  const modelConfig = getModelConfig(settings, modelId);
  const response = await ai.models.generateContent({
    ...modelConfig,
    contents: history,
    config: {
      systemInstruction: getSystemInstruction(
        settings?.aiPersona,
        settings?.customRules,
        [],
      ),
    },
  });
  return response.text;
});

ipcMain.handle(
  "gemini:summarizePlaceholders",
  async (event, code, language) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const prompt = `Scan the following ${language} code for placeholders, TODOs, FIXMEs, or incomplete logic. Provide a concise summary of what needs to be completed:\n\n\`\`\`${language}\n${code}\n\`\`\``;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text;
  },
);

ipcMain.handle(
  "gemini:refactorCode",
  async (event, code, language, goals, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const modelConfig = getModelConfig(settings, modelId);
    const systemInstruction = getSystemInstruction(
      settings.aiPersona,
      settings.customRules,
      goals,
    );

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description:
            "A detailed, markdown-formatted explanation of the changes made.",
        },
        refactoredCode: {
          type: Type.STRING,
          description: "The complete, refactored code block.",
        },
      },
      required: ["summary", "refactoredCode"],
    };

    const prompt = `Refactor the following ${language} code based on my goals. Provide the full, refactored code and a summary of changes.\n\n\`\`\`${language}\n${code}\n\`\`\``;

    const response = await ai.models.generateContent({
      ...modelConfig,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return JSON.parse(response.text);
  },
);

ipcMain.handle(
  "gemini:aiTeamRefactorCode",
  async (
    event,
    code,
    language,
    goals,
    settings,
    fileIdentifier,
    selectedModelId,
  ) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const steps = [];
    let currentCode = code;

    const orderedAgents = settings.aiTeamConfiguration
      .filter((a) => a.enabled)
      .sort((a, b) => a.order - b.order);

    const runAgent = async (role, prompt) => {
      const agentConfig = settings.aiTeamConfiguration.find(
        (a) => a.role === role,
      );
      if (!agentConfig) return null; // Should not happen if logic is correct

      const modelId =
        agentConfig.modelId || selectedModelId || "gemini-2.5-flash";
      const systemPrompt =
        agentConfig.systemPrompt ||
        `You are an AI assistant acting as the ${role}. ${settings.aiPersona}`;

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { systemInstruction: systemPrompt },
      });
      const content = response.text;
      steps.push({ role, content });
      return content;
    };

    let previousStepsContent = "";
    for (const agent of orderedAgents) {
      let prompt;
      switch (agent.role) {
        case "Brainstormer":
          prompt = `Analyze this ${language} code from file "${fileIdentifier}" and the user's refactoring goals: [${goals.join(", ")}]. Identify potential issues, improvements, and missing requirements. Provide a concise analysis. Do not write any code.\n\nCode:\n${code}`;
          break;
        case "Planner":
          prompt = `Based on the Brainstormer's analysis and user goals, create a detailed, step-by-step plan to refactor the code. The plan should be clear and actionable for the Coder agent.\n\nUser Goals: [${goals.join(", ")}]\n\nCode:\n${code}\n\nPrevious Analysis:\n${previousStepsContent}`;
          break;
        case "Coder":
          prompt = `Execute the provided plan to refactor the code. IMPORTANT: Provide ONLY the complete, final, and clean code block in a single markdown block. Do not add any explanations, introductions, or pleasantries.\n\nPlan:\n${previousStepsContent}\n\nOriginal Code:\n${code}`;
          break;
        case "Critic":
          prompt = `Critically review the refactored code. Does it successfully meet the user's goals and the original plan? Are there any new bugs, logical errors, or regressions? Provide a concise critique.\n\nUser Goals: [${goals.join(", ")}]\n\nPlan & Analysis:\n${previousStepsContent}\n\nRefactored Code:\n${currentCode}`;
          break;
        case "Integrator":
          prompt = `Based on all previous steps (analysis, plan, code, critique), provide a final, clean version of the code and a single, concise summary of all the changes made. Format the summary nicely using markdown.\n\nPrevious Steps:\n${previousStepsContent}\n\nLast Code Version:\n${currentCode}`;
          break;
        default: // For other agents like SecurityAnalyst, Optimizer, etc.
          prompt = `You are the ${agent.role}. Analyze the following code from the perspective of your role and provide suggestions for improvement. Previous analysis is provided for context.\n\nUser Goals: [${goals.join(", ")}]\n\nCode:\n${currentCode}\n\nPrevious Steps:\n${previousStepsContent}`;
          break;
      }

      const result = await runAgent(agent.role, prompt);

      if (agent.role === "Coder") {
        currentCode = result.match(/```(?:\w+\n)?([\s\S]+)```/)?.[1] || result;
      }

      previousStepsContent += `\n\n--- ${agent.role} ---\n${result}`;

      if (agent.role === "Integrator") {
        const finalCode =
          result.match(/```(?:\w+\n)?([\s\S]+)```/)?.[1] || currentCode;
        const finalSummary = result
          .replace(/```(?:\w+\n)?([\s\S]+)```/, "")
          .trim();
        return { steps, summary: finalSummary, refactoredCode: finalCode };
      }
    }

    // Fallback if Integrator wasn't run
    return {
      steps,
      summary: "AI Team process completed without an Integrator step.",
      refactoredCode: currentCode,
    };
  },
);

// Continue AI Team Refactor (post-clarification)
ipcMain.handle(
  "gemini:continueAITeamRefactor",
  async (
    event,
    code,
    language,
    goals,
    settings,
    fileIdentifier,
    selectedModelId,
  ) => {
    // For now, we re-run the AI Team flow with the provided, clarified inputs.
    // This mirrors the logic of aiTeamRefactorCode to maintain behavior parity.
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const result = await ipcMain.invoke(
      "gemini:aiTeamRefactorCode",
      code,
      language,
      goals,
      settings,
      fileIdentifier,
      selectedModelId,
    );
    return result;
  },
);

// Suggest Code Snippets for Chat Assistant
ipcMain.handle(
  "gemini:suggestSnippets",
  async (event, userQuery, activeCode, savedSnippets, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];
    const schema = {
      type: Type.OBJECT,
      properties: {
        reasoning: { type: Type.STRING },
        snippets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              code: { type: Type.STRING },
              language: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["title", "code", "language"],
          },
        },
      },
      required: ["reasoning", "snippets"],
    };

    const prompt = `The user asked: "${userQuery}". Review the active code (if any) and their saved snippets to recommend up to 3 concise code snippets that could help answer or accelerate their task. Return JSON with a short 'reasoning' and 'snippets' array. Avoid duplicates from saved snippets unless significantly improved.\n\nActive Code (may be empty):\n\n\`\`\`\n${activeCode || ""}\n\`\`\`\n\nSaved Snippets (titles):\n${(savedSnippets || []).map((s) => `- ${s.title} [${s.language}]`).join("\n")}`;

    const response = await ai.models.generateContent({
      model: modelId || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        safetySettings,
      },
    });

    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch (e) {
      // Defensive fallback: wrap raw text as a single snippet if JSON parsing fails
      parsed = {
        reasoning: "Model returned non-JSON output; providing raw suggestion.",
        snippets: activeCode
          ? [
              {
                id: Date.now().toString(),
                title: "Suggested Edit",
                code: activeCode,
                language: "plaintext",
                tags: ["suggestion"],
              },
            ]
          : [],
      };
    }

    // Ensure each snippet has an id and tags array
    parsed.snippets = (parsed.snippets || []).map((snip, idx) => ({
      id: snip.id || `${Date.now()}-${idx}`,
      title: snip.title,
      code: snip.code,
      language: snip.language || "plaintext",
      tags: Array.isArray(snip.tags) ? snip.tags : [],
    }));
    return parsed;
  },
);

ipcMain.handle(
  "gemini:aiTeamProjectRefactor",
  async (event, files, goals, settings, selectedModelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );

    const overallSummaryPrompt = `Analyze this project structure and user goals. Provide a high-level summary of a refactoring strategy.\n\nFiles:\n${files.map((f) => f.identifier).join("\n")}\n\nGoals: ${goals.join(", ")}`;
    const overallSummary = (
      await ai.models.generateContent({
        model: selectedModelId,
        contents: [{ role: "user", parts: [{ text: overallSummaryPrompt }] }],
      })
    ).text;

    const refactoredFiles = [];
    for (const file of files) {
      // Simplified refactor for each file
      const fileRefactorPrompt = `Refactor this file (${file.identifier}) based on the overall project goals. Provide a summary and the refactored code.\n\nGoals: ${goals.join(", ")}\n\nOriginal Code:\n${file.content}`;
      const schema = {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          refactoredCode: { type: Type.STRING },
        },
        required: ["summary", "refactoredCode"],
      };
      const response = await ai.models.generateContent({
        model: selectedModelId,
        contents: [{ role: "user", parts: [{ text: fileRefactorPrompt }] }],
        config: {
          systemInstruction: "You are an expert code refactoring agent.",
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      const result = JSON.parse(response.text);
      refactoredFiles.push({
        identifier: file.identifier,
        refactoredCode: result.refactoredCode,
        summary: result.summary,
      });
    }

    return { overallSummary, files: refactoredFiles };
  },
);

ipcMain.handle(
  "gemini:findSimilarCode",
  async (event, files, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const modelConfig = getModelConfig(settings, modelId);

    const fileContents = files
      .map((f) => `--- FILE: ${f.identifier} ---\n${f.content}`)
      .join("\n\n");
    const prompt = `Analyze the following code files. Group them by semantic similarity (i.e., they perform a similar function, even if the code is different). For each group, list the file identifiers, explain why they are similar, and point out key differences.\n\n${fileContents}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        groups: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fileIdentifiers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              reasoning: { type: Type.STRING },
              keyDifferences: { type: Type.STRING },
            },
            required: ["fileIdentifiers", "reasoning", "keyDifferences"],
          },
        },
      },
      required: ["groups"],
    };

    const response = await ai.models.generateContent({
      ...modelConfig,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return JSON.parse(response.text);
  },
);

// --- Git IPC Handlers ---
ipcMain.handle("git:is-enabled", async () => {
  try {
    // Attempt a no-op command to verify git availability
    await simpleGit().raw(["--version"]);
    return { success: true, enabled: true };
  } catch (error) {
    console.warn("Git integration unavailable:", error?.message || error);
    return {
      success: true,
      enabled: false,
      error:
        "Git integration disabled. Ensure Git CLI is installed and accessible from the desktop shell.",
    };
  }
});

ipcMain.handle("git:status", async (_event, repoPath) => {
  try {
    const git = simpleGit({ baseDir: repoPath });
    const status = await git.status();
    return { success: true, status };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("git:stage", async (_event, repoPath, files) => {
  try {
    const git = simpleGit({ baseDir: repoPath });
    await git.add(files);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("git:unstage", async (_event, repoPath, files) => {
  try {
    const git = simpleGit({ baseDir: repoPath });
    await git.reset(["HEAD", ...files]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("git:commit", async (_event, repoPath, message) => {
  try {
    const git = simpleGit({ baseDir: repoPath });
    const result = await git.commit(message);
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle(
  "git:aiCommitMessage",
  async (_event, repoPath, settings, modelId) => {
    if (!ai) return { success: false, error: "AI not initialized" };
    try {
      const git = simpleGit({ baseDir: repoPath });
      const diff = await git.diff(["--staged"]);
      const prompt = `Generate a clear, conventional commit message for the following staged diff. Include a short subject and an optional body.\n\n${diff}`;
      const response = await ai.models.generateContent({
        model: modelId || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { systemInstruction: settings?.aiPersona || "" },
      });
      return { success: true, message: response.text.trim() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
);

// --- Database (Prisma) IPC Handlers ---
ipcMain.handle("db:is-enabled", async () => ({
  success: true,
  enabled: isDatabaseEnabled,
  error: isDatabaseEnabled ? undefined : "Database bridge disabled",
}));

ipcMain.handle("db:snippets:list", async () => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const items = await prisma.codeSnippet.findMany({
      orderBy: { id: "desc" },
    });
    return { success: true, items };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:snippets:create", async (_e, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const item = await prisma.codeSnippet.create({ data });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:snippets:update", async (_e, id, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const item = await prisma.codeSnippet.update({ where: { id }, data });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:snippets:delete", async (_e, id) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    await prisma.codeSnippet.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- Database (Prisma) IPC Handlers: ModelProvider ---
ipcMain.handle("db:providers:list", async () => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const items = await prisma.modelProvider.findMany({
      orderBy: { id: "desc" },
    });
    return { success: true, items };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:providers:create", async (_e, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const item = await prisma.modelProvider.create({ data });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:providers:update", async (_e, id, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const item = await prisma.modelProvider.update({ where: { id }, data });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:providers:delete", async (_e, id) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    await prisma.modelProvider.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- Database (Prisma) IPC Handlers: Workflow & AgentModelMap ---
ipcMain.handle("db:workflows:list", async () => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const items = await prisma.workflow.findMany({
      include: { agentMaps: true },
      orderBy: { id: "desc" },
    });
    return { success: true, items };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:workflows:create", async (_e, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const item = await prisma.workflow.create({
      data: { name: data.name, definition: data.definition },
    });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:workflows:update", async (_e, id, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const item = await prisma.workflow.update({
      where: { id },
      data: { name: data.name, definition: data.definition },
    });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:workflows:delete", async (_e, id) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    await prisma.workflow.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:agentMap:set", async (_e, data) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    // Upsert mapping for a workflow + agentRole
    const existing = await prisma.agentModelMap.findFirst({
      where: { workflowId: data.workflowId, agentRole: data.agentRole },
    });
    const payload = {
      agentRole: data.agentRole,
      primaryModelId: data.primaryModelId,
      collaboratorModelId: data.collaboratorModelId,
      workflowId: data.workflowId,
    };
    const item = existing
      ? await prisma.agentModelMap.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.agentModelMap.create({ data: payload });
    return { success: true, item };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("db:agentMap:list", async (_e, workflowId) => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const items = await prisma.agentModelMap.findMany({
      where: { workflowId },
      include: { primaryModel: true, collaboratorModel: true },
    });
    return { success: true, items };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- Database (Prisma) IPC Handlers: MultiAgentConfig ---
ipcMain.handle("db:multiAgentConfigs:list", async () => {
  if (!prisma) return { success: false, error: "Database not available" };
  try {
    const items = await prisma.multiAgentConfig.findMany({
      orderBy: { agentKey: "asc" },
    });
    const sanitized = items.map((item) => ({
      agentKey: item.agentKey,
      name: item.name,
      role: item.role,
      model: item.model,
      temperature: Number(item.temperature ?? 0),
      systemPrompt: item.systemPrompt,
      maxRetries: item.maxRetries,
    }));
    return { success: true, items: sanitized };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db:multiAgentConfigs:save", async (_event, configs) => {
  if (!prisma) return { success: false, error: "Database not available" };
  if (!Array.isArray(configs)) {
    return { success: false, error: "Invalid payload for multi-agent configs" };
  }

  const normalized = configs.map((config) => {
    const agentKey = String(config.agentKey || "").trim();
    if (!agentKey) {
      throw new Error("Agent key is required");
    }
    const name = String(config.name || "").trim();
    const role = String(config.role || "").trim();
    const model = String(config.model || "").trim();
    const temperatureNumber = Number(config.temperature);
    const temperature = Number.isFinite(temperatureNumber)
      ? Math.min(1, Math.max(0, temperatureNumber))
      : 0.3;
    const systemPrompt = String(config.systemPrompt || "");
    const maxRetriesValue =
      config.maxRetries === null || config.maxRetries === undefined
        ? null
        : Math.max(0, Math.round(Number(config.maxRetries)));

    return {
      agentKey,
      name,
      role,
      model,
      temperature,
      systemPrompt,
      maxRetries: maxRetriesValue,
    };
  });

  const agentKeys = normalized.map((item) => item.agentKey);

  try {
    await prisma.$transaction(async (tx) => {
      for (const config of normalized) {
        await tx.multiAgentConfig.upsert({
          where: { agentKey: config.agentKey },
          update: {
            name: config.name,
            role: config.role,
            model: config.model,
            temperature: config.temperature,
            systemPrompt: config.systemPrompt,
            maxRetries: config.maxRetries,
          },
          create: {
            agentKey: config.agentKey,
            name: config.name,
            role: config.role,
            model: config.model,
            temperature: config.temperature,
            systemPrompt: config.systemPrompt,
            maxRetries: config.maxRetries,
          },
        });
      }

      await tx.multiAgentConfig.deleteMany({
        where: {
          agentKey: {
            notIn: agentKeys,
          },
        },
      });
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "gemini:debugError",
  async (event, errorMessage, relevantFiles, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const modelConfig = getModelConfig(settings, modelId);

    const fileContents = relevantFiles
      .map((f) => `--- FILE: ${f.identifier} ---\n${f.content}`)
      .join("\n\n");
    const prompt = `I encountered an error: "${errorMessage}". Here is the relevant code. Analyze the error, identify the root cause, and provide a fix.\n\n${fileContents}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        explanation: {
          type: Type.STRING,
          description: "Explanation of the root cause.",
        },
        culprit: {
          type: Type.OBJECT,
          properties: {
            fileIdentifier: { type: Type.STRING },
            lineNumber: { type: Type.INTEGER },
            codeSnippet: { type: Type.STRING },
            language: { type: Type.STRING },
          },
          required: ["fileIdentifier", "lineNumber", "codeSnippet", "language"],
        },
        fix: {
          type: Type.OBJECT,
          properties: {
            originalCode: { type: Type.STRING },
            refactoredCode: { type: Type.STRING },
          },
          required: ["originalCode", "refactoredCode"],
        },
      },
      required: ["explanation", "culprit", "fix"],
    };

    const response = await ai.models.generateContent({
      ...modelConfig,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return JSON.parse(response.text);
  },
);

ipcMain.handle(
  "gemini:generateUnitTests",
  async (event, file, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const modelConfig = getModelConfig(settings, modelId);

    const prompt = `Generate a comprehensive suite of unit tests for the following file: ${file.identifier}. Use a common testing framework suitable for the language.\n\n\`\`\`\n${file.content}\n\`\`\``;

    const schema = {
      type: Type.OBJECT,
      properties: {
        testFilePath: { type: Type.STRING },
        testFileContent: { type: Type.STRING },
      },
      required: ["testFilePath", "testFileContent"],
    };

    const response = await ai.models.generateContent({
      ...modelConfig,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    return JSON.parse(response.text);
  },
);

ipcMain.handle(
  "gemini:generateDocumentation",
  async (event, file, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const modelConfig = getModelConfig(settings, modelId);

    const prompt = `Add comprehensive inline documentation (e.g., JSDoc, Python Docstrings) to the following file: ${file.identifier}. Return the full, updated file content.\n\n\`\`\`\n${file.content}\n\`\`\``;

    const response = await ai.models.generateContent({
      ...modelConfig,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return (
      response.text.match(/```(?:\w+\n)?([\s\S]+)```/)?.[1] || response.text
    );
  },
);

ipcMain.handle(
  "gemini:analyzeDependencies",
  async (event, files, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const packageJsonFile = files.find((f) => f.name === "package.json");
    if (!packageJsonFile) {
      return "No package.json file found in the project.";
    }

    const prompt = `Analyze this package.json file. For each dependency and devDependency, provide a brief, one-sentence explanation of its purpose.\n\n${packageJsonFile.content}`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text;
  },
);

ipcMain.handle(
  "gemini:projectSearch",
  async (event, files, query, settings, modelId) => {
    if (!ai)
      throw new Error(
        "Gemini AI is not initialized. Please check your API_KEY.",
      );
    const modelConfig = getModelConfig(settings, modelId);

    const fileContents = files
      .map((f) => `--- FILE: ${f.identifier} ---\n${f.content}`)
      .join("\n\n");
    const prompt = `Search through these files to find code snippets relevant to the query: "${query}". For each result, provide the file identifier, line number, the code snippet itself, and a brief reasoning for its relevance.\n\n${fileContents}`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fileIdentifier: { type: Type.STRING },
          lineNumber: { type: Type.INTEGER },
          snippet: { type: Type.STRING },
          reasoning: { type: Type.STRING },
        },
        required: ["fileIdentifier", "lineNumber", "snippet", "reasoning"],
      },
    };

    const response = await ai.models.generateContent({
      ...modelConfig,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    return JSON.parse(response.text);
  },
);
