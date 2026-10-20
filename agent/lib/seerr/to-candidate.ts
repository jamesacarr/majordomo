import { AVAILABILITY_BY_STATUS, OVERVIEW_MAX_LENGTH } from './constants';
import type {
  Availability,
  MediaCandidate,
  MediaInfo,
  SearchResult,
} from './types';

const toYear = (date: string | undefined): number | null => {
  const year = Number.parseInt(date?.slice(0, 4) ?? '', 10);
  return Number.isNaN(year) ? null : year;
};

const toAvailability = (mediaInfo: MediaInfo | undefined): Availability =>
  mediaInfo === undefined
    ? 'not_requested'
    : (AVAILABILITY_BY_STATUS[mediaInfo.status] ?? 'unknown');

const truncate = (text: string | undefined): string => {
  const trimmed = text?.trim() ?? '';
  return trimmed.length <= OVERVIEW_MAX_LENGTH
    ? trimmed
    : `${trimmed.slice(0, OVERVIEW_MAX_LENGTH - 1).trimEnd()}…`;
};

/**
 * Maps a Seerr search or recommendation result to the candidate the model sees.
 * Returns `null` for people, which cannot be requested. A result with no
 * `mediaInfo` has never been requested or synced, so it is `not_requested`.
 */
export const toCandidate = (result: SearchResult): MediaCandidate | null => {
  switch (result.mediaType) {
    case 'movie':
      return {
        availability: toAvailability(result.mediaInfo),
        mediaType: 'movie',
        overview: truncate(result.overview),
        title: result.title,
        tmdbId: result.id,
        year: toYear(result.releaseDate),
      };
    case 'tv':
      return {
        availability: toAvailability(result.mediaInfo),
        mediaType: 'tv',
        overview: truncate(result.overview),
        title: result.name,
        tmdbId: result.id,
        year: toYear(result.firstAirDate),
      };
    default:
      return null;
  }
};
