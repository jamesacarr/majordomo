import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { createClient } from './create-client';
import type { Client } from './types';

interface Sent {
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
}

/** A transport that records each request and answers with `response`. */
const recordingFetch = (
  response: () => Response = () => Response.json({ ok: true }),
) => {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    sent.push({
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: { ...(init?.headers as Record<string, string>) },
      method: init?.method ?? 'GET',
      url: String(input),
    });

    return Promise.resolve(response());
  };

  return { fetch, sent };
};

const clientWith = (
  fetch: typeof globalThis.fetch,
  {
    baseUrl = 'https://seerr.example.test',
    timeoutMs,
  }: { readonly baseUrl?: string; readonly timeoutMs?: number } = {},
) =>
  createClient({
    apiKey: 'secret-key',
    baseUrl,
    fetch,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });

describe('createClient', () => {
  it.each<[string, (client: Client) => Promise<unknown>, string]>([
    ['movie', c => c.movie(603), '/api/v1/movie/603'],
    [
      'movieRecommendations',
      c => c.movieRecommendations(603),
      '/api/v1/movie/603/recommendations',
    ],
    ['movieSimilar', c => c.movieSimilar(603), '/api/v1/movie/603/similar'],
    ['tv', c => c.tv(1399), '/api/v1/tv/1399'],
    [
      'tvRecommendations',
      c => c.tvRecommendations(1399),
      '/api/v1/tv/1399/recommendations',
    ],
    ['tvSimilar', c => c.tvSimilar(1399), '/api/v1/tv/1399/similar'],
    ['radarrServers', c => c.radarrServers(), '/api/v1/service/radarr'],
    ['radarrServer', c => c.radarrServer(0), '/api/v1/service/radarr/0'],
    ['sonarrServers', c => c.sonarrServers(), '/api/v1/service/sonarr'],
    ['sonarrServer', c => c.sonarrServer(2), '/api/v1/service/sonarr/2'],
    ['listRequests with no params', c => c.listRequests(), '/api/v1/request'],
  ])('%s sends a GET to %s', async (_label, invoke, path) => {
    const { fetch, sent } = recordingFetch();

    await invoke(clientWith(fetch));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('GET');
    expect(sent[0]?.url).toBe(`https://seerr.example.test${path}`);
  });

  it('authenticates every request with the X-Api-Key header', async () => {
    const { fetch, sent } = recordingFetch();

    await clientWith(fetch).movie(603);

    expect(sent[0]?.headers['X-Api-Key']).toBe('secret-key');
  });

  it('returns the parsed JSON body', async () => {
    const { fetch } = recordingFetch(() =>
      Response.json({ id: 603, title: 'The Matrix' }),
    );

    await expect(clientWith(fetch).movie(603)).resolves.toEqual({
      id: 603,
      title: 'The Matrix',
    });
  });

  it('drops trailing slashes from the base URL', async () => {
    const { fetch, sent } = recordingFetch();

    await clientWith(fetch, { baseUrl: 'https://seerr.example.test//' }).movie(
      603,
    );

    expect(sent[0]?.url).toBe('https://seerr.example.test/api/v1/movie/603');
  });

  it('search percent-encodes the query, including the characters Seerr rejects raw', async () => {
    const { fetch, sent } = recordingFetch();

    await clientWith(fetch).search("Ocean's Eleven (2001)! *&");

    expect(sent[0]?.url).toBe(
      'https://seerr.example.test/api/v1/search?query=Ocean%27s%20Eleven%20%282001%29%21%20%2A%26',
    );
  });

  it('listRequests sends the given params as the query string', async () => {
    const { fetch, sent } = recordingFetch();

    await clientWith(fetch).listRequests({
      filter: 'pending',
      sort: 'added',
      take: 20,
    });

    expect(sent[0]?.url).toBe(
      'https://seerr.example.test/api/v1/request?filter=pending&sort=added&take=20',
    );
  });

  it('createRequest POSTs the body as JSON, tags included', async () => {
    const { fetch, sent } = recordingFetch(() =>
      Response.json({ id: 1 }, { status: 201 }),
    );
    const body = {
      mediaId: 1399,
      mediaType: 'tv' as const,
      seasons: [1, 2],
      tags: [3, 7],
    };

    await clientWith(fetch).createRequest(body);

    expect(sent[0]).toMatchObject({
      body,
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      url: 'https://seerr.example.test/api/v1/request',
    });
  });

  it("throws an ApiError carrying the status and Seerr's message on a non-2xx answer", async () => {
    const { fetch } = recordingFetch(() =>
      Response.json(
        { message: 'Request for this media already exists.' },
        {
          status: 409,
        },
      ),
    );

    const error = await clientWith(fetch)
      .createRequest({ mediaId: 603, mediaType: 'movie', tags: [] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message:
        'Seerr answered HTTP 409: Request for this media already exists.',
      status: 409,
    });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    const { fetch } = recordingFetch(
      () =>
        new Response('<html>Bad Gateway</html>', {
          status: 502,
          statusText: 'Bad Gateway',
        }),
    );

    await expect(clientWith(fetch).movie(603)).rejects.toThrow(
      'Seerr answered HTTP 502: Bad Gateway',
    );
  });

  it('falls back to a placeholder when the error has neither a message nor status text', async () => {
    const { fetch } = recordingFetch(() =>
      Response.json({ errors: [] }, { status: 401 }),
    );

    await expect(clientWith(fetch).movie(603)).rejects.toThrow(
      'Seerr answered HTTP 401: no error message',
    );
  });

  describe('timeout', () => {
    /** Rejects the way real `fetch` does once `signal` aborts. */
    const onAbort = (signal: AbortSignal | null | undefined) =>
      new Promise<never>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      });

    it('throws naming the path when Seerr sends no response in time', async () => {
      const hanging: typeof globalThis.fetch = (_input, init) =>
        onAbort(init?.signal);
      await expect(
        clientWith(hanging, { timeoutMs: 20 }).search('Dune'),
      ).rejects.toThrow('Seerr did not answer /search within 20 ms');
    });

    it('throws when the response body stalls after the headers arrive', async () => {
      const stalling: typeof globalThis.fetch = (_input, init) => {
        const body = new ReadableStream({
          start: controller => {
            controller.enqueue(new TextEncoder().encode('{"id":'));
            onAbort(init?.signal).catch((reason: unknown) =>
              controller.error(reason),
            );
          },
        });

        return Promise.resolve(new Response(body, { status: 200 }));
      };
      await expect(
        clientWith(stalling, { timeoutMs: 20 }).movie(603),
      ).rejects.toThrow('Seerr did not answer /movie/603 within 20 ms');
    });

    it('gives each call its own deadline rather than one shared from creation', async () => {
      // Real fetch rejects at once when handed a signal that has already aborted.
      const immediate: typeof globalThis.fetch = (_input, init) =>
        init?.signal?.aborted
          ? Promise.reject(init.signal.reason)
          : Promise.resolve(Response.json({ id: 603 }));
      const client = clientWith(immediate, { timeoutMs: 20 });

      await client.movie(603);
      await new Promise(resolve => setTimeout(resolve, 40));

      await expect(client.movie(603)).resolves.toEqual({ id: 603 });
    });

    it('passes other network failures through unchanged', async () => {
      const failure = new TypeError('fetch failed');
      const failing: typeof globalThis.fetch = () => Promise.reject(failure);

      await expect(clientWith(failing).movie(603)).rejects.toBe(failure);
    });
  });
});
