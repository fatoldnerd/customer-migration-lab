'use client';

import { useEffect, useState } from 'react';
import { CURATOR } from '@/lib/validation/checks';

/**
 * Public images load with a plain <img> (cacheable). Private images cannot be
 * requested by <img> with an Authorization header, so they are fetched with the
 * simulated curator session and shown from an object URL.
 */
export function ObjectImage({ id, name, visibility, className }: { id: string; name: string; visibility: 'public' | 'private'; className?: string }) {
  const src = `/api/objects/${id}/image`;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visibility === 'public') return;
    let url: string | null = null;
    let cancelled = false;
    fetch(src, { headers: { authorization: CURATOR }, cache: 'no-store' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setBlobUrl(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, visibility]);

  const resolved = visibility === 'public' ? src : blobUrl;
  if (failed) return <div className={`grid place-items-center bg-subtle text-sm text-muted ${className}`}>Image unavailable</div>;
  if (!resolved) return <div className={`animate-pulse bg-subtle ${className}`} aria-label={`Loading ${name}`} />;
  // eslint-disable-next-line @next/next/no-img-element -- synthetic SVG served by a route handler with explicit cache headers
  return <img src={resolved} alt={`${name} (synthetic illustration)`} className={className} />;
}
