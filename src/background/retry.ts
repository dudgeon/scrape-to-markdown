/**
 * Generic retry utility with exponential backoff + jitter.
 * Only retries on errors that pass the `shouldRetry` predicate.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay?: number;
  /** Predicate — return true to retry, false to fail immediately */
  shouldRetry?: (error: unknown) => boolean;
  /** Extract a specific retry-after delay (e.g. from Retry-After header). Return ms or undefined. */
  getRetryAfter?: (error: unknown) => number | undefined;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  shouldRetry: () => true,
  getRetryAfter: () => undefined,
};

/**
 * Wraps an async function with exponential backoff retry logic.
 * Jitter is added to prevent thundering herd.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // Use Retry-After if provided, otherwise exponential backoff with jitter
      const retryAfter = opts.getRetryAfter(error);
      const backoff = retryAfter ?? Math.min(
        opts.maxDelay,
        opts.baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5),
      );

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
