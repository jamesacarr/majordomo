import { toCandidate } from '../seerr/to-candidate';
import type { Client, MovieDetails, TvDetails } from '../seerr/types';
import { TMDB_POSTER_BASE_URL } from './constants';
import type { MediaRef, PosterCard } from './types';

const toPosterCard = (
  found:
    | (MovieDetails & { mediaType: 'movie' })
    | (TvDetails & { mediaType: 'tv' }),
): PosterCard => {
  const { overview, title, year } = toCandidate(found);
  const path = found.posterPath?.trim();

  return {
    overview,
    posterUrl: path ? `${TMDB_POSTER_BASE_URL}${path}` : null,
    title,
    year,
  };
};

/** Fetches what a Telegram poster card shows for one title (decision 0023). */
export const posterCard = async (
  client: Pick<Client, 'movie' | 'tv'>,
  { mediaType, tmdbId }: MediaRef,
): Promise<PosterCard> =>
  mediaType === 'movie'
    ? toPosterCard({ ...(await client.movie(tmdbId)), mediaType: 'movie' })
    : toPosterCard({ ...(await client.tv(tmdbId)), mediaType: 'tv' });
