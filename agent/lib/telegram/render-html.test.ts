import { describe, expect, it } from 'vitest';

import { renderHtml } from './render-html';

describe('renderHtml', () => {
  it('escapes &, < and > in ordinary text', () => {
    expect(renderHtml('Tom & Jerry <3 x > y')).toBe(
      'Tom &amp; Jerry &lt;3 x &gt; y',
    );
  });

  it('lets <b> and </b> through untouched', () => {
    expect(renderHtml('<b>The Matrix</b> (1999)')).toBe(
      '<b>The Matrix</b> (1999)',
    );
  });

  it('escapes text inside bold and normalises tag case', () => {
    expect(renderHtml('<B>Fast & Furious</B>')).toBe(
      '<b>Fast &amp; Furious</b>',
    );
  });

  it('escapes every other tag so it renders as literal text', () => {
    expect(renderHtml('<i>no</i> <a href="x">link</a> <br/>')).toBe(
      '&lt;i&gt;no&lt;/i&gt; &lt;a href="x"&gt;link&lt;/a&gt; &lt;br/&gt;',
    );
    expect(renderHtml('<b class="x">bold</b>')).toBe(
      '&lt;b class="x"&gt;bold</b>',
    );
  });

  it('leaves text without markup or special characters alone', () => {
    expect(renderHtml('Consider it done.')).toBe('Consider it done.');
    expect(renderHtml('')).toBe('');
  });
});
