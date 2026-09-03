import { z } from 'zod';

import type { AllowedUser } from './allowed-user';
import { ALLOWLIST_ENV } from './allowlist-env';

const allowlistSchema = z.record(
  z.string().regex(/^\d+$/u, 'Telegram user ids are numeric strings'),
  z.string().trim().min(1, 'display name must not be empty'),
);

/**
 * Parses the allowlist JSON. Throws when the value is missing, is not JSON, or
 * does not match `{ "<telegram user id>": "<display name>" }`.
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
  const users = new Map<string, AllowedUser>();
  for (const [id, name] of Object.entries(parsed.data)) {
    users.set(id, { name, tag: name.toLowerCase() });
  }
  return users;
};
