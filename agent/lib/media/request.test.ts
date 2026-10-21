import { describe, expect, it } from 'vitest';

import { ApiError } from '../seerr/api-error';
import { SEERR_TAG } from '../seerr/constants';
import { ResponseShapeError } from '../seerr/response-shape-error';
import { createdRequestSchema } from '../seerr/schemas';
import type {
  CreatedRequest,
  CreateRequestBody,
  MovieDetails,
  ServiceTag,
  TvDetails,
} from '../seerr/types';
import type { AllowedUser } from '../types';
import { request } from './request';
import type { RequestInput } from './types';

const requester: AllowedUser = { name: 'Mary Jane', tag: 'mary-jane' };

const arrival: MovieDetails = {
  id: 329_865,
  releaseDate: '2016-11-10',
  title: 'Arrival',
};

const severance: TvDetails = {
  firstAirDate: '2022-02-17',
  id: 95_396,
  name: 'Severance',
};

const defaultTags: ServiceTag[] = [
  { id: 1, label: SEERR_TAG },
  { id: 9, label: 'mary-jane' },
];

/** A `ResponseShapeError` as the client throws it for `body`, which must not match the created-request schema. */
const shapeErrorFor = (body: unknown): ResponseShapeError => {
  const parsed = createdRequestSchema.safeParse(body);

  if (parsed.success) {
    throw new Error('expected the body not to match');
  }

  return new ResponseShapeError('bad shape', parsed.error);
};

/**
 * An in-memory Seerr holding one movie and one show, one default server per
 * service with the same tags, and a `POST /request` that records each body.
 */
const fakeSeerr = ({
  created = (body: CreateRequestBody): Promise<CreatedRequest> =>
    Promise.resolve({ id: 41, status: 2, tags: [...body.tags] }),
  movie = arrival,
  tags = defaultTags,
  tv = severance,
}: {
  readonly created?: (body: CreateRequestBody) => Promise<CreatedRequest>;
  readonly movie?: MovieDetails;
  readonly tags?: ServiceTag[];
  readonly tv?: TvDetails;
} = {}) => {
  const posted: CreateRequestBody[] = [];
  const server = { id: 0, is4k: false, isDefault: true, name: 'Main' };

  return {
    client: {
      createRequest: (body: CreateRequestBody) => {
        posted.push(body);

        return created(body);
      },
      movie: (_id: number) => Promise.resolve(movie),
      radarrServer: (_id: number) => Promise.resolve({ server, tags }),
      radarrServers: () => Promise.resolve([server]),
      sonarrServer: (_id: number) => Promise.resolve({ server, tags }),
      sonarrServers: () => Promise.resolve([server]),
      tv: (_id: number) => Promise.resolve(tv),
    },
    posted,
  };
};

const movieInput: RequestInput = {
  mediaType: 'movie',
  title: 'Arrival',
  tmdbId: 329_865,
  year: 2016,
};

const tvInput: RequestInput = {
  mediaType: 'tv',
  title: 'Severance',
  tmdbId: 95_396,
  year: 2022,
};

describe('request', () => {
  it('posts the seerr and requester tag ids and reports Seerr’s title, year and status', async () => {
    const { client, posted } = fakeSeerr();

    await expect(request(client, requester, movieInput)).resolves.toEqual({
      outcome: 'requested',
      requestId: 41,
      status: 'approved',
      tags: [1, 9],
      title: 'Arrival',
      year: 2016,
    });
    expect(posted).toEqual([
      { mediaId: 329_865, mediaType: 'movie', tags: [1, 9] },
    ]);
  });

  it('reports Seerr’s title rather than the input’s when they differ only in case and spacing', async () => {
    const { client, posted } = fakeSeerr();

    const result = await request(client, requester, {
      ...movieInput,
      title: '  arrival ',
    });

    expect(result).toMatchObject({ outcome: 'requested', title: 'Arrival' });
    expect(posted).toHaveLength(1);
  });

  it('tolerates collapsed whitespace inside the title', async () => {
    const { client } = fakeSeerr({
      movie: { ...arrival, title: 'Blade Runner' },
    });

    const result = await request(client, requester, {
      ...movieInput,
      title: 'blade   runner',
    });

    expect(result).toMatchObject({
      outcome: 'requested',
      title: 'Blade Runner',
    });
  });

  it.each([
    [2, 'pending'],
    [3, 'processing'],
    [5, 'available'],
    [6, 'blocklisted'],
  ])(
    'refuses a title with media status %i (%s) without posting',
    async (status, availability) => {
      const { client, posted } = fakeSeerr({
        movie: { ...arrival, mediaInfo: { status } },
      });

      await expect(request(client, requester, movieInput)).resolves.toEqual({
        availability,
        outcome: 'already_on_server',
        title: 'Arrival',
        year: 2016,
      });
      expect(posted).toEqual([]);
    },
  );

  it('requests a partially available show', async () => {
    const { client, posted } = fakeSeerr({
      tv: { ...severance, mediaInfo: { status: 4 } },
    });

    const result = await request(client, requester, tvInput);

    expect(result).toMatchObject({ outcome: 'requested' });
    expect(posted).toHaveLength(1);
  });

  it('names a missing seerr tag and posts nothing', async () => {
    const { client, posted } = fakeSeerr({
      tags: [{ id: 9, label: 'mary-jane' }],
    });

    await expect(request(client, requester, movieInput)).resolves.toEqual({
      missing: [SEERR_TAG],
      outcome: 'missing_tags',
      title: 'Arrival',
      year: 2016,
    });
    expect(posted).toEqual([]);
  });

  it('names a missing requester tag and posts nothing', async () => {
    const { client, posted } = fakeSeerr({
      tags: [{ id: 1, label: SEERR_TAG }],
    });

    await expect(request(client, requester, tvInput)).resolves.toEqual({
      missing: ['mary-jane'],
      outcome: 'missing_tags',
      title: 'Severance',
      year: 2022,
    });
    expect(posted).toEqual([]);
  });

  it('requests every season of a show when none are named', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, requester, tvInput);

    expect(posted).toEqual([
      { mediaId: 95_396, mediaType: 'tv', seasons: 'all', tags: [1, 9] },
    ]);
  });

  it('requests only the named seasons of a show', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, requester, { ...tvInput, seasons: [1, 3] });

    expect(posted[0]).toMatchObject({ seasons: [1, 3] });
  });

  it('never sends seasons for a movie, even when given', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, requester, { ...movieInput, seasons: [1] });

    expect(posted[0]).not.toHaveProperty('seasons');
  });

  it('never sends is4k', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, requester, movieInput);
    await request(client, requester, tvInput);

    expect(posted.every(body => !('is4k' in body))).toBe(true);
  });

  it('refuses without posting when Seerr’s title differs from the approved one', async () => {
    const { client, posted } = fakeSeerr();

    await expect(
      request(client, requester, { ...movieInput, title: 'Arrival 2' }),
    ).resolves.toEqual({
      outcome: 'title_mismatch',
      title: 'Arrival',
      year: 2016,
    });
    expect(posted).toEqual([]);
  });

  it('refuses without posting when Seerr’s year differs from the approved one', async () => {
    const { client, posted } = fakeSeerr();

    await expect(
      request(client, requester, { ...movieInput, year: 2017 }),
    ).resolves.toMatchObject({ outcome: 'title_mismatch' });
    expect(posted).toEqual([]);
  });

  it('skips the year check when no year was approved', async () => {
    const { client } = fakeSeerr();
    const { year: _year, ...withoutYear } = movieInput;

    await expect(
      request(client, requester, withoutYear),
    ).resolves.toMatchObject({ outcome: 'requested' });
  });

  it('skips the year check when the approved year is null, as results without a release date give it', async () => {
    const { client } = fakeSeerr();

    await expect(
      request(client, requester, { ...movieInput, year: null }),
    ).resolves.toMatchObject({ outcome: 'requested' });
  });

  it('reports a request whose answer lacks only its tags as requested but unconfirmed', async () => {
    const { client, posted } = fakeSeerr({
      created: () =>
        Promise.reject(shapeErrorFor({ id: 41, status: 2, tags: null })),
    });

    await expect(request(client, requester, movieInput)).resolves.toEqual({
      outcome: 'requested_unconfirmed',
      title: 'Arrival',
      year: 2016,
    });
    expect(posted).toHaveLength(1);
  });

  it('rethrows a shape error from a 2xx answer that is not a request at all', async () => {
    // Seerr 3.4.1 answers NoSeasonsAvailableError with 202 { message, errors }.
    const error = shapeErrorFor({ message: 'No seasons available to request' });
    const { client } = fakeSeerr({ created: () => Promise.reject(error) });

    await expect(request(client, requester, tvInput)).rejects.toBe(error);
  });

  it('rethrows an ApiError such as a 409 duplicate', async () => {
    const error = new ApiError(409, 'Request for this media already exists.');
    const { client } = fakeSeerr({ created: () => Promise.reject(error) });

    await expect(request(client, requester, movieInput)).rejects.toBe(error);
  });

  it('reports a request status code it does not know as unknown', async () => {
    const { client } = fakeSeerr({
      created: body =>
        Promise.resolve({ id: 41, status: 99, tags: [...body.tags] }),
    });

    await expect(request(client, requester, movieInput)).resolves.toMatchObject(
      { status: 'unknown' },
    );
  });
});
