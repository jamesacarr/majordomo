import { describe, expect, it } from 'vitest';

import { TELEGRAM_CAPTION_MAX_LENGTH } from './constants';
import { toCardHtml } from './to-card-html';

describe('toCardHtml', () => {
  it('bolds the heading and puts the summary on the next line', () => {
    expect(toCardHtml('1. Dune (2021)', 'Paul travels to Arrakis.')).toBe(
      '<b>1. Dune (2021)</b>\nPaul travels to Arrakis.',
    );
  });

  it('escapes the heading and the summary', () => {
    expect(toCardHtml('Tom & Jerry <3', 'Cat > mouse')).toBe(
      '<b>Tom &amp; Jerry &lt;3</b>\nCat &gt; mouse',
    );
  });

  it('leaves the heading alone when there is no summary', () => {
    expect(toCardHtml('2. Dune (1984)', '')).toBe('<b>2. Dune (1984)</b>');
  });

  it('shortens a summary that would push the caption past the cap, ending in an ellipsis', () => {
    const html = toCardHtml('1. Dune (2021)', 'word & '.repeat(400));

    expect(html.length).toBeLessThanOrEqual(TELEGRAM_CAPTION_MAX_LENGTH);
    expect(html).toMatch(/^<b>1\. Dune \(2021\)<\/b>\nword &amp; /u);
    expect(html).toMatch(/…$/u);
  });

  it('keeps a summary that fits exactly', () => {
    const heading = 'Dune';
    const room = TELEGRAM_CAPTION_MAX_LENGTH - '<b>Dune</b>\n'.length;
    const summary = 'a'.repeat(room);

    expect(toCardHtml(heading, summary)).toBe(`<b>Dune</b>\n${summary}`);
  });

  it('drops the summary when the heading leaves no room for it', () => {
    const heading = 'h'.repeat(TELEGRAM_CAPTION_MAX_LENGTH);

    expect(toCardHtml(heading, 'A summary.')).toBe(`<b>${heading}</b>`);
  });
});
