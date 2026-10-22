import type { SessionContext } from 'eve/tools';

import { DEV_SEERR_USER_ENV } from './constants';
import type { AllowedUser, Env } from './types';

/** The part of the runtime context this function reads. Tools pass their `ctx` straight in. */
type RequesterContext = Pick<SessionContext, 'session'>;

const SEERR_USER_ID = /^[1-9]\d*$/u;

const fromSession = (ctx: RequesterContext): AllowedUser | null => {
  const id = ctx.session.auth.current?.attributes.seerr_user_id;

  if (typeof id !== 'string' || !SEERR_USER_ID.test(id)) {
    return null;
  }

  return { seerrUserId: Number(id) };
};

const fromDevEnv = (env: Env): AllowedUser | null => {
  const id = env[DEV_SEERR_USER_ENV]?.trim();

  if (env.EVE_DEV !== '1' || !id) {
    return null;
  }

  if (!SEERR_USER_ID.test(id)) {
    throw new Error(
      `${DEV_SEERR_USER_ENV} must be a Seerr user id (a positive whole number), not "${id}"`,
    );
  }

  return { seerrUserId: Number(id) };
};

/**
 * Returns the requester for the current session. Telegram sessions carry the
 * allowlisted Seerr user id in their auth attributes. The attribute is trusted
 * because only the Telegram allowlist (`createOnMessage`) sets it: the HTTP
 * channel's authenticators never project a `seerr_user_id`, and no channel
 * accepts forwarded principals that could assert one. Sessions from the HTTP
 * channel (the `eve dev` TUI, evals) carry none, so under `eve dev` (which
 * sets `EVE_DEV=1`) the id falls back to `MAJORDOMO_DEV_SEERR_USER_ID`.
 * Anywhere else a session without an identity is an error: nothing may be
 * requested on behalf of nobody.
 */
export const requireRequester = (
  ctx: RequesterContext,
  env: Env = process.env,
): AllowedUser => {
  const requester = fromSession(ctx) ?? fromDevEnv(env);

  if (requester === null) {
    throw new Error(
      'This session has no requester identity, so the request cannot be attributed to anyone.',
    );
  }

  return requester;
};
