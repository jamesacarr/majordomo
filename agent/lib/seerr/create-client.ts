import { z } from 'zod';

import { ApiError } from './api-error';
import { REQUEST_TIMEOUT_MS } from './constants';
import { ResponseShapeError } from './response-shape-error';
import {
  combinedCreditsSchema,
  mediaRequestSchema,
  movieDetailsSchema,
  moviePageSchema,
  personSearchPageSchema,
  requestPageSchema,
  searchPageSchema,
  serviceServerDetailsSchema,
  serviceServersSchema,
  tvDetailsSchema,
  tvPageSchema,
} from './schemas';
import type { Client } from './types';
import { UnknownUserError } from './unknown-user-error';

type Query = Readonly<Record<string, string | number>>;

/**
 * Seerr validates requests with express-openapi-validator, which answers 400
 * to a raw query value containing any RFC 3986 reserved character.
 * `encodeURIComponent` escapes all of them except `!`, `'`, `(`, `)` and `*`,
 * so those are escaped here.
 */
const encode = (value: string | number): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/gu,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const toQueryString = (query: Query): string => {
  const pairs = Object.entries(query).map(
    ([key, value]) => `${key}=${encode(value)}`,
  );

  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
};

/** `AbortSignal.timeout` rejects with a `DOMException` named `TimeoutError`. */
const isTimeout = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const stringField = (body: unknown, key: string): string | null => {
  if (typeof body !== 'object' || body === null || !(key in body)) {
    return null;
  }

  const value: unknown = (body as Record<string, unknown>)[key];

  return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * Turns a non-2xx answer into the error to throw. Seerr's error handler
 * answers `{ message, errors }`; anything else falls back to the status text.
 *
 * Seerr's `isAuthenticated` middleware answers 403 `{ status, error }`, with no
 * `message`, both when `X-API-User` names no user and when the user lacks the
 * route's permission (`server/middleware/auth.ts`). Every route this client
 * calls mounts `isAuthenticated()` with no permission
 * (`server/routes/index.ts`), so here it can only mean "no such user". A call
 * to a permission-gated route (e.g. `/settings`) would need this revisited.
 */
const toError = async (
  response: Response,
  seerrUserId: number,
): Promise<Error> => {
  const body = await readJson(response);
  const message = stringField(body, 'message');

  if (
    response.status === 403 &&
    message === null &&
    stringField(body, 'error') !== null
  ) {
    return new UnknownUserError(seerrUserId);
  }

  return new ApiError(
    response.status,
    message ?? (response.statusText || 'no error message'),
  );
};

/**
 * Builds a client for the Seerr v1 API at `baseUrl` (the instance root, without
 * `/api/v1`), authenticated with the admin `X-Api-Key` and acting as Seerr
 * user `seerrUserId` through `X-API-User`, so Seerr applies that person's
 * permissions, auto-approval and quota and records them as the requester.
 * Non-2xx responses throw an `ApiError`, except an unknown `seerrUserId`,
 * which throws an `UnknownUserError`. Every answer is parsed with its schema from
 * `schemas.ts`, and one that does not match throws a `ResponseShapeError`
 * naming the path and the field, so a Seerr upgrade that renames a field
 * fails at the call rather than as an `undefined` further on. A call that
 * takes longer than `timeoutMs`, from sending the request to reading the
 * whole body, is aborted and throws. Seerr sits behind a tunnel that can
 * stall, and a hung call would hold the agent's turn. Pass `fetch` to
 * substitute the transport in tests.
 */
export const createClient = ({
  apiKey,
  baseUrl,
  fetch = globalThis.fetch,
  seerrUserId,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly seerrUserId: number;
  readonly timeoutMs?: number;
}): Client => {
  const root = `${baseUrl.replace(/\/+$/u, '')}/api/v1`;

  const call = async <T extends z.ZodType>(
    path: string,
    schema: T,
    {
      body,
      query = {},
    }: { readonly body?: unknown; readonly query?: Query } = {},
  ): Promise<z.output<T>> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-API-User': String(seerrUserId),
      'X-Api-Key': apiKey,
    };
    const init: RequestInit = {
      headers,
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.method = 'POST';
      init.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(
        `${root}${path}${toQueryString(query)}`,
        init,
      );

      if (!response.ok) {
        throw await toError(response, seerrUserId);
      }

      const parsed = schema.safeParse(await response.json());

      if (!parsed.success) {
        throw new ResponseShapeError(
          `Seerr's answer to ${path} did not have the expected shape:\n${z.prettifyError(parsed.error)}`,
          parsed.error,
        );
      }

      return parsed.data;
    } catch (error) {
      if (isTimeout(error)) {
        throw new Error(`Seerr did not answer ${path} within ${timeoutMs} ms`, {
          cause: error,
        });
      }

      throw error;
    }
  };

  return {
    createRequest: body => call('/request', mediaRequestSchema, { body }),
    listRequests: params =>
      call('/request', requestPageSchema, { query: { ...params } }),
    movie: id => call(`/movie/${id}`, movieDetailsSchema),
    movieRecommendations: id =>
      call(`/movie/${id}/recommendations`, moviePageSchema),
    movieSimilar: id => call(`/movie/${id}/similar`, moviePageSchema),
    personCredits: id =>
      call(`/person/${id}/combined_credits`, combinedCreditsSchema),
    radarrServer: id =>
      call(`/service/radarr/${id}`, serviceServerDetailsSchema),
    radarrServers: () => call('/service/radarr', serviceServersSchema),
    search: query => call('/search', searchPageSchema, { query: { query } }),
    searchPeople: query =>
      call('/search', personSearchPageSchema, { query: { query } }),
    sonarrServer: id =>
      call(`/service/sonarr/${id}`, serviceServerDetailsSchema),
    sonarrServers: () => call('/service/sonarr', serviceServersSchema),
    tv: id => call(`/tv/${id}`, tvDetailsSchema),
    tvRecommendations: id => call(`/tv/${id}/recommendations`, tvPageSchema),
    tvSimilar: id => call(`/tv/${id}/similar`, tvPageSchema),
  };
};
