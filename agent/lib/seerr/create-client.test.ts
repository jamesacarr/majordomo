import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { createClient } from './create-client';
import { ResponseShapeError } from './response-shape-error';
import type { Client } from './types';

// Answers shaped like Seerr 3.4.1's, including fields the schemas don't read.
const movieResult = {
  adult: false,
  genreIds: [28, 878],
  id: 603,
  mediaInfo: { id: 12, status: 5, tmdbId: 603 },
  mediaType: 'movie',
  originalTitle: 'The Matrix',
  overview: 'A hacker learns what the Matrix is.',
  popularity: 80.4,
  posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  releaseDate: '1999-03-31',
  title: 'The Matrix',
  voteAverage: 8.2,
  voteCount: 25_000,
};
const tvResult = {
  firstAirDate: '2011-04-17',
  id: 1399,
  mediaType: 'tv',
  name: 'Game of Thrones',
  originCountry: ['US'],
  overview: 'Nine noble families fight for control.',
  posterPath: null,
  voteAverage: 8.5,
  voteCount: 24_000,
};
const personResult = {
  adult: false,
  id: 287,
  knownFor: [movieResult],
  mediaType: 'person',
  name: 'Brad Pitt',
  popularity: 30.2,
  profilePath: '/cckcYc2v0yh1tc9QjRelptcOBko.jpg',
};
const castCredit = {
  ...movieResult,
  character: 'Neo',
  creditId: '52fe425bc3a36847f80181c1',
  originalLanguage: 'en',
};
const crewCredit = {
  ...tvResult,
  creditId: '5256c8c219c2956ff604858a',
  department: 'Directing',
  job: 'Director',
};
const page = (results: readonly unknown[]) => ({
  page: 1,
  results,
  totalPages: 1,
  totalResults: results.length,
});
const server = {
  activeDirectory: '/movies',
  activeProfileId: 1,
  activeTags: [],
  id: 0,
  is4k: false,
  isDefault: true,
  name: 'Radarr',
};
const createdRequest = {
  createdAt: '2026-10-20T04:00:00.000Z',
  id: 41,
  media: { id: 12, mediaType: 'movie', status: 2, tmdbId: 603 },
  status: 2,
  tags: [1, 9],
  type: 'movie',
};

/** A fake Seerr: answers each path the client calls with a realistic body. */
const seerrAnswer = (url: string, method: string): unknown => {
  const path = new URL(url).pathname.replace(/^\/api\/v1/u, '');

  if (path === '/search') {
    return page([movieResult, tvResult]);
  }

  if (/^\/person\/\d+\/combined_credits$/u.test(path)) {
    return { cast: [castCredit], crew: [crewCredit], id: 287 };
  }

  if (/^\/movie\/\d+\/(recommendations|similar)$/u.test(path)) {
    return page([movieResult]);
  }

  if (/^\/tv\/\d+\/(recommendations|similar)$/u.test(path)) {
    return page([tvResult]);
  }

  if (/^\/movie\/\d+$/u.test(path)) {
    return { ...movieResult, budget: 63_000_000 };
  }

  if (/^\/tv\/\d+$/u.test(path)) {
    return { ...tvResult, seasons: [{ seasonNumber: 1 }] };
  }

  if (/^\/service\/(radarr|sonarr)$/u.test(path)) {
    return [server];
  }

  if (/^\/service\/(radarr|sonarr)\/\d+$/u.test(path)) {
    return {
      profiles: [{ id: 1, name: 'HD-1080p' }],
      rootFolders: [],
      server,
      tags: [{ id: 1, label: 'seerr' }],
    };
  }

  return method === 'POST'
    ? createdRequest
    : {
        pageInfo: { page: 1, pages: 1, results: 1 },
        results: [createdRequest],
      };
};

interface Sent {
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
}

/** A transport that records each request and answers with `respond`, the fake Seerr by default. */
const recordingFetch = (
  respond: (url: string, method: string) => Response = (url, method) =>
    Response.json(seerrAnswer(url, method)),
) => {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const request = {
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: { ...(init?.headers as Record<string, string>) },
      method: init?.method ?? 'GET',
      url: String(input),
    };
    sent.push(request);

    return Promise.resolve(respond(request.url, request.method));
  };

  return { fetch, sent };
};

/** A transport that answers every call with `body`. */
const answering = (body: unknown) =>
  recordingFetch(() => Response.json(body)).fetch;

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
    [
      'personCredits',
      c => c.personCredits(287),
      '/api/v1/person/287/combined_credits',
    ],
    [
      'searchPeople',
      c => c.searchPeople('Brad Pitt'),
      '/api/v1/search?query=Brad%20Pitt',
    ],
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

  it('returns the parsed answer with the fields the schema does not read stripped', async () => {
    const { fetch } = recordingFetch();

    await expect(clientWith(fetch).movie(603)).resolves.toEqual({
      id: 603,
      mediaInfo: { status: 5, tmdbId: 603 },
      overview: 'A hacker learns what the Matrix is.',
      posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      releaseDate: '1999-03-31',
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

  it('search drops people, collections and any other result type, keeping movies and TV in order', async () => {
    const fetch = answering(
      page([
        { id: 287, knownFor: [], mediaType: 'person', name: 'Brad Pitt' },
        movieResult,
        { id: 2344, mediaType: 'collection', title: 'The Matrix Collection' },
        { id: 9, mediaType: 'keyword', name: 'hacker' },
        tvResult,
      ]),
    );

    const { results } = await clientWith(fetch).search('matrix');

    expect(results.map(r => [r.mediaType, r.id])).toEqual([
      ['movie', 603],
      ['tv', 1399],
    ]);
  });

  it('searchPeople percent-encodes the query the same way search does', async () => {
    const { fetch, sent } = recordingFetch();

    await clientWith(fetch).searchPeople("Lupita Nyong'o (actor)! *&");

    expect(sent[0]?.url).toBe(
      'https://seerr.example.test/api/v1/search?query=Lupita%20Nyong%27o%20%28actor%29%21%20%2A%26',
    );
  });

  it('searchPeople keeps only people, in order, even past a malformed movie result', async () => {
    const fetch = answering(
      page([
        movieResult,
        { id: 1, mediaType: 'person', name: 'Brad Pitt' },
        { ...movieResult, title: undefined },
        { id: 2344, mediaType: 'collection', title: 'The Matrix Collection' },
        tvResult,
        { id: 2, mediaType: 'person', name: 'Brad Pitt Jr' },
      ]),
    );

    const { results } = await clientWith(fetch).searchPeople('brad pitt');

    expect(results).toEqual([
      { id: 1, mediaType: 'person', name: 'Brad Pitt' },
      { id: 2, mediaType: 'person', name: 'Brad Pitt Jr' },
    ]);
  });

  it.each([
    ['missing', undefined],
    ['empty', []],
    ['holding a malformed entry', [{ id: 9, mediaType: 'movie' }]],
  ])(
    'searchPeople accepts a person with knownFor %s and strips it',
    async (_label, knownFor) => {
      const fetch = answering(page([{ ...personResult, knownFor }]));

      await expect(
        clientWith(fetch).searchPeople('brad pitt'),
      ).resolves.toMatchObject({
        results: [{ id: 287, mediaType: 'person', name: 'Brad Pitt' }],
      });
    },
  );

  it('searchPeople drops a result with no mediaType', async () => {
    const fetch = answering(page([{ id: 1, name: 'Nobody' }, personResult]));

    const { results } = await clientWith(fetch).searchPeople('brad pitt');

    expect(results.map(r => r.id)).toEqual([287]);
  });

  it('personCredits returns cast with character and crew with job and department, other keys stripped', async () => {
    const { fetch } = recordingFetch();

    await expect(clientWith(fetch).personCredits(287)).resolves.toEqual({
      cast: [
        {
          character: 'Neo',
          id: 603,
          mediaInfo: { status: 5, tmdbId: 603 },
          mediaType: 'movie',
          overview: 'A hacker learns what the Matrix is.',
          posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
          releaseDate: '1999-03-31',
          title: 'The Matrix',
          voteAverage: 8.2,
          voteCount: 25_000,
        },
      ],
      crew: [
        {
          department: 'Directing',
          firstAirDate: '2011-04-17',
          id: 1399,
          job: 'Director',
          mediaType: 'tv',
          name: 'Game of Thrones',
          overview: 'Nine noble families fight for control.',
          posterPath: null,
          voteAverage: 8.5,
          voteCount: 24_000,
        },
      ],
    });
  });

  it('personCredits keeps the episode count of TV cast and crew credits', async () => {
    const fetch = answering({
      cast: [{ ...tvResult, character: 'Will Colbert', episodeCount: 1 }],
      crew: [{ ...crewCredit, episodeCount: 2 }],
    });

    await expect(clientWith(fetch).personCredits(287)).resolves.toMatchObject({
      cast: [{ character: 'Will Colbert', episodeCount: 1, id: 1399 }],
      crew: [{ episodeCount: 2, id: 1399, job: 'Director' }],
    });
  });

  it('personCredits drops credits with a missing or unknown mediaType', async () => {
    const fetch = answering({
      cast: [{ ...castCredit, mediaType: undefined }, castCredit],
      crew: [{ ...crewCredit, mediaType: 'person' }, crewCredit],
    });

    const credits = await clientWith(fetch).personCredits(287);

    expect(credits.cast.map(c => c.id)).toEqual([603]);
    expect(credits.crew.map(c => c.id)).toEqual([1399]);
  });

  it('personCredits accepts null or missing optional fields and lists', async () => {
    const fetch = answering({
      cast: [{ character: null, id: 1, mediaType: 'movie', title: 'Untitled' }],
      crew: null,
    });

    await expect(clientWith(fetch).personCredits(287)).resolves.toEqual({
      cast: [{ character: null, id: 1, mediaType: 'movie', title: 'Untitled' }],
      crew: [],
    });
  });

  it('accepts results with null, empty or missing optional fields', async () => {
    const fetch = answering(
      page([
        {
          id: 1,
          mediaType: 'movie',
          posterPath: null,
          releaseDate: '',
          title: 'Untitled',
        },
      ]),
    );

    await expect(clientWith(fetch).search('untitled')).resolves.toMatchObject({
      results: [{ id: 1, title: 'Untitled' }],
    });
  });

  it('accepts listed requests with no tags, as requests made outside majordomo have', async () => {
    const fetch = answering({
      results: [{ ...createdRequest, tags: null }],
    });

    await expect(clientWith(fetch).listRequests()).resolves.toMatchObject({
      results: [{ id: 41, tags: null }],
    });
  });

  it.each<[string, (client: Client) => Promise<unknown>, unknown, string]>([
    [
      'a movie result without a title',
      c => c.search('x'),
      page([{ ...movieResult, title: undefined }]),
      'results[0].title',
    ],
    [
      'a TV result without a name',
      c => c.search('x'),
      page([movieResult, { ...tvResult, name: undefined }]),
      'results[1].name',
    ],
    [
      'a result without a mediaType',
      c => c.search('x'),
      page([{ id: 1, title: 'A' }]),
      'results[0].mediaType',
    ],
    [
      'mediaInfo without a status',
      c => c.search('x'),
      page([{ ...movieResult, mediaInfo: { tmdbId: 603 } }]),
      'results[0].mediaInfo.status',
    ],
    [
      'a recommendation page without results',
      c => c.movieRecommendations(603),
      { page: 1 },
      'results',
    ],
    ['movie details without a title', c => c.movie(603), { id: 603 }, 'title'],
    [
      'a cast member without a name',
      c => c.movie(603),
      { ...movieResult, credits: { cast: [{ character: 'Neo' }] } },
      'credits.cast[0].name',
    ],
    [
      'a TV creator without a name',
      c => c.tv(1399),
      { ...tvResult, createdBy: [{ id: 9 }] },
      'createdBy[0].name',
    ],
    ['TV details without a name', c => c.tv(1399), { id: 1399 }, 'name'],
    [
      'a server without isDefault',
      c => c.radarrServers(),
      [{ ...server, isDefault: undefined }],
      '[0].isDefault',
    ],
    ['server details without tags', c => c.sonarrServer(0), { server }, 'tags'],
    [
      'a tag without a label',
      c => c.radarrServer(0),
      { server, tags: [{ id: 1 }] },
      'tags[0].label',
    ],
    [
      'a created request without its tags',
      c => c.createRequest({ mediaId: 603, mediaType: 'movie', tags: [1] }),
      { ...createdRequest, tags: null },
      'tags',
    ],
    [
      'a listed request without a status',
      c => c.listRequests(),
      { results: [{ ...createdRequest, status: undefined }] },
      'results[0].status',
    ],
  ])(
    'throws naming the path and field for %s',
    async (_label, invoke, body, field) => {
      const error = await invoke(clientWith(answering(body))).catch(
        (e: unknown) => e,
      );

      const lines = (error as Error).message.split('\n');

      expect(lines[0]).toMatch(
        /^Seerr's answer to \/\S+ did not have the expected shape:$/u,
      );
      expect(lines).toContain(`  → at ${field}`);
    },
  );

  it('throws a ResponseShapeError carrying the zod issues for a shape mismatch', async () => {
    const error = await clientWith(answering({ ...createdRequest, tags: null }))
      .createRequest({ mediaId: 603, mediaType: 'movie', tags: [1] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ResponseShapeError);
    expect((error as ResponseShapeError).issues.map(i => i.path)).toEqual([
      ['tags'],
    ]);
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
    const { fetch, sent } = recordingFetch();
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
        { status: 409 },
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
      const immediate: typeof globalThis.fetch = (input, init) =>
        init?.signal?.aborted
          ? Promise.reject(init.signal.reason)
          : Promise.resolve(Response.json(seerrAnswer(String(input), 'GET')));
      const client = clientWith(immediate, { timeoutMs: 20 });

      await client.movie(603);
      await new Promise(resolve => setTimeout(resolve, 40));

      await expect(client.movie(603)).resolves.toMatchObject({ id: 603 });
    });

    it('passes other network failures through unchanged', async () => {
      const failure = new TypeError('fetch failed');
      const failing: typeof globalThis.fetch = () => Promise.reject(failure);

      await expect(clientWith(failing).movie(603)).rejects.toBe(failure);
    });
  });
});
