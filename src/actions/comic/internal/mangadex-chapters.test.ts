import { dedupeMangaDexFeedChapters } from '@/actions/comic/internal/mangadex-chapters';

describe('dedupeMangaDexFeedChapters', () => {
  it('picks translated language match over aggregate primary id', () => {
    const rows = [
      {
        id: 'primary-lang-id',
        attributes: {
          chapter: '1',
          volume: null,
          translatedLanguage: 'id',
          readableAt: '2025-12-01T00:00:00+00:00',
        },
        relationships: [{ type: 'scanlation_group', attributes: { name: 'IDR group' } }],
      },
      {
        id: 'en-chapter-id',
        attributes: {
          chapter: '1',
          volume: null,
          translatedLanguage: 'en',
          readableAt: '2025-11-01T00:00:00+00:00',
        },
        relationships: [{ type: 'scanlation_group', attributes: { name: 'EN group' } }],
      },
    ];

    const aggregate = {
      none: {
        volume: 'none',
        chapters: {
          x: {
            chapter: '1',
            id: 'primary-lang-id',
            others: ['en-chapter-id'],
          },
        },
      },
    };

    const out = dedupeMangaDexFeedChapters(rows, aggregate, ['en']);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('en-chapter-id');
  });

  it('honors aggregate primary when language preferences tie', () => {
    const rows = [
      {
        id: 'alpha',
        attributes: {
          chapter: '1',
          volume: null,
          translatedLanguage: 'en',
          readableAt: '2025-11-02T00:00:00+00:00',
        },
      },
      {
        id: 'beta',
        attributes: {
          chapter: '1',
          volume: null,
          translatedLanguage: 'en',
          readableAt: '2025-11-01T00:00:00+00:00',
        },
      },
    ];

    const aggregate = {
      none: {
        volume: 'none',
        chapters: {
          z: {
            chapter: '1',
            id: 'beta',
            others: ['alpha'],
          },
        },
      },
    };

    const out = dedupeMangaDexFeedChapters(rows, aggregate, ['en']);
    expect(out[0]?.id).toBe('beta');
  });
});
