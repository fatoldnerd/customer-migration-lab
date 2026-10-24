import type { AnalysisProvider } from './providers';
import { ProviderError } from './providers';
import type { ArtifactAnalysis, AnalyzeErrorCode } from './types';
import type { ValidImage } from './validate';

export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`AI provider did not respond within ${timeoutMs} ms`);
    this.name = 'TimeoutError';
  }
}

export type RunOutcome =
  | { ok: true; analysis: ArtifactAnalysis; attempts: number }
  | { ok: false; status: 502 | 504; code: AnalyzeErrorCode; message: string; retryable: true; attempts: number };

export interface RunOptions {
  timeoutMs: number;
  maxAttempts: number;
  /** Request signal, so that client disconnects stop provider work. */
  signal?: AbortSignal;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exponential backoff with full jitter: 0..(200 · 2^n) ms. */
export function backoffMs(attempt: number, random: () => number = Math.random) {
  return Math.round(random() * 200 * 2 ** (attempt - 1));
}

/**
 * Calls the provider with a per-attempt timeout. Transient provider errors are
 * retried up to maxAttempts. Timeouts are not retried automatically, because that
 * would double the user's wait; they are returned as retryable for the client.
 */
export async function runAnalysis(provider: AnalysisProvider, image: ValidImage, opts: RunOptions): Promise<RunOutcome> {
  const sleep = opts.sleep ?? defaultSleep;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const timeout = AbortSignal.timeout(opts.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    try {
      const analysis = await provider.analyze(image, signal, attempt);
      return { ok: true, analysis, attempts: attempt };
    } catch (err) {
      if (timeout.aborted) {
        return {
          ok: false,
          status: 504,
          code: 'PROVIDER_TIMEOUT',
          message: `${new TimeoutError(opts.timeoutMs).message}. Your photograph was not lost. Try again in a moment.`,
          retryable: true,
          attempts: attempt,
        };
      }
      const retryable = err instanceof ProviderError && err.retryable;
      if (retryable && attempt < opts.maxAttempts && !opts.signal?.aborted) {
        await sleep(backoffMs(attempt, opts.random));
        continue;
      }
      // Do not leak provider internals to the browser; the server log keeps the detail.
      console.error('[analyze] provider failure', { attempt, error: err instanceof Error ? err.message : String(err) });
      return {
        ok: false,
        status: 502,
        code: 'PROVIDER_ERROR',
        message: 'The AI service is temporarily unavailable. Your photograph was not lost. Try again.',
        retryable: true,
        attempts: attempt,
      };
    }
  }
}
