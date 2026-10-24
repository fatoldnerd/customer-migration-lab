'use client';

import { useState } from 'react';
import type { ValidationRun } from '@/lib/types';
import { runValidation } from '@/lib/validation/checks';
import { actions, useLab } from '@/lib/scenario/store';
import { Evidence, NotMeasured } from './ui';

const envLabel: Record<ValidationRun['meta']['environment'], string> = {
  'local-development': 'Local development server (next dev: unoptimised, not representative of production)',
  'local-production-build': 'Local production build (next start)',
  'vercel-preview': 'Vercel preview deployment',
  'vercel-production': 'Vercel production deployment',
  unknown: 'Unknown environment',
};

export function ValidationRunner() {
  const { runs } = useLab();
  const [samples, setSamples] = useState(10);
  const [progress, setProgress] = useState<string | null>(null);
  const latest = runs[0] ?? null;

  async function run() {
    setProgress('Starting…');
    try {
      actions.addRun(await runValidation({ samples, onProgress: setProgress }));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="card flex flex-wrap items-end gap-4 p-5">
        <div>
          <label htmlFor="samples" className="block text-xs font-medium text-muted">Latency samples</label>
          <select id="samples" className="field mt-1 w-32" value={samples} onChange={(e) => setSamples(Number(e.target.value))}>
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={run} disabled={progress !== null}>
          {progress ? 'Running…' : 'Run validation checks'}
        </button>
        {runs.length > 0 && !progress && (
          <button type="button" className="btn" onClick={actions.clearRuns}>Clear results</button>
        )}
        <p aria-live="polite" className="text-sm text-muted">{progress}</p>
      </div>

      {!latest && <p className="text-sm text-muted">No checks have been run in this browser yet. Results are produced by real requests to this app and kept only in this browser.</p>}

      {latest && (
        <>
          <div className="card overflow-x-auto">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <Evidence kind="measured" />
              <p className="font-medium">{latest.checks.filter((c) => c.passed).length} of {latest.checks.length} checks passed</p>
              <p className="text-xs text-muted">{new Date(latest.meta.timestamp).toLocaleString('en-GB')}</p>
            </div>
            <table className="data">
              <thead><tr><th>Result</th><th>Check</th><th>Expected</th><th>Observed</th><th className="text-right">ms</th></tr></thead>
              <tbody>
                {latest.checks.map((c) => (
                  <tr key={c.id}>
                    <td><span className={`rounded px-1.5 py-px text-xs font-semibold ${c.passed ? 'bg-accent text-white' : 'bg-danger text-white'}`}>{c.passed ? 'PASS' : 'FAIL'}</span></td>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-muted">{c.expected}</td>
                    <td className="font-mono text-xs">{c.observed}</td>
                    <td className="text-right font-mono text-xs">{c.durationMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center gap-2"><Evidence kind="measured" /><h3 className="font-semibold">Analysis request timing (this environment)</h3></div>
              {latest.latency ? (
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {([['p50', latest.latency.p50Ms], ['p95', latest.latency.p95Ms], ['max', latest.latency.maxMs], ['min', latest.latency.minMs], ['mean', latest.latency.meanMs], ['server p50', latest.latency.serverP50Ms]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-md bg-subtle p-3"><dt className="text-xs text-muted">{k}</dt><dd className="font-mono text-lg">{v === null ? '—' : `${v} ms`}</dd></div>
                  ))}
                </dl>
              ) : <p className="mt-3"><NotMeasured what="no successful samples" /></p>}
              <p className="mt-3 text-xs text-muted">
                Browser round trip of sequential valid requests with a 1×1 JPEG. {latest.meta.simulated ? 'The AI provider was simulated, so these figures exclude real AI latency and only measure route overhead on this machine.' : 'A real AI provider was called.'}
              </p>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold">Measurement metadata</h3>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">Environment</dt><dd>{envLabel[latest.meta.environment]}</dd>
                <dt className="text-muted">Origin</dt><dd className="font-mono text-xs">{latest.meta.origin}</dd>
                <dt className="text-muted">Timestamp</dt><dd className="font-mono text-xs">{latest.meta.timestamp}</dd>
                <dt className="text-muted">Samples</dt><dd>{latest.meta.sampleCount}</dd>
                <dt className="text-muted">AI response</dt><dd>{latest.meta.simulated ? 'Simulated' : `Real (${latest.meta.aiProvider})`}</dd>
                <dt className="text-muted">Node.js</dt><dd className="font-mono text-xs">{latest.meta.nodeVersion}</dd>
                <dt className="text-muted">Browser</dt><dd className="break-all font-mono text-[0.68rem] text-muted">{latest.meta.userAgent}</dd>
              </dl>
            </div>
          </div>
        </>
      )}

      <div className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <p className="font-medium">Measurements by environment</p>
          <p className="text-sm text-muted">Local results are never presented as baseline or candidate results.</p>
        </div>
        <table className="data">
          <thead><tr><th>Environment</th><th>Analysis p50 / p95</th><th>Status</th></tr></thead>
          <tbody>
            <tr>
              <td className="font-medium">Local reference workload (this app)</td>
              <td className="font-mono text-xs">{latest?.latency ? `${latest.latency.p50Ms} / ${latest.latency.p95Ms} ms` : '—'}</td>
              <td>{latest?.latency ? <span className="text-sm">Measured · {latest.meta.environment} · {latest.meta.simulated ? 'simulated AI' : 'real AI'} · n={latest.meta.sampleCount}</span> : <NotMeasured />}</td>
            </tr>
            <tr><td className="font-medium">Baseline: Heritage House current production</td><td>—</td><td><NotMeasured what="awaiting access (phase 1)" /></td></tr>
            <tr><td className="font-medium">Candidate: Vercel preview deployment</td><td>—</td><td><NotMeasured what="not yet deployed (phase 2)" /></td></tr>
            <tr><td className="font-medium">Forecast</td><td>—</td><td className="text-sm text-muted">None produced. Forecasting without a baseline would be speculation.</td></tr>
          </tbody>
        </table>
      </div>

      {runs.length > 1 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-line px-4 py-3 font-medium">Previous runs in this browser</div>
          <table className="data">
            <thead><tr><th>Timestamp</th><th>Environment</th><th>Passed</th><th>p50 / p95</th><th>n</th></tr></thead>
            <tbody>
              {runs.slice(1).map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.meta.timestamp}</td>
                  <td>{r.meta.environment}</td>
                  <td>{r.checks.filter((c) => c.passed).length}/{r.checks.length}</td>
                  <td className="font-mono text-xs">{r.latency ? `${r.latency.p50Ms} / ${r.latency.p95Ms} ms` : '—'}</td>
                  <td>{r.meta.sampleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
