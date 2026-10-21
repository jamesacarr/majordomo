import type { TelegramHandle } from 'eve/channels/telegram';
import { describe, expect, it, vi } from 'vitest';

import { sendCard } from './send-card';

type Post = TelegramHandle['post'];
type Request = TelegramHandle['request'];

const handle = ({
  messageThreadId,
  ok = true,
  post = vi.fn<Post>(async () => ({ id: '2', raw: null })),
  request = vi.fn<Request>(async () => ({
    body: {},
    ok,
    status: ok ? 200 : 400,
  })),
}: {
  readonly messageThreadId?: number;
  readonly ok?: boolean;
  readonly post?: ReturnType<typeof vi.fn<Post>>;
  readonly request?: ReturnType<typeof vi.fn<Request>>;
} = {}) => ({
  chatId: '42',
  messageThreadId,
  post,
  request,
});

const HTML = '<b>1. Dune (2021)</b>\nPaul travels to Arrakis.';
const POSTER = 'https://image.tmdb.org/t/p/w342/dune.jpg';

describe('sendCard', () => {
  it('sends the poster captioned with the card as HTML', async () => {
    const telegram = handle();

    await sendCard(telegram, HTML, POSTER);

    expect(telegram.request).toHaveBeenCalledExactlyOnceWith('sendPhoto', {
      caption: HTML,
      chat_id: '42',
      parse_mode: 'HTML',
      photo: POSTER,
    });
    expect(telegram.post).not.toHaveBeenCalled();
  });

  it('sends the photo to the forum topic when there is one', async () => {
    const telegram = handle({ messageThreadId: 9 });

    await sendCard(telegram, HTML, POSTER);

    expect(telegram.request).toHaveBeenCalledWith(
      'sendPhoto',
      expect.objectContaining({ message_thread_id: 9 }),
    );
  });

  it('sends the card as text when there is no poster', async () => {
    const telegram = handle();

    await sendCard(telegram, HTML, null);

    expect(telegram.request).not.toHaveBeenCalled();
    expect(telegram.post).toHaveBeenCalledExactlyOnceWith({
      parse_mode: 'HTML',
      text: HTML,
    });
  });

  it('falls back to text when Telegram rejects the photo', async () => {
    const telegram = handle({ ok: false });

    await sendCard(telegram, HTML, POSTER);

    expect(telegram.post).toHaveBeenCalledExactlyOnceWith({
      parse_mode: 'HTML',
      text: HTML,
    });
  });

  it('falls back to text when the photo request throws', async () => {
    const telegram = handle({
      request: vi.fn<Request>().mockRejectedValue(new Error('network down')),
    });

    await sendCard(telegram, HTML, POSTER);

    expect(telegram.post).toHaveBeenCalledOnce();
  });

  it('swallows a text send that fails', async () => {
    const telegram = handle({
      post: vi
        .fn<Post>()
        .mockRejectedValue(
          new Error('Telegram sendMessage failed with HTTP 500'),
        ),
    });

    await expect(sendCard(telegram, HTML, null)).resolves.toBeUndefined();
  });
});
