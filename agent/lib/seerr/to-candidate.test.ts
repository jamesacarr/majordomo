import { describe, expect, it } from 'vitest';

import { OVERVIEW_MAX_LENGTH } from './constants';
import { toCandidate } from './to-candidate';
import type { MovieResult, TvResult } from './types';

const movie = (overrides: Partial<MovieResult> = {}): MovieResult => ({
  id: 603,
  mediaType: 'movie',
  overview: 'A hacker learns what the Matrix is.',
  releaseDate: '1999-03-31',
  title: 'The Matrix',
  ...overrides,
});

const tv = (overrides: Partial<TvResult> = {}): TvResult => ({
  firstAirDate: '2011-04-17',
  id: 1399,
  mediaType: 'tv',
  name: 'Game of Thrones',
  overview: 'Nine noble families fight for control.',
  ...overrides,
});

describe('toCandidate', () => {
  it('maps a movie result to a candidate', () => {
    expect(toCandidate(movie())).toEqual({
      availability: 'not_requested',
      mediaType: 'movie',
      overview: 'A hacker learns what the Matrix is.',
      title: 'The Matrix',
      tmdbId: 603,
      year: 1999,
    });
  });

  it('maps a TV result to a candidate, taking the title from name and the year from firstAirDate', () => {
    expect(toCandidate(tv())).toEqual({
      availability: 'not_requested',
      mediaType: 'tv',
      overview: 'Nine noble families fight for control.',
      title: 'Game of Thrones',
      tmdbId: 1399,
      year: 2011,
    });
  });

  it.each([
    [1, 'unknown'],
    [2, 'pending'],
    [3, 'processing'],
    [4, 'partially_available'],
    [5, 'available'],
    [6, 'blocklisted'],
    [7, 'deleted'],
  ])('maps mediaInfo status %i to %s', (status, availability) => {
    expect(
      toCandidate(movie({ mediaInfo: { status, tmdbId: 603 } })),
    ).toMatchObject({ availability });
  });

  it('treats a status code Seerr has not defined as unknown', () => {
    expect(
      toCandidate(tv({ mediaInfo: { status: 99, tmdbId: 1399 } })),
    ).toMatchObject({ availability: 'unknown' });
  });

  it('gives a null year when the release date is missing', () => {
    const { releaseDate: _dropped, ...withoutDate } = movie();

    expect(toCandidate(withoutDate)).toMatchObject({ year: null });
  });

  it('gives a null year when the release date is empty, as TMDB sends for unreleased titles', () => {
    expect(toCandidate(movie({ releaseDate: '' }))).toMatchObject({
      year: null,
    });
  });

  it('gives an empty overview when the result has none', () => {
    const { overview: _dropped, ...withoutOverview } = tv();

    expect(toCandidate(withoutOverview)).toMatchObject({
      overview: '',
    });
  });

  it('keeps an overview of exactly the maximum length intact', () => {
    const overview = 'a'.repeat(OVERVIEW_MAX_LENGTH);

    expect(toCandidate(movie({ overview }))).toMatchObject({ overview });
  });

  it('truncates a longer overview to the maximum length, ending in an ellipsis', () => {
    const candidate = toCandidate(
      movie({ overview: 'word '.repeat(OVERVIEW_MAX_LENGTH) }),
    );

    expect(candidate?.overview.length).toBeLessThanOrEqual(OVERVIEW_MAX_LENGTH);
    expect(candidate?.overview).toMatch(/word…$/u);
  });
});
