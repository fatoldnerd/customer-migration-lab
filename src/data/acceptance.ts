import type { AcceptanceCriterion } from '@/lib/types';

/**
 * Baseline acceptance criteria. In the fictional scenario these were agreed with
 * Heritage House stakeholders in the discovery workshop (assumption). Scenario
 * rules may add further criteria; see src/lib/rules.
 */
export const workshopCriteria: AcceptanceCriterion[] = [
  {
    id: 'AC-1',
    statement: 'A valid photograph returns a complete analysis with the agreed response shape.',
    measure: '100% of valid test requests return ok=true with every analysis field present.',
    origin: 'workshop',
    verifiedBy: ['valid-request'],
    verifiableAt: 'local',
  },
  {
    id: 'AC-2',
    statement: 'Missing, mislabelled or oversized images are rejected before any AI provider call.',
    measure: 'Each invalid input returns the documented 4xx code and no provider attempt is made.',
    origin: 'workshop',
    verifiedBy: ['missing-image', 'invalid-image', 'oversized-image'],
    verifiableAt: 'local',
  },
  {
    id: 'AC-3',
    statement: 'Only signed-in users can trigger AI analysis.',
    measure: 'Requests without a valid session return 401 and make no provider call.',
    origin: 'workshop',
    verifiedBy: ['unauthenticated'],
    verifiableAt: 'local',
  },
  {
    id: 'AC-4',
    statement: 'A slow AI provider produces a clear, retryable error rather than a hung request.',
    measure: 'Timeout returns 504 PROVIDER_TIMEOUT, retryable=true, within timeout + 1.5 s.',
    origin: 'workshop',
    verifiedBy: ['provider-timeout'],
    verifiableAt: 'local',
  },
  {
    id: 'AC-5',
    statement: 'Transient provider failures are recovered from without user data loss.',
    measure: 'A single transient failure is retried automatically; a persistent failure is retryable by the user.',
    origin: 'workshop',
    verifiedBy: ['transient-recovery', 'failure-then-retry'],
    verifiableAt: 'local',
  },
  {
    id: 'AC-6',
    statement: 'A failed release can be reverted to the previous production version quickly.',
    measure: 'Rollback to the previous production deployment completes in under 5 minutes without a rebuild (rehearsed).',
    origin: 'workshop',
    verifiableAt: 'candidate',
  },
  {
    id: 'AC-7',
    statement: 'Collection pages load quickly for users in the primary geography.',
    measure: 'p75 Largest Contentful Paint ≤ 2.5 s from field data, no worse than baseline.',
    origin: 'workshop',
    verifiableAt: 'production',
  },
  {
    id: 'AC-8',
    statement: 'AI analysis latency is no worse than the current baseline.',
    measure: 'Analysis p95 on the candidate ≤ baseline p95 + 10%, measured with the same images and provider.',
    origin: 'workshop',
    verifiableAt: 'candidate',
  },
];
