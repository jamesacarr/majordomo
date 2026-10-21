import { describe, expect, it } from 'vitest';

import type {
  CastCredit,
  CombinedCredits,
  CrewCredit,
  PersonResult,
} from '../seerr/types';
import { MAX_CANDIDATES, MIN_TV_EPISODES } from './constants';
import { findPersonCredits } from './find-person-credits';

const person = (id: number, name: string): PersonResult => ({
  id,
  mediaType: 'person',
  name,
});

const cast = (
  id: number,
  voteCount: number | null,
  overrides: Partial<Omit<CastCredit, 'mediaType'>> = {},
): CastCredit => ({
  character: `Role ${id}`,
  id,
  mediaType: 'movie',
  title: `Film ${id}`,
  voteCount,
  ...overrides,
});

const tvCast = (
  id: number,
  voteCount: number,
  overrides: Partial<Omit<CastCredit, 'mediaType'>> = {},
): CastCredit => ({
  character: `Role ${id}`,
  id,
  mediaType: 'tv',
  name: `Show ${id}`,
  voteCount,
  ...overrides,
});

const crew = (id: number, voteCount: number, job: string): CrewCredit => ({
  department: job === 'Director' ? 'Directing' : 'Production',
  id,
  job,
  mediaType: 'movie',
  title: `Film ${id}`,
  voteCount,
});

const tvCrew = (
  id: number,
  voteCount: number,
  overrides: Partial<Omit<CrewCredit, 'mediaType'>> = {},
): CrewCredit => ({
  department: 'Directing',
  id,
  job: 'Director',
  mediaType: 'tv',
  name: `Show ${id}`,
  voteCount,
  ...overrides,
});

/** A Seerr client whose search finds `people` and whose credits for any of them are `credits`. */
const clientWith = (
  people: readonly PersonResult[],
  credits: Partial<CombinedCredits> = {},
) => {
  const creditCalls: number[] = [];

  return {
    creditCalls,
    personCredits: (id: number) => {
      creditCalls.push(id);

      return Promise.resolve({ cast: [], crew: [], ...credits });
    },
    searchPeople: (_query: string) => Promise.resolve({ results: [...people] }),
  };
};

const brad = person(287, 'Brad Pitt');

const ids = (result: Awaited<ReturnType<typeof findPersonCredits>>) =>
  result.outcome === 'found' ? result.credits.map(c => c.tmdbId) : [];

describe('findPersonCredits', () => {
  it('reports no_person without fetching credits when the search finds nobody', async () => {
    const client = clientWith([]);

    const result = await findPersonCredits(client, { name: 'Zorblax Quimby' });

    expect(result).toEqual({ outcome: 'no_person' });
    expect(client.creditCalls).toEqual([]);
  });

  it("uses the first person found and returns that person's name", async () => {
    const client = clientWith([brad, person(9, 'Brad Pitt Sr')], {
      cast: [cast(550, 100)],
    });

    const result = await findPersonCredits(client, { name: 'brad pitt' });

    expect(client.creditCalls).toEqual([287]);
    expect(result).toMatchObject({ name: 'Brad Pitt', outcome: 'found' });
  });

  it(`drops TV cast credits under ${MIN_TV_EPISODES} episodes, keeping longer runs and unknown counts`, async () => {
    const client = clientWith([brad], {
      cast: [
        tvCast(1668, 300, { episodeCount: 1 }),
        tvCast(2, 200, { episodeCount: 10 }),
        tvCast(3, 100),
      ],
    });

    expect(ids(await findPersonCredits(client, { name: 'Brad Pitt' }))).toEqual(
      [2, 3],
    );
  });

  it(`drops TV directing credits under ${MIN_TV_EPISODES} episodes, keeping longer runs and unknown counts`, async () => {
    const client = clientWith([brad], {
      crew: [
        tvCrew(1, 300, { episodeCount: 1 }),
        tvCrew(2, 200, { episodeCount: 10 }),
        tvCrew(3, 100),
      ],
    });

    expect(
      ids(
        await findPersonCredits(client, {
          name: 'Brad Pitt',
          role: 'directing',
        }),
      ),
    ).toEqual([2, 3]);
  });

  it('acting returns cast credits only', async () => {
    const client = clientWith([brad], {
      cast: [cast(1, 100)],
      crew: [crew(2, 200, 'Director')],
    });

    expect(
      ids(
        await findPersonCredits(client, { name: 'Brad Pitt', role: 'acting' }),
      ),
    ).toEqual([1]);
  });

  it('directing returns only crew credits with the Director job', async () => {
    const client = clientWith([brad], {
      cast: [cast(1, 400)],
      crew: [
        crew(2, 300, 'Producer'),
        crew(3, 200, 'Director'),
        crew(4, 100, 'Writer'),
      ],
    });

    expect(
      ids(
        await findPersonCredits(client, {
          name: 'Brad Pitt',
          role: 'directing',
        }),
      ),
    ).toEqual([3]);
  });

  it('with no role returns acting and directing credits but not producing or writing', async () => {
    const client = clientWith([brad], {
      cast: [cast(1, 400)],
      crew: [
        crew(2, 300, 'Producer'),
        crew(3, 200, 'Director'),
        crew(4, 100, 'Writer'),
      ],
    });

    expect(ids(await findPersonCredits(client, { name: 'Brad Pitt' }))).toEqual(
      [1, 3],
    );
  });

  it('leaves out appearances as themselves but keeps characters that start with Self', async () => {
    const client = clientWith([brad], {
      cast: [
        tvCast(1, 600, { character: 'Self' }),
        tvCast(2, 500, { character: 'Himself' }),
        tvCast(3, 400, { character: 'Self - Guest' }),
        cast(4, 300, { character: 'Selfridge' }),
      ],
    });

    expect(ids(await findPersonCredits(client, { name: 'Brad Pitt' }))).toEqual(
      [4],
    );
  });

  it('keeps only the given media type', async () => {
    const client = clientWith([brad], {
      cast: [cast(1, 200), tvCast(2, 100)],
    });

    const result = await findPersonCredits(client, {
      mediaType: 'tv',
      name: 'Brad Pitt',
    });

    expect(result).toMatchObject({ credits: [{ mediaType: 'tv', tmdbId: 2 }] });
  });

  it('lists a title credited more than once a single time, keeping movies and shows that share an id apart', async () => {
    const client = clientWith([brad], {
      cast: [cast(13223, 300), tvCast(13223, 200)],
      crew: [crew(13223, 300, 'Director')],
    });

    const result = await findPersonCredits(client, { name: 'Brad Pitt' });

    expect(
      result.outcome === 'found' &&
        result.credits.map(c => [c.mediaType, c.tmdbId]),
    ).toEqual([
      ['movie', 13223],
      ['tv', 13223],
    ]);
  });

  it('ranks credits by vote count, highest first, with missing counts last', async () => {
    const client = clientWith([brad], {
      cast: [cast(1, null), cast(2, 50), cast(3, 900)],
      crew: [crew(4, 300, 'Director')],
    });

    expect(ids(await findPersonCredits(client, { name: 'Brad Pitt' }))).toEqual(
      [3, 4, 2, 1],
    );
  });

  it(`returns at most ${MAX_CANDIDATES} credits`, async () => {
    const many = Array.from({ length: MAX_CANDIDATES + 3 }, (_, i) =>
      cast(i + 1, 100),
    );

    const result = await findPersonCredits(clientWith([brad], { cast: many }), {
      name: 'Brad Pitt',
    });

    expect(ids(result)).toHaveLength(MAX_CANDIDATES);
  });

  it("gives each credit its availability from Seerr's media record", async () => {
    const client = clientWith([brad], {
      cast: [cast(550, 100, { mediaInfo: { status: 5, tmdbId: 550 } })],
    });

    expect(
      await findPersonCredits(client, { name: 'Brad Pitt' }),
    ).toMatchObject({ credits: [{ availability: 'available', tmdbId: 550 }] });
  });

  it('reports the person found with no credits when none match', async () => {
    const client = clientWith([brad], { cast: [cast(1, 100)] });

    expect(
      await findPersonCredits(client, { name: 'Brad Pitt', role: 'directing' }),
    ).toEqual({ credits: [], name: 'Brad Pitt', outcome: 'found' });
  });
});
