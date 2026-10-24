import type { MigrationPhase } from '@/lib/types';

/**
 * Base migration plan. Statuses are 'proposed' unless backed by evidence.
 * Tasks with `verifiedByChecks` become verified only when the latest
 * Validation Lab run passed those checks.
 */
export const basePhases: MigrationPhase[] = [
  {
    id: 'baseline',
    number: 1,
    title: 'Establish the baseline and acceptance criteria',
    outcome: 'Agreed, measurable criteria and a measured picture of today’s performance, cost and release process.',
    tasks: [
      { id: 'inspect-reference', label: 'Inspect the reference repository and record what it establishes', status: 'verified', evidence: 'Code inspection of commit 5850081 on 2026-10-23 (see Customer Brief).' },
      { id: 'confirm-hosting', label: 'Confirm the current host, region, release and rollback process', status: 'proposed' },
      { id: 'measure-baseline', label: 'Measure baseline page LCP (field data), analysis p50/p95 and error rate', status: 'proposed' },
      { id: 'agree-criteria', label: 'Agree the acceptance criteria with stakeholders', status: 'proposed' },
    ],
    dependencies: ['Access to current hosting, analytics and billing', 'Stakeholder workshop time'],
    evidenceToProceed: ['Baseline measurements recorded with environment, date and sample count', 'Signed-off acceptance criteria', 'Answers to the open questions on hosting and Firebase region'],
    rollback: 'No production change in this phase.',
  },
  {
    id: 'candidate',
    number: 2,
    title: 'Prepare a candidate deployment and configuration',
    outcome: 'A hardened build running on a Vercel preview deployment against non-production Firebase, configured like production.',
    tasks: [
      { id: 'harden-route', label: 'Implement token verification, input validation, timeout and retry in the analysis route', status: 'proposed', evidence: 'Prototype implementation exists in this lab; not yet applied to Heritage House code.' },
      { id: 'env-config', label: 'Configure sensitive server-only environment variables per environment (preview vs production)', status: 'proposed' },
      { id: 'region', label: 'Set the function region next to the Firebase project region (default would be iad1)', status: 'proposed' },
      { id: 'cache-headers', label: 'Set Cache-Control per route: private, no-store for private content; s-maxage for public images', status: 'proposed' },
    ],
    dependencies: ['Phase 1 criteria', 'Firebase project region confirmed', 'Separate non-production Firebase project or emulator'],
    evidenceToProceed: ['Preview deployment URL protected by Deployment Protection', 'Configuration review: no secrets in client bundle', 'Automated tests passing in CI'],
    rollback: 'Preview only; delete or ignore the deployment. Production is untouched.',
  },
  {
    id: 'validate',
    number: 3,
    title: 'Validate the relevant customer journeys',
    outcome: 'Evidence that the candidate meets every acceptance criterion for browsing, analysis and private-photo access.',
    tasks: [
      { id: 'local-checks', label: 'Run the validation checks against the reference workload', status: 'proposed', verifiedByChecks: ['valid-request', 'unauthenticated', 'missing-image', 'invalid-image', 'oversized-image', 'provider-timeout', 'transient-recovery', 'failure-then-retry'] },
      { id: 'candidate-checks', label: 'Run the same checks against the candidate preview deployment', status: 'proposed' },
      { id: 'compare-latency', label: 'Compare candidate vs baseline latency with the same images, provider and sample size', status: 'proposed' },
      { id: 'rehearse-rollback', label: 'Rehearse Instant Rollback and time it against AC-6', status: 'proposed' },
    ],
    dependencies: ['Candidate deployment', 'Baseline measurements', 'Test accounts for two users'],
    evidenceToProceed: ['All acceptance criteria met or explicitly waived by the named owner', 'No unresolved high-severity security findings'],
    rollback: 'Production is untouched; fix forward on the candidate.',
  },
  {
    id: 'cutover',
    number: 4,
    title: 'Plan a controlled cutover',
    outcome: 'Production traffic moved deliberately, with a reversible DNS/routing change and a named decision-maker.',
    tasks: [
      { id: 'runbook', label: 'Write the cutover runbook with go/no-go criteria and owners', status: 'proposed' },
      { id: 'dns-ttl', label: 'Lower DNS TTL in advance; schedule a low-traffic window', status: 'proposed' },
      { id: 'gradual', label: 'Shift traffic gradually where possible (e.g. Rolling Releases between Vercel deployments after the domain moves)', status: 'proposed' },
      { id: 'comms', label: 'Prepare stakeholder and support communications', status: 'proposed' },
    ],
    dependencies: ['Phase 3 sign-off', 'Old host kept running and deployable'],
    evidenceToProceed: ['Go decision recorded against the criteria', 'Rollback owner on call'],
    rollback: 'Point DNS back to the previous host, which stays live and unchanged through the monitoring window. Firebase is unchanged, so no data migration has to be reversed.',
  },
  {
    id: 'monitor',
    number: 5,
    title: 'Monitor results and retain a rollback path',
    outcome: 'Confirmed outcomes in production, or a clean return to the previous state.',
    tasks: [
      { id: 'observe', label: 'Monitor error rate, analysis p95, LCP and spend against the baseline', status: 'proposed' },
      { id: 'review', label: 'Run a results review with stakeholders after an agreed period', status: 'proposed' },
      { id: 'decommission', label: 'Decommission the previous host only after the review', status: 'proposed' },
    ],
    dependencies: ['Observability in place before cutover', 'Agreed review date'],
    evidenceToProceed: ['Production measurements meet criteria for the agreed period', 'Cost tracking matches the estimate within an agreed tolerance'],
    rollback: 'Within Vercel: Instant Rollback to the previous production deployment. To the previous host: DNS revert until it is decommissioned.',
  },
];
