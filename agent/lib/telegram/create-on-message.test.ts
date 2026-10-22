import type {
  TelegramContext,
  TelegramInboundResult,
  TelegramMessage,
} from 'eve/channels/telegram';
import { defaultTelegramAuth } from 'eve/channels/telegram';
import { describe, expect, it, vi } from 'vitest';

import { ALLOWLIST_ENV } from '../constants';
import { createOnMessage } from './create-on-message';

const env = { [ALLOWLIST_ENV]: '{"123456789":7}' };

const message = (
  overrides: Partial<TelegramMessage> = {},
): TelegramMessage => ({
  attachments: [],
  caption: '',
  chat: { id: '123456789', type: 'private' },
  from: { firstName: 'Mary', id: '123456789', isBot: false },
  messageId: '42',
  raw: {},
  text: 'Can you get The Matrix?',
  ...overrides,
});

type SessionAuth = NonNullable<TelegramInboundResult>['auth'];

/** The fields eve's `sameResponder` compares to decide who may answer an approval. */
const identity = (auth: SessionAuth | undefined) =>
  auth
    ? {
        authenticator: auth.authenticator,
        issuer: auth.issuer,
        principalId: auth.principalId,
        principalType: auth.principalType,
      }
    : null;

const context = () => {
  const startTyping = vi.fn(async () => {});
  const ctx = { telegram: { startTyping } } as unknown as TelegramContext;
  return { ctx, startTyping };
};

describe('createOnMessage', () => {
  const auth = {
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

  it('admits an allowlisted user in a private chat with their Seerr id and Telegram name', async () => {
    const { ctx, startTyping } = context();

    const result = await createOnMessage(env)(ctx, message());

    expect(result).toEqual({
      auth,
      context: ['requester_name: Mary'],
      title: 'Mary',
    });
    expect(startTyping).toHaveBeenCalledOnce();
  });

  // eve checks an approval tap against the requester with these four fields,
  // building the tapper's identity with `defaultTelegramAuth`. Any mismatch
  // rejects every approval.
  it('gives the session the identity eve gives the same person tapping an approval button', async () => {
    const { ctx } = context();
    const user = { firstName: 'Mary', id: '123456789', isBot: false };
    const botPromptMessage = message({
      from: { firstName: 'Majordomo', id: '999', isBot: true },
      messageId: '43',
    });

    const result = await createOnMessage(env)(ctx, message({ from: user }));
    const session = identity(result?.auth);

    expect(session).not.toBeNull();
    expect(session).toEqual(
      identity(defaultTelegramAuth(message({ from: user }))),
    );
    expect(session).toEqual(
      identity(defaultTelegramAuth({ ...botPromptMessage, from: user })),
    );
  });

  it('stamps the Seerr user id from the allowlist', async () => {
    const { ctx } = context();

    const result = await createOnMessage(env)(ctx, message());

    expect(result?.auth?.attributes).toMatchObject({ seerr_user_id: '7' });
  });

  it('keeps the allowlist Seerr id alongside the Telegram username', async () => {
    const { ctx } = context();
    const named = message({
      from: {
        firstName: 'Mary',
        id: '123456789',
        isBot: false,
        username: 'mary',
      },
    });

    const result = await createOnMessage(env)(ctx, named);

    expect(result?.auth?.attributes).toMatchObject({
      seerr_user_id: '7',
      username: 'mary',
    });
  });

  it('trims the Telegram first name', async () => {
    const { ctx } = context();
    const padded = message({
      from: { firstName: '  Mary ', id: '123456789', isBot: false },
    });

    await expect(createOnMessage(env)(ctx, padded)).resolves.toMatchObject({
      context: ['requester_name: Mary'],
      title: 'Mary',
    });
  });

  it.each([
    ['no first name', { id: '123456789', isBot: false }],
    ['a blank first name', { firstName: '   ', id: '123456789', isBot: false }],
  ])(
    'sends no name context and no title when the sender has %s',
    async (_label, from) => {
      const { ctx } = context();

      const result = await createOnMessage(env)(ctx, message({ from }));

      expect(result).toEqual({ auth });
    },
  );

  it('accepts a photo or document with a caption and no text', async () => {
    const { ctx } = context();
    const photo = message({
      attachments: [{ fileId: 'f1', kind: 'photo' }],
      caption: 'this one',
      text: '',
    });

    await expect(createOnMessage(env)(ctx, photo)).resolves.not.toBeNull();
  });

  it.each(['group', 'supergroup', 'channel'] as const)(
    'drops %s chats even from an allowlisted user',
    async type => {
      const { ctx, startTyping } = context();
      const group = message({ chat: { id: '-100777', title: 'Family', type } });

      await expect(createOnMessage(env)(ctx, group)).resolves.toBeNull();
      expect(startTyping).not.toHaveBeenCalled();
    },
  );

  it('drops a private message from a user who is not allowlisted', async () => {
    const { ctx, startTyping } = context();
    const stranger = message({
      chat: { id: '555', type: 'private' },
      from: { firstName: 'Mallory', id: '555', isBot: false },
    });

    await expect(createOnMessage(env)(ctx, stranger)).resolves.toBeNull();
    expect(startTyping).not.toHaveBeenCalled();
  });

  it('drops messages with no sender or from a bot', async () => {
    const { ctx } = context();
    const onMessage = createOnMessage(env);
    const { from: _sender, ...noSender } = message();

    await expect(onMessage(ctx, noSender)).resolves.toBeNull();
    await expect(
      onMessage(ctx, message({ from: { id: '123456789', isBot: true } })),
    ).resolves.toBeNull();
  });

  it('drops messages with neither text, caption nor attachments', async () => {
    const { ctx } = context();

    await expect(
      createOnMessage(env)(ctx, message({ text: '   ' })),
    ).resolves.toBeNull();
  });

  it('fails closed when the allowlist is missing', async () => {
    const { ctx } = context();

    await expect(createOnMessage({})(ctx, message())).rejects.toThrow(
      `${ALLOWLIST_ENV} is not set`,
    );
  });
});
