import type { ArtifactAnalysis, SimulationMode } from './types';
import { isArtifactAnalysis } from './types';
import type { ValidImage } from './validate';

/** Thrown by providers. `retryable` drives the retry policy in run.ts. */
export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly status?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface AnalysisProvider {
  name: 'simulated' | 'gemini';
  analyze(image: ValidImage, signal: AbortSignal, attempt: number): Promise<ArtifactAnalysis>;
}

/** Resolves after `ms`, or rejects when the signal aborts. */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
}

const SIMULATED_ANALYSIS: ArtifactAnalysis = {
  objectIdentification: '[Simulated] Domestic object photographed against a plain background',
  suggestedCategory: 'heirloom',
  estimatedEra: '[Simulated] Mid-20th century (placeholder, not a real assessment)',
  styleMovement: '[Simulated] Not assessed',
  materials: ['[Simulated] unknown'],
  craftsmanshipNotes: '[Simulated] No real model was called. This text is a fixed fixture.',
  likelyOrigin: '[Simulated] Not assessed',
  conditionAssessment: '[Simulated] Not assessed',
  historicalContext: '[Simulated] A real provider would return historical context here.',
  suggestedDescription: '[Simulated] A real provider would draft a catalogue description here.',
  storyStarter: 'Who first owned this, and where was it kept?',
  careRecommendations: '[Simulated] Not assessed',
  valueIndicators: '[Simulated] Not assessed',
  confidence: 'low',
};

/** Deterministic fixture provider with fault injection for the Validation Lab. */
export function simulatedProvider(mode: SimulationMode, latencyMs = 0): AnalysisProvider {
  return {
    name: 'simulated',
    async analyze(_image, signal, attempt) {
      if (mode === 'timeout') {
        await wait(10 * 60_000, signal); // never completes before the timeout aborts it
      }
      if (latencyMs > 0) await wait(latencyMs, signal);
      if (mode === 'persistent-failure' || (mode === 'transient-failure' && attempt === 1)) {
        throw new ProviderError('Simulated provider returned 503 Service Unavailable', true, 503);
      }
      return { ...SIMULATED_ANALYSIS, materials: [...SIMULATED_ANALYSIS.materials] };
    },
  };
}

const PROMPT = `You are a museum curator analysing a photograph of a family object or heirloom for a collections archive. Focus on historical and sentimental context, not monetary value, and acknowledge uncertainty. Respond only with JSON with these string fields: objectIdentification, suggestedCategory, estimatedEra, styleMovement, craftsmanshipNotes, likelyOrigin, conditionAssessment, historicalContext, suggestedDescription, storyStarter, careRecommendations, valueIndicators; "materials" as an array of strings; and "confidence" as one of high, medium, low.`;

/**
 * Optional real provider, via the Gemini REST API so that the call honours AbortSignal.
 * Not exercised by automated tests; requires GOOGLE_GEMINI_API_KEY.
 */
export function geminiProvider(apiKey: string, model: string): AnalysisProvider {
  return {
    name: 'gemini',
    async analyze(image, signal) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        },
      );
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new ProviderError(`Gemini returned ${res.status}`, retryable, res.status);
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ProviderError('Gemini response was not valid JSON', true);
      }
      if (!isArtifactAnalysis(parsed)) throw new ProviderError('Gemini response was missing required fields', true);
      return parsed;
    },
  };
}
