import { afterEach, vi } from 'vitest';
import { resetPrismaMock } from './testHarness.ts';

afterEach(() => {
  const prisma = resetPrismaMock();
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (callback) => {
    return callback(prisma);
  });
});
