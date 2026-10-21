import type { TelegramChannelEvents } from 'eve/channels/telegram';
import { TELEGRAM_MESSAGE_TEXT_MAX_LENGTH } from 'eve/channels/telegram';

import { isBadRequest } from './is-bad-request';
import { renderHtml } from './render-html';
import { stripHtml } from './strip-html';
import type { HtmlMessageBody } from './types';

/**
 * `message.completed` handler. Posts the reply as HTML so `<b>` titles render.
 * eve splits text over 4096 characters and sends every chunk after the first
 * without `parse_mode`, so a reply that long goes out as plain text instead.
 * Telegram answers 400 to malformed HTML such as an unclosed tag, in which case
 * the reply is re-sent as plain text with the tags removed. The skip conditions
 * are eve's defaults.
 */
export const onMessageCompleted: NonNullable<
  TelegramChannelEvents['message.completed']
> = async (data, channel) => {
  if (data.finishReason === 'tool-calls' || !data.message) {
    return;
  }
  const html = renderHtml(data.message);
  if (html.length > TELEGRAM_MESSAGE_TEXT_MAX_LENGTH) {
    await channel.telegram.post(stripHtml(data.message));
    return;
  }
  const body: HtmlMessageBody = { parse_mode: 'HTML', text: html };
  try {
    await channel.telegram.post(body);
  } catch (error) {
    if (!isBadRequest(error)) {
      throw error;
    }
    await channel.telegram.post(stripHtml(data.message));
  }
};
