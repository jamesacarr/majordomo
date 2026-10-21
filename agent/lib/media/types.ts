import type { MediaCandidate, MediaType } from '../seerr/types';

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
