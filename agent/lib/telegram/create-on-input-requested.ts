import type {
  TelegramChannelEvents,
  TelegramEventContext,
} from 'eve/channels/telegram';
import {
  registerTelegramFreeformPrompt,
  renderTelegramInputRequest,
} from 'eve/channels/telegram';

import { getClient } from '../media/get-client';
import type { MediaRef } from '../media/types';
import type { Client } from '../seerr/types';
import { classifyRequest } from './classify-request';
import { POSTER_FETCH_TIMEOUT_MS } from './constants';
import { fetchCards } from './fetch-cards';
import { numberOptions } from './number-options';
import { registerHitlPrompt } from './register-hitl-prompt';
import { sendCard } from './send-card';
import { toCardHtml } from './to-card-html';
import type { InputRequest } from './types';

type CardClient = Pick<Client, 'movie' | 'tv'>;

/** One card per option, in button order. A title Seerr couldn't describe keeps its numbered label, so the numbers still match the buttons. */
const sendPickCards = async (
  channel: TelegramEventContext,
  makeClient: () => CardClient,
  titles: readonly { readonly label: string; readonly ref: MediaRef }[],
): Promise<void> => {
  const cards = await fetchCards(
    makeClient,
    titles.map(({ ref }) => ref),
    POSTER_FETCH_TIMEOUT_MS,
  );

  if (cards.every(card => card === undefined)) {
    return;
  }

  for (const [i, { label }] of titles.entries()) {
    const card = cards[i];
    const heading = `${i + 1}. ${label}`;

    await sendCard(
      channel.telegram,
      toCardHtml(heading, card?.overview ?? ''),
      card?.posterUrl ?? null,
    );
  }
};

/** One card for the title about to be requested, named as Seerr knows it. */
const sendApprovalCard = async (
  channel: TelegramEventContext,
  makeClient: () => CardClient,
  ref: MediaRef,
): Promise<void> => {
  const [card] = await fetchCards(makeClient, [ref], POSTER_FETCH_TIMEOUT_MS);

  if (card === undefined) {
    return;
  }

  const heading =
    card.year === null ? card.title : `${card.title} (${card.year})`;

  await sendCard(
    channel.telegram,
    toCardHtml(heading, card.overview),
    card.posterUrl,
  );
};

/** eve 0.81.1's default `input.requested` body for one request (`channels/telegram/defaults.js`). */
const postPrompt = async (
  channel: TelegramEventContext,
  request: InputRequest,
): Promise<void> => {
  const rendered = renderTelegramInputRequest(request, channel.state);
  const posted = await channel.telegram.post({
    text: rendered.text,
    ...(rendered.replyMarkup ? { reply_markup: rendered.replyMarkup } : {}),
  });

  if (!posted.id) {
    return;
  }

  if (rendered.freeformRequestId === undefined) {
    registerHitlPrompt(channel.state, request, {
      messageId: posted.id,
      text: rendered.text,
    });
  } else {
    registerTelegramFreeformPrompt(channel.state, {
      messageId: posted.id,
      requestId: rendered.freeformRequestId,
    });
  }
};

/**
 * Builds the `input.requested` handler (decision 0023). Before a `pick_media`
 * question, each option gets a poster card numbered to match its button, and
 * the buttons gain the same numbers. Before a `request_media` approval, the
 * title gets one card. The cards are best effort and never hold back the
 * keyboard. Every other request renders exactly as eve's default.
 */
export const createOnInputRequested =
  (
    makeClient: () => CardClient = () => getClient(),
  ): NonNullable<TelegramChannelEvents['input.requested']> =>
  async (data, channel) => {
    for (const request of data.requests) {
      const preview = classifyRequest(request);

      if (preview.kind === 'pick') {
        await sendPickCards(channel, makeClient, preview.titles);
        await postPrompt(channel, numberOptions(request));
        continue;
      }

      if (preview.kind === 'approval') {
        await sendApprovalCard(channel, makeClient, preview.ref);
      }

      await postPrompt(channel, request);
    }
  };
