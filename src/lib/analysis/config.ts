/** Server-side configuration for the reference workload. Read per request so tests can override env. */
export function analysisConfig() {
  const env = process.env;
  const provider = env.AI_PROVIDER === 'gemini' ? 'gemini' : 'simulated';
  return {
    provider,
    geminiApiKey: env.GOOGLE_GEMINI_API_KEY ?? '',
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: clampInt(env.ANALYSIS_TIMEOUT_MS, 15_000, 1_000, 60_000),
    maxAttempts: clampInt(env.ANALYSIS_MAX_ATTEMPTS, 2, 1, 3),
    /** Decoded image bytes. 3 MB decoded ≈ 4 MB base64, inside the 4.5 MB function body limit. */
    maxImageBytes: clampInt(env.ANALYSIS_MAX_IMAGE_BYTES, 3 * 1024 * 1024, 1024, 4 * 1024 * 1024),
    simulatedLatencyMs: clampInt(env.SIMULATED_LATENCY_MS, 0, 0, 10_000),
    /** Fault injection powers the Validation Lab. Disable for anything other than a demo. */
    faultInjection: env.FAULT_INJECTION !== 'disabled',
  } as const;
}

export type AnalysisConfig = ReturnType<typeof analysisConfig>;

function clampInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = raw === undefined ? NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
