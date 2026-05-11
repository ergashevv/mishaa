import { submitIndexNowUrls } from '@/lib/indexnow';

export const runtime = 'nodejs';

function authorize(request: Request): boolean {
  const secret =
    process.env.INDEXNOW_SUBMIT_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization')?.trim();
  return auth === `Bearer ${secret}`;
}

/**
 * POST JSON `{ "urls": ["https://…"] }` — pings IndexNow (`api.indexnow.org`).
 * Auth: `Authorization: Bearer <INDEXNOW_SUBMIT_SECRET>` or the same value as `CRON_SECRET`.
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const urls =
    body && typeof body === 'object' && Array.isArray((body as { urls?: unknown }).urls)
      ? (body as { urls: unknown[] }).urls
      : null;

  if (!urls || urls.length === 0) {
    return Response.json({ ok: false, error: 'Expected non-empty "urls" array' }, { status: 400 });
  }

  const stringUrls = urls.filter((u): u is string => typeof u === 'string');
  if (stringUrls.length === 0) {
    return Response.json({ ok: false, error: '"urls" must contain strings' }, { status: 400 });
  }

  const result = await submitIndexNowUrls(stringUrls);
  const httpStatus = result.ok
    ? 200
    : result.status === 422
      ? 422
      : result.status >= 400 && result.status < 600
        ? result.status
        : 502;
  return Response.json(
    { ok: result.ok, indexNowStatus: result.status, indexNowBody: result.body },
    { status: httpStatus },
  );
}
