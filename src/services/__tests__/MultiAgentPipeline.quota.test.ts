import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiAgentPipeline, QUOTA_TESTING, QuotaHealthSnapshot } from '../MultiAgentPipeline';
import { PerformanceMonitor } from '../PerformanceMonitor';
import * as UsageAnalytics from '../UsageAnalyticsService';

const advanceTime = (ms: number): void => {
  const now = Date.now();
  vi.setSystemTime(new Date(now + ms));
};

describe('MultiAgentPipeline quota health and cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-04T00:00:00Z'));
    QUOTA_TESTING.resetQuotaState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tracks recent quota failures within the configured window', () => {
    const { registerQuotaFailure, getQuotaHealthSnapshotInternal, QUOTA_FAILURE_WINDOW_MS } = QUOTA_TESTING;

    registerQuotaFailure();
    advanceTime(1_000);
    registerQuotaFailure();

    let snapshot: QuotaHealthSnapshot = getQuotaHealthSnapshotInternal(Date.now());
    expect(snapshot.recentQuotaFailures).toBe(2);
    expect(snapshot.isCoolingDown).toBe(true);

    // Move past the failure window - both entries should be pruned
    advanceTime(QUOTA_FAILURE_WINDOW_MS + 1_000);
    snapshot = getQuotaHealthSnapshotInternal(Date.now());
    expect(snapshot.recentQuotaFailures).toBe(0);
    expect(snapshot.isCoolingDown).toBe(false);
  });

  it('enters and exits cooldown based on last quota failure timestamp', () => {
    const { registerQuotaFailure, getQuotaHealthSnapshotInternal, QUOTA_COOLDOWN_MS } = QUOTA_TESTING;

    registerQuotaFailure();
    let snapshot: QuotaHealthSnapshot = getQuotaHealthSnapshotInternal(Date.now());

    expect(snapshot.isCoolingDown).toBe(true);
    expect(snapshot.cooldownMsRemaining).toBeGreaterThan(0);
    expect(snapshot.cooldownMsRemaining).toBeLessThanOrEqual(QUOTA_COOLDOWN_MS);

    // Advance just past cooldown window
    advanceTime(QUOTA_COOLDOWN_MS + 1_000);
    snapshot = getQuotaHealthSnapshotInternal(Date.now());
    expect(snapshot.isCoolingDown).toBe(false);
    expect(snapshot.cooldownMsRemaining).toBe(0);
  });

  it('blocks pipeline runs during cooldown and records a dedicated cooldown metric and feature event', async () => {
    const { registerQuotaFailure, QUOTA_COOLDOWN_MS } = QUOTA_TESTING;

    // Trigger a quota failure and immediate cooldown
    registerQuotaFailure();

    // Create a fresh pipeline instance
    const pipeline = new MultiAgentPipeline();

    const recordMetricSpy = vi.spyOn(PerformanceMonitor.prototype, 'recordMetric');
    const featureSpy = vi.spyOn(UsageAnalytics, 'trackFeatureUsage');

    // We expect runPipeline to throw a cooldown error immediately
    await expect(
      pipeline.runPipeline('Test prompt during cooldown', { mode: 'prompt_only' })
    ).rejects.toThrow(/usage cool-down is active/);

    // Verify cooldown metric was recorded
    expect(recordMetricSpy).toHaveBeenCalledWith(
      'multi_agent_pipeline_cooldown_blocks',
      1,
      'count',
      expect.objectContaining({
        contextMode: 'prompt_only',
      })
    );

    // Verify feature usage event was emitted
    expect(featureSpy).toHaveBeenCalledWith(
      'multi_agent_pipeline_cooldown_block',
      expect.objectContaining({
        contextMode: 'prompt_only',
      })
    );

    // After cooldown expires, pipeline should be allowed to proceed past the cooldown gate.
    // In the Node test environment the run may still "fail" later (e.g. window is not defined),
    // but it must no longer be blocked by the cooldown guard.
    advanceTime(QUOTA_COOLDOWN_MS + 1_000);
    const resultAfterCooldown = await pipeline.runPipeline('Test prompt after cooldown', {
      mode: 'prompt_only',
    });
    expect(resultAfterCooldown).toBeDefined();

    const cooldownMetricCalls = recordMetricSpy.mock.calls.filter(
      ([name]) => name === 'multi_agent_pipeline_cooldown_blocks'
    );
    expect(cooldownMetricCalls.length).toBe(1);
  });
});
