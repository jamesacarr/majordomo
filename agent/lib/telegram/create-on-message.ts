import type {
  TelegramContext,
  TelegramInboundResult,
  TelegramMessage,
} from 'eve/channels/telegram';
import { defaultTelegramAuth } from 'eve/channels/telegram';

import { lookupUser } from '../lookup-user';
import type { Env } from '../types';

/**
 * Builds the inbound message hook for `telegramChannel({ onMessage })`. Only
 * private chats from allowlisted users reach the agent; everything else is
 * dropped without a reply, so strangers and groups never learn the bot exists.
 * Returning `null` is eve's "drop".
 */
export const createOnMessage =
  (env: Env = process.env) =>
  async (
    ctx: TelegramContext,
    message: TelegramMessage,
  ): Promise<TelegramInboundResult> => {
    if (message.chat.type !== 'private') {
      return null;
    }
    const from = message.from;
    // eve checks an approval tap against the session with its own
    // `defaultTelegramAuth`, so the session must carry the same identity. It
    // returns `null` only when the message has no sender.
    const telegramAuth = defaultTelegramAuth(message);

    if (telegramAuth === null || from === undefined || from.isBot) {
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

    const auth = {
      ...telegramAuth,
      attributes: {
        ...telegramAuth.attributes,
        seerr_user_id: String(user.seerrUserId),
      },
    };
    const name = from.firstName?.trim();

    if (!name) {
      return { auth };
    }

    // Auth attributes never reach the model, so the name goes in as context.
    return { auth, context: [`requester_name: ${name}`], title: name };
  };
