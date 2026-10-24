import type { CostEstimate, CostLine, CustomerScenario, UnitPrice, UsageAssumptions } from '@/lib/types';
import { deriveMetrics } from '@/lib/rules';

/** Unit prices start empty; the presenter fills them from current pricing pages with a source and date. */
export const defaultPrices: UnitPrice[] = [
  { id: 'ai-per-1k-analyses', label: 'AI provider (per 1,000 analyses)', unit: 'USD / 1k analyses', value: null, source: '', asOf: '' },
  { id: 'invocations-per-1m', label: 'Function invocations', unit: 'USD / 1M invocations', value: null, source: '', asOf: '' },
  { id: 'active-cpu-per-hour', label: 'Function active CPU', unit: 'USD / CPU-hour', value: null, source: '', asOf: '' },
  { id: 'transfer-per-gb', label: 'Data transfer (request payloads)', unit: 'USD / GB', value: null, source: '', asOf: '' },
];

export const defaultUsage: UsageAssumptions = {
  activeCpuMsPerAnalysis: 50,
  daysPerMonth: 30,
};

const n = (v: number, dp = 2) => Number(v.toFixed(dp));

/**
 * Transparent monthly estimate for the analysis workload under Option A only.
 * Every line shows its formula. A missing price leaves that line null and marks
 * the estimate incomplete; it is never treated as zero.
 */
export function estimateMonthlyCost(s: CustomerScenario, prices: UnitPrice[], usage: UsageAssumptions): CostEstimate {
  const d = deriveMetrics(s);
  const monthly = s.dailyAnalyses * usage.daysPerMonth;
  const price = (id: UnitPrice['id']) => prices.find((p) => p.id === id)?.value ?? null;

  const cpuHours = (monthly * usage.activeCpuMsPerAnalysis) / 3_600_000;
  const gb = (monthly * d.encodedPayloadMB) / 1024;

  const spec: Omit<CostLine, 'monthlyCost'>[] = [
    { id: 'ai-per-1k-analyses', label: 'AI provider', quantity: n(monthly / 1000), quantityUnit: 'thousand analyses', formula: `${monthly.toLocaleString('en-GB')} analyses ÷ 1,000 × price` },
    { id: 'invocations-per-1m', label: 'Function invocations', quantity: n(monthly / 1_000_000, 4), quantityUnit: 'million invocations', formula: `${monthly.toLocaleString('en-GB')} ÷ 1,000,000 × price` },
    { id: 'active-cpu-per-hour', label: 'Function active CPU', quantity: n(cpuHours), quantityUnit: 'CPU-hours', formula: `${monthly.toLocaleString('en-GB')} × ${usage.activeCpuMsPerAnalysis} ms ÷ 3,600,000 × price` },
    { id: 'transfer-per-gb', label: 'Request payload transfer', quantity: n(gb), quantityUnit: 'GB', formula: `${monthly.toLocaleString('en-GB')} × ${d.encodedPayloadMB} MB ÷ 1,024 × price` },
  ];

  const lines: CostLine[] = spec.map((l) => {
    const p = price(l.id);
    return { ...l, monthlyCost: p === null ? null : n(l.quantity * p) };
  });
  const known = lines.filter((l) => l.monthlyCost !== null);
  const missing = prices.filter((p) => p.value === null).map((p) => p.label);
  const unsourced = prices.filter((p) => p.value !== null && (!p.source || !p.asOf)).map((p) => `${p.label}: source or date`);

  return {
    lines,
    knownSubtotal: known.length ? n(known.reduce((sum, l) => sum + (l.monthlyCost ?? 0), 0)) : null,
    complete: missing.length === 0 && unsourced.length === 0,
    missing: [...missing, ...unsourced],
    exclusions: [
      'Option B (current host): not modelled, because the current host and its pricing are unknown.',
      'Firebase Auth, Firestore and Storage: excluded because they are unchanged under both options.',
      'Plan or platform base fees, page rendering and static traffic.',
      'Engineering effort for migration and hardening.',
      `Active CPU of ${usage.activeCpuMsPerAnalysis} ms per analysis is an assumption until measured. Time spent waiting on the AI provider is I/O and is not billed as active CPU on Vercel.`,
    ],
  };
}
