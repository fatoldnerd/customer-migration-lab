import type {
  AcceptanceCriterion,
  CustomerScenario,
  DerivedMetrics,
  MigrationPhaseId,
  MigrationTask,
  OptionDecision,
  Recommendation,
  RecommendationRule,
} from '@/lib/types';
import { workshopCriteria } from '@/data/acceptance';

/* ------------------------------------------------------------------ */
/* Constants (each one is shown in the UI with its source)             */
/* ------------------------------------------------------------------ */

export const CONSTANTS = {
  /** Vercel Function request body limit. Source: vercel.com/docs/functions/limitations (consulted 2026-10-23). */
  functionBodyLimitMB: 4.5,
  /** Base64 encodes 3 bytes as 4 characters. */
  base64Overhead: 4 / 3,
  /** Assumption: peak minute is 4× the daily average minute. Replace with traffic data. */
  peakFactor: 4,
  /** Above this peak rate, per-user rate limiting becomes a cutover requirement. */
  rateLimitRequirementPerMinute: 60,
  /** Above this daily volume, asynchronous processing is worth discussing. */
  asyncConsiderationDaily: 50_000,
  /** Below this daily volume, hosting cost is unlikely to decide the case. */
  lowVolumeDaily: 1_000,
  /** Encoded payload above which downscaling is recommended for upload latency. */
  downscaleRecommendationMB: 1.5,
  /** "Minimise effort" and below this volume favours deferring the hosting move. */
  deferMigrationDaily: 5_000,
  daysPerMonth: 30,
} as const;

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const fmt = (n: number) => n.toLocaleString('en-GB');

export function deriveMetrics(s: CustomerScenario): DerivedMetrics {
  const encodedPayloadMB = round(s.typicalImageMB * CONSTANTS.base64Overhead, 2);
  const averagePerMinute = s.dailyAnalyses / 1440;
  return {
    monthlyAnalyses: s.dailyAnalyses * CONSTANTS.daysPerMonth,
    encodedPayloadMB,
    exceedsFunctionBodyLimit: encodedPayloadMB > CONSTANTS.functionBodyLimitMB,
    averagePerMinute: round(averagePerMinute, 2),
    peakPerMinute: round(averagePerMinute * CONSTANTS.peakFactor, 1),
  };
}

const geographyLabel: Record<CustomerScenario['geography'], string> = {
  emea: 'Europe, Middle East and Africa',
  'north-america': 'North America',
  apac: 'Asia-Pacific',
  global: 'multiple continents',
};

const task = (phaseId: MigrationPhaseId, id: string, label: string, verifiedByChecks?: MigrationTask['verifiedByChecks']) => ({
  phaseId,
  task: { id, label, status: 'proposed' as const, verifiedByChecks },
});

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const rules: RecommendationRule[] = [
  {
    id: 'auth-on-analysis-route',
    description: 'The analysis route must authenticate callers (applies regardless of scenario).',
    evaluate: () => ({
      id: 'auth-on-analysis-route',
      title: 'Verify the caller’s Firebase ID token before calling the AI provider',
      category: 'security',
      strength: 'requirement',
      rationale:
        'Inspected: the reference route /api/analyze-artifact accepts any request. Anyone who finds the URL can spend the Gemini quota and submit arbitrary images. This applies whichever hosting option is chosen.',
      triggeredBy: [],
      appliesTo: ['vercel-hosted', 'retain-and-harden'],
    }),
  },
  {
    id: 'bounded-provider-calls',
    description: 'AI calls need a timeout, a single retry for transient errors and structured errors.',
    evaluate: () => ({
      id: 'bounded-provider-calls',
      title: 'Bound AI calls with a timeout, one retry and structured, retryable errors',
      category: 'reliability',
      strength: 'requirement',
      rationale:
        'Inspected: the reference awaits Gemini with no timeout or retry and returns raw error messages. Set the timeout below the function’s maximum duration, retry transient (5xx/429) errors once with jitter, and do not retry timeouts automatically, because that doubles the user’s wait.',
      triggeredBy: [],
      appliesTo: ['vercel-hosted', 'retain-and-harden'],
    }),
  },
  {
    id: 'private-no-shared-cache',
    description: 'Private photographs must never be stored in a shared cache.',
    evaluate: (s) =>
      s.visibility !== 'private'
        ? null
        : {
            id: 'private-no-shared-cache',
            title: 'Serve private photographs and analyses with Cache-Control: private, no-store',
            category: 'caching',
            strength: 'requirement',
            rationale:
              'Photographs are marked private. A shared (CDN) cache keyed only by URL could serve one family’s photograph to another person. Private responses must bypass shared caches, require authorisation on every request, and be tested for cross-user access.',
            triggeredBy: ['visibility'],
            appliesTo: ['vercel-hosted', 'retain-and-harden'],
            addsCriteria: [
              {
                id: 'AC-P1',
                statement: 'Private images are never served from, or eligible for, a shared cache.',
                measure: 'Unauthorised requests are rejected; authorised responses carry private, no-store and no s-maxage.',
                origin: 'rule',
                verifiedBy: ['private-not-shared-cacheable'],
                verifiableAt: 'local',
              },
              {
                id: 'AC-P2',
                statement: 'One user cannot read another user’s private photograph or story.',
                measure: 'Cross-user access tests pass against server routes and Firebase Storage/Firestore security rules.',
                origin: 'rule',
                verifiedBy: ['private-not-shared-cacheable'],
                verifiableAt: 'candidate',
              },
            ],
            addsTasks: [
              task('validate', 'access-control-tests', 'Run cross-user access-control tests on private photographs (server routes and Firebase rules)', ['private-not-shared-cacheable']),
              task('candidate', 'author-firebase-rules', 'Author and review Firebase Storage and Firestore security rules (none exist in the reference repository)'),
            ],
          },
  },
  {
    id: 'public-cdn-cache',
    description: 'Public derived images can be cached at the CDN.',
    evaluate: (s) =>
      s.visibility !== 'public'
        ? null
        : {
            id: 'public-cdn-cache',
            title: 'Cache public collection images at the CDN; keep analysis requests uncached',
            category: 'caching',
            strength: 'recommendation',
            rationale:
              'Photographs are public, so derived images can be served with s-maxage and stale-while-revalidate, close to users. Analysis requests are POSTs that carry a user token, so they stay uncached. If photographs are later made private, this recommendation is withdrawn.',
            triggeredBy: ['visibility'],
            appliesTo: ['vercel-hosted', 'retain-and-harden'],
            addsCriteria: [
              {
                id: 'AC-C1',
                statement: 'Public collection images are cacheable at the CDN.',
                measure: 'Public image responses carry public, s-maxage and are served from cache on repeat requests (x-vercel-cache: HIT on the candidate).',
                origin: 'rule',
                verifiedBy: ['public-cacheable'],
                verifiableAt: 'candidate',
              },
            ],
          },
  },
  {
    id: 'payload-size',
    description: 'Encoded image payload versus the function request body limit.',
    evaluate: (s, d) => {
      if (d.exceedsFunctionBodyLimit) {
        return {
          id: 'payload-size',
          title: 'Stop sending full images through the function body: downscale or upload directly to storage',
          category: 'performance',
          strength: 'requirement',
          rationale: `A ${s.typicalImageMB} MB photograph becomes about ${d.encodedPayloadMB} MB once base64-encoded, as the reference route requires. That exceeds the ${CONSTANTS.functionBodyLimitMB} MB Vercel Function request limit. Either downscale in the browser before analysis (the reference already compresses stored photos to 1200 px), or upload to Firebase Storage and send the server a reference.`,
          triggeredBy: ['typicalImageMB'],
          appliesTo: ['vercel-hosted'],
          addsCriteria: [
            {
              id: 'AC-S1',
              statement: 'Analysis requests stay within the platform request-body limit.',
              measure: `100% of representative images produce a request body under ${CONSTANTS.functionBodyLimitMB} MB.`,
              origin: 'rule',
              verifiedBy: ['oversized-image'],
              verifiableAt: 'local',
            },
          ],
          addsTasks: [task('candidate', 'direct-upload', 'Move analysis input to client-side downscaling or a direct-to-storage upload')],
        };
      }
      if (d.encodedPayloadMB > CONSTANTS.downscaleRecommendationMB) {
        return {
          id: 'payload-size',
          title: 'Downscale images in the browser before analysis',
          category: 'performance',
          strength: 'recommendation',
          rationale: `About ${d.encodedPayloadMB} MB per request is within the ${CONSTANTS.functionBodyLimitMB} MB limit, but it adds upload time on mobile connections and increases AI provider input. The reference already resizes stored photos to 1200 px, so reuse that path for analysis.`,
          triggeredBy: ['typicalImageMB'],
          appliesTo: ['vercel-hosted', 'retain-and-harden'],
        };
      }
      return null;
    },
  },
  {
    id: 'rate-limiting',
    description: 'Per-user rate limiting, escalating with peak request rate.',
    evaluate: (s, d) => {
      const high = d.peakPerMinute > CONSTANTS.rateLimitRequirementPerMinute;
      return {
        id: 'rate-limiting',
        title: high
          ? 'Add per-user rate limits and confirm AI provider quota before cutover'
          : 'Add a per-user rate limit to cap abuse cost',
        category: 'reliability',
        strength: high ? 'requirement' : 'recommendation',
        rationale: `${fmt(s.dailyAnalyses)} analyses/day averages ${d.averagePerMinute}/min; with an assumed ${CONSTANTS.peakFactor}× peak that is about ${d.peakPerMinute}/min. ${
          high
            ? `Above ${CONSTANTS.rateLimitRequirementPerMinute}/min, the provider quota tier (unknown) must be confirmed and per-user limits enforced so that one client cannot exhaust it.`
            : 'At this rate, quota exhaustion is unlikely, but an unauthenticated or runaway client could still generate cost.'
        }`,
        triggeredBy: ['dailyAnalyses'],
        appliesTo: ['vercel-hosted', 'retain-and-harden'],
        addsCriteria: high
          ? [
              {
                id: 'AC-R1',
                statement: 'Excess requests from one user are throttled without affecting others.',
                measure: 'Load test at peak rate shows 429s only for the over-limit user; provider quota headroom ≥ 2× peak.',
                origin: 'rule',
                verifiableAt: 'candidate',
              },
            ]
          : undefined,
      };
    },
  },
  {
    id: 'async-processing',
    description: 'High volume makes queued analysis worth discussing.',
    evaluate: (s) =>
      s.dailyAnalyses < CONSTANTS.asyncConsiderationDaily
        ? null
        : {
            id: 'async-processing',
            title: 'Consider queued (asynchronous) analysis with status updates',
            category: 'reliability',
            strength: 'consideration',
            rationale: `At ${fmt(s.dailyAnalyses)} analyses/day, provider slowdowns would hold many open requests. Accepting the upload, queueing the analysis and notifying on completion isolates users from provider latency. This adds moving parts, so only adopt it if the measured p95 or error rate justifies it.`,
            triggeredBy: ['dailyAnalyses'],
            appliesTo: ['vercel-hosted', 'retain-and-harden'],
          },
  },
  {
    id: 'region-placement',
    description: 'Place compute near data; serve static and public content near users.',
    evaluate: (s) => ({
      id: 'region-placement',
      title:
        s.geography === 'global'
          ? 'Serve static content globally; run functions in one region next to Firebase and Gemini'
          : `Run functions in the region closest to the Firebase project; cache static content near ${geographyLabel[s.geography]} users`,
      category: 'performance',
      strength: 'recommendation',
      rationale: `Users are mainly in ${geographyLabel[s.geography]}. Each analysis makes several server-to-Google calls (token verification, Gemini, Firestore), so function placement near those services matters more than proximity to the user. The Firebase project region is unknown and must be confirmed. Vercel Functions run in iad1 (US East) unless a region is configured, so an EMEA deployment must set it explicitly. ${
        s.geography === 'global'
          ? 'Measure page and analysis latency from at least three locations before and after.'
          : 'Measure from the primary geography before and after.'
      }`,
      triggeredBy: ['geography'],
      appliesTo: ['vercel-hosted', 'retain-and-harden'],
    }),
  },
  {
    id: 'data-protection',
    description: 'Data-protection review is separate from hosting region choice.',
    evaluate: (s) =>
      s.visibility !== 'private' && s.geography !== 'emea' && s.geography !== 'global'
        ? null
        : {
            id: 'data-protection',
            title: 'Review processor terms for Firebase and Gemini independently of the hosting decision',
            category: 'data-protection',
            strength: 'requirement',
            rationale:
              'Personal photographs and stories may be personal data. Choosing a hosting region supports, but does not establish, compliance. Photographs are sent to Google’s Gemini API and stored in Firebase whichever host serves the app, so their data-use and retention terms, the DPIA and any transfer mechanisms need separate review.',
            triggeredBy: s.visibility === 'private' ? ['visibility', 'geography'] : ['geography'],
            appliesTo: ['vercel-hosted', 'retain-and-harden'],
            addsTasks: [task('baseline', 'dpia-review', 'Confirm DPIA status and Gemini/Firebase data-processing terms with the Data Protection Officer')],
          },
  },
  {
    id: 'low-volume-cost',
    description: 'At low volume, hosting cost rarely decides the case.',
    evaluate: (s, d) =>
      s.dailyAnalyses >= CONSTANTS.lowVolumeDaily
        ? null
        : {
            id: 'low-volume-cost',
            title: 'Decide on delivery speed and risk, not hosting cost',
            category: 'cost',
            strength: 'consideration',
            rationale: `About ${fmt(d.monthlyAnalyses)} analyses/month is a small compute workload. Hosting cost differences are unlikely to be decisive. Engineering time, release safety and AI provider charges deserve more attention, so confirm this with the cost model.`,
            triggeredBy: ['dailyAnalyses'],
            appliesTo: ['vercel-hosted', 'retain-and-harden'],
          },
  },
  {
    id: 'priority-guidance',
    description: 'Sequencing guidance from the customer’s cost/effort preference.',
    evaluate: (s) => {
      switch (s.priority) {
        case 'minimise-effort':
          return {
            id: 'priority-guidance',
            title: 'Ship the hardening changes first; they need no hosting change',
            category: 'delivery',
            strength: 'recommendation',
            rationale:
              'Heritage House prefers minimal implementation effort. Authentication, timeouts and input limits remove the largest risks found in the reference code and are portable to any host. Revisit hosting once the release process and baseline are understood.',
            triggeredBy: ['priority'],
            appliesTo: ['retain-and-harden', 'vercel-hosted'],
          };
        case 'minimise-run-cost':
          return {
            id: 'priority-guidance',
            title: 'Complete the cost model with dated prices and measured CPU time before committing',
            category: 'cost',
            strength: 'requirement',
            rationale:
              'Heritage House prioritises operating cost. The current hosting bill is unknown and AI provider charges apply under both options, so no recommendation should rest on cost until unit prices have sources and the active CPU per analysis is measured.',
            triggeredBy: ['priority'],
            appliesTo: ['vercel-hosted', 'retain-and-harden'],
            addsTasks: [task('baseline', 'cost-baseline', 'Obtain the current hosting invoice and AI provider spend for the baseline')],
          };
        default:
          return {
            id: 'priority-guidance',
            title: 'Run a time-boxed candidate deployment alongside the hardening work',
            category: 'delivery',
            strength: 'recommendation',
            rationale:
              'With a balanced preference, a preview deployment of the hardened app can be measured against the agreed criteria at low cost. Cutover is a separate decision taken on that evidence.',
            triggeredBy: ['priority'],
            appliesTo: ['vercel-hosted'],
          };
      }
    },
  },
];

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

const strengthOrder = { requirement: 0, recommendation: 1, consideration: 2 } as const;

export function evaluateRules(s: CustomerScenario): Recommendation[] {
  const d = deriveMetrics(s);
  return rules
    .map((r) => r.evaluate(s, d))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => strengthOrder[a.strength] - strengthOrder[b.strength]);
}

export function acceptanceCriteria(recs: Recommendation[]): AcceptanceCriterion[] {
  return [...workshopCriteria, ...recs.flatMap((r) => r.addsCriteria ?? [])];
}

/** Explains which recommendations appeared or disappeared between two scenarios. */
export function diffRecommendations(before: Recommendation[], after: Recommendation[]) {
  const key = (r: Recommendation) => `${r.id}:${r.strength}:${r.title}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  return {
    added: after.filter((r) => !beforeKeys.has(key(r))),
    removed: before.filter((r) => !afterKeys.has(key(r))),
  };
}

/**
 * Option selection. Deliberately simple and explainable: the hardening work is
 * required under both options, so the question is only whether a hosting move is
 * worth evaluating now.
 */
export function decideOption(s: CustomerScenario): OptionDecision {
  const d = deriveMetrics(s);
  const wouldChangeIf = [
    'The current host already provides per-branch previews, instant rollback and CDN caching with comparable effort (favours retaining it).',
    'The candidate deployment misses the latency or error-rate acceptance criteria against the measured baseline.',
    'The Firebase project region has no nearby function region, adding measurable latency to every analysis.',
    'The completed cost model, with sourced prices, shows a material increase that the delivery benefits do not justify.',
    'Data-protection review restricts where photographs may be processed in a way neither option satisfies.',
  ];

  if (s.priority === 'minimise-effort' && s.dailyAnalyses < CONSTANTS.deferMigrationDaily) {
    return {
      recommended: 'retain-and-harden',
      headline: 'Harden the existing deployment now; defer the hosting decision.',
      reasons: [
        'Heritage House has asked to minimise implementation effort.',
        `At ${fmt(s.dailyAnalyses)} analyses/day, the workload does not force a platform change.`,
        'The largest risks found in the reference code (unauthenticated AI route, no timeouts, no input limits) are fixed by code changes that work on any host.',
        'The current host and release process are unknown, so a migration case cannot yet be evidenced.',
      ],
      wouldChangeIf: [
        'Release frequency or failed-release recovery becomes a stated pain point (favours a candidate on Vercel).',
        ...wouldChangeIf.slice(1),
      ],
    };
  }

  const reasons = [
    'The application is already Next.js, so the hosting move involves configuration and verification rather than a rewrite.',
    'Per-branch preview deployments and Instant Rollback address the stated concerns about deployment speed and recovery from failed releases.',
    'Firebase Auth, Firestore and Storage can be retained unchanged. Only the Next.js frontend and its server routes move.',
  ];
  if (s.geography === 'global' || s.visibility === 'public') {
    reasons.push('Users are geographically spread or content is public, so CDN caching of static and public content is likely to help page performance. This needs to be measured.');
  }
  if (d.exceedsFunctionBodyLimit) {
    reasons.push(`Caveat: typical images (${d.encodedPayloadMB} MB encoded) exceed the function body limit, so direct-to-storage upload is part of the migration scope.`);
  }
  return {
    recommended: 'vercel-hosted',
    headline: 'Proceed to a measured candidate deployment on Vercel. Cut over only if it meets the acceptance criteria.',
    reasons,
    wouldChangeIf,
  };
}
