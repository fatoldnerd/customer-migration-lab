import type { ReactNode } from 'react';
import type { EvidenceKind, RecommendationStrength } from '@/lib/types';

const evidenceStyle: Record<EvidenceKind, { label: string; cls: string; title: string }> = {
  inspected: { label: 'Inspected', cls: 'border-ink/30 text-ink', title: 'Verified by reading the reference repository' },
  assumption: { label: 'Assumption', cls: 'border-dashed border-faint text-muted', title: 'Fictional Heritage House context' },
  proposed: { label: 'Proposed', cls: 'border-accent/40 text-accent-ink', title: 'A recommended change, not yet done' },
  measured: { label: 'Measured', cls: 'border-accent bg-accent text-white', title: 'Produced by an actual execution in this app' },
};

export function Evidence({ kind }: { kind: EvidenceKind }) {
  const s = evidenceStyle[kind];
  return (
    <span title={s.title} className={`inline-flex shrink-0 items-center rounded border px-1.5 py-px text-[0.68rem] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

const strengthStyle: Record<RecommendationStrength, string> = {
  requirement: 'bg-ink text-white',
  recommendation: 'bg-accent-soft text-accent-ink',
  consideration: 'bg-subtle text-muted',
};

export function Strength({ value }: { value: RecommendationStrength }) {
  return <span className={`inline-flex shrink-0 rounded px-1.5 py-px text-[0.68rem] font-semibold uppercase tracking-wide ${strengthStyle[value]}`}>{value}</span>;
}

export function PageHeader({ step, title, lede, children }: { step: string; title: string; lede: string; children?: ReactNode }) {
  return (
    <header className="mb-10 max-w-3xl">
      <p className="eyebrow">{step}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">{title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">{lede}</p>
      {children}
    </header>
  );
}

export function Section({ title, kicker, children, id }: { title: string; kicker?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-12 first:mt-0">
      <div className="mb-4">
        {kicker && <p className="eyebrow">{kicker}</p>}
        <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function NotMeasured({ what }: { what?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-dashed border-faint px-2 py-0.5 text-xs font-medium text-muted">
      Not measured{what ? ` · ${what}` : ''}
    </span>
  );
}
