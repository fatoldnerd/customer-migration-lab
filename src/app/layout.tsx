import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { JourneyNav } from '@/components/JourneyNav';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const serif = Source_Serif_4({ variable: '--font-serif-display', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Migration Decision Lab', template: '%s · Migration Decision Lab' },
  description: 'A customer architecture workshop for a fictional hosting and AI-workload migration decision.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} antialiased`}>
      <body className="min-h-screen">
        <div role="note" className="bg-ink px-4 py-1.5 text-center text-xs text-white/85">
          <strong className="font-semibold text-white">Fictional demonstration scenario.</strong> Heritage House is not a real
          customer. The reference workload is the open-source Memory Artifact app; AI responses are simulated unless stated.
        </div>
        <header className="no-print border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:px-8">
            <div>
              <p className="font-serif text-lg font-semibold leading-tight">Migration Decision Lab</p>
              <p className="text-xs text-muted">Heritage House · AI photo analysis and hosting decision</p>
            </div>
            <JourneyNav />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">{children}</main>
        <footer className="no-print mx-auto max-w-6xl px-4 pb-10 text-xs text-faint md:px-8">
          Prepared by Brad Towers as an interview demonstration. Independent of, and not endorsed by, any vendor.
        </footer>
      </body>
    </html>
  );
}
