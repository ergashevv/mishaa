# icomics-ingest-cron

Standalone Cloudflare Worker that fires the **daily catalog ingest + IndexNow ping**.

The main app (OpenNext) worker only exports `fetch`, so scheduled work lives here instead.
This worker is a timer: it calls the app's `/api/cron/ingest` route with a shared bearer
secret. All DB/MangaDex logic stays in the app.

## Deploy

```bash
cd workers/ingest-cron
npx wrangler deploy
# Set the shared secret (must equal the app's CRON_SECRET env var):
npx wrangler secret put CRON_SECRET
```

- Schedule: `0 6 * * *` (06:00 UTC daily) — edit `triggers.crons` in `wrangler.jsonc`.
- Titles per run: `INGEST_TARGET` var (default `500`).
- Target site: `SITE_ORIGIN` var (default `https://icomics.wiki`).

## Verify

```bash
# Tail live logs (fires on the next cron, or trigger manually):
npx wrangler tail icomics-ingest-cron

# Manual trigger over HTTP (same secret):
curl -H "authorization: Bearer $CRON_SECRET" https://icomics-ingest-cron.<subdomain>.workers.dev
```

The app route also accepts `?target=` for one-off backfills, e.g.
`/api/cron/ingest?target=2000` (capped at 2000/run).

## Prerequisite

Set `CRON_SECRET` on the **app** worker too (so the route authorizes this cron):
in the app's Cloudflare dashboard → Settings → Variables, or via `wrangler secret put`
against the `icomics` worker. Without it the route still runs (it only writes our own
data), but setting it keeps the endpoint from being triggerable by anyone.
