'use client';

import { useMemo, useState } from 'react';
import type { OptionId } from '@/lib/types';
import { decideOption, evaluateRules } from '@/lib/rules';
import { useLab } from '@/lib/scenario/store';
import { edges, flows, nodes, options, type ArchEdge, type FlowId, type NodeId } from '@/data/architecture';
import { Strength } from './ui';

const W = 150;
const H = 58;
const zones = [
  { id: 'device', label: 'User device', x: 10, w: 170 },
  { id: 'hosting', label: 'Hosting platform', x: 200, w: 400 },
  { id: 'google', label: 'Google services (retained)', x: 620, w: 200 },
];
const byId = Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<NodeId, (typeof nodes)[number]>;

function edgePath(e: ArchEdge, offset: number) {
  const a = byId[e.from];
  const b = byId[e.to];
  if (e.from === 'browser' && e.to === 'auth') {
    return { d: `M ${a.x} ${a.y - H / 2} C ${a.x} 18, 560 18, ${b.x - W / 2} ${b.y - 8}`, mx: 360, my: 32 };
  }
  const x1 = a.x + W / 2;
  const x2 = b.x - W / 2;
  const y1 = a.y + offset;
  const y2 = b.y + offset;
  return { d: `M ${x1} ${y1} L ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

export function ArchitectureDiagram() {
  const { scenario } = useLab();
  const [option, setOption] = useState<OptionId>('vercel-hosted');
  const [flow, setFlow] = useState<FlowId>('analysis');
  const [selected, setSelected] = useState<NodeId>('server');

  const active = edges.filter((e) => e.flows.includes(flow));
  const node = byId[selected];
  // The private-photo flow always shows private behaviour, whatever the scenario default.
  const cacheView = flow === 'private-image' ? 'private' : scenario.visibility;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="Architecture option" className="inline-flex rounded-lg border border-line bg-surface p-1">
          {(Object.keys(options) as OptionId[]).map((o) => (
            <button key={o} role="radio" aria-checked={option === o} type="button" onClick={() => setOption(o)}
              className={`rounded-md px-3 py-1.5 text-sm ${option === o ? 'bg-ink text-white' : 'text-muted hover:bg-subtle'}`}>
              {options[o].short}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Request flow" className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-1">
          {(Object.keys(flows) as FlowId[]).map((f) => (
            <button key={f} role="radio" aria-checked={flow === f} type="button" onClick={() => setFlow(f)}
              className={`rounded-md px-3 py-1.5 text-sm ${flow === f ? 'bg-accent text-white' : 'text-muted hover:bg-subtle'}`}>
              {flows[f].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">Photographs: <strong className="text-ink">{scenario.visibility}</strong> (set on the Customer Brief)</span>
      </div>

      <p className="max-w-3xl text-sm text-muted">{options[option].summary}</p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="card overflow-hidden p-2">
          <svg viewBox="0 0 830 400" role="group" aria-label={`Architecture diagram: ${options[option].name}, ${flows[flow].label} flow`} className="h-auto w-full">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
              </marker>
            </defs>
            {zones.map((z) => (
              <g key={z.id}>
                <rect x={z.x} y={4} width={z.w} height={392} rx={10} fill={z.id === 'hosting' ? 'var(--subtle)' : 'transparent'} stroke="var(--line)" strokeDasharray={z.id === 'hosting' && option === 'retain-and-harden' ? '6 4' : undefined} />
                <text x={z.x + 12} y={388} fontSize="11" fill="var(--faint)" letterSpacing="0.06em">{z.label.toUpperCase()}</text>
              </g>
            ))}
            {edges.map((e) => {
              const on = e.flows.includes(flow);
              const offset = e.id.endsWith('-page') ? -12 : e.id.endsWith('-an') ? 12 : 0;
              const { d } = edgePath(e, offset);
              return <path key={e.id} d={d} fill="none" stroke={on ? 'var(--accent)' : 'var(--line)'} strokeWidth={on ? 2.2 : 1.2}
                strokeDasharray={on && e.crossesBoundary ? undefined : on ? '4 3' : undefined} markerEnd={on ? 'url(#arrow)' : undefined} />;
            })}
            {active.map((e, i) => {
              const offset = e.id.endsWith('-page') ? -12 : e.id.endsWith('-an') ? 12 : 0;
              const { mx, my } = edgePath(e, offset);
              return (
                <g key={e.id}>
                  <circle cx={mx} cy={my} r={10} fill="var(--accent)" />
                  <text x={mx} y={my + 4} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{i + 1}</text>
                </g>
              );
            })}
            {nodes.map((n) => {
              const unknown = n.unknown?.[option];
              const sel = n.id === selected;
              return (
                <g key={n.id} role="button" tabIndex={0} aria-pressed={sel} aria-label={`${n.label[option]}: show details`}
                  onClick={() => setSelected(n.id)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelected(n.id); } }}
                  className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[3]">
                  <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={8} fill="var(--surface)"
                    stroke={sel ? 'var(--accent)' : 'var(--ink)'} strokeOpacity={sel ? 1 : 0.35} strokeWidth={sel ? 2.5 : 1.2}
                    strokeDasharray={unknown ? '5 4' : undefined} />
                  <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)">{n.label[option]}</text>
                  <text x={n.x} y={n.y + 13} textAnchor="middle" fontSize="10.5" fill={unknown ? 'var(--danger)' : 'var(--muted)'}>{n.sub[option]}</text>
                </g>
              );
            })}
          </svg>
          <p className="px-3 pb-2 text-xs text-faint">Solid accent line = crosses a service boundary · dashed box = unknown in this option · select a component for details</p>
        </div>

        <aside className="card p-5" aria-live="polite">
          <p className="eyebrow">Component</p>
          <h3 className="mt-1 text-lg font-semibold">{node.label[option]}</h3>
          {node.unknown?.[option] && (
            <p className="mt-2 rounded bg-danger-soft px-2 py-1 text-xs text-danger">Open question: the current host is not established by the repository.</p>
          )}
          <dl className="mt-4 grid gap-4 text-sm">
            <div><dt className="font-medium">Responsibilities</dt><dd><ul className="mt-1 grid gap-1 text-muted">{node.responsibilities.map((r) => <li key={r}>— {r}</li>)}</ul></dd></div>
            <div><dt className="font-medium">Credentials</dt><dd className="mt-1 text-muted">{node.credentials}</dd></div>
            <div><dt className="font-medium">Timeouts, retries, errors</dt><dd className="mt-1 text-muted">{node.failureHandling}</dd></div>
          </dl>
        </aside>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <p className="font-medium">{flows[flow].label}: requests in order</p>
          <p className="text-sm text-muted">{flows[flow].description}</p>
        </div>
        <table className="data">
          <thead><tr><th>#</th><th>From → to</th><th>What crosses</th><th>Boundary</th><th>Caching ({cacheView} photographs)</th></tr></thead>
          <tbody>
            {active.map((e, i) => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{i + 1}</td>
                <td className="whitespace-nowrap">{byId[e.from].label[option]} → {byId[e.to].label[option]}</td>
                <td>{e.label}</td>
                <td className="text-xs">{e.crossesBoundary ? 'Yes' : 'Internal'}</td>
                <td className="text-muted">{e.cache(cacheView)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CachingPolicy() {
  const { scenario } = useLab();
  const isPrivate = scenario.visibility === 'private';
  const rows = [
    { item: 'Hashed JS/CSS/fonts', policy: 'public, max-age=31536000, immutable', shared: true },
    { item: 'Collection pages (HTML)', policy: 'Per Next.js rendering strategy; personalised parts rendered dynamically', shared: true },
    { item: 'Public collection images', policy: 'public, s-maxage=86400, stale-while-revalidate', shared: true },
    { item: 'Private photographs', policy: 'private, no-store · authorise every request', shared: false, emphasise: isPrivate },
    { item: 'AI analysis (POST)', policy: 'private, no-store · never cached; result saved with the object', shared: false },
    { item: 'Personal stories and audio', policy: 'private, no-store', shared: false, emphasise: isPrivate },
  ];
  return (
    <div className="card overflow-x-auto">
      <table className="data">
        <thead><tr><th>Content</th><th>Cache-Control</th><th>Shared cache?</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.item} className={r.emphasise ? 'bg-accent-soft/50' : ''}>
              <td className="font-medium">{r.item}</td>
              <td className="font-mono text-xs">{r.policy}</td>
              <td className={r.shared ? '' : 'font-medium text-danger'}>{r.shared ? 'Allowed' : 'Never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        On Vercel, the CDN does not cache responses containing <code>private</code>, <code>no-cache</code> or <code>no-store</code>, or requests carrying an <code>Authorization</code> header (Vercel CDN cache docs, consulted 2026-10-23). The Validation Lab checks that this prototype emits these headers.
      </p>
    </div>
  );
}

export function OptionRecommendation() {
  const { scenario } = useLab();
  const decision = useMemo(() => decideOption(scenario), [scenario]);
  const both = useMemo(() => evaluateRules(scenario).filter((r) => r.appliesTo.length === 2 && r.strength === 'requirement'), [scenario]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card border-accent p-6">
        <p className="eyebrow">Recommendation for the current scenario</p>
        <p className="mt-2 text-sm font-medium text-accent-ink">{options[decision.recommended].name}</p>
        <h3 className="mt-2 text-xl font-semibold leading-snug">{decision.headline}</h3>
        <ul className="mt-4 grid gap-2 text-sm leading-relaxed">
          {decision.reasons.map((r) => <li key={r}>— {r}</li>)}
        </ul>
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-medium">Required under either option</p>
          <ul className="mt-2 grid gap-2">
            {both.map((r) => <li key={r.id} className="flex items-start gap-2 text-sm"><Strength value={r.strength} /><span>{r.title}</span></li>)}
          </ul>
        </div>
      </div>
      <div className="card p-6">
        <p className="eyebrow">Evidence that would change this recommendation</p>
        <ul className="mt-3 grid gap-3 text-sm leading-relaxed">
          {decision.wouldChangeIf.map((w) => <li key={w}>— {w}</li>)}
        </ul>
      </div>
    </div>
  );
}
