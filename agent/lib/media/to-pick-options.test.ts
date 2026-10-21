import { describe, expect, it } from 'vitest';

import { toPickOptions } from './to-pick-options';
import type { MediaDetails } from './types';

const movie = (
  tmdbId: number,
  title: string,
  year: number | null,
  directors: readonly string[] = [],
): MediaDetails => ({
  availability: 'not_requested',
  cast: [],
  directors,
  genres: [],
  mediaType: 'movie',
  overview: '',
  runtimeMinutes: null,
  title,
  tmdbId,
  year,
});

const tv = (
  tmdbId: number,
  title: string,
  year: number | null,
  creators: readonly string[] = [],
): MediaDetails => ({
  availability: 'not_requested',
  cast: [],
  creators,
  genres: [],
  mediaType: 'tv',
  overview: '',
  seasonCount: null,
  title,
  tmdbId,
  year,
});

const labels = (details: readonly MediaDetails[]) =>
  toPickOptions(details).map(option => option.label);

describe('toPickOptions', () => {
  it('labels distinct titles "Title (Year)" with ids from the media type and TMDB id', () => {
    expect(
      toPickOptions([
        movie(438_631, 'Dune', 2021, ['Denis Villeneuve']),
        movie(841, 'Dune', 1984, ['David Lynch']),
        tv(1_910, "Frank Herbert's Dune", 2000, ['John Harrison']),
      ]),
    ).toEqual([
      { id: 'movie:438631', label: 'Dune (2021)' },
      { id: 'movie:841', label: 'Dune (1984)' },
      { id: 'tv:1910', label: "Frank Herbert's Dune (2000)" },
    ]);
  });

  it('marks the TV show when a movie and a show share a title and year', () => {
    expect(
      labels([movie(1, 'Dune', 2000, ['Someone']), tv(2, 'Dune', 2000)]),
    ).toEqual(['Dune (2000)', 'Dune (2000, TV)']);
  });

  it('adds the director when two movies share a title and year', () => {
    expect(
      labels([
        movie(1, 'Dune', 1984, ['David Lynch', 'Alan Smithee']),
        movie(2, 'Dune', 1984, ['Someone Else']),
      ]),
    ).toEqual(['Dune (1984, David Lynch)', 'Dune (1984, Someone Else)']);
  });

  it('adds the creator after TV when two shows share a title and year', () => {
    expect(
      labels([
        tv(1, 'Dune', 2000, ['John Harrison']),
        tv(2, 'Dune', 2000, ['Someone Else']),
      ]),
    ).toEqual([
      'Dune (2000, TV, John Harrison)',
      'Dune (2000, TV, Someone Else)',
    ]);
  });

  it('labels a title with no year by its title alone', () => {
    const [label] = labels([movie(1, 'Dune', null), movie(2, 'Dune', 1984)]);

    expect(label).toBe('Dune');
    expect(label).not.toMatch(/undefined|null|\(\)/u);
  });

  it('marks the TV show in a collision with no year', () => {
    expect(labels([movie(1, 'Dune', null), tv(2, 'Dune', null)])).toEqual([
      'Dune',
      'Dune (TV)',
    ]);
  });

  it('adds the director alone in a collision with no year', () => {
    expect(
      labels([
        movie(1, 'Dune', null, ['David Lynch']),
        movie(2, 'Dune', null, ['Someone Else']),
      ]),
    ).toEqual(['Dune (David Lynch)', 'Dune (Someone Else)']);
  });

  it('leaves a colliding label as it is when the title has no director', () => {
    expect(
      toPickOptions([movie(1, 'Dune', 1984), movie(2, 'Dune', 1984)]),
    ).toEqual([
      { id: 'movie:1', label: 'Dune (1984)' },
      { id: 'movie:2', label: 'Dune (1984)' },
    ]);
  });

  it('keeps the input order', () => {
    expect(
      labels([tv(3, 'C', 2003), movie(1, 'A', 2001), movie(2, 'B', 2002)]),
    ).toEqual(['C (2003)', 'A (2001)', 'B (2002)']);
  });
});
