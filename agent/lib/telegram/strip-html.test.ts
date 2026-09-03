import { describe, expect, it } from 'vitest';

import { stripHtml } from './strip-html';

describe('stripHtml', () => {
  it('removes bold tags and keeps everything else verbatim', () => {
    expect(stripHtml('<b>Tom & Jerry</b> <i>x</i> a < b')).toBe(
      'Tom & Jerry <i>x</i> a < b',
    );
  });

  it('removes bold tags regardless of case', () => {
    expect(stripHtml('<B>Alien</B>')).toBe('Alien');
  });
});
