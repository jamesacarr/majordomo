import type {
  TelegramEventContext,
  TelegramHandle,
  TelegramHitlState,
} from 'eve/channels/telegram';
import { renderTelegramInputRequest } from 'eve/channels/telegram';
import type { SessionContext } from 'eve/tools';
import { describe, expect, it, vi } from 'vitest';

import type { MovieDetails } from '../seerr/types';
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

/** A fake channel that records every Telegram call, in order. */
const channelFor = () => {
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
      return Promise.resolve({ body: {}, ok: true, status: 200 });
    }),
  };
  const state: TelegramHitlState = {};
  const channel = { state, telegram } as unknown as TelegramEventContext;

  return { calls, channel, state, telegram };
};

const run = async (
  requests: readonly InputRequest[],
  makeClient: () => ReturnType<typeof seerr> = seerr,
) => {
  const fake = channelFor();

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

  it('renders a freeform question as eve’s default ForceReply prompt', async () => {
    const { options: _dropped, ...freeform } = {
      ...pick([1, 2], 'free-1'),
      action: { ...pick([1, 2]).action, toolName: 'other_tool' },
    };
    const { calls, state } = await run([freeform]);

    expect(calls[0]?.body).toMatchObject({
      reply_markup: { force_reply: true },
      text: 'Which one do you mean?',
    });
    expect(state.pendingFreeformReplies).toEqual({ '101': 'free-1' });
    expect(state.hitlPrompts).toBeUndefined();
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
