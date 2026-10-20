import { toCandidate } from '../seerr/to-candidate';
import type {
  Client,
  MediaCandidate,
  MovieResult,
  TvResult,
} from '../seerr/types';
import { MAX_CANDIDATES, MIN_VOTE_COUNT } from './constants';
import type { MediaRef } from './types';

type RecommendationClient = Pick<
  Client,
  'movieRecommendations' | 'movieSimilar' | 'tvRecommendations' | 'tvSimilar'
>;

const fetchResults = async (
  client: RecommendationClient,
  { mediaType, tmdbId }: MediaRef,
): Promise<readonly (MovieResult | TvResult)[]> => {
  const pages =
    mediaType === 'movie'
      ? await Promise.all([
          client.movieRecommendations(tmdbId),
          client.movieSimilar(tmdbId),
        ])
      : await Promise.all([
          client.tvRecommendations(tmdbId),
          client.tvSimilar(tmdbId),
        ]);

  return pages.flatMap(
    (page): readonly (MovieResult | TvResult)[] => page.results,
  );
};

const isWellVoted = (result: MovieResult | TvResult): boolean =>
  (result.voteCount ?? 0) >= MIN_VOTE_COUNT;

/**
 * Titles like the given one, from TMDB's recommendations and similar lists
 * merged and de-duplicated by TMDB id, without the title itself. Ranked by
 * vote average, with every title under `MIN_VOTE_COUNT` votes after every
 * title over it, rather than dropped, so an obscure title still gets
 * suggestions. Returns at most `limit`, capped at `MAX_CANDIDATES`.
 */
export const recommend = async (
  client: RecommendationClient,
  {
    limit = MAX_CANDIDATES,
    ...ref
  }: MediaRef & { readonly limit?: number | undefined },
): Promise<MediaCandidate[]> => {
  const byId = new Map<number, MovieResult | TvResult>();

  for (const result of await fetchResults(client, ref)) {
    if (result.id !== ref.tmdbId && !byId.has(result.id)) {
      byId.set(result.id, result);
    }
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        Number(isWellVoted(b)) - Number(isWellVoted(a)) ||
        (b.voteAverage ?? 0) - (a.voteAverage ?? 0),
    )
    .slice(0, Math.min(limit, MAX_CANDIDATES))
    .map(toCandidate);
};
