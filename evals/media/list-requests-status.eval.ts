import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

import type config from '../evals.config';

// Only Dune (2021) is in the request list, so the answer must come from its
// row without searching or asking which Dune.
export default defineEval<typeof config>({
  description:
    'A question about how a request is going is answered from get_media_requests, without searching.',
  async test(t) {
    await t.context.seerr.withTags(
      [
        { id: 1, label: 'seerr' },
        { id: 2, label: 'eval-tester' },
      ],
      async () => {
        const turn = await t.send("What's the status of Dune?");

        t.succeeded();
        t.calledTool('get_media_requests');
        t.notCalledTool('search_media');
        t.notCalledTool('pick_media');
        t.check(turn.message, includes(/process|on its way|download/iu));
      },
    );
  },
  timeoutMs: 300_000,
});
