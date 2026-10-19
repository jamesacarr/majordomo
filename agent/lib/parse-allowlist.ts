import { z } from 'zod';

import { ALLOWLIST_ENV } from './constants';
import { toTag } from './to-tag';
import type { AllowedUser } from './types';

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
  const idsByTag = new Map<string, string>();
  for (const [id, name] of Object.entries(parsed.data)) {
    const tag = toTag(name);
    if (tag === '') {
      throw new Error(
        `${ALLOWLIST_ENV} is malformed at "${id}": "${name}" has no letters or digits to make a tag from`,
      );
    }
    const clash = idsByTag.get(tag);
    if (clash !== undefined) {
      throw new Error(
        `${ALLOWLIST_ENV} is malformed: ids "${clash}" and "${id}" both map to tag "${tag}"; rename one`,
      );
    }
    idsByTag.set(tag, id);
    users.set(id, { name, tag });
  }
  return users;
};
