import { NextStep } from '@/components/JourneyNav';
import { CriteriaTable, Implications, ScenarioControls } from '@/components/ScenarioWorkbench';
import { Evidence, PageHeader, Section } from '@/components/ui';
import { REFERENCE_COMMIT, REFERENCE_REPO, assumptions, constraints, inspected, objective, openQuestions, stakeholders } from '@/data/brief';

export default function CustomerBrief() {
  return (
    <>
      <PageHeader
        step="Step 1 · Customer Brief"
        title="Heritage House wants AI photo analysis without risking private family stories."
        lede="A discovery summary: what they are trying to achieve, who decides, what the code actually shows, and what we would need to agree before recommending anything."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <p className="eyebrow">Business objective</p>
          <p className="mt-2 leading-relaxed">{objective.business}</p>
        </div>
        <div className="card p-6">
          <p className="eyebrow">Intended outcome of this engagement</p>
          <p className="mt-2 leading-relaxed">{objective.outcome}</p>
          <p className="mt-3 text-sm text-muted">{objective.hypothesis}</p>
        </div>
      </div>

      <Section title="Stakeholders and decision criteria" kicker="Who decides">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Role (fictional)</th><th>Part in decision</th><th>What they need to see</th></tr></thead>
            <tbody>
              {stakeholders.map((s) => (
                <tr key={s.role}><td className="font-medium">{s.role}</td><td className="text-muted">{s.type}</td><td>{s.criteria}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Current architecture: what the reference repository establishes" kicker="Grounded in code">
        <p className="mb-4 max-w-3xl text-sm text-muted">
          From reading{' '}
          <a className="underline" href={REFERENCE_REPO} target="_blank" rel="noreferrer">fatoldnerd/memoryartifact</a>{' '}
          at commit <code>{REFERENCE_COMMIT}</code>. Anything not shown here (hosting, traffic, cost) is unknown, not assumed.
        </p>
        <ul className="grid gap-2">
          {inspected.map((f) => (
            <li key={f.id} className="card flex items-start gap-3 p-4">
              <Evidence kind="inspected" />
              <span className="flex-1 text-sm leading-relaxed">{f.statement}</span>
              {f.source && <a href={f.source} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted underline">source</a>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Constraints, assumptions and open questions" kicker="What we know, assume and must ask">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5">
            <h3 className="font-semibold">Constraints</h3>
            <ul className="mt-3 grid gap-2 text-sm">
              {constraints.map((c) => <li key={c} className="leading-relaxed">— {c}</li>)}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Assumptions</h3>
            <ul className="mt-3 grid gap-3 text-sm">
              {assumptions.map((a) => (
                <li key={a.id} className="leading-relaxed"><Evidence kind="assumption" /> <span className="ml-1">{a.statement}</span></li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Unanswered questions</h3>
            <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm">
              {openQuestions.map((q) => <li key={q.id} className="leading-relaxed">{q.statement}</li>)}
            </ol>
          </div>
        </div>
      </Section>

      <Section title="Scenario and its implications" kicker="Change a control and watch the recommendations move">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-6"><ScenarioControls /></div>
          <Implications />
        </div>
      </Section>

      <Section title="Technical acceptance criteria" kicker="Agreed in discovery (fictional) plus any added by the scenario">
        <CriteriaTable />
      </Section>

      <NextStep current="/" />
    </>
  );
}
