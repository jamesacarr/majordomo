import { describe, expect, it } from 'vitest';

import { isTooManyRequests } from './is-too-many-requests';

describe('isTooManyRequests', () => {
  it("recognises eve's sendMessage error for HTTP 429", () => {
    expect(
      isTooManyRequests(
        new Error(
          'Telegram sendMessage failed with HTTP 429: Too Many Requests: retry after 3',
        ),
      ),
    ).toBe(true);
  });

  it('is false for other statuses and non-errors', () => {
    expect(
      isTooManyRequests(
        new Error('Telegram sendMessage failed with HTTP 400: Bad Request'),
      ),
    ).toBe(false);
    expect(isTooManyRequests(new Error('HTTP 4290'))).toBe(false);
    expect(isTooManyRequests('HTTP 429')).toBe(false);
  });
});
