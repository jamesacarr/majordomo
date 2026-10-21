import { describe, expect, it } from 'vitest';

import { ApiError } from '../seerr/api-error';
import type {
  Client,
  ListRequestsParams,
  MediaRequest,
  MediaType,
  MovieDetails,
  TvDetails,
} from '../seerr/types';
import { listRequests } from './list-requests';

const SEERR_USER_ID = 7;

/** A completed, available request for `tmdbId`, made on 1 March 2025 unless overridden. */
const requestFor = (
  id: number,
  mediaType: MediaType,
  tmdbId: number,
  overrides: Partial<MediaRequest> = {},
): MediaRequest => ({
  createdAt: '2025-03-01T10:00:00.000Z',
  id,
  media: { mediaType, status: 5, tmdbId },
  status: 5,
  type: mediaType,
  ...overrides,
});

const movieTitle = (tmdbId: number): string => `Movie ${tmdbId}`;

/**
 * An in-memory Seerr holding one user's `requests` (newest first), answering
 * at most `take` of them, and a detail page for every id: `Movie <id>` (2001)
 * or `Show <id>` (2010) unless `failures` names the id. Typed without the
 * `/service` methods. Records every `listRequests` call.
 */
const fakeSeerr = ({
  failures = new Map<number, Error>(),
  list,
  requests = [],
}: {
  readonly failures?: Map<number, Error>;
  readonly list?: () => Promise<never>;
  readonly requests?: MediaRequest[];
} = {}) => {
  const listCalls: ListRequestsParams[] = [];

  const detail = <T>(id: number, page: T): Promise<T> => {
    const failure = failures.get(id);

    return failure === undefined
      ? Promise.resolve(page)
      : Promise.reject(failure);
  };

  const client: Pick<Client, 'listRequests' | 'movie' | 'tv'> = {
    listRequests: params => {
      listCalls.push(params);

      return list === undefined
        ? Promise.resolve({ results: requests.slice(0, params.take) })
        : list();
    },
    movie: id =>
      detail<MovieDetails>(id, {
        id,
        releaseDate: '2001-05-04',
        title: movieTitle(id),
      }),
    tv: id =>
      detail<TvDetails>(id, {
        firstAirDate: '2010-09-01',
        id,
        name: `Show ${id}`,
      }),
  };

  return { client, listCalls };
};

describe('listRequests', () => {
  it('fetches the requester’s 20 newest requests and returns exactly the row fields', async () => {
    const { client, listCalls } = fakeSeerr({
      requests: [
        requestFor(2, 'tv', 95_396, {
          media: { status: 3, tmdbId: 95_396 },
          status: 2,
        }),
        requestFor(1, 'movie', 603),
      ],
    });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(listCalls).toStrictEqual([
      { requestedBy: SEERR_USER_ID, sort: 'added', take: 20 },
    ]);
    expect(result).toStrictEqual({
      requests: [
        {
          mediaType: 'tv',
          requestedOn: '2025-03-01',
          status: 'processing',
          title: 'Show 95396',
          year: 2010,
        },
        {
          mediaType: 'movie',
          requestedOn: '2025-03-01',
          status: 'available',
          title: 'Movie 603',
          year: 2001,
        },
      ],
    });
  });

  it('lists the requests of whichever Seerr user it is given', async () => {
    const { client, listCalls } = fakeSeerr();

    await listRequests(client, 3, {});

    expect(listCalls).toMatchObject([{ requestedBy: 3 }]);
  });

  it.each(['available', 'processing', 'pending'] as const)(
    'passes filter %s through to Seerr',
    async filter => {
      const { client, listCalls } = fakeSeerr();

      await listRequests(client, SEERR_USER_ID, { filter });

      expect(listCalls).toStrictEqual([
        { filter, requestedBy: SEERR_USER_ID, sort: 'added', take: 20 },
      ]);
    },
  );

  it('reports a request waiting for approval as pending_approval', async () => {
    const { client } = fakeSeerr({
      requests: [
        requestFor(1, 'movie', 1, {
          media: { mediaType: 'movie', status: 2, tmdbId: 1 },
          status: 1,
        }),
      ],
    });

    const result = await listRequests(client, SEERR_USER_ID, {
      filter: 'pending',
    });

    expect(result.requests).toMatchObject([{ status: 'pending_approval' }]);
  });

  it('returns the 20 newest requests in Seerr’s order', async () => {
    const requests = Array.from({ length: 25 }, (_, i) =>
      requestFor(100 - i, 'movie', i + 1),
    );
    const { client } = fakeSeerr({ requests });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests.map(row => row.title)).toStrictEqual(
      Array.from({ length: 20 }, (_, i) => movieTitle(i + 1)),
    );
  });

  it('shows a show requested in several batches once, so the list can be shorter than 20', async () => {
    const batches = Array.from({ length: 5 }, (_, i) =>
      requestFor(200 - i, 'tv', 95_396),
    );
    const movies = Array.from({ length: 20 }, (_, i) =>
      requestFor(100 - i, 'movie', i + 1),
    );
    const { client } = fakeSeerr({ requests: [...batches, ...movies] });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests.map(row => row.title)).toStrictEqual([
      'Show 95396',
      ...Array.from({ length: 15 }, (_, i) => movieTitle(i + 1)),
    ]);
  });

  it.each([
    ['an ApiError 404', new ApiError(404, 'Not found')],
    ['a plain Error', new Error('timed out')],
  ])(
    'gives null title and year for the row whose detail fetch rejects with %s',
    async (_name, error) => {
      const { client } = fakeSeerr({
        failures: new Map([[2, error]]),
        requests: [requestFor(2, 'movie', 2), requestFor(1, 'movie', 1)],
      });

      const result = await listRequests(client, SEERR_USER_ID, {});

      expect(result.requests).toStrictEqual([
        {
          mediaType: 'movie',
          requestedOn: '2025-03-01',
          status: 'available',
          title: null,
          year: null,
        },
        {
          mediaType: 'movie',
          requestedOn: '2025-03-01',
          status: 'available',
          title: 'Movie 1',
          year: 2001,
        },
      ]);
    },
  );

  it('propagates a listRequests rejection', async () => {
    const error = new ApiError(500, 'Internal Server Error');
    const { client } = fakeSeerr({ list: () => Promise.reject(error) });

    await expect(listRequests(client, SEERR_USER_ID, {})).rejects.toBe(error);
  });

  it('keeps only the newest request per title, and treats the same id with different media types as two titles', async () => {
    const { client } = fakeSeerr({
      requests: [
        requestFor(4, 'tv', 95_396, {
          createdAt: '2025-04-01T00:00:00.000Z',
          media: { status: 4, tmdbId: 95_396 },
        }),
        requestFor(3, 'movie', 95_396),
        requestFor(2, 'tv', 95_396, {
          createdAt: '2025-01-01T00:00:00.000Z',
          status: 1,
        }),
      ],
    });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests).toStrictEqual([
      {
        mediaType: 'tv',
        requestedOn: '2025-04-01',
        status: 'partially_available',
        title: 'Show 95396',
        year: 2010,
      },
      {
        mediaType: 'movie',
        requestedOn: '2025-03-01',
        status: 'available',
        title: 'Movie 95396',
        year: 2001,
      },
    ]);
  });

  it('drops rows without a media type or tmdbId', async () => {
    const { client } = fakeSeerr({
      requests: [
        requestFor(3, 'movie', 3, { media: null }),
        requestFor(2, 'movie', 2, {
          media: { mediaType: null, status: 5, tmdbId: 2 },
          type: null,
        }),
        requestFor(1, 'movie', 1),
      ],
    });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests.map(row => row.title)).toStrictEqual(['Movie 1']);
  });

  it('falls back to media.mediaType when type is missing', async () => {
    const { client } = fakeSeerr({
      requests: [requestFor(1, 'tv', 2, { type: null })],
    });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests.map(row => row.mediaType)).toStrictEqual(['tv']);
  });

  it('prefers type over media.mediaType when they differ', async () => {
    const { client } = fakeSeerr({
      requests: [
        requestFor(1, 'movie', 2, {
          media: { mediaType: 'tv', status: 5, tmdbId: 2 },
        }),
      ],
    });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests).toMatchObject([
      { mediaType: 'movie', title: 'Movie 2' },
    ]);
  });

  it('gives a null requestedOn when createdAt is missing', async () => {
    const { client } = fakeSeerr({
      requests: [requestFor(1, 'movie', 1, { createdAt: null })],
    });

    const result = await listRequests(client, SEERR_USER_ID, {});

    expect(result.requests).toMatchObject([{ requestedOn: null }]);
  });

  it('returns no rows when there are no requests', async () => {
    const { client } = fakeSeerr();

    await expect(
      listRequests(client, SEERR_USER_ID, {}),
    ).resolves.toStrictEqual({ requests: [] });
  });
});
