import { describe, expect, it } from 'vitest';

import type { MovieResult, SearchPage, TvResult } from '../seerr/types';
import { MAX_CANDIDATES } from './constants';
import { search } from './search';

const movie = (id: number, title: string): MovieResult => ({
  id,
  mediaType: 'movie',
  releaseDate: '2021-09-15',
  title,
});

const tv = (id: number, name: string): TvResult => ({
  firstAirDate: '2000-12-03',
  id,
  mediaType: 'tv',
  name,
});

/** A Seerr client whose search answers every query with `results`. */
const clientAnswering = (results: SearchPage['results']) => ({
  search: (_query: string) => Promise.resolve({ results }),
});

describe('search', () => {
  it("returns movie and TV candidates in Seerr's order", async () => {
    const client = clientAnswering([
      movie(438_631, 'Dune'),
      tv(1_910, "Frank Herbert's Dune"),
    ]);

    const candidates = await search(client, { query: 'dune' });

    expect(candidates.map(c => [c.mediaType, c.tmdbId, c.title])).toEqual([
      ['movie', 438_631, 'Dune'],
      ['tv', 1_910, "Frank Herbert's Dune"],
    ]);
  });

  it('keeps only the requested media type', async () => {
    const client = clientAnswering([
      movie(438_631, 'Dune'),
      tv(1_910, "Frank Herbert's Dune"),
    ]);

    const candidates = await search(client, { mediaType: 'tv', query: 'dune' });

    expect(candidates.map(c => c.tmdbId)).toEqual([1_910]);
  });

  it(`returns at most ${MAX_CANDIDATES} candidates, the most relevant first`, async () => {
    const results = Array.from({ length: MAX_CANDIDATES + 3 }, (_, i) =>
      movie(i + 1, `Film ${i + 1}`),
    );

    const candidates = await search(clientAnswering(results), {
      query: 'film',
    });

    expect(candidates).toHaveLength(MAX_CANDIDATES);
    expect(candidates[0]?.tmdbId).toBe(1);
  });

  it('passes the query to Seerr unchanged', async () => {
    const queries: string[] = [];
    const client = {
      search: (query: string) => {
        queries.push(query);
        return Promise.resolve({ results: [] });
      },
    };

    await search(client, { query: "Ocean's Eleven" });

    expect(queries).toEqual(["Ocean's Eleven"]);
  });
});
