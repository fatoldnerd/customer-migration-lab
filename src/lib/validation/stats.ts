import type { LatencySummary } from '@/lib/types';

/** Nearest-rank percentile on a copy of the input. */
export function percentile(values: number[], p: number) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function summarise(samples: number[], serverSamples: number[] = []): LatencySummary | null {
  if (samples.length === 0) return null;
  return {
    samples: samples.length,
    minMs: r1(Math.min(...samples)),
    p50Ms: r1(percentile(samples, 50)),
    p95Ms: r1(percentile(samples, 95)),
    maxMs: r1(Math.max(...samples)),
    meanMs: r1(samples.reduce((a, b) => a + b, 0) / samples.length),
    serverP50Ms: serverSamples.length ? r1(percentile(serverSamples, 50)) : null,
  };
}

/** Parses `analysis;dur=12.3` from a Server-Timing header. */
export function serverTimingMs(header: string | null) {
  const m = header?.match(/dur=([\d.]+)/);
  return m ? Number(m[1]) : null;
}
