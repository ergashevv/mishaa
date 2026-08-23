import { neon } from '@neondatabase/serverless';

type SqlClient = ReturnType<typeof neon>;

/**
 * The app's Postgres client: Neon's HTTP driver, used for every runtime query.
 *
 * Why not Prisma: its query engine does runtime code-generation, which the Cloudflare
 * Workers runtime forbids ("Code generation from strings disallowed"), so every Prisma
 * call throws on the deployed worker — silently, because most callers catch and return
 * empty. `neon()` runs plain parameterized SQL over HTTPS fetch and behaves identically
 * on workerd and Node. Prisma still owns the schema and migrations, which run locally.
 *
 * Two constraints that follow from the HTTP driver, and shape every query in `@/lib/db`:
 *  - No interactive transactions. Each statement stands alone, so writes are single
 *    idempotent statements (upserts), never read-modify-write pairs.
 *  - Every query is one outbound subrequest, and Workers caps those per invocation
 *    (50 on the free plan). Batch rather than looping — see the ingest's bulk upsert.
 *
 * Built lazily: DATABASE_URL is a Worker secret that does not exist during the build, and
 * `neon(undefined!)` at module scope would throw while Next prerenders.
 */
let client: SqlClient | null = null;

export function getSql(): SqlClient {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    client = neon(url);
  }
  return client;
}

/**
 * Forwards to the lazily-built client, preserving both call styles the codebase uses:
 * `sql(text, params)` and the tagged template `` sql`…` ``.
 */
export const sql = ((...args: unknown[]) =>
  (getSql() as unknown as (...a: unknown[]) => unknown)(...args)) as SqlClient;
