import { BOLD_TAG } from './constants';

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Prepares model output for Telegram's HTML parse mode. `<b>` and `</b>` pass
 * through; every other `&`, `<` and `>` is escaped so stray angle brackets in
 * titles or overviews cannot break the message or smuggle in other tags.
 */
export const renderHtml = (text: string): string => {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(BOLD_TAG)) {
    html += escapeHtml(text.slice(last, match.index));
    html += match[1] === '/' ? '</b>' : '<b>';
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
};
