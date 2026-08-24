/**
 * Creates the site_event table + indexes on Neon.
 *
 * Standalone rather than a Prisma migration: `prisma migrate` wants to diff the whole live
 * schema, and Prisma is no longer used at runtime anyway. Idempotent — safe to re-run.
 *
 *   node scripts/site-event-migrate.mjs
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (expected in .env)');
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS site_event (
     id          BIGSERIAL PRIMARY KEY,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     name        TEXT        NOT NULL,
     visitor_id  TEXT,
     path        TEXT,
     referrer    TEXT,
     country     TEXT,
     city        TEXT,
     device      TEXT,
     browser     TEXT,
     os          TEXT,
     ui_lang     TEXT,
     screen      TEXT,
     timezone    TEXT,
     ip_hash     TEXT,
     user_agent  TEXT,
     payload     JSONB
   )`,
  `CREATE INDEX IF NOT EXISTS site_event_created_at_idx ON site_event (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS site_event_name_time_idx  ON site_event (name, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS site_event_visitor_idx    ON site_event (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS site_event_path_idx       ON site_event (path)`,
];

for (const statement of statements) {
  await sql(statement);
  console.log('ok:', statement.split('\n')[0].trim().slice(0, 70));
}

const [{ count }] = await sql('SELECT count(*)::int AS count FROM site_event');
console.log(`\nsite_event ready — ${count} row(s).`);
