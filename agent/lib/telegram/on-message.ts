import type {
  TelegramContext,
  TelegramInboundResult,
  TelegramMessage,
} from 'eve/channels/telegram';

import type { AllowlistEnv } from '../allowlist';
import { lookupUser } from '../allowlist';
import { ALLOWLIST_AUTHENTICATOR } from '../principal';

/** Signature eve expects for `telegramChannel({ onMessage })`. */
export type OnMessage = (
  ctx: TelegramContext,
  message: TelegramMessage,
) => Promise<TelegramInboundResult>;

/**
 * Builds the inbound message hook. Only private chats from allowlisted users
 * reach the agent; everything else is dropped without a reply, so strangers
 * and groups never learn the bot exists. Returning `null` is eve's "drop".
 */
export const createOnMessage =
  (env: AllowlistEnv = process.env): OnMessage =>
  async (ctx, message) => {
    if (message.chat.type !== 'private') {
      return null;
    }
    const from = message.from;
    if (from === undefined || from.isBot) {
      return null;
    }
    // Stickers, voice notes and the like arrive with no text and no supported
    // attachment. eve's default hook drops those too.
    if (
      (message.text || message.caption).trim() === '' &&
      message.attachments.length === 0
    ) {
      return null;
    }
    const user = lookupUser(from.id, env);
    if (user === null) {
      return null;
    }
    // Matches eve's default hook, which shows the typing indicator for every accepted message.
    await ctx.telegram.startTyping();
    return {
      auth: {
        attributes: {
          chat_id: message.chat.id,
          name: user.name,
          tag: user.tag,
          user_id: from.id,
        },
        authenticator: ALLOWLIST_AUTHENTICATOR,
        issuer: 'telegram',
        principalId: `telegram:${from.id}`,
        principalType: 'user',
      },
      title: user.name,
    };
  };
