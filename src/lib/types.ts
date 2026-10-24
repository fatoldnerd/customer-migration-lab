// Core domain types for the Customer Migration Decision Lab.

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

/** Every claim shown in the UI belongs to exactly one of these categories. */
export type EvidenceKind = 'inspected' | 'assumption' | 'proposed' | 'measured';

/* ------------------------------------------------------------------ */
/* Customer scenario                                                   */
/* ------------------------------------------------------------------ */

export type Geography = 'emea' | 'north-america' | 'apac' | 'global';
export type PhotoVisibility = 'private' | 'public';
export type DeliveryPriority = 'minimise-effort' | 'balanced' | 'minimise-run-cost';

/** The editable scenario controls on the Customer Brief. */
export interface CustomerScenario {
  dailyAnalyses: number;
  typicalImageMB: number;
  geography: Geography;
  visibility: PhotoVisibility;
  priority: DeliveryPriority;
}

/** Values computed from the scenario that rules reason about. */
export interface DerivedMetrics {
  monthlyAnalyses: number;
  /** Size of the image once base64-encoded into a JSON body, as the reference route requires. */
  encodedPayloadMB: number;
  exceedsFunctionBodyLimit: boolean;
  averagePerMinute: number;
  peakPerMinute: number;
}

/* ------------------------------------------------------------------ */
/* Architecture                                                        */
/* ------------------------------------------------------------------ */

export type OptionId = 'vercel-hosted' | 'retain-and-harden';

export interface ArchitecturalAssumption {
  id: string;
  statement: string;
  kind: EvidenceKind;
  /** File path, doc URL or workshop note supporting the statement. */
  source?: string;
  /** True when the statement is an unanswered question rather than a fact. */
  open?: boolean;
}

/* ------------------------------------------------------------------ */
/* Recommendation rules                                                */
/* ------------------------------------------------------------------ */

export type RecommendationCategory =
  | 'security'
  | 'caching'
  | 'performance'
  | 'reliability'
  | 'cost'
  | 'delivery'
  | 'data-protection';

/** requirement = must be met before cutover; recommendation = should; consideration = discuss. */
export type RecommendationStrength = 'requirement' | 'recommendation' | 'consideration';

export interface Recommendation {
  id: string;
  title: string;
  category: RecommendationCategory;
  strength: RecommendationStrength;
  /** Plain-language reasoning, including the numbers that triggered it. */
  rationale: string;
  /** Scenario inputs this recommendation depends on (empty = always applies). */
  triggeredBy: (keyof CustomerScenario)[];
  appliesTo: OptionId[];
  /** Acceptance criteria this recommendation adds to the agreed set. */
  addsCriteria?: AcceptanceCriterion[];
  /** Migration tasks this recommendation adds, keyed by phase id. */
  addsTasks?: { phaseId: MigrationPhaseId; task: MigrationTask }[];
}

export interface RecommendationRule {
  id: string;
  description: string;
  evaluate: (scenario: CustomerScenario, derived: DerivedMetrics) => Recommendation | null;
}

export interface OptionDecision {
  recommended: OptionId;
  headline: string;
  reasons: string[];
  /** Evidence that would change the recommendation. */
  wouldChangeIf: string[];
}

/* ------------------------------------------------------------------ */
/* Acceptance criteria                                                 */
/* ------------------------------------------------------------------ */

export interface AcceptanceCriterion {
  id: string;
  statement: string;
  /** How the criterion is measured. */
  measure: string;
  /** 'workshop' = agreed baseline set (fictional); 'rule' = added by a scenario rule. */
  origin: 'workshop' | 'rule';
  /** Validation checks in this app that provide local evidence for it. */
  verifiedBy?: CheckId[];
  /** Where it can only be verified (e.g. candidate deployment, production field data). */
  verifiableAt: 'local' | 'candidate' | 'production';
}

/* ------------------------------------------------------------------ */
/* Migration plan                                                      */
/* ------------------------------------------------------------------ */

export type MigrationPhaseId = 'baseline' | 'candidate' | 'validate' | 'cutover' | 'monitor';

/** Proposed until evidence exists. 'verified' must cite evidence. */
export type TaskStatus = 'proposed' | 'verified';

export interface MigrationTask {
  id: string;
  label: string;
  /** Static status; tasks with `verifiedByChecks` are derived from validation runs instead. */
  status: TaskStatus;
  evidence?: string;
  verifiedByChecks?: CheckId[];
}

export interface MigrationPhase {
  id: MigrationPhaseId;
  number: number;
  title: string;
  outcome: string;
  tasks: MigrationTask[];
  dependencies: string[];
  evidenceToProceed: string[];
  rollback: string;
}

/* ------------------------------------------------------------------ */
/* Validation results and measurement metadata                         */
/* ------------------------------------------------------------------ */

export type CheckId =
  | 'valid-request'
  | 'unauthenticated'
  | 'missing-image'
  | 'invalid-image'
  | 'oversized-image'
  | 'provider-timeout'
  | 'transient-recovery'
  | 'failure-then-retry'
  | 'private-not-shared-cacheable'
  | 'public-cacheable';

export type MeasurementEnvironment =
  | 'local-development'
  | 'local-production-build'
  | 'vercel-preview'
  | 'vercel-production'
  | 'unknown';

export interface MeasurementMetadata {
  environment: MeasurementEnvironment;
  origin: string;
  userAgent: string;
  nodeVersion: string;
  aiProvider: 'simulated' | 'gemini';
  simulated: boolean;
  /** ISO-8601 timestamp of when the run started. */
  timestamp: string;
  sampleCount: number;
}

export interface CheckResult {
  id: CheckId;
  name: string;
  passed: boolean;
  expected: string;
  observed: string;
  /** Client-measured round trip for the check (all requests). */
  durationMs: number;
}

export interface LatencySummary {
  samples: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  meanMs: number;
  /** Server-reported handler time (Server-Timing), median. */
  serverP50Ms: number | null;
}

export interface ValidationRun {
  id: string;
  meta: MeasurementMetadata;
  checks: CheckResult[];
  latency: LatencySummary | null;
}

/* ------------------------------------------------------------------ */
/* Cost model                                                          */
/* ------------------------------------------------------------------ */

export interface UnitPrice {
  id: 'ai-per-1k-analyses' | 'invocations-per-1m' | 'active-cpu-per-hour' | 'transfer-per-gb';
  label: string;
  unit: string;
  /** null = not yet provided; makes the estimate incomplete. */
  value: number | null;
  source: string;
  asOf: string;
}

export interface UsageAssumptions {
  /** Active CPU per analysis request; must be replaced by a measurement. */
  activeCpuMsPerAnalysis: number;
  daysPerMonth: number;
}

export interface CostLine {
  id: UnitPrice['id'];
  label: string;
  quantity: number;
  quantityUnit: string;
  formula: string;
  monthlyCost: number | null;
}

export interface CostEstimate {
  lines: CostLine[];
  /** Sum of known lines; null when nothing is priced. */
  knownSubtotal: number | null;
  complete: boolean;
  missing: string[];
  exclusions: string[];
}
