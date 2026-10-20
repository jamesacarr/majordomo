import { ApiError } from './api-error';
import { REQUEST_TIMEOUT_MS } from './constants';
import type { Client } from './types';

type Query = Readonly<Record<string, string | number>>;

/**
 * Seerr's request validator rejects `!`, `(`, `)` and `*` in query values
 * unless they are percent-encoded, which `encodeURIComponent` leaves alone.
 * Seerr's own frontend escapes the same set (`encodeURIExtraParams`), plus `'`
 * here for RFC 3986.
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

/** Seerr's error handler answers `{ message, errors }`; anything else falls back to the status text. */
/** `AbortSignal.timeout` rejects with a `DOMException` named `TimeoutError`. */
const isTimeout = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string' &&
      body.message !== ''
    ) {
      return body.message;
    }
  } catch {
    // Not JSON; use the status text below.
  }
  return response.statusText || 'no error message';
};

/**
 * Builds a client for the Seerr v1 API at `baseUrl` (the instance root, without
 * `/api/v1`), authenticated with the `X-Api-Key` header. Non-2xx responses
 * throw an `ApiError`. A call that takes longer than `timeoutMs`, from sending
 * the request to reading the whole body, is aborted and throws. Seerr sits
 * behind a tunnel that can stall, and a hung call would hold the agent's turn.
 * Pass `fetch` to substitute the transport in tests.
 */
export const createClient = ({
  apiKey,
  baseUrl,
  fetch = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}): Client => {
  const root = `${baseUrl.replace(/\/+$/u, '')}/api/v1`;

  const call = async <T>(
    path: string,
    {
      body,
      query = {},
    }: { readonly body?: unknown; readonly query?: Query } = {},
  ): Promise<T> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
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
        throw new ApiError(response.status, await readErrorMessage(response));
      }
      return (await response.json()) as T;
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
    createRequest: body => call('/request', { body }),
    listRequests: (params = {}) => call('/request', { query: { ...params } }),
    movie: id => call(`/movie/${id}`),
    movieRecommendations: id => call(`/movie/${id}/recommendations`),
    movieSimilar: id => call(`/movie/${id}/similar`),
    radarrServer: id => call(`/service/radarr/${id}`),
    radarrServers: () => call('/service/radarr'),
    search: query => call('/search', { query: { query } }),
    sonarrServer: id => call(`/service/sonarr/${id}`),
    sonarrServers: () => call('/service/sonarr'),
    tv: id => call(`/tv/${id}`),
    tvRecommendations: id => call(`/tv/${id}/recommendations`),
    tvSimilar: id => call(`/tv/${id}/similar`),
  };
};
