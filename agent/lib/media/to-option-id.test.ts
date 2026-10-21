import { describe, expect, it } from 'vitest';

import { toOptionId } from './to-option-id';

describe('toOptionId', () => {
  it('joins the media type and TMDB id', () => {
    expect(toOptionId({ mediaType: 'movie', tmdbId: 841 })).toBe('movie:841');
    expect(toOptionId({ mediaType: 'tv', tmdbId: 1_910 })).toBe('tv:1910');
  });
});
