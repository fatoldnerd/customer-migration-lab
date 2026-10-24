import { describe, expect, it } from 'vitest';
import { CHECKS, type HealthInfo } from './checks';

const check = CHECKS.find((c) => c.id === 'public-cacheable')!;
const health = {} as HealthInfo;

// Returns the given responses in order, one per request.
const fetcher = (...responses: Array<{ status?: number; headers: Record<string, string> }>) => {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response('<svg/>', { status: r.status ?? 200, headers: r.headers });
  }) as typeof fetch;
};

describe('public-cacheable check', () => {
  it('passes locally when the response carries public and s-maxage', async () => {
    const r = await check.run(fetcher({ headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' } }), health);
    expect(r.passed).toBe(true);
  });

  it('fails locally when s-maxage is missing', async () => {
    const r = await check.run(fetcher({ headers: { 'cache-control': 'public, max-age=3600' } }), health);
    expect(r.passed).toBe(false);
  });

  it('passes on Vercel when the repeat request is a CDN HIT, although s-maxage is stripped', async () => {
    const cc = 'public, max-age=3600';
    const r = await check.run(fetcher({ headers: { 'cache-control': cc, 'x-vercel-cache': 'MISS' } }, { headers: { 'cache-control': cc, 'x-vercel-cache': 'HIT' } }), health);
    expect(r.passed).toBe(true);
    expect(r.observed).toContain('MISS → HIT');
  });

  it('fails on Vercel when the CDN bypasses the cache', async () => {
    const cc = 'public, max-age=3600';
    const r = await check.run(fetcher({ headers: { 'cache-control': cc, 'x-vercel-cache': 'BYPASS' } }, { headers: { 'cache-control': cc, 'x-vercel-cache': 'BYPASS' } }), health);
    expect(r.passed).toBe(false);
  });
});
