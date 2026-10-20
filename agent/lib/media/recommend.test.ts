import { describe, expect, it } from 'vitest';

import type { MovieResult, TvResult } from '../seerr/types';
import { MAX_CANDIDATES, MIN_VOTE_COUNT } from './constants';
import { recommend } from './recommend';

const movie = (
  id: number,
  voteAverage: number,
  voteCount = 1_000,
): MovieResult => ({
  id,
  mediaType: 'movie',
  title: `Film ${id}`,
  voteAverage,
  voteCount,
});

const tv = (id: number, voteAverage: number): TvResult => ({
  id,
  mediaType: 'tv',
  name: `Show ${id}`,
  voteAverage,
  voteCount: 1_000,
});

const page = <T>(results: readonly T[]) =>
  Promise.resolve({ results: [...results] });

/** A Seerr client answering movie recommendations and similar titles with the given lists. */
const movieClient = (
  recommendations: readonly MovieResult[],
  similar: readonly MovieResult[] = [],
) => ({
  movieRecommendations: (_id: number) => page(recommendations),
  movieSimilar: (_id: number) => page(similar),
  tvRecommendations: (_id: number) => page<TvResult>([]),
  tvSimilar: (_id: number) => page<TvResult>([]),
});

const ids = (candidates: readonly { readonly tmdbId: number }[]) =>
  candidates.map(c => c.tmdbId);

describe('recommend', () => {
  it('merges recommendations and similar titles, listing each title once', async () => {
    const client = movieClient(
      [movie(1, 8), movie(2, 7)],
      [movie(2, 7), movie(3, 6)],
    );

    const candidates = await recommend(client, {
      mediaType: 'movie',
      tmdbId: 550,
    });

    expect(ids(candidates)).toEqual([1, 2, 3]);
  });

  it('leaves out the title the recommendations are for', async () => {
    const client = movieClient([movie(550, 9), movie(1, 8)]);

    const candidates = await recommend(client, {
      mediaType: 'movie',
      tmdbId: 550,
    });

    expect(ids(candidates)).toEqual([1]);
  });

  it('ranks titles by vote average, best first', async () => {
    const client = movieClient([movie(1, 6.1), movie(2, 8.4)], [movie(3, 7.3)]);

    const candidates = await recommend(client, {
      mediaType: 'movie',
      tmdbId: 550,
    });

    expect(ids(candidates)).toEqual([2, 3, 1]);
  });

  it(`ranks titles with fewer than ${MIN_VOTE_COUNT} votes after every better-voted title, whatever their average`, async () => {
    const client = movieClient([
      movie(1, 10, MIN_VOTE_COUNT - 1),
      movie(2, 6, MIN_VOTE_COUNT),
      { ...movie(3, 9), voteCount: null },
    ]);

    const candidates = await recommend(client, {
      mediaType: 'movie',
      tmdbId: 550,
    });

    expect(ids(candidates)).toEqual([2, 1, 3]);
  });

  it('returns at most the requested number of titles', async () => {
    const client = movieClient([movie(1, 9), movie(2, 8), movie(3, 7)]);

    const candidates = await recommend(client, {
      limit: 2,
      mediaType: 'movie',
      tmdbId: 550,
    });

    expect(ids(candidates)).toEqual([1, 2]);
  });

  it(`returns at most ${MAX_CANDIDATES} titles, whatever limit is asked for`, async () => {
    const many = Array.from({ length: MAX_CANDIDATES + 4 }, (_, i) =>
      movie(i + 1, 5),
    );

    const candidates = await recommend(movieClient(many), {
      limit: 50,
      mediaType: 'movie',
      tmdbId: 550,
    });

    expect(candidates).toHaveLength(MAX_CANDIDATES);
  });

  it('recommends TV shows from the TV lists for a TV show', async () => {
    const client = {
      ...movieClient([movie(1, 9)]),
      tvRecommendations: (_id: number) => page([tv(10, 8)]),
      tvSimilar: (_id: number) => page([tv(11, 7)]),
    };

    const candidates = await recommend(client, {
      mediaType: 'tv',
      tmdbId: 1_399,
    });

    expect(candidates.map(c => [c.mediaType, c.tmdbId])).toEqual([
      ['tv', 10],
      ['tv', 11],
    ]);
  });
});
