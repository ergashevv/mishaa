<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI Direction Notes

- Keep hero layouts minimal unless the user explicitly asks for more density.
- Avoid AI-flavored filler copy such as `Live feature`, `Featured now`, `Focus`, `Neural`, or similar decorative labels.
- Preferred hero structure: background image with color wash, poster card on the right, title and rating on the left.
- Do not add extra badges, stats, or ornamental copy when a simpler composition is requested.
- If the user asks for a Netflix-style hero, keep it borderless or nearly borderless, cinematic, and poster-led. Prefer large title, short metadata, subtle gradient wash, and one prominent poster without stacked cards or heavy frames.

## Server surface (official)

Follow this split when adding endpoints or data access:

### Server Actions (`src/actions/**`)

Use for **library / comic UX** invoked from Client Components via Next server actions:

- Canonical example: `@/actions/comic` (`getComicDetails`, `searchComics`, `getChapters`, `getChapterPages`, …).

Prefer actions when the caller is React client code inside app routes (forms, suspense-friendly flows) and responses are typed domain objects fetched on the server.

### HTTP Route Handlers (`src/app/api/**`)

Use **`/api/**`** when:

- The client calls `fetch()` with a stable URL or you need CDN/edge caching headers on HTTP.
- Cron, webhooks, third-party integrations, or OAuth callbacks require a plain HTTP verb + path.
- Public proxies (`/api/proxy/*`), auth JSON (`/api/auth/*`), `/api/home/data`, `/api/reading-progress`, Telegram routes, studio AI routes, etc.

Do **not** add new “self-fetch” hops from one route to another route on the same app (e.g. avoid `fetch(origin + '/api/...')` for internal aggregation). Prefer a shared **`@/lib/...`** function used by multiple routes instead.

- **`@/lib/comic-types.ts`** — **`ComicListItem`** (search/grid), **`ComicDetail`** (+ optional Marvel extras), **`ComicChapter`**, enrichment stubs **`ComicDetailAniListData`** / **`ComicDetailJikanData`**. Consumers should import these (or re-exports from **`@/actions/comic`**) instead of re-declaring `ComicDetails` in each client file.

- **`@/lib/nhentai/`** — mirror list, canonical headers, and **proxy allowlists** (`isAllowedNHentaiProxyApiPath`, `isAllowedNHentaiImageCdnPath`).
- **`@/lib/http/cookie-header.ts`** — safe parsing of verification cookies from `Cookie` headers (substring matching on raw header strings is discouraged).
