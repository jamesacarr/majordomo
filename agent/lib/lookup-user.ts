import { ALLOWLIST_ENV } from './constants';
import { parseAllowlist } from './parse-allowlist';
import type { AllowedUser, Env } from './types';

/**
 * Looks up a Telegram user id in the allowlist. Returns `null` for anyone not
 * listed. Throws on a missing or malformed allowlist so misconfiguration fails
 * closed at first use rather than silently admitting nobody.
 */
export const lookupUser = (
  telegramUserId: string,
  env: Env = process.env,
): AllowedUser | null =>
  parseAllowlist(env[ALLOWLIST_ENV]).get(telegramUserId) ?? null;
