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
