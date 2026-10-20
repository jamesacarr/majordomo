import { toCandidate } from '../seerr/to-candidate';
import type { Client, MovieDetails, TvDetails } from '../seerr/types';
import { MAX_CAST } from './constants';
import type { MediaDetails, MediaRef } from './types';

type Credits = MovieDetails['credits'];

const names = (
  people: readonly { readonly name: string }[] | null | undefined,
) => people?.map(person => person.name) ?? [];

const topCast = (credits: Credits): string[] =>
  (credits?.cast ?? [])
    .slice(0, MAX_CAST)
    .map(({ character, name }) =>
      character ? `${name} as ${character}` : name,
    );

const movieDetails = (movie: MovieDetails): MediaDetails => ({
  ...toCandidate({ ...movie, mediaType: 'movie' }),
  cast: topCast(movie.credits),
  directors: names(
    movie.credits?.crew?.filter(person => person.job === 'Director'),
  ),
  genres: names(movie.genres),
  mediaType: 'movie',
  runtimeMinutes: movie.runtime || null,
});

const tvDetails = (show: TvDetails): MediaDetails => ({
  ...toCandidate({ ...show, mediaType: 'tv' }),
  cast: topCast(show.credits),
  creators: names(show.createdBy),
  genres: names(show.genres),
  mediaType: 'tv',
  seasonCount: show.numberOfSeasons ?? null,
});

/**
 * Fetches what tells one title from another with the same name: genres,
 * top-billed cast, director or creators, and runtime or season count, beside
 * the fields every candidate carries. TMDB reports an unknown runtime as 0,
 * so 0 becomes `null`.
 */
export const details = async (
  client: Pick<Client, 'movie' | 'tv'>,
  { mediaType, tmdbId }: MediaRef,
): Promise<MediaDetails> =>
  mediaType === 'movie'
    ? movieDetails(await client.movie(tmdbId))
    : tvDetails(await client.tv(tmdbId));
