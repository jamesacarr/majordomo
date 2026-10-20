import { toCandidate } from '../seerr/to-candidate';
import type { Client, MediaCandidate, MediaType } from '../seerr/types';
import { MAX_CANDIDATES } from './constants';

/**
 * Searches Seerr for movies and TV shows matching `query`, in Seerr's
 * relevance order, optionally keeping only one media type. People and
 * collections never appear; the client drops them.
 */
export const search = async (
  client: Pick<Client, 'search'>,
  {
    mediaType,
    query,
  }: { readonly mediaType?: MediaType | undefined; readonly query: string },
): Promise<MediaCandidate[]> => {
  const { results } = await client.search(query);

  return results
    .filter(result => mediaType === undefined || result.mediaType === mediaType)
    .slice(0, MAX_CANDIDATES)
    .map(toCandidate);
};
