import { describe, expect, it } from 'vitest';

import { stripTelegramHtml } from './strip-telegram-html';

describe('stripTelegramHtml', () => {
  it('removes bold tags and keeps everything else verbatim', () => {
    expect(stripTelegramHtml('<b>Tom & Jerry</b> <i>x</i> a < b')).toBe(
      'Tom & Jerry <i>x</i> a < b',
    );
  });

  it('removes bold tags regardless of case', () => {
    expect(stripTelegramHtml('<B>Alien</B>')).toBe('Alien');
  });
});
