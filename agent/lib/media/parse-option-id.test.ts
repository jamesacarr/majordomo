import { describe, expect, it } from 'vitest';

import { parseOptionId } from './parse-option-id';
import { toOptionId } from './to-option-id';

describe('parseOptionId', () => {
  it('reads the media type and TMDB id from a pick_media option id', () => {
    expect(parseOptionId('movie:841')).toEqual({
      mediaType: 'movie',
      tmdbId: 841,
    });
    expect(parseOptionId('tv:1910')).toEqual({
      mediaType: 'tv',
      tmdbId: 1_910,
    });
  });

  it('round-trips toOptionId', () => {
    const ref = { mediaType: 'tv', tmdbId: 1_399 } as const;

    expect(parseOptionId(toOptionId(ref))).toEqual(ref);
  });

  it.each([
    'book:1',
    'movie:',
    'movie:0',
    'movie:01',
    'movie:12a',
    'movie:-1',
    'movie:1:2',
    ' movie:1',
    'approve',
  ])('rejects %j', id => {
    expect(parseOptionId(id)).toBeUndefined();
  });
});
