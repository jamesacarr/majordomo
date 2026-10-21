import { describe, expect, it } from 'vitest';

import type { MovieDetails, TvDetails } from '../seerr/types';
import { posterCard } from './poster-card';

const dune: MovieDetails = {
  id: 438_631,
  overview: '  Paul Atreides travels to Arrakis.  ',
  posterPath: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
  releaseDate: '2021-09-15',
  title: 'Dune',
};

const miniseries: TvDetails = {
  firstAirDate: '2000-12-03',
  id: 1_910,
  name: "Frank Herbert's Dune",
  overview: 'A three-part adaptation.',
  posterPath: null,
};

const client = {
  movie: (_id: number) => Promise.resolve(dune),
  tv: (_id: number) => Promise.resolve(miniseries),
};

describe('posterCard', () => {
  it('gives a movie its title, year, trimmed summary and w342 poster URL', async () => {
    await expect(
      posterCard(client, { mediaType: 'movie', tmdbId: 438_631 }),
    ).resolves.toEqual({
      overview: 'Paul Atreides travels to Arrakis.',
      posterUrl:
        'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
      title: 'Dune',
      year: 2021,
    });
  });

  it('reads a show from its name and first air date, with no poster when TMDB has none', async () => {
    await expect(
      posterCard(client, { mediaType: 'tv', tmdbId: 1_910 }),
    ).resolves.toEqual({
      overview: 'A three-part adaptation.',
      posterUrl: null,
      title: "Frank Herbert's Dune",
      year: 2000,
    });
  });

  it('treats a blank poster path as no poster', async () => {
    const blank = {
      ...client,
      movie: () => Promise.resolve({ ...dune, posterPath: ' ' }),
    };

    await expect(
      posterCard(blank, { mediaType: 'movie', tmdbId: 438_631 }),
    ).resolves.toMatchObject({ posterUrl: null });
  });
});
