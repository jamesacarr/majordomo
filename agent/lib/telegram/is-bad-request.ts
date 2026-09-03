/**
 * eve's `sendMessage` wrapper throws a plain `Error` whose message carries the
 * HTTP status ("Telegram sendMessage failed with HTTP 400: ..."), so the status
 * has to be read back out of the text. Verified against eve 0.50.
 */
export const isBadRequest = (error: unknown): boolean =>
  error instanceof Error && /\bHTTP 400\b/u.test(error.message);
