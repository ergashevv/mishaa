import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// Incremental cache backed by Cloudflare KV. Without this, `defineCloudflareConfig({})` uses the
// "dummy" no-op cache, so `unstable_cache`/ISR NEVER persist on Workers — every homepage request
// re-ran the full MangaDex + AniList fan-out (TTFB ~1.7s). With KV, getHomeData's `unstable_cache`
// (1h) actually caches, collapsing TTFB toward pure render time on a hit.
//
// REQUIRES the `NEXT_INC_CACHE_KV` KV binding in wrangler.jsonc (see the note there). If the binding
// is absent at runtime the override throws an IgnorableError and OpenNext degrades to a cache miss —
// i.e. same behaviour as before, never a crash.
const config = defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
config.default = config.default || {};
config.default.minify = true;

export default config;
