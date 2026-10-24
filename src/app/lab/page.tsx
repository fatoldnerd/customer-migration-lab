import type { Metadata } from 'next';
import Link from 'next/link';
import { NextStep } from '@/components/JourneyNav';
import { ObjectImage } from '@/components/ObjectImage';
import { ValidationRunner } from '@/components/ValidationRunner';
import { PageHeader, Section } from '@/components/ui';
import { collection } from '@/data/objects';

export const metadata: Metadata = { title: 'Validation Lab' };

export default function LabPage() {
  return (
    <>
      <PageHeader
        step="Step 4 · Validation Lab"
        title="Evidence from a working reference workload, not from slides."
        lede="A small, hardened version of the Memory Artifact analysis flow runs inside this app with simulated AI by default. The checks below make real requests and record real timings with their environment."
      />

      <Section title="Reference collection" kicker="Synthetic objects and stories">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collection.map((o) => (
            <li key={o.id}>
              <Link href={`/lab/objects/${o.id}`} className="card block overflow-hidden transition hover:border-accent">
                <ObjectImage id={o.id} name={o.name} visibility={o.visibility} className="aspect-[4/3] w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{o.name}</p>
                    <span className={`rounded px-1.5 py-px text-[0.68rem] font-semibold uppercase ${o.visibility === 'private' ? 'bg-ink text-white' : 'bg-subtle text-muted'}`}>{o.visibility}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{o.contributedBy}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Private images are fetched with a simulated curator session and served <code>private, no-store</code>; public images are served with <code>s-maxage</code>.</p>
      </Section>

      <Section title="Validation checks" kicker="Executed against the running app">
        <ValidationRunner />
      </Section>

      <NextStep current="/lab" />
    </>
  );
}
