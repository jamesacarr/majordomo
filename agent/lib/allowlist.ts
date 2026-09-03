import { z } from 'zod';

/** The env var holding the allowlist: a JSON map of Telegram user id to display name. */
export const ALLOWLIST_ENV = 'MAJORDOMO_ALLOWED_USERS';

/** A household member permitted to talk to the bot. */
export interface AllowedUser {
  /** Display name as written in the allowlist. */
  readonly name: string;
  /** Radarr/Sonarr tag label for this person: the lowercased name. */
  readonly tag: string;
}

const allowlistSchema = z.record(
  z.string().regex(/^\d+$/u, 'Telegram user ids are numeric strings'),
  z.string().trim().min(1, 'display name must not be empty'),
);

/** Read-only view of the env vars this module needs. */
export type AllowlistEnv = Readonly<
  Partial<Record<typeof ALLOWLIST_ENV, string>>
>;

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

/**
 * Looks up a Telegram user id in the allowlist. Returns `null` for anyone not
 * listed. Throws on a missing or malformed allowlist so misconfiguration fails
 * closed at first use rather than silently admitting nobody.
 */
export const lookupUser = (
  telegramUserId: string,
  env: AllowlistEnv = process.env,
): AllowedUser | null =>
  parseAllowlist(env[ALLOWLIST_ENV]).get(telegramUserId) ?? null;
