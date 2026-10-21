import { defineEval } from 'eve/evals';
import { equals } from 'eve/evals/expect';

import type config from '../evals.config';

const DUNE_1984 = 841;

// Stops at the approval prompt, so it never resolves tags and doesn't take
// the stub's tag lock.
export default defineEval<typeof config>({
  description:
    'Asking for a title with several versions asks which with pick_media, then asks to approve the chosen one.',
  async test(t) {
    const { seerr } = t.context;
    const turn = await t.send('Can you get Dune?');

    turn.parked();
    t.notCalledTool('ask_question');

    const pick = turn.session.requireInputRequest({ toolName: 'pick_media' });
    const next = await turn.session.respond([
      { optionId: `movie:${DUNE_1984}`, requestId: pick.requestId },
    ]);

    next.parked();
    next.session.requireInputRequest({
      prompt: 'Request Dune (1984)?',
      toolName: 'request_media',
    });
    t.check(
      seerr.requests.filter(posted => posted.mediaId === DUNE_1984),
      equals([]),
    );
  },
});
