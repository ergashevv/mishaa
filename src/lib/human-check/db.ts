import { neon } from '@neondatabase/serverless';

/**
 * Neon HTTP SQL client for the human-check log.
 *
 * Deliberately NOT Prisma: Prisma's query engine does runtime code-generation, which the
 * Cloudflare Workers runtime forbids ("Code generation from strings disallowed"), so every
 * Prisma call throws on the deployed worker. `neon()` is plain parameterized SQL over
 * HTTPS fetch — works identically on workerd and Node.
 *
 * Lazily constructed: `DATABASE_URL` is a Worker secret that is absent at build time, and a
 * module-scope `neon(undefined!)` would throw during OpenNext's bundling/prerender pass.
 */
let client: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    client = neon(url);
  }
  return client;
}
