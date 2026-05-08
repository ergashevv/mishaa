import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/site-url', () => ({
  getSiteUrl: () => 'https://example.test',
}));

describe('fetchJsonThroughProxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses JSON from first successful endpoint', async () => {
    const payload = { data: [{ id: 'm1' }], total: 1 };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('https://example.test/api/proxy/mangadex')) {
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error('should not reach fallback');
    });

    const { fetchJsonThroughProxy } = await import('./mangadex-client');

    await expect(fetchJsonThroughProxy('manga?page=1', 'https://api.mangadex.org/FAIL')).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalled();
    const firstUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(firstUrl).toContain('/api/proxy/mangadex');
    expect(firstUrl).toContain(encodeURIComponent('manga?page=1'));
  });

  it('falls back to direct URL when proxy fails', async () => {
    const payload = { ok: true };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('proxy')) {
        return new Response('bad gateway', { status: 502 });
      }
      if (url === 'https://api.mangadex.org/direct') {
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });

    const { fetchJsonThroughProxy } = await import('./mangadex-client');

    await expect(
      fetchJsonThroughProxy('unused', 'https://api.mangadex.org/direct'),
    ).resolves.toEqual(payload);
  });

  it('throws when all endpoints fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('error', { status: 500 }),
    );

    const { fetchJsonThroughProxy } = await import('./mangadex-client');

    await expect(fetchJsonThroughProxy('manga/x')).rejects.toThrow('MangaDex fetch failed');
  });
});
