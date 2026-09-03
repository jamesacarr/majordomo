import type { SessionContext } from 'eve/tools';
import { describe, expect, it } from 'vitest';

import type { RequesterContext } from './principal';
import { ALLOWLIST_AUTHENTICATOR, requireRequester } from './principal';

// eve does not export this type by name; derive it from the session context tools receive.
type SessionAuthContext = NonNullable<
  SessionContext['session']['auth']['current']
>;

const contextWith = (current: SessionAuthContext | null): RequesterContext => ({
  session: {
    auth: { current, initiator: current },
    id: 'session-1',
    turn: { id: 'turn-1', sequence: 1 },
  },
});

const telegramAuth: SessionAuthContext = {
  attributes: {
    chat_id: '123456789',
    name: 'Alice',
    tag: 'alice',
    user_id: '123456789',
  },
  authenticator: ALLOWLIST_AUTHENTICATOR,
  issuer: 'telegram',
  principalId: 'telegram:123456789',
  principalType: 'user',
};

describe('requireRequester', () => {
  it('reads the name and tag from a Telegram allowlist session', () => {
    expect(requireRequester(contextWith(telegramAuth), {})).toEqual({
      name: 'Alice',
      tag: 'alice',
    });
  });

  it('prefers the session identity over the dev fallback when both exist', () => {
    const env = { EVE_DEV: '1', MAJORDOMO_DEV_USER: 'Bob' };

    expect(requireRequester(contextWith(telegramAuth), env)).toEqual({
      name: 'Alice',
      tag: 'alice',
    });
  });

  it('throws when the session has no auth and dev mode is off', () => {
    expect(() =>
      requireRequester(contextWith(null), { MAJORDOMO_DEV_USER: 'Bob' }),
    ).toThrow('no requester identity');
  });

  it('ignores name and tag attributes stamped by another authenticator', () => {
    const oidc: SessionAuthContext = {
      ...telegramAuth,
      authenticator: 'vercel-oidc',
    };

    expect(() => requireRequester(contextWith(oidc), {})).toThrow(
      'no requester identity',
    );
  });

  it('throws when the allowlist attributes are incomplete', () => {
    const partial: SessionAuthContext = {
      ...telegramAuth,
      attributes: { name: 'Alice' },
    };

    expect(() => requireRequester(contextWith(partial), {})).toThrow(
      'no requester identity',
    );
  });

  it('falls back to MAJORDOMO_DEV_USER only when EVE_DEV is 1', () => {
    const ctx = contextWith(null);

    expect(
      requireRequester(ctx, { EVE_DEV: '1', MAJORDOMO_DEV_USER: 'Bob Smith' }),
    ).toEqual({
      name: 'Bob Smith',
      tag: 'bob smith',
    });
    expect(() =>
      requireRequester(ctx, { EVE_DEV: 'true', MAJORDOMO_DEV_USER: 'Bob' }),
    ).toThrow();
    expect(() => requireRequester(ctx, { EVE_DEV: '1' })).toThrow(
      'no requester identity',
    );
    expect(() =>
      requireRequester(ctx, { EVE_DEV: '1', MAJORDOMO_DEV_USER: '  ' }),
    ).toThrow();
  });
});
