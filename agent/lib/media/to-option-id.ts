import type { MediaRef } from './types';

/** The `pick_media` option id for a title, such as `movie:841`. The prefix keeps a movie and a show with the same TMDB id apart. */
export const toOptionId = ({ mediaType, tmdbId }: MediaRef): string =>
  `${mediaType}:${tmdbId}`;
