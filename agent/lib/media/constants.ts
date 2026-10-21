/** The env var holding the Seerr instance root, without `/api/v1`. */
export const SEERR_URL_ENV = 'SEERR_URL';

/** The env var holding the Seerr API key (Seerr > Settings > General). */
export const SEERR_API_KEY_ENV = 'SEERR_API_KEY';

/** Search and recommendations return at most this many candidates. Tool output is re-sent on every later model call. */
export const MAX_CANDIDATES = 8;

/** Recommendations with fewer TMDB votes than this rank below every one with more, so a 10.0 from three votes can't top the list. */
export const MIN_VOTE_COUNT = 50;

/** `get_media_details` lists this many top-billed cast members. */
export const MAX_CAST = 5;

/** `pick_media` shows at most this many titles. Telegram lays buttons out two per row, so four take the same two rows as three. */
export const MAX_PICK_OPTIONS = 4;

/** The question `pick_media` asks. Fixed, so the model writes no user-facing text. */
export const PICK_PROMPT = 'Which one do you mean?';
