import { describe, expect, it } from 'vitest';

import { isBadRequest } from './is-bad-request';

describe('isBadRequest', () => {
  it("recognises eve's sendMessage error for HTTP 400", () => {
    const error = new Error(
      "Telegram sendMessage failed with HTTP 400: Bad Request: can't parse entities",
    );

    expect(isBadRequest(error)).toBe(true);
  });

  it('is false for other statuses and non-errors', () => {
    expect(
      isBadRequest(
        new Error(
          'Telegram sendMessage failed with HTTP 429: Too Many Requests',
        ),
      ),
    ).toBe(false);
    expect(isBadRequest(new Error('HTTP 4000'))).toBe(false);
    expect(isBadRequest('HTTP 400')).toBe(false);
  });
});
