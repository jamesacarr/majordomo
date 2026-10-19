import { describe, expect, it } from 'vitest';

import { toTag } from './to-tag';

describe('toTag', () => {
  it.each([
    ['Alice', 'alice'],
    ['Mary Jane', 'mary-jane'],
    ['Mary-Jane', 'mary-jane'],
    ["  O'Brien  ", 'o-brien'],
    ['Zoë', 'zoe'],
    ['Agent 47', 'agent-47'],
    ['--Bob--', 'bob'],
  ])('turns %j into %j', (name, tag) => {
    expect(toTag(name)).toBe(tag);
  });

  it('returns an empty string when the name has no Latin letters or digits', () => {
    expect(toTag('美咲')).toBe('');
    expect(toTag('!!!')).toBe('');
  });
});
