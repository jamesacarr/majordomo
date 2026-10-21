import { describe, expect, it } from 'vitest';

import { ALLOWLIST_ENV } from './constants';
import { parseAllowlist } from './parse-allowlist';

describe('parseAllowlist', () => {
  it('maps each Telegram user id to a Seerr user id', () => {
    const users = parseAllowlist('{"123456789":7,"987654321":12}');

    expect(users.get('123456789')).toEqual({ seerrUserId: 7 });
    expect(users.get('987654321')).toEqual({ seerrUserId: 12 });
    expect(users.size).toBe(2);
  });

  it('lets two Telegram accounts act as the same Seerr user', () => {
    const users = parseAllowlist('{"100":7,"200":7}');

    expect(users.get('100')).toEqual({ seerrUserId: 7 });
    expect(users.get('200')).toEqual({ seerrUserId: 7 });
  });

  it('throws when the env var is unset or blank', () => {
    expect(() => parseAllowlist(undefined)).toThrow(
      `${ALLOWLIST_ENV} is not set`,
    );
    expect(() => parseAllowlist('   ')).toThrow(`${ALLOWLIST_ENV} is not set`);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseAllowlist('{"123":7')).toThrow(
      `${ALLOWLIST_ENV} is not valid JSON`,
    );
  });

  it('throws when the JSON is not an object', () => {
    expect(() => parseAllowlist('[7]')).toThrow(
      `${ALLOWLIST_ENV} is malformed`,
    );
  });

  it.each([
    ['a non-numeric Telegram id', '{"123":7,"alice":8}', 'alice'],
    ['a Seerr id written as a string', '{"123":7,"456":"7"}', '456'],
    ['a zero Seerr id', '{"123":7,"456":0}', '456'],
    ['a negative Seerr id', '{"123":7,"456":-3}', '456'],
    ['a fractional Seerr id', '{"123":7,"456":1.5}', '456'],
  ])(
    'throws on %s, naming the variable and the entry',
    (_label, raw, entry) => {
      expect(() => parseAllowlist(raw)).toThrow(
        `${ALLOWLIST_ENV} is malformed at "${entry}"`,
      );
    },
  );
});
