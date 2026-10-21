import { describe, expect, it } from 'vitest';

import { labelCandidates } from './label-candidates';
import type { MediaDetails } from './types';

const movie = (tmdbId: number, year: number): MediaDetails => ({
  availability: 'not_requested',
  cast: [],
  directors: [],
  genres: [],
  mediaType: 'movie',
  overview: '',
  runtimeMinutes: null,
  title: 'Dune',
  tmdbId,
  year,
});

describe('labelCandidates', () => {
  it('pairs each candidate with its label, in input order', () => {
    const later = movie(438_631, 2021);
    const earlier = movie(841, 1984);

    expect(labelCandidates([later, earlier])).toEqual([
      { item: later, label: 'Dune (2021)' },
      { item: earlier, label: 'Dune (1984)' },
    ]);
  });
});
