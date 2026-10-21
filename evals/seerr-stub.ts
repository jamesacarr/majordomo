import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';

import {
  DETAILS,
  PERSON_CREDITS,
  RELATED,
  SEARCH_RESULTS,
} from './fixtures/seerr';

/** A Radarr or Sonarr tag as Seerr returns it under `/service/{radarr,sonarr}/{id}`. */
export interface StubTag {
  readonly id: number;
  readonly label: string;
}

/** The body of one `POST /request` the stub received, as parsed JSON. */
export interface RecordedRequest {
  readonly is4k?: unknown;
  readonly mediaId?: unknown;
  readonly mediaType?: unknown;
  readonly seasons?: unknown;
  readonly tags?: unknown;
}

/** Both servers carry these unless an eval swaps them with `withTags`. */
const DEFAULT_TAGS: readonly StubTag[] = [
  { id: 1, label: 'seerr' },
  { id: 2, label: 'eval-tester' },
];

/** One default non-4K server per service, as a single-server Seerr lists them. */
const SERVERS: Readonly<Record<string, readonly unknown[]>> = {
  '/service/radarr': [{ id: 0, is4k: false, isDefault: true, name: 'Radarr' }],
  '/service/sonarr': [{ id: 10, is4k: false, isDefault: true, name: 'Sonarr' }],
};

/** The detail paths of the servers above, which answer with the current tag set. */
const SERVER_DETAILS = new Set(['/service/radarr/0', '/service/sonarr/10']);

const page = (results: readonly unknown[]) => ({
  page: 1,
  results,
  totalPages: 1,
  totalResults: results.length,
});

/** Answers one Seerr v1 read from the fixtures and current tags, or `undefined` for a 404. */
const answer = (
  path: string,
  query: URLSearchParams,
  tags: readonly StubTag[],
): unknown => {
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

  if (SERVER_DETAILS.has(path)) {
    return { tags };
  }

  return SERVERS[path] ?? DETAILS[path];
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

/**
 * Starts an HTTP server on the given loopback port that answers the Seerr
 * reads the media tools make from fixture JSON, so evals are deterministic
 * and need no network. Requests without `X-Api-Key: apiKey` get a 401, as
 * Seerr answers them.
 *
 * `POST /request` records its body in `requests` and answers as Seerr 3.4.1
 * does for an auto-approved request: status 2 (approved) with the tags
 * echoed. Evals share one stub, so each request eval uses its own tmdbId and
 * filters `requests` by `mediaId`. `withTags` replaces both servers' tag set
 * while `fn` runs, one caller at a time, then restores the default.
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
  readonly withTags: <T>(
    tags: readonly StubTag[],
    fn: () => Promise<T>,
  ) => Promise<T>;
}> => {
  const requests: RecordedRequest[] = [];
  let tags = DEFAULT_TAGS;
  let queue: Promise<unknown> = Promise.resolve();
  let nextRequestId = 1;

  const withTags = <T>(
    replacement: readonly StubTag[],
    fn: () => Promise<T>,
  ): Promise<T> => {
    const run = queue.then(async () => {
      tags = replacement;

      try {
        return await fn();
      } finally {
        tags = DEFAULT_TAGS;
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

    if (request.method === 'POST' && path === '/request') {
      const body = (await readJson(request)) as RecordedRequest;

      requests.push(body);
      send(201, {
        id: nextRequestId++,
        media: { mediaType: body.mediaType, status: 2, tmdbId: body.mediaId },
        status: 2,
        tags: body.tags,
        type: body.mediaType,
      });
      return;
    }

    const body =
      request.method === 'GET'
        ? answer(path, url.searchParams, tags)
        : undefined;

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
    withTags,
  };
};
