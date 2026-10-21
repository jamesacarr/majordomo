import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MovieDetails, TvDetails } from '../seerr/types';
import { fetchCards } from './fetch-cards';

const movie = (id: number): MovieDetails => ({
  id,
  overview: `Movie ${id}.`,
  posterPath: `/${id}.jpg`,
  releaseDate: '2021-01-01',
  title: `Movie ${id}`,
});

const show: TvDetails = {
  firstAirDate: '2000-01-01',
  id: 7,
  name: 'Show 7',
  overview: 'Show 7.',
  posterPath: null,
};

const client = {
  movie: (id: number) =>
    id === 404
      ? Promise.reject(new Error('Not found'))
      : Promise.resolve(movie(id)),
  tv: (_id: number) => Promise.resolve(show),
};

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchCards', () => {
  it('fetches a card per title, in input order', async () => {
    await expect(
      fetchCards(
        () => client,
        [
          { mediaType: 'tv', tmdbId: 7 },
          { mediaType: 'movie', tmdbId: 1 },
        ],
        3000,
      ),
    ).resolves.toEqual([
      { overview: 'Show 7.', posterUrl: null, title: 'Show 7', year: 2000 },
      {
        overview: 'Movie 1.',
        posterUrl: 'https://image.tmdb.org/t/p/w342/1.jpg',
        title: 'Movie 1',
        year: 2021,
      },
    ]);
  });

  it('leaves a title whose fetch fails without a card', async () => {
    const cards = await fetchCards(
      () => client,
      [
        { mediaType: 'movie', tmdbId: 404 },
        { mediaType: 'movie', tmdbId: 1 },
      ],
      3000,
    );

    expect(cards[0]).toBeUndefined();
    expect(cards[1]).toMatchObject({ title: 'Movie 1' });
  });

  it('gives up on a fetch still pending at the deadline', async () => {
    vi.useFakeTimers();
    const stalled = {
      ...client,
      movie: (id: number) =>
        id === 2
          ? new Promise<MovieDetails>(() => {})
          : Promise.resolve(movie(id)),
    };

    const pending = fetchCards(
      () => stalled,
      [
        { mediaType: 'movie', tmdbId: 1 },
        { mediaType: 'movie', tmdbId: 2 },
      ],
      3000,
    );
    await vi.advanceTimersByTimeAsync(3000);
    const cards = await pending;

    expect(cards[0]).toMatchObject({ title: 'Movie 1' });
    expect(cards[1]).toBeUndefined();
  });

  it('gives no cards when the client cannot be built', async () => {
    await expect(
      fetchCards(
        () => {
          throw new Error('SEERR_URL is not set');
        },
        [{ mediaType: 'movie', tmdbId: 1 }],
        3000,
      ),
    ).resolves.toEqual([undefined]);
  });
});
