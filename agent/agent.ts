import { defineAgent } from 'eve';

const ONE_DAY_MS = 24 * 60 * 60 * 1_000;

export default defineAgent({
  // Cost bounds; see docs/plan.md "Cost controls". A Telegram chat is one
  // session and every model call re-sends its history, so a short lifetime
  // is the main lever. The token budgets are a backstop against runaway turns.
  limits: {
    maxInputTokensPerSession: 250_000,
    maxOutputTokensPerSession: 25_000,
    sessionTimeoutMs: ONE_DAY_MS,
  },
  model: 'minimax/minimax-m3',
});
