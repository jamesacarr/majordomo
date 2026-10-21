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
