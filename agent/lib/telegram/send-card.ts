import type { TelegramHandle } from 'eve/channels/telegram';

import type { HtmlMessageBody, TelegramApiBody } from './types';

type CardHandle = Pick<
  TelegramHandle,
  'chatId' | 'messageThreadId' | 'post' | 'request'
>;

/** `sendPhoto` through the raw API, which adds no chat id and resolves rather than throws on a non-2xx answer. */
const sendPhoto = async (
  telegram: CardHandle,
  html: string,
  photo: string,
): Promise<boolean> => {
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
    return (await telegram.request('sendPhoto', body)).ok;
  } catch {
    return false;
  }
};

/**
 * Sends one poster card: the photo captioned with `html`, or `html` as a text
 * message when there is no poster or Telegram rejects the photo (for example
 * when TMDB has no image at that path). Never rejects; a card that can't be
 * sent is skipped so the keyboard still follows (decision 0023).
 */
export const sendCard = async (
  telegram: CardHandle,
  html: string,
  posterUrl: string | null,
): Promise<void> => {
  if (posterUrl !== null && (await sendPhoto(telegram, html, posterUrl))) {
    return;
  }

  const body: HtmlMessageBody = { parse_mode: 'HTML', text: html };

  try {
    await telegram.post(body);
  } catch {
    // Best effort: the keyboard matters more than the card.
  }
};
