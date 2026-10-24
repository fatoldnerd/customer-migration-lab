import type { Metadata } from 'next';
import { DecisionBrief } from '@/components/DecisionBrief';

export const metadata: Metadata = { title: 'Executive Decision' };

export default function DecisionPage() {
  return <DecisionBrief />;
}
