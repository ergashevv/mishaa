/**
 * Creates the human_check table + indexes on Neon.
 *
 * Standalone (not a Prisma migration) because `prisma migrate` wants to diff/reset the whole
 * schema, and this app's other tables are already live. Idempotent — safe to re-run.
 *
 *   node scripts/human-check-migrate.mjs
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
  `CREATE TABLE IF NOT EXISTS human_check (
     id            BIGSERIAL PRIMARY KEY,
     visitor_id    TEXT        NOT NULL,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     country       TEXT,
     city          TEXT,
     region        TEXT,
     timezone      TEXT,
     ui_lang       TEXT,
     path          TEXT,
     referrer      TEXT,
     device        TEXT,
     browser       TEXT,
     os            TEXT,
     screen        TEXT,
     user_agent    TEXT,
     ip_hash       TEXT,
     decided_ms    INTEGER,
     repeat_visit  BOOLEAN     NOT NULL DEFAULT false
   )`,
  `CREATE INDEX IF NOT EXISTS human_check_created_at_idx ON human_check (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS human_check_visitor_idx    ON human_check (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS human_check_country_idx    ON human_check (country)`,
];

for (const statement of statements) {
  await sql(statement);
  console.log('ok:', statement.split('\n')[0].trim().slice(0, 72));
}

const [{ count }] = await sql('SELECT count(*)::int AS count FROM human_check');
console.log(`\nhuman_check ready — ${count} row(s).`);
