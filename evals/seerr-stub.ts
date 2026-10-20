import { createServer } from 'node:http';

import { DETAILS, RELATED, SEARCH_RESULTS } from './fixtures/seerr';

const page = (results: readonly unknown[]) => ({
  page: 1,
  results,
  totalPages: 1,
  totalResults: results.length,
});

/** Answers one Seerr v1 path from the fixtures, or `undefined` for a 404. */
const answer = (path: string, query: URLSearchParams): unknown => {
  if (path === '/search') {
    const text = (query.get('query') ?? '').toLowerCase();
    const match = Object.keys(SEARCH_RESULTS).find(key => text.includes(key));

    return page(match === undefined ? [] : (SEARCH_RESULTS[match] ?? []));
  }

  if (/^\/(movie|tv)\/\d+\/(recommendations|similar)$/u.test(path)) {
    return page(RELATED[path] ?? []);
  }

  return DETAILS[path];
};

/**
 * Starts an HTTP server on the given loopback port that answers the Seerr
 * reads the media tools make from fixture JSON, so evals are deterministic
 * and need no network. Requests without `X-Api-Key: apiKey` get a 401, as
 * Seerr answers them.
 */
export const startSeerrStub = async ({
  apiKey,
  port,
}: {
  readonly apiKey: string;
  readonly port: number;
}): Promise<{ readonly close: () => Promise<void> }> => {
  const server = createServer((request, response) => {
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
  };
};
