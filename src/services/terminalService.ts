// src/services/terminalService.ts
import { getElectronAPI, isElectronAvailable } from '../utils/electronBridge';

type TerminalBridge = NonNullable<Window['electronAPI']>;

const resolveBridge = (): TerminalBridge | undefined => {
  if (!isElectronAvailable()) {
    return undefined;
  }
  return getElectronAPI();
};

const requireTerminalBridge = (): TerminalBridge => {
  const bridge = resolveBridge();
  if (!bridge) {
    throw new Error('Terminal features require the desktop application environment.');
  }
  return bridge;
};

const ensurePtyBridge = (bridge: TerminalBridge) => {
  const pty = bridge.pty;
  if (!pty) {
    throw new Error('Interactive terminal not available in this environment.');
  }
  return pty;
};

/**
 * Executes a terminal command using the backend Node.js process.
 * Fallback for environments where PTY is not available.
 */
export const runCommand = async (
  command: string,
): Promise<{ success: boolean; output: string; error?: string }> => {
  try {
    const bridge = resolveBridge();
    if (!bridge?.runCommand) {
      throw new Error('Terminal access is not available in this environment.');
    }
    return await bridge.runCommand(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[terminalService] runCommand failed:', message);
    return { success: false, output: message, error: message };
  }
};

// PTY interactive APIs
export async function spawnPty(
  cwd?: string,
  cols?: number,
  rows?: number,
): Promise<{ id: string }> {
  const bridge = requireTerminalBridge();
  const pty = ensurePtyBridge(bridge);
  const result = await pty.spawn(cwd ?? '', cols ?? 120, rows ?? 30);
  if (!result || !result.success || typeof result.id !== 'string') {
    throw new Error(result?.error || 'Failed to start PTY session.');
  }
  return { id: result.id };
}

export async function writePty(id: string, data: string): Promise<void> {
  const bridge = requireTerminalBridge();
  const pty = ensurePtyBridge(bridge);
  const result = await pty.write(id, data);
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to write to PTY.');
  }
}

export async function resizePty(id: string, cols: number, rows: number): Promise<void> {
  const bridge = requireTerminalBridge();
  const pty = ensurePtyBridge(bridge);
  const result = await pty.resize(id, cols, rows);
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to resize PTY.');
  }
}

export async function killPty(id: string): Promise<void> {
  const bridge = requireTerminalBridge();
  const pty = ensurePtyBridge(bridge);
  const result = await pty.kill(id);
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to kill PTY.');
  }
}

export function onPtyData(listener: (payload: { id: string; data: string }) => void): () => void {
  const bridge = requireTerminalBridge();
  const pty = ensurePtyBridge(bridge);
  if (!pty.onData) {
    throw new Error('PTY data stream not available in this environment.');
  }
  return pty.onData(listener);
}

export function onPtyExit(
  listener: (payload: { id: string; exitCode?: number; signal?: number }) => void,
): () => void {
  const bridge = requireTerminalBridge();
  const pty = ensurePtyBridge(bridge);
  if (!pty.onExit) {
    throw new Error('PTY exit stream not available in this environment.');
  }
  return pty.onExit(listener);
}
