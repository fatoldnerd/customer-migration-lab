'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { acceptanceCriteria, decideOption, deriveMetrics, evaluateRules } from '@/lib/rules';
import { estimateMonthlyCost } from '@/lib/cost/model';
import { actions, useLab } from '@/lib/scenario/store';
import { options, tradeoffs } from '@/data/architecture';
import { openQuestions } from '@/data/brief';
import { NotMeasured, Strength } from './ui';

const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const geo = { emea: 'EMEA', 'north-america': 'North America', apac: 'Asia-Pacific', global: 'Global' } as const;
const prio = { 'minimise-effort': 'Minimise implementation effort', balanced: 'Balanced', 'minimise-run-cost': 'Minimise operating cost' } as const;

const noop = () => () => {};
/** Rendered on the client only, so the date reflects when the brief is viewed or printed. */
function PreparedOn() {
  const date = useSyncExternalStore(noop, () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), () => null);
  return date ? <>Prepared {date}.</> : null;
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-9 border-b border-line pb-1.5 text-lg font-semibold">{children}</h2>;
}

export function DecisionBrief() {
  const { scenario, runs, prices, usage } = useLab();
  const recs = useMemo(() => evaluateRules(scenario), [scenario]);
  const decision = useMemo(() => decideOption(scenario), [scenario]);
  const criteria = useMemo(() => acceptanceCriteria(recs), [recs]);
  const cost = useMemo(() => estimateMonthlyCost(scenario, prices, usage), [scenario, prices, usage]);
  const d = deriveMetrics(scenario);
  const latest = runs[0] ?? null;
  const localCriteria = criteria.filter((c) => c.verifiedBy?.length && c.verifiableAt === 'local');
  const met = latest ? localCriteria.filter((c) => c.verifiedBy!.every((id) => latest.checks.find((k) => k.id === id)?.passed)) : [];
  const requirements = recs.filter((r) => r.strength === 'requirement');

  return (
    <article className="mx-auto max-w-3xl">
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Generated from the current scenario, rules and validation results. Edit the scenario on the Customer Brief.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
      </div>

      <header>
        <p className="eyebrow">Executive decision brief · Fictional scenario · Heritage House</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">{decision.headline}</h1>
        <p className="mt-2 text-sm text-muted">
          Recommended: <strong className="text-ink">{options[decision.recommended].name}</strong>
        </p>
        <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-xs text-muted">
          Scenario (assumptions): {scenario.dailyAnalyses.toLocaleString('en-GB')} analyses/day · {scenario.typicalImageMB} MB images ({d.encodedPayloadMB} MB encoded) · {geo[scenario.geography]} users · photographs {scenario.visibility} · {prio[scenario.priority]}. <PreparedOn />
        </p>
      </header>

      <H>Recommendation and business rationale</H>
      <ul className="grid gap-2 text-sm leading-relaxed">{decision.reasons.map((r) => <li key={r}>— {r}</li>)}</ul>

      <H>Principal architectural tradeoffs</H>
      <table className="data">
        <thead><tr><th>Dimension</th><th>{options['vercel-hosted'].short}</th><th>{options['retain-and-harden'].short}</th></tr></thead>
        <tbody>
          {tradeoffs.slice(0, 5).map((t) => <tr key={t.dimension}><td className="font-medium">{t.dimension}</td><td>{t.a}</td><td className="text-muted">{t.b}</td></tr>)}
        </tbody>
      </table>

      <H>Expected benefits that still require validation</H>
      <ul className="grid gap-2 text-sm leading-relaxed">
        <li>— Faster, safer releases through preview deployments and Instant Rollback <span className="text-muted">(verify: AC-6 rollback rehearsal on the candidate)</span>.</li>
        <li>— Page performance for {geo[scenario.geography]} users from CDN caching of static{scenario.visibility === 'public' ? ' and public image' : ''} content <span className="text-muted">(verify: AC-7 against the baseline. Baseline not measured.)</span>.</li>
        <li>— Reliable AI analysis with bounded failures <span className="text-muted">(verify: AC-4/AC-5. Provider latency itself is not changed by hosting.)</span>.</li>
        <li>— Lower cataloguing effort for curators <span className="text-muted">(hypothesis with no baseline yet)</span>.</li>
      </ul>

      <H>Known risks and unanswered questions</H>
      <ul className="grid gap-2 text-sm">
        {requirements.map((r) => <li key={r.id} className="flex items-start gap-2"><Strength value={r.strength} /><span>{r.title}</span></li>)}
      </ul>
      <ol className="mt-4 grid list-decimal gap-1 pl-5 text-sm text-muted">{openQuestions.map((q) => <li key={q.id}>{q.statement}</li>)}</ol>

      <H>Evidence gathered so far</H>
      <ul className="grid gap-2 text-sm leading-relaxed">
        <li>— <strong>Code inspection</strong> of the reference repository (commit 5850081): stack, Firebase usage and analysis route gaps.</li>
        <li>
          — <strong>Local validation</strong>:{' '}
          {latest ? (
            <>
              {latest.checks.filter((c) => c.passed).length}/{latest.checks.length} checks passed; {met.length}/{localCriteria.length} locally verifiable acceptance criteria met. Local analysis p50 {latest.latency?.p50Ms ?? '—'} ms, p95 {latest.latency?.p95Ms ?? '—'} ms (n={latest.meta.sampleCount}, {latest.meta.environment}, {latest.meta.simulated ? 'simulated AI' : 'real AI'}, {latest.meta.timestamp}). These figures measure route overhead on one machine, not production performance.
            </>
          ) : (
            <NotMeasured what="run the Validation Lab" />
          )}
        </li>
        <li>— <strong>Baseline (current production)</strong>: <NotMeasured /></li>
        <li>— <strong>Candidate deployment</strong>: <NotMeasured what="no deployment yet" /></li>
      </ul>

      <H>Operating cost (analysis workload, Option A)</H>
      <CostModel />
      <div className="mt-3 text-sm">
        {cost.complete ? (
          <p>Estimated analysis workload: <strong>{money(cost.knownSubtotal ?? 0)}/month</strong> for the priced lines above. This is an estimate, not a quote.</p>
        ) : (
          <p className="rounded-md border border-dashed border-faint p-3">
            <strong>Estimate incomplete.</strong> {cost.knownSubtotal !== null ? `Priced lines total ${money(cost.knownSubtotal)}/month, ` : 'No lines are priced yet, '}
            but {cost.missing.length} input(s) are missing: {cost.missing.join('; ')}. No total is stated.
          </p>
        )}
        <ul className="mt-3 grid gap-1 text-xs text-muted">{cost.exclusions.map((e) => <li key={e}>Excludes / note: {e}</li>)}</ul>
      </div>

      <H>Conditions for proceeding</H>
      <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed">
        <li>Baseline measured and acceptance criteria signed off by the named stakeholders.</li>
        <li>All {requirements.length} requirements above implemented and verified on the candidate.</li>
        <li>Candidate meets {criteria.map((c) => c.id).join(', ')}, or the owner explicitly waives specific criteria.</li>
        <li>Rollback rehearsed and timed; the previous host is kept live through the monitoring window.</li>
        <li>Data Protection Officer confirms processor terms for Gemini and Firebase.</li>
      </ol>

      <H>Next customer decision</H>
      <p className="text-sm leading-relaxed">
        {decision.recommended === 'vercel-hosted'
          ? 'Approve a time-boxed phase 1–3 evaluation: grant access to current hosting metrics and billing, nominate test accounts and a non-production Firebase project, and agree a go/no-go review date. No production change is requested at this stage.'
          : 'Approve the hardening work on the current host, and grant access to current hosting metrics so that the hosting question can be revisited with a measured baseline.'}
      </p>

      <footer className="mt-10 border-t border-line pt-3 text-xs text-faint">
        Fictional demonstration prepared by Brad Towers. Heritage House is not a real organisation. Reference workload: github.com/fatoldnerd/memoryartifact. AI responses in the lab are simulated unless stated.
      </footer>
    </article>
  );
}

function CostModel() {
  const { scenario, prices, usage } = useLab();
  const cost = estimateMonthlyCost(scenario, prices, usage);
  return (
    <div className="grid gap-3">
      <table className="data">
        <thead><tr><th>Line</th><th>Quantity / month</th><th>Calculation</th><th className="text-right">Cost</th></tr></thead>
        <tbody>
          {cost.lines.map((l) => (
            <tr key={l.id}>
              <td className="font-medium">{l.label}</td>
              <td className="font-mono text-xs">{l.quantity.toLocaleString('en-GB')} {l.quantityUnit}</td>
              <td className="text-xs text-muted">{l.formula}</td>
              <td className="text-right font-mono text-xs">{l.monthlyCost === null ? <span className="text-muted">price missing</span> : money(l.monthlyCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="no-print card p-4" open>
        <summary className="cursor-pointer text-sm font-medium">Unit-price assumptions (editable, with source and date)</summary>
        <div className="mt-3 grid gap-3">
          {prices.map((p) => (
            <fieldset key={p.id} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[1.2fr_0.8fr_1.4fr_0.8fr]">
              <legend className="px-1 text-xs font-medium">{p.label} ({p.unit})</legend>
              <label className="text-xs text-muted">Price
                <input className="field mt-1 font-mono" inputMode="decimal" placeholder="not set" value={p.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    actions.updatePrice(p.id, { value: v === '' || Number.isNaN(Number(v)) ? null : Number(v) });
                  }} />
              </label>
              <span className="hidden sm:block" />
              <label className="text-xs text-muted">Source (URL or document)
                <input className="field mt-1" placeholder="e.g. official pricing page" value={p.source} onChange={(e) => actions.updatePrice(p.id, { source: e.target.value })} />
              </label>
              <label className="text-xs text-muted">As of
                <input className="field mt-1" type="date" value={p.asOf} onChange={(e) => actions.updatePrice(p.id, { asOf: e.target.value })} />
              </label>
            </fieldset>
          ))}
          <label className="text-xs text-muted">Active CPU per analysis (ms), an assumption until measured on the candidate
            <input className="field mt-1 w-32 font-mono" type="number" min={1} value={usage.activeCpuMsPerAnalysis}
              onChange={(e) => actions.updateUsage({ activeCpuMsPerAnalysis: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
        </div>
      </details>

      <div className="hidden text-xs print:block">
        Unit prices used: {prices.map((p) => `${p.label}: ${p.value ?? 'not set'}${p.value !== null ? ` ${p.unit}` : ''}${p.source ? ` (source: ${p.source}${p.asOf ? `, ${p.asOf}` : ''})` : ''}`).join(' · ')}. Active CPU per analysis: {usage.activeCpuMsPerAnalysis} ms (assumption).
      </div>
    </div>
  );
}
