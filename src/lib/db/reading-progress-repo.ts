import { sql } from '@/lib/sql';

export type ReadingProgressRow = {
  id: string;
  userId: string;
  source: string;
  comicId: string;
  comicTitle: string | null;
  comicCoverUrl: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  currentPage: number;
  totalPages: number;
  chapterIndex: number;
  chapterCount: number;
  progressPercent: number;
  progressStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

const RP_COLUMNS =
  'id, "userId", source, "comicId", "comicTitle", "comicCoverUrl", "chapterId", "chapterTitle", ' +
  '"currentPage", "totalPages", "chapterIndex", "chapterCount", "progressPercent", "progressStatus", ' +
  '"createdAt", "updatedAt"';

export async function findProgress(
  userId: string,
  source: string,
  comicId: string,
): Promise<ReadingProgressRow | null> {
  const rows = (await sql(
    `SELECT ${RP_COLUMNS} FROM "ReadingProgress"
      WHERE "userId" = $1 AND source = $2 AND "comicId" = $3 LIMIT 1`,
    [userId, source, comicId],
  )) as ReadingProgressRow[];
  return rows[0] ?? null;
}

export async function listProgress(userId: string): Promise<ReadingProgressRow[]> {
  return (await sql(
    `SELECT ${RP_COLUMNS} FROM "ReadingProgress" WHERE "userId" = $1 ORDER BY "updatedAt" DESC`,
    [userId],
  )) as ReadingProgressRow[];
}

export type ProgressUpsert = {
  userId: string;
  source: string;
  comicId: string;
  comicTitle: string | null;
  comicCoverUrl: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  currentPage: number;
  totalPages: number;
  chapterIndex: number;
  chapterCount: number;
  progressPercent: number;
  progressStatus: string;
};

/**
 * One idempotent statement — the HTTP driver has no interactive transactions, and a
 * read-then-write pair would race a second tab reading the same comic.
 *
 * The COALESCE columns reproduce the old Prisma upsert, whose update branch passed
 * `undefined` for the descriptive fields: a later save that doesn't carry a title or
 * cover must not blank the one already stored. Counters always take the new value, and
 * `updatedAt` is set explicitly because the column has no database default (Prisma used
 * to fill it client-side via `@updatedAt`).
 */
export async function upsertProgress(input: ProgressUpsert): Promise<ReadingProgressRow> {
  const rows = (await sql(
    `INSERT INTO "ReadingProgress"
       (id, "userId", source, "comicId", "comicTitle", "comicCoverUrl", "chapterId", "chapterTitle",
        "currentPage", "totalPages", "chapterIndex", "chapterCount", "progressPercent",
        "progressStatus", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
     ON CONFLICT ("userId", source, "comicId") DO UPDATE SET
       "comicTitle"      = COALESCE(EXCLUDED."comicTitle", "ReadingProgress"."comicTitle"),
       "comicCoverUrl"   = COALESCE(EXCLUDED."comicCoverUrl", "ReadingProgress"."comicCoverUrl"),
       "chapterId"       = COALESCE(EXCLUDED."chapterId", "ReadingProgress"."chapterId"),
       "chapterTitle"    = COALESCE(EXCLUDED."chapterTitle", "ReadingProgress"."chapterTitle"),
       "currentPage"     = EXCLUDED."currentPage",
       "totalPages"      = EXCLUDED."totalPages",
       "chapterIndex"    = EXCLUDED."chapterIndex",
       "chapterCount"    = EXCLUDED."chapterCount",
       "progressPercent" = EXCLUDED."progressPercent",
       "progressStatus"  = EXCLUDED."progressStatus",
       "updatedAt"       = now()
     RETURNING ${RP_COLUMNS}`,
    [
      input.userId,
      input.source,
      input.comicId,
      input.comicTitle,
      input.comicCoverUrl,
      input.chapterId,
      input.chapterTitle,
      input.currentPage,
      input.totalPages,
      input.chapterIndex,
      input.chapterCount,
      input.progressPercent,
      input.progressStatus,
    ],
  )) as ReadingProgressRow[];
  return rows[0];
}

export async function deleteProgress(
  userId: string,
  source: string,
  comicId: string,
): Promise<void> {
  await sql(
    'DELETE FROM "ReadingProgress" WHERE "userId" = $1 AND source = $2 AND "comicId" = $3',
    [userId, source, comicId],
  );
}

export async function deleteAllProgress(userId: string): Promise<void> {
  await sql('DELETE FROM "ReadingProgress" WHERE "userId" = $1', [userId]);
}

/**
 * Both profile counters in a single statement. Two `count(*)` queries would be two
 * outbound subrequests, and Workers caps those per invocation.
 */
export async function countProgress(userId: string): Promise<{ reading: number; completed: number }> {
  const rows = (await sql(
    `SELECT count(*)::int AS reading,
            count(*) FILTER (WHERE "progressStatus" = 'completed')::int AS completed
       FROM "ReadingProgress" WHERE "userId" = $1`,
    [userId],
  )) as Array<{ reading: number; completed: number }>;
  return { reading: rows[0]?.reading ?? 0, completed: rows[0]?.completed ?? 0 };
}
