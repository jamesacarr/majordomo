/**
 * Reads HTTP 429 out of the plain `Error` eve's `sendMessage` wrapper throws,
 * as `isBadRequest` does for 400. Verified against eve 0.81.1.
 */
export const isTooManyRequests = (error: unknown): boolean =>
  error instanceof Error && /\bHTTP 429\b/u.test(error.message);
