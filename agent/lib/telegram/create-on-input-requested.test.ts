import type {
  TelegramEventContext,
  TelegramHandle,
  TelegramHitlState,
} from 'eve/channels/telegram';
import { renderTelegramInputRequest } from 'eve/channels/telegram';
import type { SessionContext } from 'eve/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MovieDetails } from '../seerr/types';
import { MAX_THROTTLE_WAIT_MS, POSTER_FETCH_TIMEOUT_MS } from './constants';
import { createOnInputRequested } from './create-on-input-requested';
import type { InputRequest } from './types';

const POSTER = 'https://image.tmdb.org/t/p/w342';

const movie = (id: number, posterPath: string | null): MovieDetails => ({
  id,
  overview: `Summary ${id}.`,
  posterPath,
  releaseDate: '2021-01-01',
  title: `Movie ${id}`,
});

/** Seerr with posters for every id but 2, and no answer at all for 404. */
const seerr = () => ({
  movie: vi.fn((id: number) =>
    id === 404
      ? Promise.reject(new Error('Not found'))
      : Promise.resolve(movie(id, id === 2 ? null : `/${id}.jpg`)),
  ),
  tv: vi.fn(() => Promise.reject(new Error('unused'))),
});

const pick = (ids: readonly number[], requestId = 'pick-1'): InputRequest => ({
  action: {
    callId: 'call-1',
    input: { candidates: [] },
    kind: 'tool-call',
    toolName: 'pick_media',
  },
  allowFreeform: false,
  display: 'select',
  kind: 'question',
  options: ids.map(id => ({ id: `movie:${id}`, label: `Movie ${id} (2021)` })),
  prompt: 'Which one do you mean?',
  requestId,
});

const approval = (tmdbId: number): InputRequest => ({
  action: {
    callId: 'call-2',
    input: { mediaType: 'movie', title: `Movie ${tmdbId}`, tmdbId, year: 2021 },
    kind: 'tool-call',
    toolName: 'request_media',
  },
  kind: 'tool-approval',
  options: [
    { id: 'approve', label: 'Approve' },
    { id: 'deny', label: 'Cancel' },
  ],
  prompt: `Request Movie ${tmdbId} (2021)?`,
  requestId: 'approval-1',
});

type ApiResponse = Awaited<ReturnType<TelegramHandle['request']>>;

const OK: ApiResponse = { body: {}, ok: true, status: 200 };

/** Telegram's answer to a bot sending too fast. */
const throttled = (seconds: number): ApiResponse => ({
  body: {
    description: `Too Many Requests: retry after ${seconds}`,
    error_code: 429,
    ok: false,
    parameters: { retry_after: seconds },
  },
  ok: false,
  status: 429,
});

/** A fake channel that records every Telegram call, in order. `answer` decides each raw API response from its body. */
const channelFor = (answer: (body: unknown) => ApiResponse = () => OK) => {
  const calls: { readonly body: unknown; readonly method: string }[] = [];
  let nextId = 100;
  const telegram = {
    chatId: '42',
    messageThreadId: undefined,
    post: vi.fn<TelegramHandle['post']>(body => {
      calls.push({ body, method: 'post' });
      nextId += 1;
      return Promise.resolve({ id: String(nextId), raw: null });
    }),
    request: vi.fn<TelegramHandle['request']>((method, body) => {
      calls.push({ body, method });
      return Promise.resolve(answer(body));
    }),
  };
  const state: TelegramHitlState = {};
  const channel = { state, telegram } as unknown as TelegramEventContext;

  return { calls, channel, state, telegram };
};

const run = async (
  requests: readonly InputRequest[],
  makeClient: () => ReturnType<typeof seerr> = seerr,
  answer?: (body: unknown) => ApiResponse,
) => {
  const fake = channelFor(answer);

  await createOnInputRequested(makeClient)(
    { requests, sequence: 1, stepIndex: 0, turnId: 'turn-1' },
    fake.channel,
    {} as SessionContext,
  );

  return fake;
};

const keyboardLabels = (body: unknown): string[] =>
  (
    body as { reply_markup: { inline_keyboard: { text: string }[][] } }
  ).reply_markup.inline_keyboard
    .flat()
    .map(button => button.text);

/** Answers 429 for the photo of `tmdbId`, and OK for everything else. */
const throttlePhotoOf =
  (tmdbId: number, seconds: number) =>
  (body: unknown): ApiResponse =>
    (body as { photo?: string }).photo === `${POSTER}/${tmdbId}.jpg`
      ? throttled(seconds)
      : OK;

/** Starts the handler without awaiting it, so fake timers can step through its waits. */
const start = (
  requests: readonly InputRequest[],
  makeClient: () => ReturnType<typeof seerr>,
  answer?: (body: unknown) => ApiResponse,
) => {
  const fake = channelFor(answer);
  const done = createOnInputRequested(makeClient)(
    { requests, sequence: 1, stepIndex: 0, turnId: 'turn-1' },
    fake.channel,
    {} as SessionContext,
  );

  return { ...fake, done };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createOnInputRequested', () => {
  it('sends a card per pick_media option in button order, then the numbered keyboard', async () => {
    const { calls, state } = await run([pick([1, 2, 3])]);

    expect(calls.map(call => call.method)).toEqual([
      'sendPhoto',
      'post',
      'sendPhoto',
      'post',
    ]);
    expect(calls[0]?.body).toEqual({
      caption: '<b>1. Movie 1 (2021)</b>\nSummary 1.',
      chat_id: '42',
      parse_mode: 'HTML',
      photo: `${POSTER}/1.jpg`,
    });
    expect(calls[1]?.body).toEqual({
      parse_mode: 'HTML',
      text: '<b>2. Movie 2 (2021)</b>\nSummary 2.',
    });
    expect(calls[2]?.body).toMatchObject({ photo: `${POSTER}/3.jpg` });
    expect(keyboardLabels(calls[3]?.body)).toEqual([
      '1. Movie 1 (2021)',
      '2. Movie 2 (2021)',
      '3. Movie 3 (2021)',
    ]);
    expect(state.hitlPrompts?.['pick-1']).toEqual({
      messageId: '102',
      options: [
        { id: 'movie:1', label: '1. Movie 1 (2021)' },
        { id: 'movie:2', label: '2. Movie 2 (2021)' },
        { id: 'movie:3', label: '3. Movie 3 (2021)' },
      ],
      text: 'Which one do you mean?',
    });
  });

  it('keeps the numbered label for a title Seerr could not describe', async () => {
    const { calls } = await run([pick([404, 1])]);

    expect(calls[0]).toEqual({
      body: { parse_mode: 'HTML', text: '<b>1. Movie 404 (2021)</b>' },
      method: 'post',
    });
    expect(calls[1]?.body).toMatchObject({ photo: `${POSTER}/1.jpg` });
  });

  it('sends no cards when Seerr describes none of the titles, but still numbers the keyboard', async () => {
    const { calls } = await run([pick([404, 404])]);

    expect(calls).toHaveLength(1);
    expect(keyboardLabels(calls[0]?.body)).toEqual([
      '1. Movie 404 (2021)',
      '2. Movie 404 (2021)',
    ]);
  });

  it('still posts the keyboard when Seerr cannot be reached at all', async () => {
    const { calls } = await run([pick([1, 3])], () => {
      throw new Error('SEERR_URL is not set');
    });

    expect(calls.map(call => call.method)).toEqual(['post']);
  });

  it('sends one card before a request_media approval, then the unchanged keyboard', async () => {
    const { calls, state } = await run([approval(1)]);

    expect(calls[0]).toEqual({
      body: {
        caption: '<b>Movie 1 (2021)</b>\nSummary 1.',
        chat_id: '42',
        parse_mode: 'HTML',
        photo: `${POSTER}/1.jpg`,
      },
      method: 'sendPhoto',
    });
    expect(keyboardLabels(calls[1]?.body)).toEqual(['Approve', 'Cancel']);
    expect(state.hitlPrompts?.['approval-1']?.text).toBe(
      'Request Movie 1 (2021)?',
    );
  });

  it('sends only the keyboard for an approval Seerr could not describe', async () => {
    const { calls } = await run([approval(404)]);

    expect(calls.map(call => call.method)).toEqual(['post']);
  });

  it('names an approval card without a year by its title alone', async () => {
    const undated = () => ({
      ...seerr(),
      movie: vi.fn(() =>
        Promise.resolve({ ...movie(5, null), overview: '', releaseDate: null }),
      ),
    });
    const { calls } = await run([approval(5)], undated);

    expect(calls[0]?.body).toEqual({
      parse_mode: 'HTML',
      text: '<b>Movie 5</b>',
    });
  });

  it.each([
    [
      'a question whose ids name no title',
      {
        ...pick([1, 2]),
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
      },
    ],
    [
      'an approval for another tool',
      {
        ...approval(1),
        action: { ...approval(1).action, toolName: 'other_tool' },
      },
    ],
  ])('renders %s exactly as eve’s default', async (_, request) => {
    const client = seerr();
    const { calls, state } = await run([request], () => client);
    const expected = renderTelegramInputRequest(request, {});

    expect(client.movie).not.toHaveBeenCalled();
    expect(calls).toEqual([
      {
        body: { reply_markup: expected.replyMarkup, text: expected.text },
        method: 'post',
      },
    ]);
    expect(state.hitlPrompts?.[request.requestId]).toEqual({
      messageId: '101',
      options: (request.options ?? []).map(({ id, label }) => ({ id, label })),
      text: expected.text,
    });
  });

  it('renders a freeform pick_media question as eve’s default ForceReply prompt', async () => {
    const { options: _dropped, ...freeform } = pick([1, 2], 'free-1');
    const client = seerr();
    const { calls, state } = await run([freeform], () => client);
    const expected = renderTelegramInputRequest(freeform, {});

    expect(client.movie).not.toHaveBeenCalled();
    expect(calls).toEqual([
      {
        body: { reply_markup: expected.replyMarkup, text: expected.text },
        method: 'post',
      },
    ]);
    expect(state.pendingFreeformReplies).toEqual({ '101': 'free-1' });
    expect(state.hitlPrompts).toBeUndefined();
  });

  it('posts the keyboard once the poster deadline passes when Seerr never answers', async () => {
    vi.useFakeTimers();
    const stalled = () => ({
      ...seerr(),
      movie: vi.fn(() => new Promise<MovieDetails>(() => {})),
    });
    const { calls, done } = start([pick([1, 3])], stalled);

    await vi.advanceTimersByTimeAsync(POSTER_FETCH_TIMEOUT_MS - 1);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await done;

    expect(calls.map(call => call.method)).toEqual(['post']);
  });

  it('stops the cards at a throttled one and holds the keyboard for Telegram’s wait', async () => {
    vi.useFakeTimers();
    const { calls, done } = start(
      [pick([1, 3, 4])],
      seerr,
      throttlePhotoOf(3, 4),
    );

    await vi.advanceTimersByTimeAsync(3999);
    expect(calls.map(call => call.method)).toEqual(['sendPhoto', 'sendPhoto']);
    await vi.advanceTimersByTimeAsync(1);
    await done;

    expect(calls.map(call => call.method)).toEqual([
      'sendPhoto',
      'sendPhoto',
      'post',
    ]);
    expect(keyboardLabels(calls[2]?.body)).toHaveLength(3);
  });

  it('caps the keyboard’s wait when Telegram asks for longer', async () => {
    vi.useFakeTimers();
    const { calls, done } = start(
      [pick([1, 3])],
      seerr,
      throttlePhotoOf(1, 60),
    );

    await vi.advanceTimersByTimeAsync(MAX_THROTTLE_WAIT_MS);
    await done;

    expect(calls.map(call => call.method)).toEqual(['sendPhoto', 'post']);
  });

  it('holds an approval’s keyboard after its card is throttled', async () => {
    vi.useFakeTimers();
    const { calls, done } = start([approval(1)], seerr, throttlePhotoOf(1, 2));

    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await done;

    expect(calls.map(call => call.method)).toEqual(['sendPhoto', 'post']);
  });

  it('registers nothing when Telegram returns no message id', async () => {
    const fake = channelFor();
    fake.telegram.post.mockResolvedValue({ id: '', raw: null });

    await createOnInputRequested(seerr)(
      {
        requests: [approval(404)],
        sequence: 1,
        stepIndex: 0,
        turnId: 'turn-1',
      },
      fake.channel,
      {} as SessionContext,
    );

    expect(fake.state.hitlPrompts).toBeUndefined();
  });

  it('handles each request in a batch in order', async () => {
    const other = {
      ...approval(1),
      action: { ...approval(1).action, toolName: 'other_tool' },
      requestId: 'other-1',
    };
    const { calls, state } = await run([pick([1, 3]), other]);

    expect(calls.map(call => call.method)).toEqual([
      'sendPhoto',
      'sendPhoto',
      'post',
      'post',
    ]);
    expect(Object.keys(state.hitlPrompts ?? {})).toEqual(['pick-1', 'other-1']);
  });
});
