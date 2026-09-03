import { describe, expect, it } from 'vitest';

import { isTelegramBadRequest } from './is-telegram-bad-request';

describe('isTelegramBadRequest', () => {
  it("recognises eve's sendMessage error for HTTP 400", () => {
    const error = new Error(
      "Telegram sendMessage failed with HTTP 400: Bad Request: can't parse entities",
    );

    expect(isTelegramBadRequest(error)).toBe(true);
  });

  it('is false for other statuses and non-errors', () => {
    expect(
      isTelegramBadRequest(
        new Error(
          'Telegram sendMessage failed with HTTP 429: Too Many Requests',
        ),
      ),
    ).toBe(false);
    expect(isTelegramBadRequest(new Error('HTTP 4000'))).toBe(false);
    expect(isTelegramBadRequest('HTTP 400')).toBe(false);
  });
});
