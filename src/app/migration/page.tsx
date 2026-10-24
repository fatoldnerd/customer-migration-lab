import type { Metadata } from 'next';
import { NextStep } from '@/components/JourneyNav';
import { MigrationPlan } from '@/components/MigrationPlan';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Migration Plan' };

export default function MigrationPage() {
  return (
    <>
      <PageHeader
        step="Step 3 · Migration Plan"
        title="Five phases, each with an exit test and a way back."
        lede="Nothing moves to production without evidence. Tasks are proposed until an execution proves them; the local validation task turns verified only after the Validation Lab checks pass."
      />
      <MigrationPlan />
      <NextStep current="/migration" />
    </>
  );
}
