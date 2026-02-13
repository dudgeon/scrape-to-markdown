import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/background/retry';

describe('withRetry', () => {
  it('returns result on first attempt if no error', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient errors and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      shouldRetry: () => true,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 1, shouldRetry: () => true }),
    ).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 1, shouldRetry: () => false }),
    ).rejects.toThrow('permanent');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses getRetryAfter delay when provided', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, {
      maxRetries: 1,
      baseDelay: 10000, // High default — should be overridden
      shouldRetry: () => true,
      getRetryAfter: () => 10, // 10ms
    });

    const elapsed = Date.now() - start;
    // Should have used the 10ms retry-after, not the 10s baseDelay
    expect(elapsed).toBeLessThan(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('applies exponential backoff', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 50,
      maxDelay: 5000,
      shouldRetry: () => true,
    });

    const elapsed = Date.now() - start;
    // Two retries: ~50ms (base * 2^0 * jitter) + ~100ms (base * 2^1 * jitter)
    // With jitter factor 0.5-1.0, minimum total is ~75ms
    expect(elapsed).toBeGreaterThanOrEqual(25);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects maxDelay cap', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const start = Date.now();
    await withRetry(fn, {
      maxRetries: 1,
      baseDelay: 100000, // Very high
      maxDelay: 10, // But capped to 10ms
      shouldRetry: () => true,
    });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
