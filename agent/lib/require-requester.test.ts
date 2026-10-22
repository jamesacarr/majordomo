import type { SessionContext } from 'eve/tools';
import { describe, expect, it } from 'vitest';

import { DEV_SEERR_USER_ENV } from './constants';
import { requireRequester } from './require-requester';

// eve does not export this type by name; derive it from the session context tools receive.
type SessionAuthContext = NonNullable<
  SessionContext['session']['auth']['current']
>;

const contextWith = (
  current: SessionAuthContext | null,
): Pick<SessionContext, 'session'> => ({
  session: {
    auth: { current, initiator: current },
    id: 'session-1',
    turn: { id: 'turn-1', sequence: 1 },
  },
});

const telegramAuth: SessionAuthContext = {
  attributes: {
    chat_id: '123456789',
    chat_type: 'private',
    message_id: '42',
    seerr_user_id: '7',
    user_id: '123456789',
  },
  authenticator: 'telegram-webhook',
  issuer: 'telegram',
  principalId: 'telegram:123456789',
  principalType: 'user',
};

const withSeerrId = (seerrUserId: string): SessionAuthContext => ({
  ...telegramAuth,
  attributes: { ...telegramAuth.attributes, seerr_user_id: seerrUserId },
});

describe('requireRequester', () => {
  it('reads the Seerr user id from a Telegram allowlist session', () => {
    expect(requireRequester(contextWith(telegramAuth), {})).toEqual({
      seerrUserId: 7,
    });
  });

  it('prefers the session identity over the dev fallback when both exist', () => {
    const env = { EVE_DEV: '1', [DEV_SEERR_USER_ENV]: '2' };

    expect(requireRequester(contextWith(telegramAuth), env)).toEqual({
      seerrUserId: 7,
    });
  });

  it('throws when the session has no auth and dev mode is off', () => {
    expect(() =>
      requireRequester(contextWith(null), { [DEV_SEERR_USER_ENV]: '2' }),
    ).toThrow('no requester identity');
  });

  it('throws when the session has no Seerr id attribute', () => {
    const partial: SessionAuthContext = {
      ...telegramAuth,
      attributes: { chat_id: '123456789', user_id: '123456789' },
    };

    expect(() => requireRequester(contextWith(partial), {})).toThrow(
      'no requester identity',
    );
  });

  it.each(['Alice', '0', '-3', '1.5', '7abc', ''])(
    'rejects the session Seerr id %j',
    seerrUserId => {
      expect(() =>
        requireRequester(contextWith(withSeerrId(seerrUserId)), {}),
      ).toThrow('no requester identity');
    },
  );

  it('rejects a Seerr id attribute that is a list', () => {
    const list: SessionAuthContext = {
      ...telegramAuth,
      attributes: { ...telegramAuth.attributes, seerr_user_id: ['7'] },
    };

    expect(() => requireRequester(contextWith(list), {})).toThrow(
      'no requester identity',
    );
  });

  it(`falls back to ${DEV_SEERR_USER_ENV} only when EVE_DEV is 1`, () => {
    const ctx = contextWith(null);

    expect(
      requireRequester(ctx, { EVE_DEV: '1', [DEV_SEERR_USER_ENV]: ' 2 ' }),
    ).toEqual({ seerrUserId: 2 });
    expect(() =>
      requireRequester(ctx, { EVE_DEV: 'true', [DEV_SEERR_USER_ENV]: '2' }),
    ).toThrow('no requester identity');
    expect(() => requireRequester(ctx, { EVE_DEV: '1' })).toThrow(
      'no requester identity',
    );
    expect(() =>
      requireRequester(ctx, { EVE_DEV: '1', [DEV_SEERR_USER_ENV]: '  ' }),
    ).toThrow('no requester identity');
  });

  it.each(['Bob', '0', '1.5'])(
    `throws naming ${DEV_SEERR_USER_ENV} when it is set to %j`,
    value => {
      expect(() =>
        requireRequester(contextWith(null), {
          EVE_DEV: '1',
          [DEV_SEERR_USER_ENV]: value,
        }),
      ).toThrow(`${DEV_SEERR_USER_ENV} must be a Seerr user id`);
    },
  );
});
