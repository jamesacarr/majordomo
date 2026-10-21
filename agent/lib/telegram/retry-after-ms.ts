import { z } from 'zod';

import { DEFAULT_RETRY_AFTER_MS } from './constants';

/** Telegram's 429 body: `{ ok: false, error_code: 429, parameters: { retry_after } }`. */
const throttledBodySchema = z.object({
  parameters: z.object({ retry_after: z.number().positive() }),
});

/** eve's `sendMessage` error carries Telegram's description, "Too Many Requests: retry after N". */
const RETRY_AFTER_TEXT = /\bretry after (\d+)\b/u;

const readSeconds = (source: unknown): number | undefined => {
  if (source instanceof Error) {
    const match = RETRY_AFTER_TEXT.exec(source.message);

    return match ? Number(match[1]) : undefined;
  }

  const parsed = throttledBodySchema.safeParse(source);

  return parsed.success ? parsed.data.parameters.retry_after : undefined;
};

/**
 * How long Telegram asked a throttled bot to wait, in milliseconds, read from
 * a raw API 429 body or from eve's `sendMessage` error. Falls back to
 * `DEFAULT_RETRY_AFTER_MS` when neither says.
 */
export const retryAfterMs = (source: unknown): number => {
  const seconds = readSeconds(source);

  return seconds && seconds > 0 ? seconds * 1000 : DEFAULT_RETRY_AFTER_MS;
};
