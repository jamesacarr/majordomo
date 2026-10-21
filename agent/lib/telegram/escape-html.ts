/** Escapes the three characters Telegram's HTML parse mode reserves. */
export const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
