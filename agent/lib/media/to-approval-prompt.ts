import type { RequestInput } from './types';

/** "all seasons", "season 2", "seasons 1 and 2" or "seasons 1, 2 and 4". */
const describeSeasons = (seasons: RequestInput['seasons']): string => {
  if (seasons === undefined || seasons === 'all') {
    return 'all seasons';
  }

  if (seasons.length === 1) {
    return `season ${seasons[0]}`;
  }

  return `seasons ${seasons.slice(0, -1).join(', ')} and ${seasons.at(-1)}`;
};

/**
 * The question eve shows the person before `request_media` runs:
 * `Request Title (Year)?` for a movie, and the same with the seasons named
 * for a TV show (decision 0007). The title passes through as given; escaping
 * it is the channel's job.
 */
export const toApprovalPrompt = ({
  mediaType,
  seasons,
  title,
  year,
}: RequestInput): string => {
  const name = year == null ? title : `${title} (${year})`;

  return mediaType === 'movie'
    ? `Request ${name}?`
    : `Request ${name}, ${describeSeasons(seasons)}?`;
};
