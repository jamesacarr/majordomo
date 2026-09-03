import { describe, expect, it } from 'vitest';

import { ALLOWLIST_ENV } from './allowlist-env';
import { lookupUser } from './lookup-user';

describe('lookupUser', () => {
  const env = { [ALLOWLIST_ENV]: '{"123456789":"Alice"}' };

  it('returns the allowlisted user', () => {
    expect(lookupUser('123456789', env)).toEqual({
      name: 'Alice',
      tag: 'alice',
    });
  });

  it('returns null for an id that is not listed', () => {
    expect(lookupUser('555', env)).toBeNull();
  });

  it('throws rather than returning null when the allowlist is missing', () => {
    expect(() => lookupUser('123456789', {})).toThrow(
      `${ALLOWLIST_ENV} is not set`,
    );
  });
});
