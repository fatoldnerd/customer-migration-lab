import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { ObjectImage } from '@/components/ObjectImage';
import { collection, getObject } from '@/data/objects';

export function generateStaticParams() {
  return collection.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: PageProps<'/lab/objects/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: getObject(id)?.name ?? 'Object' };
}

export default async function ObjectPage({ params }: PageProps<'/lab/objects/[id]'>) {
  const { id } = await params;
  const object = getObject(id);
  if (!object) notFound();

  return (
    <>
      <Link href="/lab" className="text-sm text-muted hover:underline">← Validation Lab</Link>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <ObjectImage id={object.id} name={object.name} visibility={object.visibility} className="aspect-[4/3] w-full object-cover" />
        </div>
        <div>
          <span className={`rounded px-1.5 py-px text-[0.68rem] font-semibold uppercase ${object.visibility === 'private' ? 'bg-ink text-white' : 'bg-subtle text-muted'}`}>{object.visibility}</span>
          <h1 className="mt-3 text-3xl font-semibold">{object.name}</h1>
          <p className="mt-1 text-sm text-muted">{object.contributedBy} · {object.era}</p>
          <p className="mt-4 leading-relaxed">{object.story}</p>
          <p className="mt-3 text-xs text-faint">Synthetic fixture: the object, story and illustration are invented for this demonstration.</p>
        </div>
      </div>
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">AI-assisted analysis</h2>
        <AnalysisPanel objectId={object.id} visibility={object.visibility} />
      </section>
    </>
  );
}
