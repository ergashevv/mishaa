import { describe, expect, it } from 'vitest';
import { getNHentaiPageEntries, resolveNHentaiImageExt } from './nhentai-internal';

describe('resolveNHentaiImageExt', () => {
  it('maps type letters to extensions', () => {
    expect(resolveNHentaiImageExt('p')).toBe('png');
    expect(resolveNHentaiImageExt('g')).toBe('gif');
    expect(resolveNHentaiImageExt('w')).toBe('webp');
    expect(resolveNHentaiImageExt('j')).toBe('jpg');
  });

  it('defaults to jpg for unknown or missing', () => {
    expect(resolveNHentaiImageExt(undefined)).toBe('jpg');
    expect(resolveNHentaiImageExt('x')).toBe('jpg');
  });
});

describe('getNHentaiPageEntries', () => {
  it('indexes array pages starting at 1', () => {
    const rows = [{ t: 'j' }, { t: 'p' }];
    const out = getNHentaiPageEntries(rows);
    expect(out).toEqual([
      { page: 1, t: 'j' },
      { page: 2, t: 'p' },
    ]);
  });

  it('sorts keyed object pages numerically', () => {
    const pages = {
      '3': { t: 'w' },
      '1': { t: 'j' },
      '2': { t: 'p' },
    };
    expect(getNHentaiPageEntries(pages)).toEqual([
      { page: 1, t: 'j' },
      { page: 2, t: 'p' },
      { page: 3, t: 'w' },
    ]);
  });

  it('returns empty for missing pages', () => {
    expect(getNHentaiPageEntries(undefined as never)).toEqual([]);
  });
});
