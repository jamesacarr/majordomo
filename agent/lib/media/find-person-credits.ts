import { toCandidate } from '../seerr/to-candidate';
import type { CastCredit, Client, CrewCredit, MediaType } from '../seerr/types';
import { MAX_CANDIDATES, MIN_TV_EPISODES, SELF_APPEARANCE } from './constants';
import type { PersonCredits, PersonRole } from './types';

/** A TV credit for too few episodes to rank among films: a guest spot or a one-off episode directed. */
const isBriefTv = (credit: CastCredit | CrewCredit): boolean =>
  credit.mediaType === 'tv' &&
  credit.episodeCount != null &&
  credit.episodeCount < MIN_TV_EPISODES;

/** An appearance as themselves, or a TV guest spot. */
const isMinorCast = (credit: CastCredit): boolean =>
  SELF_APPEARANCE.test(credit.character ?? '') || isBriefTv(credit);

const isDirecting = (credit: CrewCredit): boolean =>
  credit.job === 'Director' && !isBriefTv(credit);

/**
 * A person's titles, by name: the first person Seerr's search finds, then
 * their acting credits, directing credits, or both when `role` is omitted.
 * Producing, writing and other crew jobs, appearances as themselves and
 * TV credits under `MIN_TV_EPISODES` episodes are left out. De-duplicated by
 * media type and TMDB id, ranked by vote count, and capped at
 * `MAX_CANDIDATES`.
 */
export const findPersonCredits = async (
  client: Pick<Client, 'personCredits' | 'searchPeople'>,
  {
    mediaType,
    name,
    role,
  }: {
    readonly mediaType?: MediaType | undefined;
    readonly name: string;
    readonly role?: PersonRole | undefined;
  },
): Promise<PersonCredits> => {
  const [person] = (await client.searchPeople(name)).results;

  if (person === undefined) {
    return { outcome: 'no_person' };
  }

  const { cast, crew } = await client.personCredits(person.id);
  const pool = [
    ...(role === 'directing' ? [] : cast.filter(c => !isMinorCast(c))),
    ...(role === 'acting' ? [] : crew.filter(isDirecting)),
  ];
  const byKey = new Map<string, CastCredit | CrewCredit>();

  for (const credit of pool) {
    const key = `${credit.mediaType}:${credit.id}`;

    if (
      (mediaType === undefined || credit.mediaType === mediaType) &&
      !byKey.has(key)
    ) {
      byKey.set(key, credit);
    }
  }

  const credits = [...byKey.values()]
    .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
    .slice(0, MAX_CANDIDATES)
    .map(toCandidate);

  return { credits, name: person.name, outcome: 'found' };
};
