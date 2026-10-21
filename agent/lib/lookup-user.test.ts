import { describe, expect, it } from 'vitest';

import { ALLOWLIST_ENV } from './constants';
import { lookupUser } from './lookup-user';

describe('lookupUser', () => {
  const env = { [ALLOWLIST_ENV]: '{"123456789":7}' };

  it('returns the allowlisted user', () => {
    expect(lookupUser('123456789', env)).toEqual({ seerrUserId: 7 });
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
