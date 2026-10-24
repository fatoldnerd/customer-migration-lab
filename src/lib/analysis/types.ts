/** Same shape as the reference repository's ArtifactAnalysis (src/types/analysis.ts). */
export interface ArtifactAnalysis {
  objectIdentification: string;
  suggestedCategory: string;
  estimatedEra: string;
  styleMovement: string;
  materials: string[];
  craftsmanshipNotes: string;
  likelyOrigin: string;
  conditionAssessment: string;
  historicalContext: string;
  suggestedDescription: string;
  storyStarter: string;
  careRecommendations: string;
  valueIndicators: string;
  confidence: 'high' | 'medium' | 'low';
}

/** Fault-injection modes used by the Validation Lab. */
export type SimulationMode = 'none' | 'timeout' | 'transient-failure' | 'persistent-failure';

export interface AnalyzeRequestBody {
  imageDataUrl: string;
  simulate?: SimulationMode;
  /** Only honoured together with a simulation mode, to keep checks fast. */
  timeoutMs?: number;
}

export type AnalyzeErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'NOT_CONFIGURED';

export interface AnalyzeMeta {
  provider: 'simulated' | 'gemini';
  simulated: boolean;
  attempts: number;
  durationMs: number;
}

export type AnalyzeResponse =
  | { ok: true; analysis: ArtifactAnalysis; meta: AnalyzeMeta }
  | { ok: false; error: { code: AnalyzeErrorCode; message: string; retryable: boolean }; meta?: AnalyzeMeta };

const STRING_FIELDS = [
  'objectIdentification',
  'suggestedCategory',
  'estimatedEra',
  'styleMovement',
  'craftsmanshipNotes',
  'likelyOrigin',
  'conditionAssessment',
  'historicalContext',
  'suggestedDescription',
  'storyStarter',
  'careRecommendations',
  'valueIndicators',
] as const;

/** Runtime guard used by both the server (for provider output) and the validation checks. */
export function isArtifactAnalysis(value: unknown): value is ArtifactAnalysis {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    STRING_FIELDS.every((f) => typeof v[f] === 'string' && (v[f] as string).length > 0) &&
    Array.isArray(v.materials) &&
    v.materials.every((m) => typeof m === 'string') &&
    (v.confidence === 'high' || v.confidence === 'medium' || v.confidence === 'low')
  );
}
