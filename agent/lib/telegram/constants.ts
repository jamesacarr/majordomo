/** Matches the one HTML tag the model may emit, opening or closing, in any case. */
export const BOLD_TAG = /<(\/?)b>/giu;

/** Telegram's caption cap for a photo. */
export const TELEGRAM_CAPTION_MAX_LENGTH = 1024;

/** How long the poster cards may wait on Seerr before the keyboard goes out without them (decision 0023). */
export const POSTER_FETCH_TIMEOUT_MS = 3000;

/** The tool whose questions get a poster card per option. */
export const PICK_TOOL_NAME = 'pick_media';

/** The tool whose approvals get a poster card. */
export const REQUEST_TOOL_NAME = 'request_media';

/** Telegram's HTTP status for a bot sending to one chat too fast. */
export const TELEGRAM_TOO_MANY_REQUESTS = 429;

/** How long to wait after a 429 that doesn't say. */
export const DEFAULT_RETRY_AFTER_MS = 1000;

/** The longest the keyboard waits out a 429 on the cards before it's posted anyway (decision 0023). */
export const MAX_THROTTLE_WAIT_MS = 10_000;
