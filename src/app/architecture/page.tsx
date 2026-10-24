import type { Metadata } from 'next';
import { ArchitectureDiagram, CachingPolicy, OptionRecommendation } from '@/components/ArchitectureReview';
import { NextStep } from '@/components/JourneyNav';
import { PageHeader, Section } from '@/components/ui';
import { options, placementTable, tradeoffs } from '@/data/architecture';

export const metadata: Metadata = { title: 'Architecture Review' };

export default function ArchitecturePage() {
  return (
    <>
      <PageHeader
        step="Step 2 · Architecture Review"
        title="Two credible options. The hardening is the same in both."
        lede="Where each responsibility sits, which requests cross service boundaries, what may be cached and what must stay private. The hosting decision is separate from the security fixes."
      />

      <Section title="Request flows" kicker="Interactive diagram">
        <ArchitectureDiagram />
      </Section>

      <Section title="What is cached and what stays private" kicker="Follows the photo visibility control">
        <CachingPolicy />
      </Section>

      <Section title="Where timeouts, retries, rate limits and error handling belong" kicker="Responsibilities">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Concern</th><th>Where</th><th>Why there</th></tr></thead>
            <tbody>
              {placementTable.map((r) => (
                <tr key={r.concern}><td className="font-medium">{r.concern}</td><td>{r.where}</td><td className="text-muted">{r.why}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Tradeoffs" kicker="Option A vs option B">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th className="w-48">Dimension</th><th>{options['vercel-hosted'].short}</th><th>{options['retain-and-harden'].short}</th></tr></thead>
            <tbody>
              {tradeoffs.map((t) => (
                <tr key={t.dimension}><td className="font-medium">{t.dimension}</td><td>{t.a}</td><td className="text-muted">{t.b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Neither option, and no region choice, establishes regulatory compliance by itself. Photographs reach Google’s Gemini API and Firebase under either option, so their processing terms are reviewed separately.
        </p>
      </Section>

      <Section title="Reasoned recommendation" kicker="Generated from the scenario rules">
        <OptionRecommendation />
      </Section>

      <NextStep current="/architecture" />
    </>
  );
}
