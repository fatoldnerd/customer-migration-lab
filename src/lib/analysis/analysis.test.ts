import { afterEach, describe, expect, it, vi } from 'vitest';
import { MISLABELLED_DATA_URL, TINY_JPEG_DATA_URL } from '@/lib/validation/fixtures';
import { POST } from '@/app/api/analyze/route';
import { GET as getImage } from '@/app/api/objects/[id]/image/route';
import { ProviderError, simulatedProvider, type AnalysisProvider } from './providers';
import { backoffMs, runAnalysis } from './run';
import { isArtifactAnalysis } from './types';
import { decodedBytes, validateAnalyzeRequest } from './validate';

const opts = { maxImageBytes: 1024, faultInjection: true };

describe('validateAnalyzeRequest', () => {
  it('accepts a valid JPEG', () => {
    const r = validateAnalyzeRequest({ imageDataUrl: TINY_JPEG_DATA_URL }, opts);
    expect(r.ok && r.image.mimeType).toBe('image/jpeg');
  });
  it.each([
    [null, 400, 'INVALID_INPUT'],
    [{}, 400, 'INVALID_INPUT'],
    [{ imageDataUrl: 'https://example.com/a.jpg' }, 400, 'INVALID_INPUT'],
    [{ imageDataUrl: `data:text/plain;base64,${btoa('hi')}` }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [{ imageDataUrl: MISLABELLED_DATA_URL }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [{ imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'explode' }, 400, 'INVALID_INPUT'],
  ])('rejects %j', (body, status, code) => {
    const r = validateAnalyzeRequest(body, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(status);
      expect(r.code).toBe(code);
    }
  });
  it('rejects oversized images with 413 before checking content', () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(2000)}`;
    const r = validateAnalyzeRequest({ imageDataUrl: big }, opts);
    expect(!r.ok && r.status).toBe(413);
  });
  it('ignores fault injection when disabled', () => {
    const r = validateAnalyzeRequest({ imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'timeout' }, { ...opts, faultInjection: false });
    expect(r.ok && r.simulate).toBe('none');
  });
  it('clamps timeout overrides and only honours them with simulation', () => {
    const a = validateAnalyzeRequest({ imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'timeout', timeoutMs: 10 }, opts);
    expect(a.ok && a.timeoutMs).toBe(200);
    const b = validateAnalyzeRequest({ imageDataUrl: TINY_JPEG_DATA_URL, timeoutMs: 10 }, opts);
    expect(b.ok && b.timeoutMs).toBeUndefined();
  });
  it('estimates decoded size', () => {
    expect(decodedBytes(btoa('abcd'))).toBe(4);
    expect(decodedBytes(btoa('abcde'))).toBe(5);
  });
});

describe('runAnalysis', () => {
  const image = { mimeType: 'image/jpeg' as const, base64: '', bytes: 0 };
  const noSleep = { sleep: async () => {}, random: () => 0 };

  it('returns a valid analysis on the first attempt', async () => {
    const r = await runAnalysis(simulatedProvider('none'), image, { timeoutMs: 1000, maxAttempts: 2, ...noSleep });
    expect(r.ok && r.attempts).toBe(1);
    expect(r.ok && isArtifactAnalysis(r.analysis)).toBe(true);
  });
  it('recovers from one transient failure', async () => {
    const r = await runAnalysis(simulatedProvider('transient-failure'), image, { timeoutMs: 1000, maxAttempts: 2, ...noSleep });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });
  it('returns a retryable 502 after persistent failure, without leaking provider detail', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await runAnalysis(simulatedProvider('persistent-failure'), image, { timeoutMs: 1000, maxAttempts: 2, ...noSleep });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r).toMatchObject({ status: 502, code: 'PROVIDER_ERROR', retryable: true, attempts: 2 });
      expect(r.message).not.toContain('503');
    }
    err.mockRestore();
  });
  it('does not retry non-retryable errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls = vi.fn();
    const p: AnalysisProvider = { name: 'simulated', analyze: async () => { calls(); throw new ProviderError('bad request', false, 400); } };
    const r = await runAnalysis(p, image, { timeoutMs: 1000, maxAttempts: 3, ...noSleep });
    expect(r.ok).toBe(false);
    expect(calls).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
  it('times out with a retryable 504 and does not retry the timeout', async () => {
    const started = Date.now();
    const r = await runAnalysis(simulatedProvider('timeout'), image, { timeoutMs: 150, maxAttempts: 2, ...noSleep });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(r).toMatchObject({ ok: false, status: 504, code: 'PROVIDER_TIMEOUT', retryable: true, attempts: 1 });
  });
  it('backoff grows exponentially within the jitter bound', () => {
    expect(backoffMs(1, () => 1)).toBe(200);
    expect(backoffMs(3, () => 1)).toBe(800);
    expect(backoffMs(3, () => 0)).toBe(0);
  });
});

describe('POST /api/analyze (route handler)', () => {
  afterEach(() => vi.unstubAllEnvs());
  const call = (body: unknown, auth: string | null = 'demo-curator-session') =>
    POST(
      new Request('http://local/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
        body: JSON.stringify(body),
      }),
    );

  it('returns a simulated analysis with metadata and no-store caching', async () => {
    const res = await call({ imageDataUrl: TINY_JPEG_DATA_URL });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('server-timing')).toMatch(/^analysis;dur=/);
    const json = await res.json();
    expect(json.meta).toMatchObject({ provider: 'simulated', simulated: true, attempts: 1 });
    expect(isArtifactAnalysis(json.analysis)).toBe(true);
  });
  it('rejects unauthenticated callers before reading the body', async () => {
    const res = await call({ imageDataUrl: TINY_JPEG_DATA_URL }, null);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
  });
  it('rejects missing image', async () => {
    const res = await call({});
    expect(res.status).toBe(400);
  });
  it('reports a misconfigured Gemini provider clearly', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('GOOGLE_GEMINI_API_KEY', '');
    const res = await call({ imageDataUrl: TINY_JPEG_DATA_URL });
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('NOT_CONFIGURED');
  });
  it('maps a simulated timeout to 504', async () => {
    const res = await call({ imageDataUrl: TINY_JPEG_DATA_URL, simulate: 'timeout', timeoutMs: 200 });
    expect(res.status).toBe(504);
    expect((await res.json()).error.retryable).toBe(true);
  });
});

describe('GET /api/objects/[id]/image (caching paths)', () => {
  const get = (id: string, auth?: string) =>
    getImage(new Request(`http://local/api/objects/${id}/image`, { headers: auth ? { authorization: `Bearer ${auth}` } : {} }), {
      params: Promise.resolve({ id }),
    });

  it('public images are shared-cacheable', async () => {
    const res = await get('carriage-clock');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/public.*s-maxage/);
  });
  it('private images require auth and are never shared-cacheable', async () => {
    const anon = await get('wedding-portrait');
    expect(anon.status).toBe(401);
    expect(anon.headers.get('cache-control')).toBe('private, no-store');

    const other = await get('wedding-portrait', 'demo-visitor-session');
    expect(other.status).toBe(403);

    const owner = await get('wedding-portrait', 'demo-curator-session');
    expect(owner.status).toBe(200);
    expect(owner.headers.get('cache-control')).toBe('private, no-store');
    expect(owner.headers.get('cache-control')).not.toMatch(/s-maxage|public/);
  });
  it('unknown objects return 404', async () => {
    expect((await get('nope')).status).toBe(404);
  });
});
