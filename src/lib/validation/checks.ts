import { isArtifactAnalysis } from '@/lib/analysis/types';
import type { CheckId, CheckResult, MeasurementEnvironment, MeasurementMetadata, ValidationRun } from '@/lib/types';
import { MISLABELLED_DATA_URL, TINY_JPEG_DATA_URL } from './fixtures';
import { serverTimingMs, summarise } from './stats';

/*
 * Checks executed from the browser against the running app. Every timing here
 * is a real measurement of this environment; nothing is estimated.
 */

export const CURATOR = 'Bearer demo-curator-session';
export const VISITOR = 'Bearer demo-visitor-session';

export interface HealthInfo {
  nodeVersion: string;
  nodeEnv: string;
  vercelEnv: string | null;
  aiProvider: 'simulated' | 'gemini';
  faultInjection: boolean;
  maxImageBytes: number;
  timeoutMs: number;
}

export function classifyEnvironment(h: Pick<HealthInfo, 'nodeEnv' | 'vercelEnv'>): MeasurementEnvironment {
  if (h.vercelEnv === 'production') return 'vercel-production';
  if (h.vercelEnv === 'preview') return 'vercel-preview';
  if (h.nodeEnv === 'development') return 'local-development';
  if (h.nodeEnv === 'production') return 'local-production-build';
  return 'unknown';
}

type Fetch = typeof fetch;

const analyze = (f: Fetch, body: unknown, auth: string | null = CURATOR) =>
  f('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

interface CheckDef {
  id: CheckId;
  name: string;
  expected: string;
  run: (f: Fetch, h: HealthInfo) => Promise<{ passed: boolean; observed: string }>;
}

async function describe(res: Response) {
  const json = await res.json().catch(() => null);
  return { json, text: `${res.status} ${json?.error?.code ?? (json?.ok ? 'ok' : '')}`.trim() };
}

export const CHECKS: CheckDef[] = [
  {
    id: 'valid-request',
    name: 'Valid request returns the expected response shape',
    expected: '200, ok=true, every analysis field present, meta.provider set',
    run: async (f) => {
      const res = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL });
      const { json, text } = await describe(res);
      const passed = res.status === 200 && json?.ok === true && isArtifactAnalysis(json.analysis) && typeof json.meta?.provider === 'string';
      return { passed, observed: `${text}; shape ${isArtifactAnalysis(json?.analysis) ? 'valid' : 'invalid'}; provider=${json?.meta?.provider ?? '—'}` };
    },
  },
  {
    id: 'unauthenticated',
    name: 'Unauthenticated request is rejected',
    expected: '401 UNAUTHENTICATED',
    run: async (f) => {
      const res = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL }, null);
      const { json, text } = await describe(res);
      return { passed: res.status === 401 && json?.error?.code === 'UNAUTHENTICATED', observed: text };
    },
  },
  {
    id: 'missing-image',
    name: 'Missing image is rejected',
    expected: '400 INVALID_INPUT',
    run: async (f) => {
      const res = await analyze(f, {});
      const { json, text } = await describe(res);
      return { passed: res.status === 400 && json?.error?.code === 'INVALID_INPUT', observed: text };
    },
  },
  {
    id: 'invalid-image',
    name: 'Mislabelled image content is rejected',
    expected: '415 UNSUPPORTED_MEDIA_TYPE (declared PNG, actual text)',
    run: async (f) => {
      const res = await analyze(f, { imageDataUrl: MISLABELLED_DATA_URL });
      const { json, text } = await describe(res);
      return { passed: res.status === 415 && json?.error?.code === 'UNSUPPORTED_MEDIA_TYPE', observed: text };
    },
  },
  {
    id: 'oversized-image',
    name: 'Oversized image is rejected before reaching the provider',
    expected: '413 PAYLOAD_TOO_LARGE',
    run: async (f, h) => {
      const chars = Math.ceil(((h.maxImageBytes + 1024) * 4) / 3 / 4) * 4;
      const res = await analyze(f, `{"imageDataUrl":"data:image/jpeg;base64,${'A'.repeat(chars)}"}`);
      const { json, text } = await describe(res);
      return { passed: res.status === 413 && json?.error?.code === 'PAYLOAD_TOO_LARGE', observed: `${text} (${(chars / 1048576).toFixed(1)} MB body)` };
    },
  },
  {
    id: 'provider-timeout',
    name: 'Simulated AI timeout produces a useful, retryable error',
    expected: '504 PROVIDER_TIMEOUT, retryable, message, < 2.5 s with a 1 s timeout',
    run: async (f) => {
      const t0 = performance.now();
      const res = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'timeout', timeoutMs: 1000 });
      const ms = performance.now() - t0;
      const { json, text } = await describe(res);
      const passed = res.status === 504 && json?.error?.code === 'PROVIDER_TIMEOUT' && json?.error?.retryable === true && !!json?.error?.message && ms < 2500;
      return { passed, observed: `${text}; retryable=${json?.error?.retryable}; ${Math.round(ms)} ms` };
    },
  },
  {
    id: 'transient-recovery',
    name: 'Transient provider failure is retried automatically',
    expected: '200 after 2 attempts',
    run: async (f) => {
      const res = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'transient-failure' });
      const { json, text } = await describe(res);
      return { passed: res.status === 200 && json?.meta?.attempts === 2, observed: `${text}; attempts=${json?.meta?.attempts ?? '—'}` };
    },
  },
  {
    id: 'failure-then-retry',
    name: 'Persistent provider failure can be recovered from by retrying',
    expected: '502 PROVIDER_ERROR retryable, then 200 on user retry',
    run: async (f) => {
      const first = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'persistent-failure' });
      const a = await describe(first);
      const second = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL });
      const b = await describe(second);
      const passed = first.status === 502 && a.json?.error?.retryable === true && second.status === 200;
      return { passed, observed: `${a.text} → retry → ${b.text}` };
    },
  },
  {
    id: 'private-not-shared-cacheable',
    name: 'Private content is excluded from shared caching',
    expected: 'anon 401, other user 403, owner 200 with private, no-store (no public/s-maxage); analysis responses no-store',
    run: async (f) => {
      const url = '/api/objects/wedding-portrait/image';
      const anon = await f(url, { cache: 'no-store' });
      const other = await f(url, { cache: 'no-store', headers: { authorization: VISITOR } });
      const owner = await f(url, { cache: 'no-store', headers: { authorization: CURATOR } });
      const analysis = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL });
      const cc = owner.headers.get('cache-control') ?? '';
      const acc = analysis.headers.get('cache-control') ?? '';
      const ownerPrivate = /private/.test(cc) && /no-store/.test(cc) && !/public|s-maxage/.test(cc);
      const passed = anon.status === 401 && other.status === 403 && owner.status === 200 && ownerPrivate && /no-store/.test(acc);
      return { passed, observed: `anon ${anon.status}, other ${other.status}, owner ${owner.status} [${cc}]; analysis [${acc}]` };
    },
  },
  {
    id: 'public-cacheable',
    name: 'Public collection image is marked shared-cacheable',
    expected: '200 with public, s-maxage (on Vercel: repeat request served from the CDN cache)',
    run: async (f) => {
      const url = '/api/objects/carriage-clock/image';
      const res = await f(url, { cache: 'no-store' });
      const cc = res.headers.get('cache-control') ?? '';
      const first = res.headers.get('x-vercel-cache');
      if (first === null) {
        return { passed: res.status === 200 && /public/.test(cc) && /s-maxage/.test(cc), observed: `${res.status} [${cc}]` };
      }
      // Vercel's CDN consumes s-maxage and strips it from the response, so check the cache status instead.
      const again = await f(url, { cache: 'no-store' });
      const second = again.headers.get('x-vercel-cache') ?? '';
      return {
        passed: res.status === 200 && again.status === 200 && /public/.test(cc) && /^(HIT|STALE)$/.test(second),
        observed: `${res.status} [${cc}] x-vercel-cache ${first} → ${second}`,
      };
    },
  },
];

export async function runValidation(opts: { samples: number; fetcher?: Fetch; onProgress?: (label: string) => void }): Promise<ValidationRun> {
  const f = opts.fetcher ?? fetch.bind(globalThis);
  const timestamp = new Date().toISOString();
  const health = (await (await f('/api/health', { cache: 'no-store' })).json()) as HealthInfo;

  const checks: CheckResult[] = [];
  for (const c of CHECKS) {
    opts.onProgress?.(c.name);
    const t0 = performance.now();
    try {
      const { passed, observed } = await c.run(f, health);
      checks.push({ id: c.id, name: c.name, expected: c.expected, passed, observed, durationMs: Math.round(performance.now() - t0) });
    } catch (err) {
      checks.push({ id: c.id, name: c.name, expected: c.expected, passed: false, observed: `Error: ${err instanceof Error ? err.message : String(err)}`, durationMs: Math.round(performance.now() - t0) });
    }
  }

  // Latency samples: sequential valid requests, round trip measured in the browser.
  const client: number[] = [];
  const server: number[] = [];
  for (let i = 0; i < opts.samples; i++) {
    opts.onProgress?.(`Latency sample ${i + 1} of ${opts.samples}`);
    const t0 = performance.now();
    const res = await analyze(f, { imageDataUrl: TINY_JPEG_DATA_URL });
    await res.json();
    if (res.ok) {
      client.push(performance.now() - t0);
      const s = serverTimingMs(res.headers.get('server-timing'));
      if (s !== null) server.push(s);
    }
  }

  const meta: MeasurementMetadata = {
    environment: classifyEnvironment(health),
    origin: typeof location !== 'undefined' ? location.origin : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    nodeVersion: health.nodeVersion,
    aiProvider: health.aiProvider,
    simulated: health.aiProvider === 'simulated',
    timestamp,
    sampleCount: client.length,
  };
  return { id: `run-${Date.now()}`, meta, checks, latency: summarise(client, server) };
}
