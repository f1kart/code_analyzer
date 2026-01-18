import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { createTestApp, getPrismaMock } from './testHarness.ts';

describe('Telemetry routes', () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.telemetryEvent.findMany.mockResolvedValue([
      {
        id: 42,
        projectId: 7,
        project: { externalId: 'proj-123', name: 'Demo Project' },
        eventType: 'pipeline_completed',
        severity: 'info',
        payload: { detail: 'completed successfully' },
        correlationId: 'corr-1',
        occurredAt: new Date('2024-01-01T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);
    prisma.telemetryEvent.count.mockResolvedValue(1);
  });

  it('lists telemetry events with pagination metadata', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/telemetry?projectId=proj-123');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].eventType).toBe('pipeline_completed');
    expect(response.body.pagination.total).toBe(1);
  });

  it('creates telemetry event and resolves project reference', async () => {
    const prisma = getPrismaMock();
    prisma.project.findUnique.mockResolvedValue({ id: 7, externalId: 'proj-123' });
    prisma.telemetryEvent.create.mockResolvedValue({
      id: 100,
      projectId: 7,
      eventType: 'error',
      severity: 'warning',
      payload: { message: 'disk nearly full' },
      correlationId: 'corr-99',
      occurredAt: new Date('2024-02-02T12:00:00.000Z'),
      createdAt: new Date('2024-02-02T12:00:00.000Z'),
    });

    const app = createTestApp();
    const response = await request(app)
      .post('/api/telemetry')
      .send({
        eventType: 'error',
        severity: 'warning',
        payload: { message: 'disk nearly full' },
        projectId: 'proj-123',
        correlationId: 'corr-99',
        occurredAt: '2024-02-02T12:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(100);
    expect(prisma.telemetryEvent.create).toHaveBeenCalled();
  });
});
