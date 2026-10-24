import { describe, expect, it } from 'vitest';
import type { CustomerScenario, UnitPrice } from '@/lib/types';
import { percentile, serverTimingMs, summarise } from '@/lib/validation/stats';
import { classifyEnvironment } from '@/lib/validation/checks';
import { defaultPrices, defaultUsage, estimateMonthlyCost } from './model';

const s: CustomerScenario = { dailyAnalyses: 10_000, typicalImageMB: 1.5, geography: 'emea', visibility: 'private', priority: 'balanced' };
const priced = (values: Partial<Record<UnitPrice['id'], number>>, sourced = true): UnitPrice[] =>
  defaultPrices.map((p) => ({ ...p, value: values[p.id] ?? null, source: sourced ? 'test sheet' : '', asOf: sourced ? '2026-10-23' : '' }));

describe('estimateMonthlyCost', () => {
  it('is incomplete with no subtotal when nothing is priced', () => {
    const e = estimateMonthlyCost(s, defaultPrices, defaultUsage);
    expect(e.complete).toBe(false);
    expect(e.knownSubtotal).toBeNull();
    expect(e.lines.every((l) => l.monthlyCost === null)).toBe(true);
    expect(e.missing).toHaveLength(4);
  });
  it('never treats a missing price as zero', () => {
    const e = estimateMonthlyCost(s, priced({ 'ai-per-1k-analyses': 1 }), defaultUsage);
    expect(e.complete).toBe(false);
    expect(e.knownSubtotal).toBe(300); // 300k analyses / 1000 × 1
    expect(e.lines.find((l) => l.id === 'transfer-per-gb')?.monthlyCost).toBeNull();
  });
  it('computes each line from visible quantities', () => {
    const e = estimateMonthlyCost(s, priced({ 'ai-per-1k-analyses': 1, 'invocations-per-1m': 0.6, 'active-cpu-per-hour': 0.128, 'transfer-per-gb': 0.15 }), defaultUsage);
    const line = (id: UnitPrice['id']) => e.lines.find((l) => l.id === id)!;
    expect(line('active-cpu-per-hour').quantity).toBe(4.17); // 300k × 50 ms / 3.6M
    expect(line('transfer-per-gb').quantity).toBe(585.94); // 300k × 2 MB / 1024
    expect(e.complete).toBe(true);
    expect(e.knownSubtotal).toBeCloseTo(300 + 0.18 + 0.53 + 87.89, 1);
  });
  it('flags prices without source or date as incomplete', () => {
    const e = estimateMonthlyCost(s, priced({ 'ai-per-1k-analyses': 1, 'invocations-per-1m': 1, 'active-cpu-per-hour': 1, 'transfer-per-gb': 1 }, false), defaultUsage);
    expect(e.complete).toBe(false);
    expect(e.missing[0]).toMatch(/source or date/);
  });
});

describe('stats', () => {
  it('nearest-rank percentiles', () => {
    const v = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 95)).toBe(10);
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });
  it('summarise returns null for no samples', () => {
    expect(summarise([])).toBeNull();
    expect(summarise([10, 20], [1, 3])?.serverP50Ms).toBe(1);
  });
  it('parses Server-Timing', () => {
    expect(serverTimingMs('analysis;dur=12.5')).toBe(12.5);
    expect(serverTimingMs(null)).toBeNull();
  });
  it('classifies environments honestly', () => {
    expect(classifyEnvironment({ nodeEnv: 'development', vercelEnv: null })).toBe('local-development');
    expect(classifyEnvironment({ nodeEnv: 'production', vercelEnv: null })).toBe('local-production-build');
    expect(classifyEnvironment({ nodeEnv: 'production', vercelEnv: 'preview' })).toBe('vercel-preview');
  });
});
