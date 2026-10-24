import type { AnalyzeErrorCode, SimulationMode } from './types';

export interface ValidImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  bytes: number;
}

export type ValidationOutcome =
  | { ok: true; image: ValidImage; simulate: SimulationMode; timeoutMs?: number }
  | { ok: false; status: 400 | 413 | 415; code: AnalyzeErrorCode; message: string };

const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MODES: SimulationMode[] = ['none', 'timeout', 'transient-failure', 'persistent-failure'];

/** Approximate decoded size of a base64 string without decoding it. */
export function decodedBytes(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Checks the first bytes match the declared type, so a renamed text file is rejected. */
export function magicBytesMatch(mimeType: string, base64: string) {
  const head = Buffer.from(base64.slice(0, 24), 'base64');
  switch (mimeType) {
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'image/png':
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

export function validateAnalyzeRequest(
  body: unknown,
  opts: { maxImageBytes: number; faultInjection: boolean },
): ValidationOutcome {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'Request body must be a JSON object.' };
  }
  const { imageDataUrl, simulate, timeoutMs } = body as Record<string, unknown>;

  if (typeof imageDataUrl !== 'string' || imageDataUrl.length === 0) {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'imageDataUrl is required.' };
  }
  const match = DATA_URL.exec(imageDataUrl);
  if (!match) {
    return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'imageDataUrl must be a base64 data URL.' };
  }
  const [, mimeType, base64] = match;
  if (!ALLOWED.has(mimeType)) {
    return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: `Unsupported type ${mimeType}. Use JPEG, PNG or WebP.` };
  }
  const bytes = decodedBytes(base64);
  if (bytes > opts.maxImageBytes) {
    return {
      ok: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: `Image is ${(bytes / 1048576).toFixed(1)} MB; the limit is ${(opts.maxImageBytes / 1048576).toFixed(1)} MB. Downscale before analysis.`,
    };
  }
  if (!magicBytesMatch(mimeType, base64)) {
    return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: `Content does not match declared type ${mimeType}.` };
  }

  let mode: SimulationMode = 'none';
  if (simulate !== undefined) {
    if (!MODES.includes(simulate as SimulationMode)) {
      return { ok: false, status: 400, code: 'INVALID_INPUT', message: `simulate must be one of ${MODES.join(', ')}.` };
    }
    mode = opts.faultInjection ? (simulate as SimulationMode) : 'none';
  }
  const override =
    mode !== 'none' && typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)
      ? Math.min(5_000, Math.max(200, Math.round(timeoutMs)))
      : undefined;

  return { ok: true, image: { mimeType: mimeType as ValidImage['mimeType'], base64, bytes }, simulate: mode, timeoutMs: override };
}
