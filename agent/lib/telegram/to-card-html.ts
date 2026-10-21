import { TELEGRAM_CAPTION_MAX_LENGTH } from './constants';
import { escapeHtml } from './escape-html';

/** The longest escaped summary that fits `budget`, cut at a character and ended with `…`. */
const fitSummary = (summary: string, budget: number): string => {
  const escaped = escapeHtml(summary);

  if (escaped.length <= budget) {
    return escaped;
  }

  for (let length = budget - 1; length > 0; length--) {
    const cut = `${escapeHtml(summary.slice(0, length).trimEnd())}…`;

    if (cut.length <= budget) {
      return cut;
    }
  }

  return '';
};

/**
 * A poster card's HTML: the heading in bold, then the summary on the next
 * line, both escaped. An empty summary leaves the heading alone. The summary
 * is shortened so the whole stays within Telegram's caption cap.
 */
export const toCardHtml = (heading: string, summary: string): string => {
  const head = `<b>${escapeHtml(heading)}</b>`;

  if (summary === '') {
    return head;
  }

  const body = fitSummary(
    summary,
    TELEGRAM_CAPTION_MAX_LENGTH - head.length - 1,
  );

  return body === '' ? head : `${head}\n${body}`;
};
