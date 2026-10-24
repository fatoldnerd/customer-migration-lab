import type { OptionId } from '@/lib/types';

export type NodeId = 'browser' | 'edge' | 'server' | 'auth' | 'data' | 'gemini';
export type FlowId = 'page' | 'analysis' | 'private-image';
export type Zone = 'device' | 'hosting' | 'google';

export interface ArchNode {
  id: NodeId;
  zone: Zone;
  x: number;
  y: number;
  label: Record<OptionId, string>;
  sub: Record<OptionId, string>;
  /** Unknown in this option, so the node is drawn dashed and treated as an open question. */
  unknown?: Partial<Record<OptionId, boolean>>;
  responsibilities: string[];
  credentials: string;
  failureHandling: string;
}

export interface ArchEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  flows: FlowId[];
  label: string;
  /** Crosses a service or trust boundary. */
  crossesBoundary: boolean;
  /** Caching note; may depend on visibility. */
  cache: (visibility: 'private' | 'public') => string;
}

export const options: Record<OptionId, { name: string; short: string; summary: string }> = {
  'vercel-hosted': {
    name: 'Option A: Next.js frontend and server routes on Vercel; Firebase retained',
    short: 'Vercel + Firebase',
    summary:
      'Deploy the existing Next.js app to Vercel. Server routes run as Vercel Functions in a region chosen next to the Firebase project. Firebase Auth, Firestore and Storage stay where they are.',
  },
  'retain-and-harden': {
    name: 'Option B: Retain the current hosting, apply targeted hardening, defer migration',
    short: 'Retain + harden',
    summary:
      'Keep the current (unknown) hosting. Apply the same code-level fixes: token verification, timeouts, retries, input limits and cache headers. Revisit hosting once the baseline and release process are known.',
  },
};

export const nodes: ArchNode[] = [
  {
    id: 'browser', zone: 'device', x: 90, y: 200,
    label: { 'vercel-hosted': 'Browser', 'retain-and-harden': 'Browser' },
    sub: { 'vercel-hosted': 'Curator / family', 'retain-and-harden': 'Curator / family' },
    responsibilities: ['Signs in with Firebase Auth and holds a short-lived ID token', 'Downscales photographs before upload (reference: 1200 px JPEG)', 'Shows retryable error states; never holds the Gemini key'],
    credentials: 'Firebase ID token only. The Firebase web config is public by design; security rules protect the data.',
    failureHandling: 'Displays timeout and provider errors with a Retry action; keeps the photo locally until analysis succeeds.',
  },
  {
    id: 'edge', zone: 'hosting', x: 290, y: 200,
    label: { 'vercel-hosted': 'Vercel CDN', 'retain-and-harden': 'Current CDN / proxy' },
    sub: { 'vercel-hosted': 'Static + public images', 'retain-and-harden': 'Unknown: to confirm' },
    unknown: { 'retain-and-harden': true },
    responsibilities: ['Serves hashed static assets (immutable)', 'Caches public images when responses carry s-maxage', 'Passes private and POST requests through uncached'],
    credentials: 'None. Requests with an Authorization header, or responses marked private/no-store, are not cached by the Vercel CDN.',
    failureHandling: 'Firewall and rate limiting can sit at this layer (Option A: Vercel WAF rules); per-user limits still need app logic.',
  },
  {
    id: 'server', zone: 'hosting', x: 490, y: 200,
    label: { 'vercel-hosted': 'Vercel Functions', 'retain-and-harden': 'Current server runtime' },
    sub: { 'vercel-hosted': 'Next.js server routes', 'retain-and-harden': 'Unknown: to confirm' },
    unknown: { 'retain-and-harden': true },
    responsibilities: ['Verifies the Firebase ID token (firebase-admin)', 'Validates image type, content and size before any AI call', 'Calls Gemini with a timeout and one retry; returns structured errors', 'Enforces per-user rate limits; sets Cache-Control on every response'],
    credentials: 'GOOGLE_GEMINI_API_KEY and the Firebase service account, held as sensitive server-only environment variables and never exposed with a NEXT_PUBLIC_ prefix.',
    failureHandling: 'Timeout below maxDuration (prototype: 15 s vs 30 s). Retry 5xx/429 once with jitter. 504/502 responses carry retryable=true.',
  },
  {
    id: 'auth', zone: 'google', x: 720, y: 80,
    label: { 'vercel-hosted': 'Firebase Auth', 'retain-and-harden': 'Firebase Auth' },
    sub: { 'vercel-hosted': 'Retained', 'retain-and-harden': 'Retained' },
    responsibilities: ['Issues ID tokens to the browser', 'Signing keys used by the server to verify tokens'],
    credentials: 'Web config in the browser; service account on the server.',
    failureHandling: 'Token verification failure → 401 and re-authentication; never fall back to anonymous access.',
  },
  {
    id: 'data', zone: 'google', x: 720, y: 200,
    label: { 'vercel-hosted': 'Firestore + Storage', 'retain-and-harden': 'Firestore + Storage' },
    sub: { 'vercel-hosted': 'Retained (assumed adoption)', 'retain-and-harden': 'Retained (assumed adoption)' },
    responsibilities: ['Stores photographs, stories and analysis results (assumption: the reference uses localStorage today)', 'Security rules enforce per-user ownership'],
    credentials: 'Security rules for browser access; service account for server access.',
    failureHandling: 'Write the analysis result only after a valid response, so a failed analysis leaves the record unchanged.',
  },
  {
    id: 'gemini', zone: 'google', x: 720, y: 320,
    label: { 'vercel-hosted': 'Gemini API', 'retain-and-harden': 'Gemini API' },
    sub: { 'vercel-hosted': 'Third-party processor', 'retain-and-harden': 'Third-party processor' },
    responsibilities: ['Analyses the image and returns structured JSON'],
    credentials: 'API key from the server only. Its data handling is governed by Google’s terms, not by the hosting choice.',
    failureHandling: 'Slow responses, 429 quota errors and malformed JSON are all expected and handled by the server.',
  },
];

export const edges: ArchEdge[] = [
  { id: 'b-e-page', from: 'browser', to: 'edge', flows: ['page'], label: 'GET pages and assets', crossesBoundary: true, cache: () => 'Static assets: public, immutable. HTML: per route rendering strategy.' },
  { id: 'e-s-page', from: 'edge', to: 'server', flows: ['page'], label: 'Dynamic render on cache miss', crossesBoundary: false, cache: () => 'Only dynamic segments reach the function.' },
  { id: 'b-a', from: 'browser', to: 'auth', flows: ['analysis', 'private-image'], label: 'Sign in → ID token', crossesBoundary: true, cache: () => 'Never cached.' },
  { id: 'b-e-an', from: 'browser', to: 'edge', flows: ['analysis', 'private-image'], label: 'Request + Bearer token', crossesBoundary: true, cache: (v) => (v === 'private' ? 'Authorization header present: bypasses shared cache.' : 'POST analysis: never cached. Public images: cacheable.') },
  { id: 'e-s-an', from: 'edge', to: 'server', flows: ['analysis', 'private-image'], label: 'Forwarded uncached', crossesBoundary: false, cache: () => 'Response sets private, no-store.' },
  { id: 's-a', from: 'server', to: 'auth', flows: ['analysis', 'private-image'], label: 'Verify ID token', crossesBoundary: true, cache: () => 'Signing keys cached in-process by firebase-admin.' },
  { id: 's-d', from: 'server', to: 'data', flows: ['analysis', 'private-image'], label: 'Read photo / save result', crossesBoundary: true, cache: (v) => (v === 'private' ? 'Private: no shared cache; ownership enforced.' : 'Public derivatives may be cached at the CDN.') },
  { id: 's-g', from: 'server', to: 'gemini', flows: ['analysis'], label: 'Image + prompt (timeout, 1 retry)', crossesBoundary: true, cache: () => 'Never cached. Results are stored with the object instead.' },
];

export const flows: Record<FlowId, { label: string; description: string }> = {
  page: { label: 'Page load', description: 'Browsing the collection: static assets from the CDN, dynamic rendering only where needed.' },
  analysis: { label: 'AI analysis', description: 'A signed-in user requests analysis. Five service boundaries are crossed, so every hop needs a timeout and an error contract.' },
  'private-image': { label: 'Private photo view', description: 'Viewing a private photograph: authorised on every request and never stored in a shared cache.' },
};

export const placementTable = [
  { concern: 'Timeouts', where: 'Server route, per provider call, below the function maxDuration', why: 'Only the server can cancel the provider call and return a structured error.' },
  { concern: 'Retries', where: 'Server, once, for 5xx/429 with jittered backoff; user-initiated after that', why: 'Automatic retries on timeouts double latency; unbounded retries amplify provider outages.' },
  { concern: 'Rate limits', where: 'Per user in the server route; coarse IP rules at the CDN/WAF', why: 'Only the server knows the authenticated user, while the CDN can stop floods early.' },
  { concern: 'Input validation', where: 'Server, before reading provider credentials', why: 'Rejects bad input cheaply and protects quota.' },
  { concern: 'Error handling', where: 'Server returns codes and retryable flags; browser renders recovery', why: 'Users see actionable messages, while provider details stay in server logs.' },
  { concern: 'Credentials', where: 'Server-only environment variables (sensitive)', why: 'The Gemini key and service account must never reach the browser bundle.' },
];

export const tradeoffs: { dimension: string; a: string; b: string }[] = [
  { dimension: 'Deployment speed and recovery', a: 'Per-branch preview deployments; Instant Rollback to a previous production deployment (environment variables and external data are not rolled back).', b: 'Depends on the current host’s release process, which is unknown and may already be adequate.' },
  { dimension: 'Global page performance', a: 'Static and public content served from a global CDN. Needs measurement against the baseline.', b: 'Unknown; the current CDN may already cover this.' },
  { dimension: 'AI analysis latency', a: 'Dominated by Gemini; function region must sit near Firebase/Gemini. No inherent speed-up from hosting.', b: 'Same provider latency; the same code fixes apply.' },
  { dimension: 'Private data protection', a: 'Same app-level controls are required. Hosting does not change Gemini or Firebase data handling.', b: 'Same app-level controls are required.' },
  { dimension: 'Migration effort', a: 'Already Next.js: environment variables, region, domains, CI and verification. Size of effort to be confirmed in phase 1.', b: 'Lowest: code changes only.' },
  { dimension: 'Operating cost', a: 'Active-CPU pricing; AI wait time is not billed as CPU. Estimate shown with editable, sourced prices.', b: 'Unknown until the current invoice is shared.' },
  { dimension: 'Firebase', a: 'Retained unchanged.', b: 'Retained unchanged.' },
];
