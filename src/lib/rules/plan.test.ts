import { describe, expect, it } from 'vitest';
import type { CheckId, CustomerScenario, ValidationRun } from '@/lib/types';
import { CHECKS } from '@/lib/validation/checks';
import { evaluateRules } from './index';
import { buildPlan } from './plan';

const s: CustomerScenario = { dailyAnalyses: 8_000, typicalImageMB: 1, geography: 'emea', visibility: 'private', priority: 'balanced' };

const run = (failing: CheckId[] = []): ValidationRun => ({
  id: 'r',
  meta: { environment: 'local-development', origin: 'http://localhost', userAgent: 'test', nodeVersion: 'v24', aiProvider: 'simulated', simulated: true, timestamp: '2026-10-23T10:00:00Z', sampleCount: 5 },
  checks: CHECKS.map((c) => ({ id: c.id, name: c.name, expected: c.expected, observed: '', durationMs: 1, passed: !failing.includes(c.id) })),
  latency: null,
});

const find = (phases: ReturnType<typeof buildPlan>, id: string) => phases.flatMap((p) => p.tasks).find((t) => t.id === id);

describe('buildPlan', () => {
  it('keeps check-backed tasks proposed until a run exists', () => {
    expect(find(buildPlan(evaluateRules(s), null), 'local-checks')?.status).toBe('proposed');
  });
  it('marks check-backed tasks verified only when every linked check passes', () => {
    expect(find(buildPlan(evaluateRules(s), run()), 'local-checks')?.status).toBe('verified');
    expect(find(buildPlan(evaluateRules(s), run(['provider-timeout'])), 'local-checks')?.status).toBe('proposed');
  });
  it('adds the access-control task only when photographs are private', () => {
    expect(find(buildPlan(evaluateRules(s), null), 'access-control-tests')?.addedBy).toBe('private-no-shared-cache');
    expect(find(buildPlan(evaluateRules({ ...s, visibility: 'public' }), null), 'access-control-tests')).toBeUndefined();
  });
  it('never marks candidate or production tasks verified from local runs', () => {
    const plan = buildPlan(evaluateRules(s), run());
    for (const id of ['candidate-checks', 'rehearse-rollback', 'measure-baseline', 'observe']) {
      expect(find(plan, id)?.status).toBe('proposed');
    }
  });
});
