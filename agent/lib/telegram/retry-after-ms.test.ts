import { describe, expect, it } from 'vitest';

import { DEFAULT_RETRY_AFTER_MS } from './constants';
import { retryAfterMs } from './retry-after-ms';

describe('retryAfterMs', () => {
  it('reads retry_after from a raw Telegram 429 body', () => {
    expect(
      retryAfterMs({
        error_code: 429,
        ok: false,
        parameters: { retry_after: 3 },
      }),
    ).toBe(3000);
  });

  it("reads the wait from eve's sendMessage error", () => {
    expect(
      retryAfterMs(
        new Error(
          'Telegram sendMessage failed with HTTP 429: Too Many Requests: retry after 7',
        ),
      ),
    ).toBe(7000);
  });

  it.each([
    ['a body without parameters', { error_code: 429, ok: false }],
    ['a non-positive wait', { parameters: { retry_after: 0 } }],
    ['an error that names no wait', new Error('HTTP 429: Too Many Requests')],
    ['nothing at all', null],
  ])('falls back to the default for %s', (_, source) => {
    expect(retryAfterMs(source)).toBe(DEFAULT_RETRY_AFTER_MS);
  });
});
