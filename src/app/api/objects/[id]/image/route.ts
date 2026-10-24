import { sessionFromRequest } from '@/lib/analysis/auth';
import { getObject } from '@/data/objects';
import { objectImageSvg } from '@/data/images';

/**
 * Fixture image route demonstrating the two caching paths:
 * - public objects: shared-cacheable (s-maxage) so a CDN may serve them;
 * - private objects: authorisation on every request, `private, no-store`,
 *   never eligible for a shared cache.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/objects/[id]/image'>) {
  const { id } = await ctx.params;
  const object = getObject(id);
  const noStore = { 'cache-control': 'private, no-store' };

  if (!object) return new Response('Not found', { status: 404, headers: noStore });

  if (object.visibility === 'public') {
    return new Response(objectImageSvg(object), {
      headers: {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  }

  const session = sessionFromRequest(request);
  if (!session) return new Response('Authentication required', { status: 401, headers: noStore });
  if (session.userId !== object.ownerId) return new Response('Forbidden', { status: 403, headers: noStore });

  return new Response(objectImageSvg(object), {
    headers: { 'content-type': 'image/svg+xml', ...noStore, vary: 'Authorization' },
  });
}
