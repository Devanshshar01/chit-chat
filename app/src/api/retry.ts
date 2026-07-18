/**
 * Retry with exponential backoff + jitter for network operations.
 *
 * Only network-level failures (fetch throwing) and 5xx/429 responses are
 * retried - a 4xx is a real answer, retrying it would just repeat the
 * same mistake. Callers pass idempotent operations only; every mutating
 * path in this app is already idempotent by design (client_id dedupe on
 * messages, upsert semantics on push tokens), so that holds everywhere.
 */
import { ApiError } from './client';
import { log } from '../logging/logger';

export interface RetryOptions {
  attempts?: number;      // total tries, including the first
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  attempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
};

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429;
  }
  // fetch() throwing = network failure (offline, DNS, timeout) - retryable
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  tag: string,
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const { attempts, baseDelayMs, maxDelayMs } = { ...DEFAULTS, ...options };

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === attempts - 1) throw error;

      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jittered = backoff / 2 + Math.random() * (backoff / 2);
      log.warn('retry', `${tag} failed (attempt ${attempt + 1}/${attempts}), retrying in ${Math.round(jittered)}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });
      await delay(jittered);
    }
  }
  throw lastError;
}
