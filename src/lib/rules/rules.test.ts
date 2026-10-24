import { describe, expect, it } from 'vitest';
import type { CustomerScenario } from '@/lib/types';
import { acceptanceCriteria, decideOption, deriveMetrics, diffRecommendations, evaluateRules } from './index';

const base: CustomerScenario = {
  dailyAnalyses: 8_000,
  typicalImageMB: 1,
  geography: 'emea',
  visibility: 'private',
  priority: 'balanced',
};
const ids = (s: CustomerScenario) => evaluateRules(s).map((r) => r.id);
const rec = (s: CustomerScenario, id: string) => evaluateRules(s).find((r) => r.id === id);

describe('deriveMetrics', () => {
  it('applies base64 overhead and the function body limit', () => {
    expect(deriveMetrics({ ...base, typicalImageMB: 3 }).encodedPayloadMB).toBe(4);
    expect(deriveMetrics({ ...base, typicalImageMB: 3 }).exceedsFunctionBodyLimit).toBe(false);
    expect(deriveMetrics({ ...base, typicalImageMB: 3.5 }).exceedsFunctionBodyLimit).toBe(true);
  });

  it('computes monthly volume and assumed peak rate', () => {
    const d = deriveMetrics({ ...base, dailyAnalyses: 14_400 });
    expect(d.monthlyAnalyses).toBe(432_000);
    expect(d.averagePerMinute).toBe(10);
    expect(d.peakPerMinute).toBe(40);
  });
});

describe('always-on rules', () => {
  it('requires auth and bounded provider calls for every scenario, under both options', () => {
    for (const visibility of ['private', 'public'] as const) {
      const s = { ...base, visibility };
      expect(rec(s, 'auth-on-analysis-route')?.strength).toBe('requirement');
      expect(rec(s, 'auth-on-analysis-route')?.appliesTo).toEqual(['vercel-hosted', 'retain-and-harden']);
      expect(rec(s, 'bounded-provider-calls')?.strength).toBe('requirement');
    }
  });
});

describe('visibility', () => {
  it('private photographs forbid shared caching and add access-control criteria and tasks', () => {
    const r = rec(base, 'private-no-shared-cache')!;
    expect(r.strength).toBe('requirement');
    expect(r.triggeredBy).toContain('visibility');
    expect(r.addsCriteria?.map((c) => c.id)).toEqual(['AC-P1', 'AC-P2']);
    expect(r.addsTasks?.some((t) => t.task.id === 'access-control-tests')).toBe(true);
    expect(ids(base)).not.toContain('public-cdn-cache');
  });

  it('public photographs allow CDN caching and drop the private requirement', () => {
    const s = { ...base, visibility: 'public' as const };
    expect(ids(s)).toContain('public-cdn-cache');
    expect(ids(s)).not.toContain('private-no-shared-cache');
    expect(acceptanceCriteria(evaluateRules(s)).map((c) => c.id)).not.toContain('AC-P1');
  });

  it('diff reports the consequence of toggling visibility', () => {
    const pub = evaluateRules({ ...base, visibility: 'public' });
    const priv = evaluateRules(base);
    const { added, removed } = diffRecommendations(pub, priv);
    expect(added.map((r) => r.id)).toContain('private-no-shared-cache');
    expect(removed.map((r) => r.id)).toContain('public-cdn-cache');
  });
});

describe('payload size', () => {
  it('no recommendation for small images', () => {
    expect(ids({ ...base, typicalImageMB: 0.5 })).not.toContain('payload-size');
  });
  it('recommends downscaling for mid-sized images', () => {
    expect(rec({ ...base, typicalImageMB: 2 }, 'payload-size')?.strength).toBe('recommendation');
  });
  it('requires a different upload path above the function body limit', () => {
    const r = rec({ ...base, typicalImageMB: 6 }, 'payload-size')!;
    expect(r.strength).toBe('requirement');
    expect(r.rationale).toContain('8 MB');
    expect(r.addsCriteria?.[0].id).toBe('AC-S1');
  });
});

describe('volume', () => {
  it('rate limiting escalates to a requirement above 60/min assumed peak', () => {
    expect(rec({ ...base, dailyAnalyses: 20_000 }, 'rate-limiting')?.strength).toBe('recommendation'); // 55.6/min
    expect(rec({ ...base, dailyAnalyses: 30_000 }, 'rate-limiting')?.strength).toBe('requirement'); // 83.3/min
  });
  it('async processing is only a consideration at high volume', () => {
    expect(ids({ ...base, dailyAnalyses: 49_999 })).not.toContain('async-processing');
    expect(rec({ ...base, dailyAnalyses: 50_000 }, 'async-processing')?.strength).toBe('consideration');
  });
  it('low volume flags that hosting cost is unlikely to decide', () => {
    expect(ids({ ...base, dailyAnalyses: 500 })).toContain('low-volume-cost');
    expect(ids({ ...base, dailyAnalyses: 1_000 })).not.toContain('low-volume-cost');
  });
});

describe('data protection', () => {
  it('never claims that region choice establishes compliance', () => {
    const r = rec(base, 'data-protection')!;
    expect(r.rationale).toMatch(/does not establish/);
  });
  it('is not raised for public content outside EMEA/global', () => {
    expect(ids({ ...base, visibility: 'public', geography: 'north-america' })).not.toContain('data-protection');
  });
});

describe('ordering', () => {
  it('lists requirements before recommendations before considerations', () => {
    const order = { requirement: 0, recommendation: 1, consideration: 2 };
    const strengths = evaluateRules({ ...base, dailyAnalyses: 60_000 }).map((r) => order[r.strength]);
    expect(strengths).toEqual([...strengths].sort());
  });
});

describe('decideOption', () => {
  it('defers migration when the customer minimises effort at modest volume', () => {
    const d = decideOption({ ...base, priority: 'minimise-effort', dailyAnalyses: 2_000 });
    expect(d.recommended).toBe('retain-and-harden');
    expect(d.wouldChangeIf.length).toBeGreaterThan(0);
  });
  it('recommends a measured Vercel candidate otherwise, conditional on criteria', () => {
    const d = decideOption(base);
    expect(d.recommended).toBe('vercel-hosted');
    expect(d.headline).toMatch(/only if/i);
  });
  it('minimise-effort at high volume still evaluates a candidate', () => {
    expect(decideOption({ ...base, priority: 'minimise-effort', dailyAnalyses: 5_000 }).recommended).toBe('vercel-hosted');
  });
  it('carries the body-limit caveat into the reasons', () => {
    const d = decideOption({ ...base, typicalImageMB: 6 });
    expect(d.reasons.some((r) => r.includes('function body limit'))).toBe(true);
  });
});
