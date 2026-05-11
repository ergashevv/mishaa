/**
 * Next.js `/ _next/image` rejects proxied sources: a `src` like
 * `/api/proxy/image?url=https%3A%2F%2F...` becomes an invalid optimize request
 * (`INVALID_IMAGE_OPTIMIZE_REQUEST`). Use `unoptimized` so the browser loads
 * the app proxy URL directly.
 */
export function imageUnoptimizedForSrc(src: string | undefined | null): boolean {
  return typeof src === 'string' && src.startsWith('/api/proxy/image');
}
