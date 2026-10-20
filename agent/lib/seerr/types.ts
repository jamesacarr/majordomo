// Hand-written shapes for the parts of the Seerr v1 API the tools use. Checked
// against the Seerr 3.4.1 source, which the published OpenAPI spec trails.

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

/** Seerr's record of a title it already knows about. Absent until first requested or synced. */
export interface MediaInfo {
  readonly status: number;
  readonly tmdbId: number;
}

export interface MovieResult {
  readonly id: number;
  readonly mediaInfo?: MediaInfo;
  readonly mediaType: 'movie';
  readonly overview?: string;
  readonly posterPath?: string | null;
  readonly releaseDate?: string;
  readonly title: string;
  readonly voteAverage?: number;
  readonly voteCount?: number;
}

export interface TvResult {
  readonly firstAirDate?: string;
  readonly id: number;
  readonly mediaInfo?: MediaInfo;
  readonly mediaType: 'tv';
  readonly name: string;
  readonly overview?: string;
  readonly posterPath?: string | null;
  readonly voteAverage?: number;
  readonly voteCount?: number;
}

export interface PersonResult {
  readonly id: number;
  readonly mediaType: 'person';
  readonly name: string;
}

export type SearchResult = MovieResult | TvResult | PersonResult;

export interface Page<T> {
  readonly page: number;
  readonly results: readonly T[];
  readonly totalPages: number;
  readonly totalResults: number;
}

/** `/movie/{id}` returns many more fields; only these are read. */
export interface MovieDetails {
  readonly id: number;
  readonly mediaInfo?: MediaInfo;
  readonly overview?: string;
  readonly releaseDate?: string;
  readonly title: string;
}

/** `/tv/{id}` returns many more fields; only these are read. */
export interface TvDetails {
  readonly firstAirDate?: string;
  readonly id: number;
  readonly mediaInfo?: MediaInfo;
  readonly name: string;
  readonly overview?: string;
  readonly seasons?: readonly { readonly seasonNumber: number }[];
}

/** A Radarr or Sonarr server as Seerr lists it under `/service/radarr` or `/service/sonarr`. */
export interface ServiceServer {
  readonly id: number;
  readonly is4k: boolean;
  readonly isDefault: boolean;
  readonly name: string;
}

export interface ServiceTag {
  readonly id: number;
  readonly label: string;
}

/** `/service/{radarr,sonarr}/{id}`. The spec omits `tags`, but Seerr 3.4.1 returns the server's tags here. */
export interface ServiceServerDetails {
  readonly server: ServiceServer;
  readonly tags: readonly ServiceTag[];
}

/** `POST /request`. `tags` is undocumented in the spec but read by `MediaRequest.request` in 3.4.1. */
export interface CreateRequestBody {
  readonly mediaId: number;
  readonly mediaType: MediaType;
  readonly seasons?: readonly number[] | 'all';
  readonly tags: readonly number[];
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
  readonly skip?: number;
  readonly sort?: 'added' | 'modified';
  readonly take?: number;
}

/** A request as `POST /request` and `GET /request` return it. `status`: 1 pending approval, 2 approved, 3 declined, 4 failed, 5 completed. */
export interface MediaRequest {
  readonly createdAt: string;
  readonly id: number;
  readonly media: MediaInfo & { readonly mediaType: MediaType };
  readonly status: number;
  readonly tags?: readonly number[] | null;
  readonly type: MediaType;
}

export interface RequestPage {
  readonly pageInfo: {
    readonly page: number;
    readonly pages: number;
    readonly results: number;
  };
  readonly results: readonly MediaRequest[];
}

export interface Client {
  readonly createRequest: (body: CreateRequestBody) => Promise<MediaRequest>;
  readonly listRequests: (params?: ListRequestsParams) => Promise<RequestPage>;
  readonly movie: (id: number) => Promise<MovieDetails>;
  readonly movieRecommendations: (id: number) => Promise<Page<MovieResult>>;
  readonly movieSimilar: (id: number) => Promise<Page<MovieResult>>;
  readonly radarrServer: (id: number) => Promise<ServiceServerDetails>;
  readonly radarrServers: () => Promise<readonly ServiceServer[]>;
  readonly search: (query: string) => Promise<Page<SearchResult>>;
  readonly sonarrServer: (id: number) => Promise<ServiceServerDetails>;
  readonly sonarrServers: () => Promise<readonly ServiceServer[]>;
  readonly tv: (id: number) => Promise<TvDetails>;
  readonly tvRecommendations: (id: number) => Promise<Page<TvResult>>;
  readonly tvSimilar: (id: number) => Promise<Page<TvResult>>;
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
