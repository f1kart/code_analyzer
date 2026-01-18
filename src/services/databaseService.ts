// src/services/databaseService.ts
export type Snippet = {
  id: number;
  title: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

interface DBBridge {
  listSnippets: () => Promise<{ success: boolean; items?: Snippet[]; error?: string }>;
  createSnippet: (
    data: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<{ success: boolean; item?: Snippet; error?: string }>;
  updateSnippet: (
    id: number,
    data: Partial<Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>>,
  ) => Promise<{ success: boolean; item?: Snippet; error?: string }>;
  deleteSnippet: (id: number) => Promise<{ success: boolean; error?: string }>;
}

const isDesktop = (): boolean => typeof window !== 'undefined' && Boolean((window as any)?.electronAPI);

const ensureBridgeAvailable = async (): Promise<DBBridge> => {
  if (!isDesktop()) {
    throw new Error('Database features require the desktop application environment.');
  }

  const api = (window as any).electronAPI?.db;
  if (!api) {
    throw new Error('Database bridge not available in preload context.');
  }

  const status = await (window as any).electronAPI?.db?.isEnabled?.();
  if (!status?.enabled) {
    throw new Error(
      status?.error ||
        'Database bridge not available. Ensure DATABASE_URL is configured and Prisma migrations have run.',
    );
  }

  return api as DBBridge;
};

const normalizeError = (msg: string) => new Error(`Database error: ${msg}`);

export async function listSnippets(): Promise<Snippet[]> {
  const bridge = await ensureBridgeAvailable();
  const res = await bridge.listSnippets();
  if (!res.success) throw normalizeError(res.error || 'Unknown error retrieving snippets.');
  return res.items || [];
}

export async function createSnippet(input: {
  title: string;
  code: string;
  language: string;
  tags?: string[];
}): Promise<Snippet> {
  if (!input.title?.trim()) throw new Error('Title is required');
  if (typeof input.code !== 'string') throw new Error('Code is required');
  const payload = {
    title: input.title.trim(),
    code: input.code,
    language: input.language || 'plaintext',
    tags: input.tags ?? [],
  };
  const bridge = await ensureBridgeAvailable();
  const res = await bridge.createSnippet(payload);
  if (!res.success || !res.item)
    throw normalizeError(res.error || 'Unknown error creating snippet.');
  return res.item;
}

export async function updateSnippet(
  id: number,
  input: Partial<{ title: string; code: string; language: string; tags: string[] }>,
): Promise<Snippet> {
  if (!Number.isFinite(id)) throw new Error('Invalid snippet id');
  const bridge = await ensureBridgeAvailable();
  const res = await bridge.updateSnippet(id, input);
  if (!res.success || !res.item)
    throw normalizeError(res.error || 'Unknown error updating snippet.');
  return res.item;
}

export async function deleteSnippet(id: number): Promise<void> {
  if (!Number.isFinite(id)) throw new Error('Invalid snippet id');
  const bridge = await ensureBridgeAvailable();
  const res = await bridge.deleteSnippet(id);
  if (!res.success) throw normalizeError(res.error || 'Unknown error deleting snippet.');
}
