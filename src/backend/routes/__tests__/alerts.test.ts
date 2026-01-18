import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { createTestApp, getPrismaMock } from './testHarness.ts';

describe('Alert routes', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.alertSubscription.findMany.mockResolvedValue([
      {
        id: 1,
        projectId: null,
        project: null,
        channel: 'slack',
        target: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prisma.alertSubscription.count.mockResolvedValue(1);
  });

  it('returns paginated alerts', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/alerts');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].channel).toBe('slack');
    expect(response.body.pagination.total).toBe(1);
  });
});
