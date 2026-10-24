import type { ArchitecturalAssumption } from '@/lib/types';

export const REFERENCE_REPO = 'https://github.com/fatoldnerd/memoryartifact';
export const REFERENCE_COMMIT = '5850081';
const file = (p: string) => `${REFERENCE_REPO}/blob/${REFERENCE_COMMIT}/${p}`;

export const objective = {
  business:
    'Introduce AI-assisted analysis of photographs so that curators and contributing families can catalogue objects faster, without putting private photographs or personal stories at risk.',
  outcome:
    'A decision, backed by evidence, on whether to move the application’s hosting and server-side workload to Vercel, and a safe path to launch AI analysis whichever option is chosen.',
  hypothesis:
    'Hypothesis (not measured): AI-drafted descriptions reduce cataloguing time per object. There is no baseline yet, so this is a validation goal rather than a claim.',
};

export const stakeholders = [
  { role: 'Chief Digital Officer', type: 'Executive sponsor', criteria: 'Time to launch AI features; reputational risk; a clear recommendation with conditions.' },
  { role: 'Head of Engineering', type: 'Technical decision-maker', criteria: 'Migration effort; deployment speed; recovering from a failed release; keeping Firebase where sensible.' },
  { role: 'Data Protection Officer', type: 'Approver', criteria: 'Protection of private photographs and stories; processor terms; access control evidence.' },
  { role: 'Collections & Community Lead', type: 'Product owner', criteria: 'Reliable, fast analysis for curators and families; graceful failure states.' },
  { role: 'Finance Business Partner', type: 'Approver', criteria: 'Predictable operating cost; transparent estimates rather than headline numbers.' },
];

/** What the reference repository actually establishes (code inspection, commit 5850081). */
export const inspected: ArchitecturalAssumption[] = [
  { id: 'i-stack', kind: 'inspected', statement: 'Next.js 16.0.5 (App Router), React 19.2, TypeScript, Tailwind CSS 4.', source: file('package.json') },
  { id: 'i-auth', kind: 'inspected', statement: 'Firebase Auth (email/password and Google sign-in) runs in the browser, with a development-only test-user bypass.', source: file('src/context/AuthContext.tsx') },
  { id: 'i-storage', kind: 'inspected', statement: 'Artifacts, photos (base64 JPEG, max 1200 px) and audio are stored in browser localStorage. Firestore and Storage are initialised but never called.', source: file('src/lib/artifacts.ts') },
  { id: 'i-docs', kind: 'inspected', statement: 'The repository’s CLAUDE.md describes a Firestore/Storage data model. This is documented intent, not current implementation.', source: file('CLAUDE.md') },
  { id: 'i-route', kind: 'inspected', statement: 'One server route, POST /api/analyze-artifact, sends a base64 data URL to Gemini (gemini-2.0-flash) using the server-only GOOGLE_GEMINI_API_KEY.', source: file('src/app/api/analyze-artifact/route.ts') },
  { id: 'i-gaps', kind: 'inspected', statement: 'The analysis route has no authentication, timeout, retry, rate limit or body-size limit, and returns raw error messages to the browser.', source: file('src/lib/gemini.ts') },
  { id: 'i-hosting', kind: 'inspected', statement: 'No hosting configuration (firebase.json, vercel.json, Dockerfile), tests or Firebase security-rules files are present.', source: REFERENCE_REPO },
];

/** Fictional Heritage House context. */
export const assumptions: ArchitecturalAssumption[] = [
  { id: 'a-workload', kind: 'assumption', statement: 'Heritage House runs a digital collections application built from the Memory Artifact code base.' },
  { id: 'a-firebase', kind: 'assumption', statement: 'Heritage House will move photographs from browser storage to Firebase Storage/Firestore as the reference repo documents. Firebase Auth already holds its user base.' },
  { id: 'a-volume', kind: 'assumption', statement: 'Daily analysis volume, image size and geography are the editable scenario values below. No traffic data has been shared.' },
  { id: 'a-team', kind: 'assumption', statement: 'A small platform team maintains the application alongside other work.' },
];

export const constraints = [
  'Keep Firebase Auth: re-registering users is not acceptable.',
  'Private family photographs must not become publicly reachable or cached in shared infrastructure.',
  'No production change without a rehearsed rollback.',
  'Gemini remains the AI provider for this decision; changing provider is out of scope.',
];

export const openQuestions: ArchitecturalAssumption[] = [
  { id: 'q-host', kind: 'assumption', open: true, statement: 'Where is the application hosted today, in which region, and how are releases deployed and rolled back?' },
  { id: 'q-region', kind: 'assumption', open: true, statement: 'Which region is the Firebase project in?' },
  { id: 'q-baseline', kind: 'assumption', open: true, statement: 'What are the current page-load and analysis latencies, error rates and monthly hosting cost?' },
  { id: 'q-quota', kind: 'assumption', open: true, statement: 'Which Gemini tier, quota and data-use terms apply? Are prompts or images retained by the provider?' },
  { id: 'q-dpia', kind: 'assumption', open: true, statement: 'Has a DPIA been completed for AI processing of personal photographs?' },
  { id: 'q-peaks', kind: 'assumption', open: true, statement: 'Are there seasonal or campaign-driven traffic peaks (for example, exhibitions or appeals)?' },
];
