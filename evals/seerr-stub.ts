import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';

import {
  DETAILS,
  PERSON_CREDITS,
  RELATED,
  REQUESTS,
  SEARCH_RESULTS,
} from './fixtures/seerr';

/** The body of one `POST /request` the stub received, as parsed JSON. */
export interface RecordedRequest {
  readonly is4k?: unknown;
  readonly mediaId?: unknown;
  readonly mediaType?: unknown;
  readonly seasons?: unknown;
  readonly tags?: unknown;
}

/**
 * How Seerr answers user 2's `POST /request`: `auto` approves it (status 2),
 * `manual` leaves it waiting for approval (status 1), and `refused` answers
 * 403 as Seerr's `RequestPermissionError` does.
 */
export type StubProfile = 'auto' | 'manual' | 'refused';

/** The eval requester, as the `eval` script sets `MAJORDOMO_DEV_SEERR_USER_ID`. */
const REQUESTER_ID = 2;

/** Another household member, who requested Fight Club. */
const OTHER_USER_ID = 3;

const KNOWN_USERS = new Set([REQUESTER_ID, OTHER_USER_ID]);

/** Seerr's `isAuthenticated()` answer when `X-API-User` names no user. */
const NO_USER = {
  error: 'You do not have permission to access this endpoint',
  status: 403,
};

const REFUSED = {
  message: 'You do not have permission to make movie requests.',
};

const STATUS_BY_PROFILE: Readonly<Record<'auto' | 'manual', number>> = {
  auto: 2,
  manual: 1,
};

const page = (results: readonly unknown[]) => ({
  page: 1,
  results,
  totalPages: 1,
  totalResults: results.length,
});

const requestedById = (row: unknown): unknown =>
  (row as { readonly requestedBy?: { readonly id?: unknown } }).requestedBy?.id;

/** One user's fixed `REQUESTS`, newest first, honouring `take`. */
const requestPage = (requestedBy: number, query: URLSearchParams) => {
  const take = Number.parseInt(query.get('take') ?? '', 10);
  const own = REQUESTS.filter(row => requestedById(row) === requestedBy);

  return {
    pageInfo: { page: 1, pages: 1, results: own.length },
    results: own.slice(0, Number.isNaN(take) ? own.length : take),
  };
};

/** Answers one Seerr v1 read from the fixtures, or `undefined` for a 404. */
const answer = (path: string, query: URLSearchParams): unknown => {
  if (path === '/search') {
    const text = (query.get('query') ?? '').toLowerCase();
    const match = Object.keys(SEARCH_RESULTS).find(key => text.includes(key));

    return page(match === undefined ? [] : (SEARCH_RESULTS[match] ?? []));
  }

  if (/^\/(movie|tv)\/\d+\/(recommendations|similar)$/u.test(path)) {
    return page(RELATED[path] ?? []);
  }

  if (/^\/person\/\d+\/combined_credits$/u.test(path)) {
    return PERSON_CREDITS[path];
  }

  return DETAILS[path];
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

/** The `X-API-User` header as a user id, or `null` when it's missing or not an integer. */
const readUserId = (request: IncomingMessage): number | null => {
  const header = request.headers['x-api-user'];
  const id = typeof header === 'string' ? Number(header) : Number.NaN;

  return Number.isInteger(id) ? id : null;
};

/**
 * Starts an HTTP server on the given loopback port that answers the Seerr
 * reads the media tools make from fixture JSON, so evals are deterministic
 * and need no network. It checks callers as Seerr 3.5.0 does with the admin
 * key: without `X-Api-Key: apiKey` or an `X-API-User` header it answers 401,
 * and for an `X-API-User` other than users 2 and 3 it answers the auth
 * middleware's 403 `{ status, error }`. There's no `/service` route, so any
 * Radarr or Sonarr tag lookup 404s.
 *
 * `POST /request` records its body in `requests` and answers by user 2's
 * profile, `auto` unless `withProfile` sets another. `GET /request` lists the
 * fixed `REQUESTS` made by `requestedBy`, honouring `take`, and answers 400
 * without `requestedBy`, so evals prove the tools send it. Posted requests
 * don't join the list. Evals share one stub, so each request eval uses its
 * own tmdbId and filters `requests` by `mediaId`. `withProfile` sets the
 * profile while `fn` runs, one caller at a time, then restores `auto`.
 */
export const startSeerrStub = async ({
  apiKey,
  port,
}: {
  readonly apiKey: string;
  readonly port: number;
}): Promise<{
  readonly close: () => Promise<void>;
  readonly requests: readonly RecordedRequest[];
  readonly withProfile: <T>(
    profile: StubProfile,
    fn: () => Promise<T>,
  ) => Promise<T>;
}> => {
  const requests: RecordedRequest[] = [];
  let profile: StubProfile = 'auto';
  let queue: Promise<unknown> = Promise.resolve();
  let nextRequestId = 1;

  const withProfile = <T>(
    replacement: StubProfile,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const run = queue.then(async () => {
      profile = replacement;

      try {
        return await fn();
      } finally {
        profile = 'auto';
      }
    });

    // The next caller waits for this one to settle, whether or not it threw.
    queue = run.catch(() => undefined);

    return run;
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://stub');
    const path = url.pathname.replace(/^\/api\/v1/u, '');
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (request.headers['x-api-key'] !== apiKey) {
      send(401, { message: 'Unauthorized' });
      return;
    }

    const userId = readUserId(request);

    if (userId === null) {
      send(401, { message: 'X-API-User is required' });
      return;
    }

    if (!KNOWN_USERS.has(userId)) {
      send(403, NO_USER);
      return;
    }

    if (request.method === 'POST' && path === '/request') {
      const body = (await readJson(request)) as RecordedRequest;
      const current = userId === REQUESTER_ID ? profile : 'auto';

      if (current === 'refused') {
        send(403, REFUSED);
        return;
      }

      requests.push(body);
      send(201, {
        id: nextRequestId++,
        media: { mediaType: body.mediaType, status: 2, tmdbId: body.mediaId },
        requestedBy: { id: userId },
        status: STATUS_BY_PROFILE[current],
        type: body.mediaType,
      });
      return;
    }

    if (request.method === 'GET' && path === '/request') {
      const requestedBy = Number(url.searchParams.get('requestedBy') ?? '');

      if (!Number.isInteger(requestedBy) || requestedBy <= 0) {
        send(400, { message: 'The stub requires requestedBy' });
        return;
      }

      send(200, requestPage(requestedBy, url.searchParams));
      return;
    }

    const body =
      request.method === 'GET' ? answer(path, url.searchParams) : undefined;

    if (body === undefined) {
      send(404, { message: `No fixture for ${request.method} ${path}` });
      return;
    }

    send(200, body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      }),
    requests,
    withProfile,
  };
};
