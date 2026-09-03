import type { TelegramEventContext } from 'eve/channels/telegram';
import type { SessionContext } from 'eve/tools';
import { describe, expect, it, vi } from 'vitest';

import {
  isTelegramBadRequest,
  onMessageCompleted,
  renderTelegramHtml,
  stripTelegramHtml,
} from './deliver';

describe('renderTelegramHtml', () => {
  it('escapes &, < and > in ordinary text', () => {
    expect(renderTelegramHtml('Tom & Jerry <3 x > y')).toBe(
      'Tom &amp; Jerry &lt;3 x &gt; y',
    );
  });

  it('lets <b> and </b> through untouched', () => {
    expect(renderTelegramHtml('<b>The Matrix</b> (1999)')).toBe(
      '<b>The Matrix</b> (1999)',
    );
  });

  it('escapes text inside bold and normalises tag case', () => {
    expect(renderTelegramHtml('<B>Fast & Furious</B>')).toBe(
      '<b>Fast &amp; Furious</b>',
    );
  });

  it('escapes every other tag so it renders as literal text', () => {
    expect(renderTelegramHtml('<i>no</i> <a href="x">link</a> <br/>')).toBe(
      '&lt;i&gt;no&lt;/i&gt; &lt;a href="x"&gt;link&lt;/a&gt; &lt;br/&gt;',
    );
    expect(renderTelegramHtml('<b class="x">bold</b>')).toBe(
      '&lt;b class="x"&gt;bold</b>',
    );
  });

  it('leaves text without markup or special characters alone', () => {
    expect(renderTelegramHtml('Consider it done.')).toBe('Consider it done.');
    expect(renderTelegramHtml('')).toBe('');
  });
});

describe('stripTelegramHtml', () => {
  it('removes bold tags and keeps everything else verbatim', () => {
    expect(stripTelegramHtml('<b>Tom & Jerry</b> <i>x</i> a < b')).toBe(
      'Tom & Jerry <i>x</i> a < b',
    );
  });
});

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

describe('onMessageCompleted', () => {
  const completed = (
    message: string | null,
    finishReason: 'stop' | 'tool-calls' = 'stop',
  ) => ({
    finishReason,
    message,
    sequence: 1,
    stepIndex: 0,
    turnId: 'turn-1',
  });
  const session = {} as SessionContext;
  const channelWith = (post: (body: unknown) => Promise<unknown>) =>
    ({ telegram: { post } }) as unknown as TelegramEventContext;

  it('posts the escaped reply with parse_mode HTML', async () => {
    const post = vi.fn(async () => ({ id: '1', raw: null }));

    await onMessageCompleted(
      completed('<b>Alien</b> (1979) & more'),
      channelWith(post),
      session,
    );

    expect(post).toHaveBeenCalledExactlyOnceWith({
      parse_mode: 'HTML',
      text: '<b>Alien</b> (1979) &amp; more',
    });
  });

  it('re-sends the tag-stripped plain text when Telegram rejects the HTML with 400', async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Telegram sendMessage failed with HTTP 400: Bad Request: can't parse entities",
        ),
      )
      .mockResolvedValueOnce({ id: '2', raw: null });

    await onMessageCompleted(
      completed('<b>Unclosed & broken'),
      channelWith(post),
      session,
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith('Unclosed & broken');
  });

  it('rethrows any other send failure without a plain-text retry', async () => {
    const error = new Error(
      'Telegram sendMessage failed with HTTP 429: Too Many Requests',
    );
    const post = vi.fn().mockRejectedValue(error);

    await expect(
      onMessageCompleted(completed('hello'), channelWith(post), session),
    ).rejects.toBe(error);
    expect(post).toHaveBeenCalledOnce();
  });

  it('sends nothing for tool-call boundaries or empty messages, like the default handler', async () => {
    const post = vi.fn();

    await onMessageCompleted(
      completed('thinking...', 'tool-calls'),
      channelWith(post),
      session,
    );
    await onMessageCompleted(completed(null), channelWith(post), session);
    await onMessageCompleted(completed(''), channelWith(post), session);

    expect(post).not.toHaveBeenCalled();
  });
});
