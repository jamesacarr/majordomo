import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

import type config from '../evals.config';

// Arrival isn't in the request list, so the model falls back to search_media,
// which shows it not requested.
export default defineEval<typeof config>({
  description:
    'A status question about a title nobody requested falls back from get_media_requests to search_media.',
  async test(t) {
    const turn = await t.send("What's the status of Arrival?");

    t.succeeded();
    t.toolOrder(['get_media_requests', 'search_media']);
    t.check(
      turn.message,
      includes(/n.t (been )?requested|isn.t on the server|not on the server/iu),
    );
  },
  timeoutMs: 300_000,
});
