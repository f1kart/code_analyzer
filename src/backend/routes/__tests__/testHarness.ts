import express from 'express';
import type { Express } from 'express';
import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createApiRouter } from '../index.ts';

type PrismaMockShape = {
  alertSubscription: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  project: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  telemetryEvent: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  collaborationSession: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  collaborationParticipant: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  // Admin-specific models
  modelProvider: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  workflow: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  agentModelMap: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

type PrismaMock = PrismaClient & PrismaMockShape;

function buildPrismaMock(): PrismaMock {
  const mock = {
    alertSubscription: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    telemetryEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    collaborationSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    collaborationParticipant: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Admin-specific models
    modelProvider: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    workflow: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    agentModelMap: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  } satisfies PrismaMockShape;

  return mock as unknown as PrismaMock;
}

const prismaMockState = vi.hoisted(() => ({
  prismaMock: buildPrismaMock(),
}));

// Mock the Prisma module used by backend routes/services so both getPrisma()
// and the direct prisma export resolve to the same in-memory mock client.
vi.mock('../../prisma.js', () => ({
  getPrisma: () => prismaMockState.prismaMock,
  prisma: prismaMockState.prismaMock,
  ensurePrismaConnection: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

export const resetPrismaMock = (): PrismaMock => {
  prismaMockState.prismaMock = buildPrismaMock();
  return prismaMockState.prismaMock;
};

export const getPrismaMock = (): PrismaMock => prismaMockState.prismaMock;

export const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter());
  return app;
};

// Admin testing utilities
export const createMockProvider = (overrides = {}) => ({
  id: 1,
  name: 'OpenAI',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKeyRef: 'OPENAI_API_KEY',
  modelId: 'gpt-4',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockWorkflow = (overrides = {}) => ({
  id: 1,
  name: 'Code Review Workflow',
  definition: {
    steps: [
      { type: 'code_analysis', config: {} },
      { type: 'review_generation', config: {} },
    ],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockAgentMap = (overrides = {}) => ({
  id: 1,
  workflowId: 1,
  agentId: 'code-reviewer',
  modelId: 'gpt-4',
  providerId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createAdminTestRequest = (overrides = {}) => ({
  requestId: 'test-req-123',
  apiKey: 'test-api-key',
  validated: {
    body: {},
    params: {},
    query: {},
  },
  ...overrides,
});

export type { PrismaMock };
