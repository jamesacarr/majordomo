import type {
  TelegramChannelEvents,
  TelegramMessageBody,
} from 'eve/channels/telegram';

import { isBadRequest } from './is-bad-request';
import { renderHtml } from './render-html';
import { stripHtml } from './strip-html';

/** `TelegramMessageBody` omits `parse_mode`, but eve spreads the body straight into `sendMessage`. */
type HtmlMessageBody = TelegramMessageBody & { readonly parse_mode: 'HTML' };

/**
 * `message.completed` handler. Posts the reply as HTML so `<b>` titles render.
 * Telegram answers 400 to malformed HTML (an unclosed tag, or a tag split by
 * eve's 4096-character chunking), in which case the reply is re-sent as plain
 * text with the tags removed. The skip conditions are eve's defaults.
 */
export const onMessageCompleted: NonNullable<
  TelegramChannelEvents['message.completed']
> = async (data, channel) => {
  if (data.finishReason === 'tool-calls' || !data.message) {
    return;
  }
  const body: HtmlMessageBody = {
    parse_mode: 'HTML',
    text: renderHtml(data.message),
  };
  try {
    await channel.telegram.post(body);
  } catch (error) {
    if (!isBadRequest(error)) {
      throw error;
    }
    await channel.telegram.post(stripHtml(data.message));
  }
};
