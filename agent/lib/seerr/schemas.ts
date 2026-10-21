// Schemas for the parts of the Seerr v1 API the tools use, checked against the
// Seerr 3.4.1 source, which the published OpenAPI spec trails. Only fields the
// logic depends on are required. Everything else is nullish, because TMDB
// sends nulls, empty strings and missing fields, and an over-strict schema
// would turn a harmless upstream change into every call failing. Unknown keys
// are stripped.

import { z } from 'zod';

/** Seerr's record of a title it already knows about. Absent until first requested or synced. */
export const mediaInfoSchema = z.object({
  status: z.number(),
  tmdbId: z.number().nullish(),
});

export const movieResultSchema = z.object({
  id: z.number(),
  mediaInfo: mediaInfoSchema.nullish(),
  mediaType: z.literal('movie'),
  overview: z.string().nullish(),
  posterPath: z.string().nullish(),
  releaseDate: z.string().nullish(),
  title: z.string(),
  voteAverage: z.number().nullish(),
  voteCount: z.number().nullish(),
});

export const tvResultSchema = z.object({
  firstAirDate: z.string().nullish(),
  id: z.number(),
  mediaInfo: mediaInfoSchema.nullish(),
  mediaType: z.literal('tv'),
  name: z.string(),
  overview: z.string().nullish(),
  posterPath: z.string().nullish(),
  voteAverage: z.number().nullish(),
  voteCount: z.number().nullish(),
});

/**
 * Seerr's `/search` maps TMDB's movie and TV results, and turns every other
 * type into a person-shaped result that keeps TMDB's `media_type` (3.4.1,
 * `mapSearchResults`). So besides `person` and `collection`, any new TMDB type
 * can appear. None of them can be requested, so they become `null`. They are
 * relabelled before the discriminated union runs, so a malformed movie or TV
 * result still reports the exact field that failed.
 */
const searchResultSchema = z.preprocess(
  value =>
    typeof value === 'object' &&
    value !== null &&
    'mediaType' in value &&
    value.mediaType !== 'movie' &&
    value.mediaType !== 'tv'
      ? { mediaType: 'other' }
      : value,
  z.discriminatedUnion('mediaType', [
    movieResultSchema,
    tvResultSchema,
    z.object({ mediaType: z.literal('other') }).transform(() => null),
  ]),
);

const pageOf = <T extends z.ZodType>(result: T) =>
  z.object({
    page: z.number().nullish(),
    results: z.array(result),
    totalPages: z.number().nullish(),
    totalResults: z.number().nullish(),
  });

/** A `/search` page with everything but movies and TV dropped. */
export const searchPageSchema = pageOf(searchResultSchema).transform(page => ({
  ...page,
  results: page.results.filter(result => result !== null),
}));

export const moviePageSchema = pageOf(movieResultSchema);

export const tvPageSchema = pageOf(tvResultSchema);

const namedSchema = z.object({ name: z.string() });

/**
 * Cast and crew as Seerr maps them (`server/models/common.ts`, 3.4.1). TV
 * cast comes from TMDB's aggregate credits, with each actor's most frequent
 * role as `character`.
 */
const creditsSchema = z.object({
  cast: z
    .array(namedSchema.extend({ character: z.string().nullish() }))
    .nullish(),
  crew: z.array(namedSchema.extend({ job: z.string().nullish() })).nullish(),
});

/** `/movie/{id}` returns many more fields; only these are read. */
export const movieDetailsSchema = z.object({
  credits: creditsSchema.nullish(),
  genres: z.array(namedSchema).nullish(),
  id: z.number(),
  mediaInfo: mediaInfoSchema.nullish(),
  overview: z.string().nullish(),
  posterPath: z.string().nullish(),
  releaseDate: z.string().nullish(),
  runtime: z.number().nullish(),
  title: z.string(),
});

/** `/tv/{id}` returns many more fields; only these are read. */
export const tvDetailsSchema = z.object({
  createdBy: z.array(namedSchema).nullish(),
  credits: creditsSchema.nullish(),
  firstAirDate: z.string().nullish(),
  genres: z.array(namedSchema).nullish(),
  id: z.number(),
  mediaInfo: mediaInfoSchema.nullish(),
  name: z.string(),
  numberOfSeasons: z.number().nullish(),
  overview: z.string().nullish(),
  posterPath: z.string().nullish(),
  seasons: z.array(z.object({ seasonNumber: z.number() })).nullish(),
});

/** A Radarr or Sonarr server as Seerr lists it under `/service/radarr` or `/service/sonarr`. */
export const serviceServerSchema = z.object({
  id: z.number(),
  is4k: z.boolean(),
  isDefault: z.boolean(),
  name: z.string().nullish(),
});

export const serviceServersSchema = z.array(serviceServerSchema);

export const serviceTagSchema = z.object({
  id: z.number(),
  label: z.string(),
});

/** `/service/{radarr,sonarr}/{id}`. The spec omits `tags`, but Seerr 3.4.1 returns the server's tags here. */
export const serviceServerDetailsSchema = z.object({
  server: serviceServerSchema.nullish(),
  tags: z.array(serviceTagSchema),
});

/**
 * A request as `GET /request` lists it. `status`: 1 pending approval,
 * 2 approved, 3 declined, 4 failed, 5 completed. Requests made outside
 * majordomo may carry no tags.
 */
export const mediaRequestSchema = z.object({
  createdAt: z.string().nullish(),
  id: z.number(),
  media: mediaInfoSchema
    .extend({ mediaType: z.enum(['movie', 'tv']).nullish() })
    .nullish(),
  status: z.number(),
  tags: z.array(z.number()).nullish(),
  type: z.enum(['movie', 'tv']).nullish(),
});

/** The request `POST /request` creates. It must echo the tags sent, so they are required here. */
export const createdRequestSchema = mediaRequestSchema.extend({
  tags: z.array(z.number()),
});

export const requestPageSchema = z.object({
  pageInfo: z
    .object({
      page: z.number().nullish(),
      pages: z.number().nullish(),
      results: z.number().nullish(),
    })
    .nullish(),
  results: z.array(mediaRequestSchema),
});
