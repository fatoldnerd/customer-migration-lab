import { connection } from 'next/server';
import { analysisConfig } from '@/lib/analysis/config';

/** Environment metadata recorded with every validation run. Contains no secrets. */
export async function GET() {
  await connection(); // always evaluate at request time
  const config = analysisConfig();
  return Response.json(
    {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      aiProvider: config.provider,
      faultInjection: config.faultInjection,
      maxImageBytes: config.maxImageBytes,
      timeoutMs: config.timeoutMs,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
