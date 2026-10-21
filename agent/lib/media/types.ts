import type {
  Availability,
  MediaCandidate,
  MediaType,
  RequestStatus,
} from '../seerr/types';

/** Identifies one title, the way every media tool takes it. */
export interface MediaRef {
  readonly mediaType: MediaType;
  readonly tmdbId: number;
}

/** What `get_media_details` hands the model: the candidate fields plus what tells two versions apart. */
export type MediaDetails = Omit<MediaCandidate, 'mediaType'> & {
  /** Top-billed cast, as "Name as Character" where TMDB gives the role. */
  readonly cast: readonly string[];
  readonly genres: readonly string[];
} & (
    | {
        readonly directors: readonly string[];
        readonly mediaType: 'movie';
        readonly runtimeMinutes: number | null;
      }
    | {
        readonly creators: readonly string[];
        readonly mediaType: 'tv';
        readonly seasonCount: number | null;
      }
  );

/** Which of a person's credits `search_media_by_person` returns. Omitted means both. */
export type PersonRole = 'acting' | 'directing';

/** What `search_media_by_person` hands the model. `name` is Seerr's, so a wrong namesake shows. */
export type PersonCredits =
  | {
      readonly credits: readonly MediaCandidate[];
      readonly name: string;
      readonly outcome: 'found';
    }
  | { readonly outcome: 'no_person' };

/** What a Telegram poster card shows for one title, from `posterCard`. */
export interface PosterCard {
  /** Seerr's overview, trimmed and truncated as candidates' are; may be empty. */
  readonly overview: string;
  /** `null` when TMDB has no poster for the title. */
  readonly posterUrl: string | null;
  readonly title: string;
  readonly year: number | null;
}

/** A candidate with its `pick_media` label, from `labelCandidates`. */
export interface LabelledCandidate {
  readonly item: MediaDetails;
  readonly label: string;
}

/** One button `pick_media` shows: its id names the title, its label comes from Seerr data only. */
export interface PickOption {
  /** `movie:841` or `tv:1910`, from `toOptionId`. */
  readonly id: string;
  readonly label: string;
}

/**
 * eve's answer to a `pick_media` question, as `toPickResult` reads it. A
 * structural copy of `ToolInputResponse` from `eve/tools`, so `agent/lib`
 * doesn't depend on eve.
 */
export type PickAnswer =
  | {
      readonly optionId?: string;
      readonly status: 'answered';
      readonly text?: string;
    }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable' };

/** What `pick_media` hands the model. */
export type PickResult =
  | {
      readonly mediaType: MediaType;
      readonly status: 'chosen';
      readonly title: string;
      readonly tmdbId: number;
      readonly year: number | null;
    }
  | {
      /** The labels the person saw, in button order. */
      readonly options: readonly (MediaRef & { readonly label: string })[];
      readonly status: 'cancelled';
    };

/** What `request_media` takes. `title` and `year` only build the approval prompt; Seerr's own title is what gets reported. */
export interface RequestInput extends MediaRef {
  /** TV only: the season numbers to request, or `'all'`. Omitted means all. */
  readonly seasons?: readonly number[] | 'all' | undefined;
  readonly title: string;
  /** `null` when the search result had no release date; treated as unknown. */
  readonly year?: number | null | undefined;
}

/** What `request_media` hands the model. Title and year always come from Seerr. */
export type RequestResult = {
  readonly title: string;
  readonly year: number | null;
} & (
  | {
      readonly outcome: 'requested';
      readonly requestId: number;
      readonly status: RequestStatus;
      /** The tag ids Seerr echoed back on the request. */
      readonly tags: readonly number[];
    }
  /** Seerr created the request but its answer didn't echo the tags, so they can't be confirmed. */
  | { readonly outcome: 'requested_unconfirmed' }
  | {
      readonly availability: Availability;
      readonly outcome: 'already_on_server';
    }
  /** Seerr's title or year for the id differs from the one the person approved. */
  | { readonly outcome: 'title_mismatch' }
  /** The tag labels with no Radarr or Sonarr tag; nothing was requested. */
  | { readonly missing: readonly string[]; readonly outcome: 'missing_tags' }
);

/**
 * One request's progress, from `toRequestProgress`. An approved or completed
 * request reports its media's availability, since bot requests auto-approve
 * (decision 0010); otherwise the request's own state.
 */
export type RequestProgress =
  | Extract<
      Availability,
      | 'processing'
      | 'partially_available'
      | 'available'
      | 'blocklisted'
      | 'deleted'
    >
  | 'pending_approval'
  | 'declined'
  | 'failed'
  | 'unknown';

/** What `get_media_requests` takes. */
export interface ListRequestsInput {
  /** Seerr's own request filter, passed through. Omitted lists every state. */
  readonly filter?: 'available' | 'processing' | undefined;
  /** Only the person asking's requests, matched by their Radarr or Sonarr tag. */
  readonly mine?: boolean | undefined;
}

/** One title in `get_media_requests`' answer: the newest request for it. */
export interface RequestRow {
  readonly mediaType: MediaType;
  /** `YYYY-MM-DD` from the request's `createdAt`; `null` when Seerr sent none. */
  readonly requestedOn: string | null;
  readonly status: RequestProgress;
  /** `null` when the title couldn't be fetched. */
  readonly title: string | null;
  /** `null` when the title couldn't be fetched or has no release date. */
  readonly year: number | null;
}

/** The *arr server that holds a media type's requests: Radarr for movies, Sonarr for TV. */
export type RequestServer = 'Radarr' | 'Sonarr';

/** What `get_media_requests` hands the model. */
export interface ListRequestsResult {
  /** Newest first, at most `MAX_REQUEST_ROWS`. */
  readonly requests: readonly RequestRow[];
  /** Only when `mine`: servers with no tag for the requester, so their requests there can't be found. Omitted when empty. */
  readonly tagMissingOn?: readonly RequestServer[];
}
