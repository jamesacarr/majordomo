import { describe, expect, it } from 'vitest';

import type { MovieDetails, TvDetails } from '../seerr/types';
import { MAX_CAST } from './constants';
import { details } from './details';

const dune: MovieDetails = {
  credits: {
    cast: [
      { character: 'Paul Atreides', name: 'Timothée Chalamet' },
      { character: 'Lady Jessica', name: 'Rebecca Ferguson' },
    ],
    crew: [
      { job: 'Director', name: 'Denis Villeneuve' },
      { job: 'Screenplay', name: 'Jon Spaihts' },
    ],
  },
  genres: [{ name: 'Science Fiction' }, { name: 'Adventure' }],
  id: 438_631,
  mediaInfo: { status: 5 },
  overview: 'Paul Atreides travels to Arrakis.',
  releaseDate: '2021-09-15',
  runtime: 155,
  title: 'Dune',
};

const miniseries: TvDetails = {
  createdBy: [{ name: 'John Harrison' }],
  credits: { cast: [{ character: 'Paul Atreides', name: 'Alec Newman' }] },
  firstAirDate: '2000-12-03',
  genres: [{ name: 'Sci-Fi & Fantasy' }],
  id: 1_910,
  name: "Frank Herbert's Dune",
  numberOfSeasons: 1,
  overview: 'A three-part adaptation.',
};

const clientWith = ({
  movie = dune,
  tv = miniseries,
}: {
  readonly movie?: MovieDetails;
  readonly tv?: TvDetails;
} = {}) => ({
  movie: (_id: number) => Promise.resolve(movie),
  tv: (_id: number) => Promise.resolve(tv),
});

describe('details', () => {
  it('describes a movie with its genres, cast, director, runtime and availability', async () => {
    await expect(
      details(clientWith(), { mediaType: 'movie', tmdbId: 438_631 }),
    ).resolves.toEqual({
      availability: 'available',
      cast: [
        'Timothée Chalamet as Paul Atreides',
        'Rebecca Ferguson as Lady Jessica',
      ],
      directors: ['Denis Villeneuve'],
      genres: ['Science Fiction', 'Adventure'],
      mediaType: 'movie',
      overview: 'Paul Atreides travels to Arrakis.',
      runtimeMinutes: 155,
      title: 'Dune',
      tmdbId: 438_631,
      year: 2021,
    });
  });

  it('describes a TV show with its creators and season count', async () => {
    await expect(
      details(clientWith(), { mediaType: 'tv', tmdbId: 1_910 }),
    ).resolves.toEqual({
      availability: 'not_requested',
      cast: ['Alec Newman as Paul Atreides'],
      creators: ['John Harrison'],
      genres: ['Sci-Fi & Fantasy'],
      mediaType: 'tv',
      overview: 'A three-part adaptation.',
      seasonCount: 1,
      title: "Frank Herbert's Dune",
      tmdbId: 1_910,
      year: 2000,
    });
  });

  it(`lists only the first ${MAX_CAST} cast members, in billing order`, async () => {
    const cast = Array.from({ length: MAX_CAST + 2 }, (_, i) => ({
      character: `Role ${i + 1}`,
      name: `Actor ${i + 1}`,
    }));

    const result = await details(
      clientWith({ movie: { ...dune, credits: { cast } } }),
      { mediaType: 'movie', tmdbId: 438_631 },
    );

    expect(result.cast).toHaveLength(MAX_CAST);
    expect(result.cast[0]).toBe('Actor 1 as Role 1');
  });

  it('names a cast member alone when TMDB gives no character', async () => {
    const result = await details(
      clientWith({
        movie: {
          ...dune,
          credits: { cast: [{ character: '', name: 'Sting' }] },
        },
      }),
      { mediaType: 'movie', tmdbId: 438_631 },
    );

    expect(result.cast).toEqual(['Sting']);
  });

  it('reports an unknown runtime of 0 minutes as null', async () => {
    const result = await details(
      clientWith({ movie: { ...dune, runtime: 0 } }),
      {
        mediaType: 'movie',
        tmdbId: 438_631,
      },
    );

    expect(result).toMatchObject({ runtimeMinutes: null });
  });

  it('returns empty lists and null counts when Seerr omits credits, genres and counts', async () => {
    const result = await details(
      clientWith({ tv: { id: 1_910, name: "Frank Herbert's Dune" } }),
      { mediaType: 'tv', tmdbId: 1_910 },
    );

    expect(result).toMatchObject({
      cast: [],
      creators: [],
      genres: [],
      seasonCount: null,
    });
  });

  it('returns no directors when the movie has no crew', async () => {
    const result = await details(
      clientWith({ movie: { ...dune, credits: null, runtime: null } }),
      { mediaType: 'movie', tmdbId: 438_631 },
    );

    expect(result).toMatchObject({
      cast: [],
      directors: [],
      runtimeMinutes: null,
    });
  });
});
