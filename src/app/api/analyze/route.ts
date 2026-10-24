import { sessionFromRequest } from '@/lib/analysis/auth';
import { analysisConfig } from '@/lib/analysis/config';
import { geminiProvider, simulatedProvider } from '@/lib/analysis/providers';
import { runAnalysis } from '@/lib/analysis/run';
import type { AnalyzeErrorCode, AnalyzeMeta, AnalyzeResponse } from '@/lib/analysis/types';
import { validateAnalyzeRequest } from '@/lib/analysis/validate';

// Hardened version of the reference POST /api/analyze-artifact.
export const maxDuration = 30;

const NO_STORE = { 'cache-control': 'private, no-store' };

function reply(body: AnalyzeResponse, status: number, startedAt: number, extra: Record<string, string> = {}) {
  const dur = performance.now() - startedAt;
  return Response.json(body, {
    status,
    headers: { ...NO_STORE, 'server-timing': `analysis;dur=${dur.toFixed(1)}`, ...extra },
  });
}

function fail(code: AnalyzeErrorCode, message: string, status: number, startedAt: number, retryable = false, meta?: AnalyzeMeta) {
  return reply({ ok: false, error: { code, message, retryable }, meta }, status, startedAt);
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const config = analysisConfig();

  // 1. Authenticate before reading the body or spending provider quota.
  if (!sessionFromRequest(request)) {
    return fail('UNAUTHENTICATED', 'Sign in to analyse photographs.', 401, startedAt);
  }

  // 2. Reject oversized bodies early. Base64 inflates by 4/3; allow 64 KB of JSON envelope.
  const maxBody = Math.ceil((config.maxImageBytes * 4) / 3) + 65_536;
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBody) {
    return fail('PAYLOAD_TOO_LARGE', 'Request body too large. Downscale the image before analysis.', 413, startedAt);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('INVALID_INPUT', 'Request body must be valid JSON.', 400, startedAt);
  }

  // 3. Validate input before any provider call.
  const input = validateAnalyzeRequest(body, config);
  if (!input.ok) return fail(input.code, input.message, input.status, startedAt);

  // 4. Choose a provider. Fault injection always uses the simulated provider.
  const useGemini = config.provider === 'gemini' && input.simulate === 'none';
  if (useGemini && !config.geminiApiKey) {
    return fail('NOT_CONFIGURED', 'AI_PROVIDER=gemini but GOOGLE_GEMINI_API_KEY is not set.', 500, startedAt);
  }
  const provider = useGemini
    ? geminiProvider(config.geminiApiKey, config.geminiModel)
    : simulatedProvider(input.simulate, config.simulatedLatencyMs);

  // 5. Bounded call with timeout and retry.
  const outcome = await runAnalysis(provider, input.image, {
    timeoutMs: input.timeoutMs ?? config.timeoutMs,
    maxAttempts: config.maxAttempts,
    signal: request.signal,
  });
  const meta: AnalyzeMeta = {
    provider: provider.name,
    simulated: provider.name === 'simulated',
    attempts: outcome.attempts,
    durationMs: Math.round(performance.now() - startedAt),
  };
  if (!outcome.ok) return fail(outcome.code, outcome.message, outcome.status, startedAt, true, meta);
  return reply({ ok: true, analysis: outcome.analysis, meta }, 200, startedAt, { 'x-analysis-provider': provider.name });
}
