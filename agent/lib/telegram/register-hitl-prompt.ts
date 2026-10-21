import type { TelegramHitlState } from 'eve/channels/telegram';

import type { InputRequest } from './types';

/**
 * Records a posted inline-keyboard prompt so eve's `input.resolved` handler
 * can replace its keyboard with the outcome. A structural copy of
 * `registerTelegramHitlPrompt` in eve 0.81.1 (`channels/telegram/hitl.js`),
 * which `eve/channels/telegram` doesn't export. Reassigns the whole map, as
 * eve does, so the change is written back to channel state.
 */
export const registerHitlPrompt = (
  state: TelegramHitlState,
  request: InputRequest,
  posted: { readonly messageId: string; readonly text: string },
): void => {
  state.hitlPrompts = {
    ...state.hitlPrompts,
    [request.requestId]: {
      ...posted,
      options: (request.options ?? []).map(({ id, label }) => ({ id, label })),
    },
  };
};
