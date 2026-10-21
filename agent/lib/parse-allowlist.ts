import { z } from 'zod';

import { ALLOWLIST_ENV } from './constants';
import type { AllowedUser } from './types';

const allowlistSchema = z.record(
  z.string().regex(/^\d+$/u, 'Telegram user ids are numeric strings'),
  z
    .number('Seerr user ids are JSON numbers, not strings')
    .int('Seerr user ids are whole numbers')
    .positive('Seerr user ids are positive'),
);

/**
 * Parses the allowlist JSON. Throws when the value is missing, is not JSON, or
 * does not match `{ "<telegram user id>": <seerr user id> }`, for example
 * `{ "123456789": 7 }`. Two Telegram ids may share a Seerr id.
 */
export const parseAllowlist = (
  raw: string | undefined,
): ReadonlyMap<string, AllowedUser> => {
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`${ALLOWLIST_ENV} is not set`);
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`${ALLOWLIST_ENV} is not valid JSON`);
  }

  const parsed = allowlistSchema.safeParse(json);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` at "${issue.path.join('.')}"` : '';
    throw new Error(
      `${ALLOWLIST_ENV} is malformed${where}: ${issue?.message ?? 'invalid shape'}`,
    );
  }

  return new Map(
    Object.entries(parsed.data).map(([id, seerrUserId]) => [
      id,
      { seerrUserId },
    ]),
  );
};
