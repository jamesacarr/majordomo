import { describe, expect, it } from 'vitest';

import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapes &, < and >, ampersands first so nothing is escaped twice', () => {
    expect(escapeHtml('<b>Tom & Jerry</b>')).toBe(
      '&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;',
    );
  });
});
