import type { TelegramContext, TelegramMessage } from 'eve/channels/telegram';
import { describe, expect, it, vi } from 'vitest';

import { ALLOWLIST_AUTHENTICATOR, ALLOWLIST_ENV } from '../constants';
import { createOnMessage } from './create-on-message';

const env = { [ALLOWLIST_ENV]: '{"123456789":"Alice"}' };

const message = (
  overrides: Partial<TelegramMessage> = {},
): TelegramMessage => ({
  attachments: [],
  caption: '',
  chat: { id: '123456789', type: 'private' },
  from: { firstName: 'Alice', id: '123456789', isBot: false },
  messageId: '42',
  raw: {},
  text: 'Can you get The Matrix?',
  ...overrides,
});

const context = () => {
  const startTyping = vi.fn(async () => {});
  const ctx = { telegram: { startTyping } } as unknown as TelegramContext;
  return { ctx, startTyping };
};

describe('createOnMessage', () => {
  it('admits an allowlisted user in a private chat with the allowlist identity', async () => {
    const { ctx, startTyping } = context();

    const result = await createOnMessage(env)(ctx, message());

    expect(result).toEqual({
      auth: {
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
      },
      title: 'Alice',
    });
    expect(startTyping).toHaveBeenCalledOnce();
  });

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
