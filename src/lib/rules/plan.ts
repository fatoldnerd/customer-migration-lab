import type { MigrationPhase, MigrationTask, Recommendation, ValidationRun } from '@/lib/types';
import { basePhases } from '@/data/migration';

export interface ResolvedTask extends MigrationTask {
  /** Rule that added this task, if any. */
  addedBy?: string;
}
export interface ResolvedPhase extends Omit<MigrationPhase, 'tasks'> {
  tasks: ResolvedTask[];
}

/**
 * Merges rule-added tasks into the base plan and derives check-backed statuses
 * from the latest validation run. A task is only 'verified' when every linked
 * check passed in that run; otherwise it stays 'proposed'.
 */
export function buildPlan(recs: Recommendation[], latest: ValidationRun | null): ResolvedPhase[] {
  return basePhases.map((phase) => {
    const added: ResolvedTask[] = recs.flatMap((r) =>
      (r.addsTasks ?? []).filter((t) => t.phaseId === phase.id).map((t) => ({ ...t.task, addedBy: r.id })),
    );
    const tasks = [...phase.tasks, ...added].map((t): ResolvedTask => {
      if (!t.verifiedByChecks?.length) return t;
      const results = t.verifiedByChecks.map((id) => latest?.checks.find((c) => c.id === id));
      const allPassed = results.every((c) => c?.passed);
      if (latest && allPassed) {
        return {
          ...t,
          status: 'verified',
          evidence: `Validation Lab run ${new Date(latest.meta.timestamp).toLocaleString('en-GB')} (${latest.meta.environment}, ${latest.meta.simulated ? 'simulated AI' : 'real AI'}): ${results.length} linked checks passed.`,
        };
      }
      const failed = results.filter((c) => c && !c.passed).length;
      return { ...t, status: 'proposed', evidence: latest ? `${failed} linked check(s) failing in the latest run.` : 'Not yet run.' };
    });
    return { ...phase, tasks };
  });
}
