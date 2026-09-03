import type { SessionContext } from 'eve/tools';

import type { AllowedUser } from './allowlist';

/** `authenticator` value stamped on sessions the Telegram allowlist admitted. */
export const ALLOWLIST_AUTHENTICATOR = 'majordomo-allowlist';

/** The person a tool is acting for. Same shape as an allowlist entry. */
export type Requester = AllowedUser;

/** Env vars consulted for the development fallback. */
export type PrincipalEnv = Readonly<
  Partial<Record<'EVE_DEV' | 'MAJORDOMO_DEV_USER', string>>
>;

/** The part of the runtime context this module reads. Tools pass their `ctx` straight in. */
export type RequesterContext = Pick<SessionContext, 'session'>;

const fromSession = (ctx: RequesterContext): Requester | null => {
  const current = ctx.session.auth.current;
  if (current?.authenticator !== ALLOWLIST_AUTHENTICATOR) {
    return null;
  }
  const { name, tag } = current.attributes;
  if (typeof name !== 'string' || typeof tag !== 'string') {
    return null;
  }
  return { name, tag };
};

const fromDevEnv = (env: PrincipalEnv): Requester | null => {
  const name = env.MAJORDOMO_DEV_USER?.trim();
  if (env.EVE_DEV !== '1' || !name) {
    return null;
  }
  return { name, tag: name.toLowerCase() };
};

/**
 * Returns the requester for the current session. Telegram sessions carry the
 * allowlist identity in their auth attributes. Sessions from the HTTP channel
 * (the `eve dev` TUI, evals) carry none, so under `eve dev` (which sets
 * `EVE_DEV=1`) the name falls back to `MAJORDOMO_DEV_USER`. Anywhere else a
 * session without an identity is an error: nothing may be requested on behalf
 * of nobody.
 */
export const requireRequester = (
  ctx: RequesterContext,
  env: PrincipalEnv = process.env,
): Requester => {
  const requester = fromSession(ctx) ?? fromDevEnv(env);
  if (requester === null) {
    throw new Error(
      'This session has no requester identity, so the request cannot be attributed to anyone.',
    );
  }
  return requester;
};
