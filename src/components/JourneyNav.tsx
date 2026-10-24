'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const steps = [
  { href: '/', label: 'Customer Brief', short: 'Brief' },
  { href: '/architecture', label: 'Architecture Review', short: 'Architecture' },
  { href: '/migration', label: 'Migration Plan', short: 'Migration' },
  { href: '/lab', label: 'Validation Lab', short: 'Validation' },
  { href: '/decision', label: 'Executive Decision', short: 'Decision' },
] as const;

export function JourneyNav() {
  const path = usePathname();
  return (
    <nav aria-label="Workshop journey" className="-mx-1 overflow-x-auto">
      <ol className="flex gap-1 px-1">
        {steps.map((s, i) => {
          const active = s.href === '/' ? path === '/' : path.startsWith(s.href);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${
                  active ? 'bg-accent-soft font-medium text-accent-ink' : 'text-muted hover:bg-subtle'
                }`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[0.68rem] ${active ? 'bg-accent text-white' : 'bg-subtle text-muted'}`}>
                  {i + 1}
                </span>
                <span className="hidden lg:inline">{s.label}</span>
                <span className="lg:hidden">{s.short}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function NextStep({ current }: { current: (typeof steps)[number]['href'] }) {
  const i = steps.findIndex((s) => s.href === current);
  const next = steps[i + 1];
  if (!next) return null;
  return (
    <div className="no-print mt-14 flex justify-end border-t border-line pt-6">
      <Link href={next.href} className="btn btn-primary">
        Next: {next.label} →
      </Link>
    </div>
  );
}
