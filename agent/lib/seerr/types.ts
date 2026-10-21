import type { z } from 'zod';

import type {
  combinedCreditsSchema,
  mediaInfoSchema,
  mediaRequestSchema,
  movieDetailsSchema,
  moviePageSchema,
  movieResultSchema,
  personResultSchema,
  personSearchPageSchema,
  requestPageSchema,
  searchPageSchema,
  tvDetailsSchema,
  tvPageSchema,
  tvResultSchema,
} from './schemas';

// Response types come from the schemas in `schemas.ts`, which validate every
// Seerr answer. Request inputs and what the model sees are written by hand.

export type MediaType = 'movie' | 'tv';

/** Seerr's `MediaStatus` enum (`server/constants/media.ts`), by name. */
export type Availability =
  | 'unknown'
  | 'pending'
  | 'processing'
  | 'partially_available'
  | 'available'
  | 'blocklisted'
  | 'deleted'
  | 'not_requested';

/** Seerr's `MediaRequestStatus` enum (`server/constants/media.ts`), by name. */
export type RequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'declined'
  | 'failed'
  | 'completed'
  | 'unknown';

export type MediaInfo = z.output<typeof mediaInfoSchema>;
export type MovieResult = z.output<typeof movieResultSchema>;
export type TvResult = z.output<typeof tvResultSchema>;
export type SearchPage = z.output<typeof searchPageSchema>;
export type PersonResult = z.output<typeof personResultSchema>;
export type PersonSearchPage = z.output<typeof personSearchPageSchema>;
export type CombinedCredits = z.output<typeof combinedCreditsSchema>;
export type CastCredit = CombinedCredits['cast'][number];
export type CrewCredit = CombinedCredits['crew'][number];
export type MoviePage = z.output<typeof moviePageSchema>;
export type TvPage = z.output<typeof tvPageSchema>;
export type MovieDetails = z.output<typeof movieDetailsSchema>;
export type TvDetails = z.output<typeof tvDetailsSchema>;
export type MediaRequest = z.output<typeof mediaRequestSchema>;
export type RequestPage = z.output<typeof requestPageSchema>;

/** `POST /request`. The requester is the client's `X-API-User`. */
export interface CreateRequestBody {
  readonly mediaId: number;
  readonly mediaType: MediaType;
  readonly seasons?: readonly number[] | 'all';
}

export interface ListRequestsParams {
  readonly filter?:
    | 'all'
    | 'approved'
    | 'available'
    | 'pending'
    | 'processing'
    | 'unavailable'
    | 'failed'
    | 'deleted'
    | 'completed';
  readonly mediaType?: MediaType | 'all';
  /**
   * The Seerr user whose requests to list. Required: a caller with
   * `MANAGE_REQUESTS` or `REQUEST_VIEW` would otherwise get everyone's.
   */
  readonly requestedBy: number;
  readonly skip?: number;
  readonly sort?: 'added' | 'modified';
  readonly take?: number;
}

export interface Client {
  readonly createRequest: (body: CreateRequestBody) => Promise<MediaRequest>;
  readonly listRequests: (params: ListRequestsParams) => Promise<RequestPage>;
  readonly movie: (id: number) => Promise<MovieDetails>;
  readonly movieRecommendations: (id: number) => Promise<MoviePage>;
  readonly movieSimilar: (id: number) => Promise<MoviePage>;
  /** A person's movie and TV credits, cast and crew; credits of any other type are dropped. */
  readonly personCredits: (id: number) => Promise<CombinedCredits>;
  /** Only movie and TV results; people, collections and anything else are dropped. */
  readonly search: (query: string) => Promise<SearchPage>;
  /** The same `/search` as `search`, keeping only people, in Seerr's order. */
  readonly searchPeople: (query: string) => Promise<PersonSearchPage>;
  readonly tv: (id: number) => Promise<TvDetails>;
  readonly tvRecommendations: (id: number) => Promise<TvPage>;
  readonly tvSimilar: (id: number) => Promise<TvPage>;
}

/** What the media tools hand the model: small, and directly requestable by `tmdbId`. */
export interface MediaCandidate {
  readonly availability: Availability;
  readonly mediaType: MediaType;
  readonly overview: string;
  readonly title: string;
  readonly tmdbId: number;
  readonly year: number | null;
}
