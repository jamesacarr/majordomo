import type { Client, MediaRequest, MediaType } from '../seerr/types';
import { MAX_REQUEST_ROWS } from './constants';
import { details } from './details';
import { toRequestProgress } from './to-request-progress';
import type {
  ListRequestsInput,
  ListRequestsResult,
  MediaDetails,
  RequestRow,
} from './types';

type ListClient = Pick<Client, 'listRequests' | 'movie' | 'tv'>;

/** A request with the media type and `tmdbId` a title fetch needs. */
interface TitledRequest {
  readonly mediaType: MediaType;
  readonly request: MediaRequest;
  readonly tmdbId: number;
}

/** `type` wins over `media.mediaType`; `null` when neither is set or there's no `tmdbId`. */
const toTitledRequest = (request: MediaRequest): TitledRequest | null => {
  const mediaType = request.type ?? request.media?.mediaType;
  const tmdbId = request.media?.tmdbId;

  return mediaType == null || tmdbId == null
    ? null
    : { mediaType, request, tmdbId };
};

/** Keeps the first, so newest, request per title. */
const newestPerTitle = (
  requests: readonly TitledRequest[],
): TitledRequest[] => {
  const seen = new Set<string>();

  return requests.filter(({ mediaType, tmdbId }) => {
    const key = `${mediaType}:${tmdbId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
};

const toRow = (
  { mediaType, request }: TitledRequest,
  fetched: PromiseSettledResult<MediaDetails> | undefined,
): RequestRow => {
  const { title, year } =
    fetched?.status === 'fulfilled'
      ? fetched.value
      : { title: null, year: null };

  return {
    mediaType,
    requestedOn: request.createdAt?.slice(0, 10) ?? null,
    status: toRequestProgress(request),
    title,
    year,
  };
};

/**
 * Lists Seerr user `seerrUserId`'s own requests, newest first, one row per
 * title with its combined status (`toRequestProgress`). Reads Seerr's
 * `MAX_REQUEST_ROWS` newest requests by that user, narrowed by Seerr's own
 * `filter` when given (decision 0026). `requestedBy` is always sent: Seerr
 * returns everyone's requests to a user with `MANAGE_REQUESTS` or
 * `REQUEST_VIEW` otherwise. A show requested in season batches has several
 * requests but one row, so the list can be shorter than `MAX_REQUEST_ROWS`.
 * List errors propagate. A failed title fetch gives that row a `null` title
 * and year rather than failing the list.
 */
export const listRequests = async (
  client: ListClient,
  seerrUserId: number,
  input: ListRequestsInput,
): Promise<ListRequestsResult> => {
  const page = await client.listRequests({
    ...(input.filter === undefined ? {} : { filter: input.filter }),
    requestedBy: seerrUserId,
    sort: 'added',
    take: MAX_REQUEST_ROWS,
  });
  const kept = newestPerTitle(
    page.results.map(toTitledRequest).filter(row => row !== null),
  );
  const fetched = await Promise.allSettled(
    kept.map(({ mediaType, tmdbId }) => details(client, { mediaType, tmdbId })),
  );

  return { requests: kept.map((row, i) => toRow(row, fetched[i])) };
};
