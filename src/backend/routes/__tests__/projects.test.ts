import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { createTestApp, getPrismaMock } from './testHarness.ts';

describe('Project routes - search', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.project.findMany.mockReset();
    prisma.project.count.mockReset();
  });

  it('returns a project when searching by metadata.description', async () => {
    const prisma = getPrismaMock();
    const now = new Date('2024-01-01T00:00:00.000Z');

    prisma.project.findMany.mockResolvedValue([
      {
        id: 1,
        externalId: 'proj-123',
        name: 'Sample Project',
        rootPath: '/tmp/sample',
        metadata: { description: 'This description includes the magic term.' },
        createdAt: now,
        updatedAt: now,
        states: [],
        sessions: [],
        telemetry: [],
        alerts: [],
        anomalies: [],
      },
    ]);

    prisma.project.count.mockResolvedValue(1);

    const app = createTestApp();
    const response = await request(app).get('/api/projects?search=magic');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe('proj-123');

    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    const args = prisma.project.findMany.mock.calls[0][0];

    expect(args.where).toEqual({
      OR: [
        {
          name: {
            contains: 'magic',
            mode: 'insensitive',
          },
        },
        {
          metadata: {
            path: ['description'],
            string_contains: 'magic',
          },
        },
      ],
    });
  });
});
