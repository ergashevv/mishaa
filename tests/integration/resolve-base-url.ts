/**
 * Resolve the deployment origin for HTTP integration tests.
 * Priority: INTEGRATION_BASE_URL → SITE_URL → NEXT_PUBLIC_SITE_URL → VERCEL_URL (preview/production hostname).
 */
export function resolveIntegrationBaseUrl(): string | null {
  const explicit =
    process.env.INTEGRATION_BASE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  const vercelRaw = process.env.VERCEL_URL?.trim();

  let raw = explicit || vercelRaw;
  if (!raw) return null;

  raw = raw.replace(/\/$/, '');
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
