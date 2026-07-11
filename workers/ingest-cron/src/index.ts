/**
 * icomics-ingest-cron — a tiny standalone Cloudflare Worker whose only job is to fire the
 * daily catalog ingest + IndexNow ping on a schedule.
 *
 * Why a separate worker (not the main OpenNext app worker): the OpenNext-generated
 * `.open-next/worker.js` exports only a `fetch` handler and is rebuilt/patched on every
 * deploy, so bolting a `scheduled` export onto it is fragile. This worker is decoupled: it
 * just calls the app's own `/api/cron/ingest` route (which owns the DB + MangaDex logic)
 * with the shared bearer secret. The heavy lifting stays in the app; this is only a timer.
 *
 * Deploy (from workers/ingest-cron/):
 *   wrangler deploy
 *   wrangler secret put CRON_SECRET   # same value as the app's CRON_SECRET env
 * Manual run (optional): POST/GET this worker's URL with `Authorization: Bearer <secret>`.
 */

interface Env {
  /** Public site origin the ingest route lives on, e.g. https://icomics.wiki */
  SITE_ORIGIN: string;
  /** Shared secret — must equal the app's CRON_SECRET so the route authorizes us. */
  CRON_SECRET?: string;
  /** Titles to ingest per run (default 500). */
  INGEST_TARGET?: string;
}

async function runIngest(env: Env): Promise<{ status: number; body: string }> {
  const origin = (env.SITE_ORIGIN || 'https://icomics.wiki').replace(/\/$/, '');
  const target = env.INGEST_TARGET || '500';
  const url = `${origin}/api/cron/ingest?target=${encodeURIComponent(target)}`;
  const res = await fetch(url, {
    headers: env.CRON_SECRET ? { authorization: `Bearer ${env.CRON_SECRET}` } : {},
  });
  const body = (await res.text()).slice(0, 1000);
  console.log(`ingest-cron → ${res.status} ${body}`);
  return { status: res.status, body };
}

export default {
  // Cloudflare Cron Trigger entry point.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(runIngest(env));
  },

  // Optional manual trigger over HTTP, gated by the same secret.
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get('authorization')?.trim();
    if (env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await runIngest(env);
    return new Response(JSON.stringify(result), {
      status: result.status < 400 ? 200 : 502,
      headers: { 'content-type': 'application/json' },
    });
  },
};
