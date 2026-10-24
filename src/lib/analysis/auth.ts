/**
 * SIMULATED session auth for the local prototype.
 *
 * Production (proposed): verify a Firebase ID token server-side with
 * firebase-admin `verifyIdToken`, using a service-account credential stored as a
 * sensitive environment variable. These fixed demo tokens only stand in for that
 * check so the access-control behaviour can be exercised locally.
 */
export const DEMO_SESSIONS = {
  'demo-curator-session': { userId: 'curator-a', name: 'Curator A (owner of private fixtures)' },
  'demo-visitor-session': { userId: 'visitor-b', name: 'Visitor B (no access to private fixtures)' },
} as const;

export type DemoToken = keyof typeof DEMO_SESSIONS;

export function sessionFromRequest(request: Request): { userId: string } | null {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token in DEMO_SESSIONS ? DEMO_SESSIONS[token as DemoToken] : null;
}
