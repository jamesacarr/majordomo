import { resolveTagIds } from '../seerr/resolve-tag-ids';
import type { Client, MediaRequest, MediaType } from '../seerr/types';
import type { AllowedUser } from '../types';
import { MAX_REQUEST_ROWS, REQUEST_SCAN_SIZE } from './constants';
import { details } from './details';
import { toRequestProgress } from './to-request-progress';
import type {
  ListRequestsInput,
  ListRequestsResult,
  MediaDetails,
  RequestRow,
  RequestServer,
} from './types';

type ListClient = Pick<
  Client,
  | 'listRequests'
  | 'movie'
  | 'radarrServer'
  | 'radarrServers'
  | 'sonarrServer'
  | 'sonarrServers'
  | 'tv'
>;

/** A request with the media type and `tmdbId` a title fetch needs. */
interface TitledRequest {
  readonly mediaType: MediaType;
  readonly request: MediaRequest;
  readonly tmdbId: number;
}

const SERVER_BY_TYPE: Readonly<Record<MediaType, RequestServer>> = {
  movie: 'Radarr',
  tv: 'Sonarr',
};

/** The requester's tag id on each default server; `undefined` where the tag is missing. */
const requesterTagIds = async (
  client: ListClient,
  tag: string,
): Promise<Readonly<Record<MediaType, number | undefined>>> => {
  const [movie, tv] = await Promise.all([
    resolveTagIds(client, 'movie', [tag]),
    resolveTagIds(client, 'tv', [tag]),
  ]);

  return { movie: movie.ids[0], tv: tv.ids[0] };
};

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
 * Lists recent Seerr requests, newest first, one row per title with its
 * combined status (`toRequestProgress`). Always reads Seerr's
 * `REQUEST_SCAN_SIZE` newest requests, narrowed by Seerr's own `filter` when
 * given, and returns at most `MAX_REQUEST_ROWS`.
 *
 * With `mine`, keeps only requests carrying the requester's tag id for their
 * media type: Seerr has no tag filter, and every bot request is Seerr user 1
 * (decision 0004). `getRequester` runs only then, so a session without an
 * identity can still list everything. A server with no tag for the requester
 * contributes no rows and is named in `tagMissingOn`, never falling back to
 * everyone's requests. Tag and list errors propagate. A failed title fetch
 * gives that row a `null` title and year rather than failing the list.
 */
export const listRequests = async (
  client: ListClient,
  input: ListRequestsInput,
  getRequester: () => AllowedUser,
): Promise<ListRequestsResult> => {
  const tagIds = input.mine
    ? await requesterTagIds(client, getRequester().tag)
    : null;
  const tagMissingOn =
    tagIds === null
      ? []
      : (['movie', 'tv'] as const)
          .filter(mediaType => tagIds[mediaType] === undefined)
          .map(mediaType => SERVER_BY_TYPE[mediaType]);
  const missingField = tagMissingOn.length > 0 ? { tagMissingOn } : {};

  if (tagMissingOn.length === 2) {
    return { requests: [], ...missingField };
  }

  const page = await client.listRequests({
    ...(input.filter === undefined ? {} : { filter: input.filter }),
    sort: 'added',
    take: REQUEST_SCAN_SIZE,
  });

  const matching = page.results
    .map(toTitledRequest)
    .filter(row => row !== null)
    .filter(({ mediaType, request }) => {
      if (tagIds === null) {
        return true;
      }

      const id = tagIds[mediaType];

      return id !== undefined && (request.tags ?? []).includes(id);
    });
  const kept = newestPerTitle(matching).slice(0, MAX_REQUEST_ROWS);
  const fetched = await Promise.allSettled(
    kept.map(({ mediaType, tmdbId }) => details(client, { mediaType, tmdbId })),
  );
  const requests = kept.map((row, i) => toRow(row, fetched[i]));

  return { requests, ...missingField };
};
