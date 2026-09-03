import { describe, expect, it } from 'vitest';

import { ALLOWLIST_ENV } from './constants';
import { parseAllowlist } from './parse-allowlist';

describe('parseAllowlist', () => {
  it('maps each Telegram user id to a name and a lowercased tag', () => {
    const users = parseAllowlist(
      '{"123456789":"Alice","987654321":"Bob Smith"}',
    );

    expect(users.get('123456789')).toEqual({ name: 'Alice', tag: 'alice' });
    expect(users.get('987654321')).toEqual({
      name: 'Bob Smith',
      tag: 'bob smith',
    });
    expect(users.size).toBe(2);
  });

  it('trims surrounding whitespace from names before deriving the tag', () => {
    expect(parseAllowlist('{"1":"  Alice "}').get('1')).toEqual({
      name: 'Alice',
      tag: 'alice',
    });
  });

  it('throws when the env var is unset or blank', () => {
    expect(() => parseAllowlist(undefined)).toThrow(
      `${ALLOWLIST_ENV} is not set`,
    );
    expect(() => parseAllowlist('   ')).toThrow(`${ALLOWLIST_ENV} is not set`);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseAllowlist('{"123":"Alice"')).toThrow(
      `${ALLOWLIST_ENV} is not valid JSON`,
    );
  });

  it.each([
    ['an array', '["Alice"]'],
    ['a non-numeric user id', '{"alice":"Alice"}'],
    ['a non-string name', '{"123":42}'],
    ['an empty name', '{"123":""}'],
  ])('throws when the JSON is %s', (_label, raw) => {
    expect(() => parseAllowlist(raw)).toThrow(`${ALLOWLIST_ENV} is malformed`);
  });

  it('names the offending key in the error', () => {
    expect(() => parseAllowlist('{"123":"Alice","456":""}')).toThrow(
      'at "456"',
    );
  });
});
