import { describe, expect, it } from 'vitest';

import { ApiError } from '../seerr/api-error';
import { ResponseShapeError } from '../seerr/response-shape-error';
import { mediaRequestSchema } from '../seerr/schemas';
import type {
  Client,
  CreateRequestBody,
  MediaRequest,
  MovieDetails,
  TvDetails,
} from '../seerr/types';
import { UnknownUserError } from '../seerr/unknown-user-error';
import { request } from './request';
import type { RequestInput } from './types';

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

/** A `ResponseShapeError` as the client throws it for `body`, which must not match the request schema. */
const shapeErrorFor = (body: unknown): ResponseShapeError => {
  const parsed = mediaRequestSchema.safeParse(body);

  if (parsed.success) {
    throw new Error('expected the body not to match');
  }

  return new ResponseShapeError('bad shape', parsed.error);
};

/**
 * An in-memory Seerr holding one movie and one show, and a `POST /request`
 * that records each body. It answers as an auto-approving user (status 2)
 * unless `created` says otherwise. `calls` records every call in order.
 */
const fakeSeerr = ({
  created = () => Promise.resolve({ id: 41, status: 2 }),
  movie = (): Promise<MovieDetails> => Promise.resolve(arrival),
  tv = severance,
}: {
  readonly created?: (body: CreateRequestBody) => Promise<MediaRequest>;
  readonly movie?: () => Promise<MovieDetails>;
  readonly tv?: TvDetails;
} = {}) => {
  const posted: CreateRequestBody[] = [];
  const calls: string[] = [];
  const client: Pick<Client, 'createRequest' | 'movie' | 'tv'> = {
    createRequest: body => {
      calls.push('createRequest');
      posted.push(body);

      return created(body);
    },
    movie: () => {
      calls.push('movie');

      return movie();
    },
    tv: () => {
      calls.push('tv');

      return Promise.resolve(tv);
    },
  };

  return { calls, client, posted };
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
  it('posts only the title and reports an auto-approved request with Seerr’s title and year', async () => {
    const { client, posted } = fakeSeerr();

    await expect(request(client, movieInput)).resolves.toEqual({
      outcome: 'requested',
      requestId: 41,
      status: 'approved',
      title: 'Arrival',
      year: 2016,
    });
    expect(posted).toStrictEqual([{ mediaId: 329_865, mediaType: 'movie' }]);
  });

  it('reports a request Seerr left for approval as pending_approval', async () => {
    const { client } = fakeSeerr({
      created: () => Promise.resolve({ id: 42, status: 1 }),
    });

    await expect(request(client, movieInput)).resolves.toEqual({
      outcome: 'requested',
      requestId: 42,
      status: 'pending_approval',
      title: 'Arrival',
      year: 2016,
    });
  });

  it.each([
    'You do not have permission to make movie requests.',
    'Movie Quota exceeded.',
  ])(
    'reports a 403 from Seerr as refused with its message %j, and makes no further calls',
    async message => {
      const { calls, client } = fakeSeerr({
        created: () => Promise.reject(new ApiError(403, message)),
      });

      await expect(request(client, movieInput)).resolves.toEqual({
        message,
        outcome: 'refused',
        title: 'Arrival',
        year: 2016,
      });
      expect(calls).toStrictEqual(['movie', 'createRequest']);
    },
  );

  it('propagates an unknown Seerr user rather than reporting it as refused', async () => {
    const error = new UnknownUserError(42);
    const { client } = fakeSeerr({ created: () => Promise.reject(error) });

    await expect(request(client, movieInput)).rejects.toBe(error);
  });

  it('propagates an unknown Seerr user from the title lookup without posting', async () => {
    const error = new UnknownUserError(42);
    const { client, posted } = fakeSeerr({
      movie: () => Promise.reject(error),
    });

    await expect(request(client, movieInput)).rejects.toBe(error);
    expect(posted).toStrictEqual([]);
  });

  it('reports Seerr’s title rather than the input’s when they differ only in case and spacing', async () => {
    const { client, posted } = fakeSeerr();

    const result = await request(client, {
      ...movieInput,
      title: '  arrival ',
    });

    expect(result).toMatchObject({ outcome: 'requested', title: 'Arrival' });
    expect(posted).toHaveLength(1);
  });

  it('tolerates collapsed whitespace inside the title', async () => {
    const { client } = fakeSeerr({
      movie: () => Promise.resolve({ ...arrival, title: 'Blade Runner' }),
    });

    const result = await request(client, {
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
        movie: () => Promise.resolve({ ...arrival, mediaInfo: { status } }),
      });

      await expect(request(client, movieInput)).resolves.toEqual({
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

    const result = await request(client, tvInput);

    expect(result).toMatchObject({ outcome: 'requested' });
    expect(posted).toHaveLength(1);
  });

  it('requests every season of a show when none are named', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, tvInput);

    expect(posted).toStrictEqual([
      { mediaId: 95_396, mediaType: 'tv', seasons: 'all' },
    ]);
  });

  it('requests only the named seasons of a show', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, { ...tvInput, seasons: [1, 3] });

    expect(posted[0]).toMatchObject({ seasons: [1, 3] });
  });

  it('never sends seasons for a movie, even when given', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, { ...movieInput, seasons: [1] });

    expect(posted[0]).not.toHaveProperty('seasons');
  });

  it('never sends is4k', async () => {
    const { client, posted } = fakeSeerr();

    await request(client, movieInput);
    await request(client, tvInput);

    expect(posted.every(body => !('is4k' in body))).toBe(true);
  });

  it('refuses without posting when Seerr’s title differs from the approved one', async () => {
    const { client, posted } = fakeSeerr();

    await expect(
      request(client, { ...movieInput, title: 'Arrival 2' }),
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
      request(client, { ...movieInput, year: 2017 }),
    ).resolves.toMatchObject({ outcome: 'title_mismatch' });
    expect(posted).toEqual([]);
  });

  it('skips the year check when no year was approved', async () => {
    const { client } = fakeSeerr();
    const { year: _year, ...withoutYear } = movieInput;

    await expect(request(client, withoutYear)).resolves.toMatchObject({
      outcome: 'requested',
    });
  });

  it('skips the year check when the approved year is null, as results without a release date give it', async () => {
    const { client } = fakeSeerr();

    await expect(
      request(client, { ...movieInput, year: null }),
    ).resolves.toMatchObject({ outcome: 'requested' });
  });

  it('rethrows a shape error from a 2xx answer that is not a request at all', async () => {
    // Seerr answers NoSeasonsAvailableError with 202 { message, errors }.
    const error = shapeErrorFor({ message: 'No seasons available to request' });
    const { client } = fakeSeerr({ created: () => Promise.reject(error) });

    await expect(request(client, tvInput)).rejects.toBe(error);
  });

  it('rethrows an ApiError such as a 409 duplicate', async () => {
    const error = new ApiError(409, 'Request for this media already exists.');
    const { client } = fakeSeerr({ created: () => Promise.reject(error) });

    await expect(request(client, movieInput)).rejects.toBe(error);
  });

  it('rethrows a 403 ApiError from the title lookup rather than reporting refused', async () => {
    const error = new ApiError(403, 'Forbidden');
    const { client, posted } = fakeSeerr({
      movie: () => Promise.reject(error),
    });

    await expect(request(client, movieInput)).rejects.toBe(error);
    expect(posted).toStrictEqual([]);
  });

  it('reports a request status code it does not know as unknown', async () => {
    const { client } = fakeSeerr({
      created: () => Promise.resolve({ id: 41, status: 99 }),
    });

    await expect(request(client, movieInput)).resolves.toMatchObject({
      status: 'unknown',
    });
  });
});
