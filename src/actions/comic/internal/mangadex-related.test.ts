import { describe, expect, it } from 'vitest';
import { extractMangaDexUuidFromExternalLinks } from './mangadex-related';

describe('extractMangaDexUuidFromExternalLinks', () => {
  it('returns null for empty input', () => {
    expect(extractMangaDexUuidFromExternalLinks(null)).toBeNull();
    expect(extractMangaDexUuidFromExternalLinks(undefined)).toBeNull();
    expect(extractMangaDexUuidFromExternalLinks([])).toBeNull();
  });

  it('extracts first UUID from link URLs (case-insensitive hex)', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const links = [{ url: `https://mangadex.org/title/${id}` }, { url: 'https://example.com/other' }];
    expect(extractMangaDexUuidFromExternalLinks(links)).toBe(id);
  });

  it('handles null url entries', () => {
    const id = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'.toLowerCase();
    expect(
      extractMangaDexUuidFromExternalLinks([{ url: null }, { url: `x/${id}/y` }]),
    ).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
