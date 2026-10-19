import type { TelegramEventContext } from 'eve/channels/telegram';
import type { SessionContext } from 'eve/tools';
import { describe, expect, it, vi } from 'vitest';

import { onMessageCompleted } from './on-message-completed';

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

describe('onMessageCompleted', () => {
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

  it('sends plain text when escaping pushes the reply past one Telegram message', async () => {
    // 2,000 ampersands fit in one message, but escaped to &amp; they need 10,000
    // characters. eve would split that and send every chunk after the first
    // without parse_mode, showing the entities raw.
    const reply = `<b>Title</b> ${'&'.repeat(2_000)}`;
    const post = vi.fn(async () => ({ id: '1', raw: null }));

    await onMessageCompleted(completed(reply), channelWith(post), session);

    expect(post).toHaveBeenCalledExactlyOnceWith(`Title ${'&'.repeat(2_000)}`);
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
