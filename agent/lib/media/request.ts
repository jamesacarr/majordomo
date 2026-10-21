import { REQUEST_STATUS_BY_CODE, SEERR_TAG } from '../seerr/constants';
import { resolveTagIds } from '../seerr/resolve-tag-ids';
import { ResponseShapeError } from '../seerr/response-shape-error';
import type { Client } from '../seerr/types';
import type { AllowedUser } from '../types';
import { NOT_REQUESTABLE } from './constants';
import { details } from './details';
import type { RequestInput, RequestResult } from './types';

type RequestClient = Pick<
  Client,
  | 'createRequest'
  | 'movie'
  | 'radarrServer'
  | 'radarrServers'
  | 'sonarrServer'
  | 'sonarrServers'
  | 'tv'
>;

const normalise = (title: string): string =>
  title.trim().replace(/\s+/gu, ' ').toLowerCase();

/** The only shape failure that still means "created": Seerr made the request but didn't echo its tags. */
const isMissingTagEcho = (error: unknown): boolean =>
  error instanceof ResponseShapeError &&
  error.issues.every(issue => issue.path[0] === 'tags');

/**
 * Requests a title on Seerr for `requester`, tagged `seerr` and with the
 * requester's own tag (decision 0004). Reads the title from Seerr first and
 * posts nothing when it's already on the server or on its way, when Seerr's
 * title or year differs from the one the person approved (the post goes by
 * `tmdbId`, so this stops a wrong id fetching something else; decision
 * 0006), or when either tag is missing on the default server (decision
 * 0005). A show with no named seasons is requested in full (decision 0007),
 * and `is4k` is never sent (decision 0008).
 *
 * A created request whose answer lacks only its tags is reported as
 * `requested_unconfirmed`. Every other failure propagates, including a 2xx
 * answer that isn't a request at all: Seerr 3.4.1 answers
 * `NoSeasonsAvailableError` with HTTP 202 `{ message, errors }`
 * (`server/routes/request.ts`), and nothing was created.
 */
export const request = async (
  client: RequestClient,
  requester: AllowedUser,
  input: RequestInput,
): Promise<RequestResult> => {
  const { mediaType, tmdbId } = input;
  const { availability, title, year } = await details(client, input);

  if (NOT_REQUESTABLE.has(availability)) {
    return { availability, outcome: 'already_on_server', title, year };
  }

  if (
    normalise(title) !== normalise(input.title) ||
    (input.year != null && input.year !== year)
  ) {
    return { outcome: 'title_mismatch', title, year };
  }

  const { ids, missing } = await resolveTagIds(client, mediaType, [
    SEERR_TAG,
    requester.tag,
  ]);

  if (missing.length > 0) {
    return { missing, outcome: 'missing_tags', title, year };
  }

  try {
    const created = await client.createRequest({
      mediaId: tmdbId,
      mediaType,
      tags: ids,
      ...(mediaType === 'tv' ? { seasons: input.seasons ?? 'all' } : {}),
    });

    return {
      outcome: 'requested',
      requestId: created.id,
      status: REQUEST_STATUS_BY_CODE[created.status] ?? 'unknown',
      tags: created.tags,
      title,
      year,
    };
  } catch (error) {
    if (isMissingTagEcho(error)) {
      return { outcome: 'requested_unconfirmed', title, year };
    }

    throw error;
  }
};
