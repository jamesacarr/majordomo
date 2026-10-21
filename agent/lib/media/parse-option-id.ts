import type { MediaRef } from './types';

const OPTION_ID = /^(movie|tv):([1-9]\d*)$/u;

/** Reads a `pick_media` option id back into a title, the inverse of `toOptionId`. Anything else is `undefined`. */
export const parseOptionId = (id: string): MediaRef | undefined => {
  const match = OPTION_ID.exec(id);

  if (match === null) {
    return undefined;
  }

  return {
    mediaType: match[1] === 'movie' ? 'movie' : 'tv',
    tmdbId: Number(match[2]),
  };
};
