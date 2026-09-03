import type {
  TelegramChannelEvents,
  TelegramMessageBody,
} from 'eve/channels/telegram';

/** Matches the one tag the model may emit, opening or closing, in any case. */
const BOLD_TAG = /<(\/?)b>/giu;

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Prepares model output for Telegram's HTML parse mode. `<b>` and `</b>` pass
 * through; every other `&`, `<` and `>` is escaped so stray angle brackets in
 * titles or overviews cannot break the message or smuggle in other tags.
 */
export const renderTelegramHtml = (text: string): string => {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(BOLD_TAG)) {
    html += escapeHtml(text.slice(last, match.index));
    html += match[1] === '/' ? '</b>' : '<b>';
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
};

/** Drops the bold tags and leaves everything else as the model wrote it. */
export const stripTelegramHtml = (text: string): string =>
  text.replace(BOLD_TAG, '');

/**
 * eve's `sendMessage` wrapper throws a plain `Error` whose message carries the
 * HTTP status ("Telegram sendMessage failed with HTTP 400: ..."), so the status
 * has to be read back out of the text. Verified against eve 0.50.
 */
export const isTelegramBadRequest = (error: unknown): boolean =>
  error instanceof Error && /\bHTTP 400\b/u.test(error.message);

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
    text: renderTelegramHtml(data.message),
  };
  try {
    await channel.telegram.post(body);
  } catch (error) {
    if (!isTelegramBadRequest(error)) {
      throw error;
    }
    await channel.telegram.post(stripTelegramHtml(data.message));
  }
};
