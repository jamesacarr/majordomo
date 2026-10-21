import { describe, expect, it } from 'vitest';

import { ApiError } from '../seerr/api-error';
import { SEERR_TAG } from '../seerr/constants';
import type {
  ListRequestsParams,
  MediaRequest,
  MediaType,
  MovieDetails,
  ServiceServer,
  ServiceTag,
  TvDetails,
} from '../seerr/types';
import type { AllowedUser } from '../types';
import { listRequests } from './list-requests';

const requester: AllowedUser = { name: 'Mary Jane', tag: 'mary-jane' };

/** Mary Jane's tag id differs per service, so a show carrying the Radarr id isn't hers. */
const RADARR_ID = 9;
const SONARR_ID = 7;

const radarrTags: ServiceTag[] = [
  { id: 1, label: SEERR_TAG },
  { id: RADARR_ID, label: 'mary-jane' },
];

const sonarrTags: ServiceTag[] = [
  { id: 1, label: SEERR_TAG },
  { id: SONARR_ID, label: 'mary-jane' },
];

const withoutRequester: ServiceTag[] = [{ id: 1, label: SEERR_TAG }];

const defaultServer: ServiceServer = {
  id: 0,
  is4k: false,
  isDefault: true,
  name: 'Main',
};

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
  tags: [1, mediaType === 'movie' ? RADARR_ID : SONARR_ID],
  type: mediaType,
  ...overrides,
});

const movieTitle = (tmdbId: number): string => `Movie ${tmdbId}`;

/**
 * An in-memory Seerr holding `requests` (newest first), one default server per
 * service, and a detail page for every id: `Movie <id>` (2001) or
 * `Show <id>` (2010) unless `failures` names the id. Records every
 * `listRequests` call and tag lookup.
 */
const fakeSeerr = ({
  failures = new Map<number, Error>(),
  list,
  radarr = radarrTags,
  radarrServers = [defaultServer],
  requests = [],
  sonarr = sonarrTags,
}: {
  readonly failures?: Map<number, Error>;
  readonly list?: () => Promise<never>;
  readonly radarr?: ServiceTag[];
  readonly radarrServers?: ServiceServer[];
  readonly requests?: MediaRequest[];
  readonly sonarr?: ServiceTag[];
} = {}) => {
  const listCalls: (ListRequestsParams | undefined)[] = [];
  const tagLookups: string[] = [];

  const detail = <T>(id: number, page: T): Promise<T> => {
    const failure = failures.get(id);

    return failure === undefined
      ? Promise.resolve(page)
      : Promise.reject(failure);
  };

  return {
    client: {
      listRequests: (params?: ListRequestsParams) => {
        listCalls.push(params);

        return list === undefined
          ? Promise.resolve({ results: requests })
          : list();
      },
      movie: (id: number) =>
        detail<MovieDetails>(id, {
          id,
          releaseDate: '2001-05-04',
          title: movieTitle(id),
        }),
      radarrServer: (_id: number) => {
        tagLookups.push('Radarr');

        return Promise.resolve({ server: defaultServer, tags: radarr });
      },
      radarrServers: () => Promise.resolve(radarrServers),
      sonarrServer: (_id: number) => {
        tagLookups.push('Sonarr');

        return Promise.resolve({ server: defaultServer, tags: sonarr });
      },
      sonarrServers: () => Promise.resolve([defaultServer]),
      tv: (id: number) =>
        detail<TvDetails>(id, {
          firstAirDate: '2010-09-01',
          id,
          name: `Show ${id}`,
        }),
    },
    listCalls,
    tagLookups,
  };
};

const unusedRequester = (): never => {
  throw new Error('getRequester should not be called');
};

const getRequester = (): AllowedUser => requester;

describe('listRequests', () => {
  it('fetches the 100 newest requests without tag lookups and returns exactly the row fields', async () => {
    const { client, listCalls, tagLookups } = fakeSeerr({
      requests: [
        requestFor(2, 'tv', 95_396, {
          media: { status: 3, tmdbId: 95_396 },
          status: 2,
        }),
        requestFor(1, 'movie', 603),
      ],
    });

    const result = await listRequests(client, {}, unusedRequester);

    expect(listCalls).toStrictEqual([{ sort: 'added', take: 100 }]);
    expect(tagLookups).toStrictEqual([]);
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

  it.each(['available', 'processing'] as const)(
    'passes filter %s through to Seerr',
    async filter => {
      const { client, listCalls } = fakeSeerr();

      await listRequests(client, { filter }, unusedRequester);

      expect(listCalls).toStrictEqual([{ filter, sort: 'added', take: 100 }]);
    },
  );

  it('propagates a requester error from mine without fetching anything', async () => {
    const { client, listCalls, tagLookups } = fakeSeerr();
    const error = new Error('no requester');

    await expect(
      listRequests(client, { mine: true }, () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(listCalls).toStrictEqual([]);
    expect(tagLookups).toStrictEqual([]);
  });

  it('propagates the missing default server error from mine without listing requests', async () => {
    const { client, listCalls } = fakeSeerr({
      radarrServers: [{ ...defaultServer, is4k: true }],
    });

    await expect(
      listRequests(client, { mine: true }, getRequester),
    ).rejects.toThrow(/no default non-4K Radarr server/u);
    expect(listCalls).toStrictEqual([]);
  });

  it('keeps only requests carrying the requester’s tag id for their media type', async () => {
    const { client } = fakeSeerr({
      requests: [
        requestFor(6, 'movie', 1, { tags: [1, RADARR_ID] }),
        requestFor(5, 'tv', 2, { tags: [1, SONARR_ID] }),
        requestFor(4, 'movie', 3, { tags: [1, 42] }),
        requestFor(3, 'movie', 4, { tags: null }),
        requestFor(2, 'tv', 5, { tags: [1, RADARR_ID] }),
      ],
    });

    const result = await listRequests(client, { mine: true }, getRequester);

    expect(result.requests.map(row => row.title)).toStrictEqual([
      'Movie 1',
      'Show 2',
    ]);
    expect(result).not.toHaveProperty('tagMissingOn');
  });

  it('returns movie rows and names Sonarr when the requester’s tag is missing there', async () => {
    const { client } = fakeSeerr({
      requests: [
        requestFor(2, 'tv', 2, { tags: [1, SONARR_ID] }),
        requestFor(1, 'movie', 1),
      ],
      sonarr: withoutRequester,
    });

    await expect(
      listRequests(client, { mine: true }, getRequester),
    ).resolves.toStrictEqual({
      requests: [
        {
          mediaType: 'movie',
          requestedOn: '2025-03-01',
          status: 'available',
          title: 'Movie 1',
          year: 2001,
        },
      ],
      tagMissingOn: ['Sonarr'],
    });
  });

  it('returns no rows and names both servers without listing requests when the tag is missing on both', async () => {
    const { client, listCalls } = fakeSeerr({
      radarr: withoutRequester,
      requests: [requestFor(1, 'movie', 1)],
      sonarr: withoutRequester,
    });

    await expect(
      listRequests(client, { mine: true }, getRequester),
    ).resolves.toStrictEqual({
      requests: [],
      tagMissingOn: ['Radarr', 'Sonarr'],
    });
    expect(listCalls).toStrictEqual([]);
  });

  it('passes filter to Seerr and still matches the tag when combined with mine', async () => {
    const { client, listCalls } = fakeSeerr({
      requests: [
        requestFor(2, 'movie', 2, { tags: [1, 42] }),
        requestFor(1, 'movie', 1),
      ],
    });

    const result = await listRequests(
      client,
      { filter: 'available', mine: true },
      getRequester,
    );

    expect(listCalls).toStrictEqual([
      { filter: 'available', sort: 'added', take: 100 },
    ]);
    expect(result.requests.map(row => row.title)).toStrictEqual(['Movie 1']);
  });

  it('omits tagMissingOn when not filtering by requester', async () => {
    const { client } = fakeSeerr({
      radarr: withoutRequester,
      requests: [requestFor(1, 'movie', 1)],
    });

    const result = await listRequests(client, {}, unusedRequester);

    expect(result).not.toHaveProperty('tagMissingOn');
  });

  it('returns the first 20 of 25 matching requests in Seerr’s order', async () => {
    const requests = Array.from({ length: 25 }, (_, i) =>
      requestFor(100 - i, 'movie', i + 1),
    );
    const { client } = fakeSeerr({ requests });

    const result = await listRequests(client, {}, unusedRequester);

    expect(result.requests.map(row => row.title)).toStrictEqual(
      Array.from({ length: 20 }, (_, i) => movieTitle(i + 1)),
    );
  });

  it('still returns 20 valid rows when invalid rows are interleaved', async () => {
    const valid = Array.from({ length: 25 }, (_, i) =>
      requestFor(100 - i, 'movie', i + 1),
    );
    const noMedia = requestFor(200, 'movie', 900, { media: null, type: null });
    const noTmdbId = requestFor(201, 'movie', 901, { media: { status: 5 } });
    const noMediaType = requestFor(202, 'movie', 902, {
      media: { mediaType: null, status: 5, tmdbId: 902 },
      type: null,
    });
    const requests = [
      ...valid.slice(0, 3),
      noMedia,
      ...valid.slice(3, 10),
      noTmdbId,
      ...valid.slice(10, 15),
      noMediaType,
      ...valid.slice(15),
    ];
    const { client } = fakeSeerr({ requests });

    const result = await listRequests(client, {}, unusedRequester);

    expect(result.requests.map(row => row.title)).toStrictEqual(
      Array.from({ length: 20 }, (_, i) => movieTitle(i + 1)),
    );
  });

  it('dedupes before capping, so duplicates among the newest 20 don’t cost rows', async () => {
    const distinct = Array.from({ length: 20 }, (_, i) =>
      requestFor(100 - i, 'movie', i + 1),
    );
    const requests = [
      ...distinct.slice(0, 5),
      requestFor(300, 'movie', 1),
      ...distinct.slice(5, 10),
      requestFor(301, 'movie', 2),
      ...distinct.slice(10),
    ];
    const { client } = fakeSeerr({ requests });

    const result = await listRequests(client, {}, unusedRequester);

    expect(result.requests.map(row => row.title)).toStrictEqual(
      Array.from({ length: 20 }, (_, i) => movieTitle(i + 1)),
    );
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

      const result = await listRequests(client, {}, unusedRequester);

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

    await expect(listRequests(client, {}, unusedRequester)).rejects.toBe(error);
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

    const result = await listRequests(client, {}, unusedRequester);

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

    const result = await listRequests(client, {}, unusedRequester);

    expect(result.requests.map(row => row.title)).toStrictEqual(['Movie 1']);
  });

  it('falls back to media.mediaType when type is missing', async () => {
    const { client } = fakeSeerr({
      requests: [requestFor(1, 'tv', 2, { type: null })],
    });

    const result = await listRequests(client, {}, unusedRequester);

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

    const result = await listRequests(client, {}, unusedRequester);

    expect(result.requests).toMatchObject([
      { mediaType: 'movie', title: 'Movie 2' },
    ]);
  });

  it('gives a null requestedOn when createdAt is missing', async () => {
    const { client } = fakeSeerr({
      requests: [requestFor(1, 'movie', 1, { createdAt: null })],
    });

    const result = await listRequests(client, {}, unusedRequester);

    expect(result.requests).toMatchObject([{ requestedOn: null }]);
  });

  it('returns no rows when there are no requests', async () => {
    const { client } = fakeSeerr();

    await expect(
      listRequests(client, {}, unusedRequester),
    ).resolves.toStrictEqual({ requests: [] });
  });
});
