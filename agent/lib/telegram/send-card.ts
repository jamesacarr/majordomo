import type { TelegramHandle } from 'eve/channels/telegram';

import { TELEGRAM_TOO_MANY_REQUESTS } from './constants';
import { isTooManyRequests } from './is-too-many-requests';
import { retryAfterMs } from './retry-after-ms';
import type { CardOutcome, HtmlMessageBody, TelegramApiBody } from './types';

type CardHandle = Pick<
  TelegramHandle,
  'chatId' | 'messageThreadId' | 'post' | 'request'
>;

const SENT: CardOutcome = { status: 'sent' };

/** `sendPhoto` through the raw API, which adds no chat id and resolves rather than throws on a non-2xx answer. `undefined` means the photo failed some other way. */
const sendPhoto = async (
  telegram: CardHandle,
  html: string,
  photo: string,
): Promise<CardOutcome | undefined> => {
  const body: TelegramApiBody = {
    caption: html,
    chat_id: telegram.chatId,
    parse_mode: 'HTML',
    photo,
    ...(telegram.messageThreadId === undefined
      ? {}
      : { message_thread_id: telegram.messageThreadId }),
  };

  try {
    const response = await telegram.request('sendPhoto', body);

    if (response.ok) {
      return SENT;
    }

    return response.status === TELEGRAM_TOO_MANY_REQUESTS
      ? { retryAfterMs: retryAfterMs(response.body), status: 'throttled' }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Sends one poster card: the photo captioned with `html`, or `html` as a text
 * message when there is no poster or Telegram rejects the photo (for example
 * when TMDB has no image at that path). Never rejects; a card that can't be
 * sent is skipped so the keyboard still follows (decision 0023). A 429 gets
 * no fallback: it resolves `throttled` with Telegram's wait, so the caller
 * stops sending cards and holds the keyboard until the chat clears.
 */
export const sendCard = async (
  telegram: CardHandle,
  html: string,
  posterUrl: string | null,
): Promise<CardOutcome> => {
  if (posterUrl !== null) {
    const outcome = await sendPhoto(telegram, html, posterUrl);

    if (outcome !== undefined) {
      return outcome;
    }
  }

  const body: HtmlMessageBody = { parse_mode: 'HTML', text: html };

  try {
    await telegram.post(body);
  } catch (error) {
    // Best effort: the keyboard matters more than the card.
    return isTooManyRequests(error)
      ? { retryAfterMs: retryAfterMs(error), status: 'throttled' }
      : SENT;
  }

  return SENT;
};
