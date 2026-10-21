import { describe, expect, it } from 'vitest';

import { toPickResult } from './to-pick-result';
import type { MediaDetails } from './types';

const movie = (tmdbId: number, title: string, year: number): MediaDetails => ({
  availability: 'not_requested',
  cast: [],
  directors: [],
  genres: [],
  mediaType: 'movie',
  overview: '',
  runtimeMinutes: null,
  title,
  tmdbId,
  year,
});

const tv = (tmdbId: number, title: string, year: number): MediaDetails => ({
  availability: 'not_requested',
  cast: [],
  creators: [],
  genres: [],
  mediaType: 'tv',
  overview: '',
  seasonCount: null,
  title,
  tmdbId,
  year,
});

const candidates = [
  movie(438_631, 'Dune', 2021),
  movie(841, 'Dune', 1984),
  tv(1_910, "Frank Herbert's Dune", 2000),
];

const shown = {
  options: [
    { label: 'Dune (2021)', mediaType: 'movie', tmdbId: 438_631 },
    { label: 'Dune (1984)', mediaType: 'movie', tmdbId: 841 },
    { label: "Frank Herbert's Dune (2000)", mediaType: 'tv', tmdbId: 1_910 },
  ],
  status: 'cancelled',
};

describe('toPickResult', () => {
  it('returns the candidate the person picked', () => {
    expect(
      toPickResult({ optionId: 'movie:841', status: 'answered' }, candidates),
    ).toEqual({
      mediaType: 'movie',
      status: 'chosen',
      title: 'Dune',
      tmdbId: 841,
      year: 1984,
    });
  });

  it('tells a movie and a show with the same TMDB id apart by the id prefix', () => {
    const sameId = [movie(7, 'Dune', 1984), tv(7, 'Dune', 2000)];

    expect(
      toPickResult({ optionId: 'tv:7', status: 'answered' }, sameId),
    ).toMatchObject({
      mediaType: 'tv',
      status: 'chosen',
      tmdbId: 7,
      year: 2000,
    });
  });

  it('returns the shown options when the answer names no candidate', () => {
    expect(
      toPickResult({ optionId: 'movie:1', status: 'answered' }, candidates),
    ).toEqual(shown);
  });

  it('returns the shown options when the answer is only text', () => {
    expect(
      toPickResult({ status: 'answered', text: 'the Lynch one' }, candidates),
    ).toEqual(shown);
  });

  it('returns the shown options when the question was withdrawn', () => {
    expect(toPickResult({ status: 'cancelled' }, candidates)).toEqual(shown);
  });

  it('returns the shown options when no one can answer', () => {
    expect(toPickResult({ status: 'unavailable' }, candidates)).toEqual(shown);
  });

  it('carries the disambiguated labels the person saw', () => {
    const clash = [movie(1, 'Dune', 2000), tv(2, 'Dune', 2000)];

    expect(toPickResult({ status: 'cancelled' }, clash)).toEqual({
      options: [
        { label: 'Dune (2000)', mediaType: 'movie', tmdbId: 1 },
        { label: 'Dune (2000, TV)', mediaType: 'tv', tmdbId: 2 },
      ],
      status: 'cancelled',
    });
  });
});
