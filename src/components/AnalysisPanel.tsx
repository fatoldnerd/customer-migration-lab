'use client';

import { useState } from 'react';
import type { AnalyzeResponse, SimulationMode } from '@/lib/analysis/types';
import { CURATOR } from '@/lib/validation/checks';

/** Mirrors the reference app: draw to a canvas, max 1200 px wide, JPEG. */
async function imageToJpegDataUrl(src: string, auth: boolean) {
  const res = await fetch(src, { headers: auth ? { authorization: CURATOR } : {}, cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load image (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1200 / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const modes: { value: SimulationMode; label: string }[] = [
  { value: 'none', label: 'Normal' },
  { value: 'timeout', label: 'Provider timeout' },
  { value: 'transient-failure', label: 'One transient failure' },
  { value: 'persistent-failure', label: 'Provider outage' },
];

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; res: AnalyzeResponse; status: number; roundTripMs: number };

export function AnalysisPanel({ objectId, visibility }: { objectId: string; visibility: 'public' | 'private' }) {
  const [mode, setMode] = useState<SimulationMode>('none');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function analyse(simulate: SimulationMode) {
    setState({ kind: 'loading' });
    const t0 = performance.now();
    try {
      const imageDataUrl = await imageToJpegDataUrl(`/api/objects/${objectId}/image`, visibility === 'private');
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: CURATOR },
        body: JSON.stringify({ imageDataUrl, simulate, ...(simulate === 'timeout' ? { timeoutMs: 2000 } : {}) }),
      });
      const res = (await r.json()) as AnalyzeResponse;
      setState({ kind: 'done', res, status: r.status, roundTripMs: Math.round(performance.now() - t0) });
    } catch (err) {
      setState({
        kind: 'done',
        status: 0,
        roundTripMs: Math.round(performance.now() - t0),
        res: { ok: false, error: { code: 'PROVIDER_ERROR', message: err instanceof Error ? err.message : 'Network error', retryable: true } },
      });
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="mode" className="block text-xs font-medium text-muted">Fault injection (demo only)</label>
          <select id="mode" className="field mt-1 w-56" value={mode} onChange={(e) => setMode(e.target.value as SimulationMode)}>
            {modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={state.kind === 'loading'} onClick={() => analyse(mode)}>
          {state.kind === 'loading' ? 'Analysing…' : 'Analyse photograph'}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Downscales to ≤1200 px JPEG in the browser (as the reference app does), then calls <code>POST /api/analyze</code> with a simulated curator session.
      </p>

      <div aria-live="polite" className="mt-5">
        {state.kind === 'done' && state.res.ok && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {state.res.meta.simulated && <span className="rounded bg-ink px-1.5 py-px font-semibold uppercase tracking-wide text-white">Simulated AI response</span>}
              <span className="text-muted">HTTP {state.status} · {state.res.meta.attempts} attempt(s) · server {state.res.meta.durationMs} ms · round trip {state.roundTripMs} ms</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {([
                ['Identification', state.res.analysis.objectIdentification],
                ['Estimated era', state.res.analysis.estimatedEra],
                ['Suggested description', state.res.analysis.suggestedDescription],
                ['Story starter', state.res.analysis.storyStarter],
                ['Materials', state.res.analysis.materials.join(', ')],
                ['Confidence', state.res.analysis.confidence],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-md bg-subtle p-3"><dt className="text-xs font-medium text-muted">{k}</dt><dd className="mt-1">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}
        {state.kind === 'done' && !state.res.ok && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft p-4">
            <p className="text-sm font-semibold text-danger">{state.res.error.code.replaceAll('_', ' ').toLowerCase()} (HTTP {state.status || 'network'})</p>
            <p className="mt-1 text-sm">{state.res.error.message}</p>
            <p className="mt-1 text-xs text-muted">Round trip {state.roundTripMs} ms{state.res.meta ? ` · ${state.res.meta.attempts} attempt(s)` : ''}</p>
            {state.res.error.retryable && (
              <button type="button" className="btn mt-3" onClick={() => { setMode('none'); analyse('none'); }}>
                Retry without fault injection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
