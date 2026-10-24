'use client';

import { useMemo } from 'react';
import type { CustomerScenario, DeliveryPriority, Geography, Recommendation } from '@/lib/types';
import { CONSTANTS, acceptanceCriteria, deriveMetrics, diffRecommendations, evaluateRules } from '@/lib/rules';
import { actions, useLab } from '@/lib/scenario/store';
import { Strength } from './ui';

const geographies: { value: Geography; label: string }[] = [
  { value: 'emea', label: 'EMEA' },
  { value: 'north-america', label: 'North America' },
  { value: 'apac', label: 'Asia-Pacific' },
  { value: 'global', label: 'Global' },
];
const priorities: { value: DeliveryPriority; label: string; hint: string }[] = [
  { value: 'minimise-effort', label: 'Minimise effort', hint: 'Fewest changes now' },
  { value: 'balanced', label: 'Balanced', hint: 'Evaluate while hardening' },
  { value: 'minimise-run-cost', label: 'Minimise run cost', hint: 'Cost evidence first' },
];
const inputLabel: Record<keyof CustomerScenario, string> = {
  dailyAnalyses: 'daily analyses',
  typicalImageMB: 'image size',
  geography: 'geography',
  visibility: 'photo visibility',
  priority: 'cost/effort preference',
};

export function ScenarioControls() {
  const { scenario } = useLab();
  const d = deriveMetrics(scenario);
  const set = actions.updateScenario;

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold">Scenario controls</h3>
        <button type="button" className="text-xs text-muted underline-offset-2 hover:underline" onClick={actions.resetScenario}>
          Reset to workshop defaults
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Fictional values (assumptions). Every change re-runs the rules immediately.</p>

      <div className="mt-6 grid gap-6">
        <div>
          <label htmlFor="daily" className="flex justify-between text-sm font-medium">
            <span>Expected daily image analyses</span>
            <span className="font-mono">{scenario.dailyAnalyses.toLocaleString('en-GB')}</span>
          </label>
          <input id="daily" type="range" min={100} max={100_000} step={100} value={scenario.dailyAnalyses}
            onChange={(e) => set({ dailyAnalyses: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" />
          <p className="mt-1 text-xs text-faint">≈ {d.monthlyAnalyses.toLocaleString('en-GB')}/month · assumed peak {d.peakPerMinute}/min ({CONSTANTS.peakFactor}× average)</p>
        </div>

        <div>
          <label htmlFor="size" className="flex justify-between text-sm font-medium">
            <span>Typical image size</span>
            <span className="font-mono">{scenario.typicalImageMB.toFixed(1)} MB</span>
          </label>
          <input id="size" type="range" min={0.2} max={8} step={0.1} value={scenario.typicalImageMB}
            onChange={(e) => set({ typicalImageMB: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" />
          <p className={`mt-1 text-xs ${d.exceedsFunctionBodyLimit ? 'font-medium text-danger' : 'text-faint'}`}>
            ≈ {d.encodedPayloadMB} MB once base64-encoded · function body limit {CONSTANTS.functionBodyLimitMB} MB
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Primary user geography</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {geographies.map((g) => (
              <label key={g.value} className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${scenario.geography === g.value ? 'border-accent bg-accent-soft font-medium text-accent-ink' : 'border-line hover:bg-subtle'}`}>
                <input type="radio" name="geo" value={g.value} checked={scenario.geography === g.value} onChange={() => set({ geography: g.value })} className="sr-only" />
                {g.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Photographs are</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['private', 'public'] as const).map((v) => (
              <label key={v} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${scenario.visibility === v ? 'border-accent bg-accent-soft font-medium text-accent-ink' : 'border-line hover:bg-subtle'}`}>
                <input type="radio" name="vis" value={v} checked={scenario.visibility === v} onChange={() => set({ visibility: v })} className="sr-only" />
                <span className="capitalize">{v}</span>
                <span className="block text-xs font-normal text-muted">{v === 'private' ? 'Family photos and personal stories' : 'Published collection imagery'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Preferred balance of operating cost and implementation effort</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {priorities.map((p) => (
              <label key={p.value} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${scenario.priority === p.value ? 'border-accent bg-accent-soft font-medium text-accent-ink' : 'border-line hover:bg-subtle'}`}>
                <input type="radio" name="prio" value={p.value} checked={scenario.priority === p.value} onChange={() => set({ priority: p.value })} className="sr-only" />
                {p.label}
                <span className="block text-xs font-normal text-muted">{p.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

function RecItem({ r, highlight }: { r: Recommendation; highlight?: boolean }) {
  return (
    <li className={`rounded-md border border-line p-4 ${highlight ? 'flash border-accent' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Strength value={r.strength} />
        <span className="text-xs uppercase tracking-wide text-faint">{r.category.replace('-', ' ')}</span>
        {highlight && <span className="text-xs font-semibold text-accent-ink">New from your last change</span>}
      </div>
      <p className="mt-2 font-medium leading-snug">{r.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.rationale}</p>
      <p className="mt-2 text-xs text-faint">
        Rule <code>{r.id}</code> · triggered by {r.triggeredBy.length ? r.triggeredBy.map((k) => inputLabel[k]).join(', ') : 'reference code inspection (always applies)'}
      </p>
    </li>
  );
}

export function Implications() {
  const { scenario, previousScenario } = useLab();
  const recs = useMemo(() => evaluateRules(scenario), [scenario]);
  const diff = useMemo(
    () => (previousScenario ? diffRecommendations(evaluateRules(previousScenario), recs) : { added: [], removed: [] }),
    [previousScenario, recs],
  );
  const addedIds = new Set(diff.added.map((r) => `${r.id}:${r.title}`));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">Implications</h3>
        <p className="text-xs text-muted">{recs.filter((r) => r.strength === 'requirement').length} requirements · {recs.length} total</p>
      </div>
      <p className="mt-1 text-sm text-muted">These come from transparent rules in <code>src/lib/rules</code>, not from an LLM.</p>
      {diff.removed.length > 0 && (
        <div aria-live="polite" className="mt-4 rounded-md border border-dashed border-faint bg-subtle p-3 text-sm">
          <p className="font-medium">No longer applies after your last change:</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {diff.removed.map((r) => <li key={r.id + r.title}>{r.title}</li>)}
          </ul>
        </div>
      )}
      <ul className="mt-4 grid gap-3" aria-live="polite">
        {recs.map((r) => <RecItem key={r.id + r.title} r={r} highlight={addedIds.has(`${r.id}:${r.title}`)} />)}
      </ul>
    </div>
  );
}

export function CriteriaTable() {
  const { scenario } = useLab();
  const criteria = useMemo(() => acceptanceCriteria(evaluateRules(scenario)), [scenario]);
  return (
    <div className="card overflow-x-auto">
      <table className="data">
        <thead>
          <tr><th>ID</th><th>Criterion</th><th>Measure</th><th>Verifiable at</th></tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.id} className={c.origin === 'rule' ? 'bg-accent-soft/50' : ''}>
              <td className="font-mono text-xs">{c.id}</td>
              <td>
                {c.statement}
                {c.origin === 'rule' && <span className="mt-1 block text-xs font-medium text-accent-ink">Added by the current scenario</span>}
              </td>
              <td className="text-muted">{c.measure}</td>
              <td className="whitespace-nowrap text-xs capitalize">{c.verifiableAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
