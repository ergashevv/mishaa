/** Parse a single cookie value from raw `Cookie:` header (Edge-safe, no accidental substring matches). */
export function readCookieFromHeader(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const needle = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const s = part.trim();
    if (!s.startsWith(needle)) continue;
    const raw = s.slice(needle.length).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function isTruthyCookieFromHeader(
  cookieHeader: string | null | undefined,
  name: string,
  expected: string,
): boolean {
  return readCookieFromHeader(cookieHeader, name) === expected;
}
