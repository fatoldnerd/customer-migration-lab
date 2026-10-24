'use client';

import { useMemo } from 'react';
import { evaluateRules } from '@/lib/rules';
import { buildPlan } from '@/lib/rules/plan';
import { useLab } from '@/lib/scenario/store';

export function MigrationPlan() {
  const { scenario, runs } = useLab();
  const phases = useMemo(() => buildPlan(evaluateRules(scenario), runs[0] ?? null), [scenario, runs]);
  const all = phases.flatMap((p) => p.tasks);
  const verified = all.filter((t) => t.status === 'verified').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full border-2 border-faint" /> Proposed</span>
        <span className="flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full bg-accent" /> Completed and verified (evidence cited)</span>
        <span className="flex items-center gap-2"><span aria-hidden className="rounded bg-accent-soft px-1.5 text-[0.68rem] font-semibold text-accent-ink">SCENARIO</span> Added by the current scenario</span>
        <span className="ml-auto text-muted">{verified} of {all.length} tasks verified</span>
      </div>

      <ol className="grid gap-6">
        {phases.map((p) => (
          <li key={p.id} className="card p-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-serif text-sm font-semibold text-white">{p.number}</span>
              <h3 className="text-xl font-semibold">{p.title}</h3>
            </div>
            <p className="mt-2 max-w-3xl text-muted"><span className="font-medium text-ink">Outcome: </span>{p.outcome}</p>

            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <div>
                <p className="eyebrow">Tasks</p>
                <ul className="mt-2 grid gap-2">
                  {p.tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 rounded-md border border-line p-3">
                      <span aria-label={t.status} className={`mt-1 h-3 w-3 shrink-0 rounded-full ${t.status === 'verified' ? 'bg-accent' : 'border-2 border-faint'}`} />
                      <div className="flex-1 text-sm">
                        <p className="leading-snug">
                          {t.label}
                          {t.addedBy && <span className="ml-2 rounded bg-accent-soft px-1.5 text-[0.68rem] font-semibold text-accent-ink">SCENARIO</span>}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          <span className="font-medium">{t.status === 'verified' ? 'Verified' : 'Proposed'}</span>
                          {t.evidence ? ` · ${t.evidence}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="grid content-start gap-4 text-sm">
                <div><dt className="eyebrow">Dependencies</dt><dd className="mt-1"><ul className="grid gap-1">{p.dependencies.map((d) => <li key={d}>— {d}</li>)}</ul></dd></div>
                <div><dt className="eyebrow">Evidence required to proceed</dt><dd className="mt-1"><ul className="grid gap-1">{p.evidenceToProceed.map((d) => <li key={d}>— {d}</li>)}</ul></dd></div>
                <div className="rounded-md bg-subtle p-3"><dt className="eyebrow">Rollback / recovery</dt><dd className="mt-1 leading-relaxed">{p.rollback}</dd></div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
