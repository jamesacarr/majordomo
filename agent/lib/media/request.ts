import { ApiError } from '../seerr/api-error';
import { REQUEST_STATUS_BY_CODE } from '../seerr/constants';
import type { Client } from '../seerr/types';
import { NOT_REQUESTABLE } from './constants';
import { details } from './details';
import type { RequestInput, RequestResult } from './types';

type RequestClient = Pick<Client, 'createRequest' | 'movie' | 'tv'>;

const normalise = (title: string): string =>
  title.trim().replace(/\s+/gu, ' ').toLowerCase();

/**
 * Requests a title on Seerr as the client's Seerr user, so Seerr applies that
 * person's permissions, auto-approval and quota (decision 0025). Reads the
 * title from Seerr first and posts nothing when it's already on the server or
 * on its way, or when Seerr's title or year differs from the one the person
 * approved (the post goes by `tmdbId`, so this stops a wrong id fetching
 * something else; decision 0006). A show with no named seasons is requested
 * in full (decision 0007), and `is4k` is never sent (decision 0008).
 *
 * A 403 `ApiError` from the post is Seerr refusing this person (no
 * permission for that kind of title, quota used up, or blocklisted) and is
 * reported as `refused` with Seerr's message. Every other failure propagates,
 * including an `UnknownUserError` and a 2xx answer that isn't a request at
 * all: Seerr answers `NoSeasonsAvailableError` with HTTP 202
 * `{ message, errors }` (`server/routes/request.ts`), and nothing was created.
 */
export const request = async (
  client: RequestClient,
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

  try {
    const created = await client.createRequest({
      mediaId: tmdbId,
      mediaType,
      ...(mediaType === 'tv' ? { seasons: input.seasons ?? 'all' } : {}),
    });

    return {
      outcome: 'requested',
      requestId: created.id,
      status: REQUEST_STATUS_BY_CODE[created.status] ?? 'unknown',
      title,
      year,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { message: error.seerrMessage, outcome: 'refused', title, year };
    }

    throw error;
  }
};
