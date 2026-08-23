import { sql } from '@/lib/sql';

/**
 * Account reads/writes. Mirrors what the Prisma `User` model returned so the API
 * responses keep their exact shape — Neon's driver already hands back `Date` for
 * timestamp columns and `number` for integers, so nothing needs re-mapping.
 */
export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string | null;
  email: string | null;
  avatar: string | null;
  authProvider: string;
  authProviderId: string | null;
  createdAt: Date;
};

const USER_COLUMNS =
  'id, "firstName", "lastName", username, password, email, avatar, "authProvider", "authProviderId", "createdAt"';

async function queryUsers(text: string, params: unknown[]): Promise<UserRow[]> {
  return (await sql(text, params)) as UserRow[];
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const rows = await queryUsers(`SELECT ${USER_COLUMNS} FROM "User" WHERE username = $1 LIMIT 1`, [
    username,
  ]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const rows = await queryUsers(`SELECT ${USER_COLUMNS} FROM "User" WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function usernameExists(username: string): Promise<boolean> {
  const rows = (await sql('SELECT 1 AS hit FROM "User" WHERE username = $1 LIMIT 1', [
    username,
  ])) as unknown[];
  return rows.length > 0;
}

/** Uniqueness checks for profile edits: does anyone *else* already hold this value? */
export async function usernameTakenByOther(username: string, excludeId: string): Promise<boolean> {
  const rows = (await sql(
    'SELECT 1 AS hit FROM "User" WHERE username = $1 AND id <> $2 LIMIT 1',
    [username, excludeId],
  )) as unknown[];
  return rows.length > 0;
}

export async function emailTakenByOther(email: string, excludeId: string): Promise<boolean> {
  const rows = (await sql('SELECT 1 AS hit FROM "User" WHERE email = $1 AND id <> $2 LIMIT 1', [
    email,
    excludeId,
  ])) as unknown[];
  return rows.length > 0;
}

export type NewUser = {
  firstName: string;
  lastName: string;
  username: string;
  password: string | null;
  email: string | null;
  avatar: string | null;
  authProvider: string;
  authProviderId: string | null;
};

/**
 * `id` has no database default — Prisma used to generate a cuid client-side, so raw SQL
 * has to supply one. `createdAt` does default to now().
 */
export async function createUser(input: NewUser): Promise<UserRow> {
  const rows = await queryUsers(
    `INSERT INTO "User"
       (id, "firstName", "lastName", username, password, email, avatar, "authProvider", "authProviderId")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${USER_COLUMNS}`,
    [
      input.firstName,
      input.lastName,
      input.username,
      input.password,
      input.email,
      input.avatar,
      input.authProvider,
      input.authProviderId,
    ],
  );
  return rows[0];
}

/** Whitelist of writable columns. Identifiers only ever come from here, never from input. */
const UPDATABLE_COLUMNS = {
  firstName: '"firstName"',
  lastName: '"lastName"',
  username: 'username',
  email: 'email',
  password: 'password',
  avatar: 'avatar',
  authProvider: '"authProvider"',
  authProviderId: '"authProviderId"',
} as const;

export type UserPatch = Partial<Record<keyof typeof UPDATABLE_COLUMNS, string | null>>;

/** `undefined` leaves a column alone; an explicit `null` writes NULL — Prisma's semantics. */
export async function updateUser(id: string, patch: UserPatch): Promise<UserRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = patch[key as keyof UserPatch];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return findUserById(id);

  params.push(id);
  const rows = await queryUsers(
    `UPDATE "User" SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING ${USER_COLUMNS}`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * Every username starting with `prefix` — a superset of `prefix` and `prefix_1`, `prefix_2`…
 * Lets a caller pick a free suffix from one round trip instead of probing the database once
 * per candidate, which matters under the Workers subrequest cap. `left()` rather than LIKE so
 * a prefix containing `_` or `%` needs no escaping.
 */
export async function findUsernamesWithPrefix(prefix: string): Promise<Set<string>> {
  const rows = (await sql('SELECT username FROM "User" WHERE left(username, $2::int) = $1', [
    prefix,
    prefix.length,
  ])) as Array<{ username: string }>;
  return new Set(rows.map((r) => r.username));
}

/**
 * The account behind a Google sign-in: the provider identity if we've seen it, otherwise
 * an existing local account with the same verified email (so signing in with Google links
 * to it rather than creating a duplicate). Ordered so the provider match always wins —
 * Prisma's `findFirst` over an OR left that pick arbitrary.
 */
export async function findGoogleUser(sub: string, email: string | null): Promise<UserRow | null> {
  const rows = await queryUsers(
    `SELECT ${USER_COLUMNS} FROM "User"
      WHERE ("authProvider" = 'google' AND "authProviderId" = $1)
         OR ($2::text IS NOT NULL AND email = $2)
      ORDER BY ("authProvider" = 'google' AND "authProviderId" = $1) DESC
      LIMIT 1`,
    [sub, email],
  );
  return rows[0] ?? null;
}
