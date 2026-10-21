import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const HEAT = 949;

// Declining never reaches tag resolution, so this eval doesn't take the
// stub's tag lock.
export default defineEval<typeof config>({
  description:
    'Cancelling the approval posts nothing, and the request_media call never completes.',
  async test(t) {
    const { seerr } = t.context;
    const turn = await t.send('Can you get Heat?');

    turn.parked();

    const request = turn.session.requireInputRequest({
      toolName: 'request_media',
    });

    const next = await turn.session.respond([
      { optionId: 'cancel', requestId: request.requestId },
    ]);

    // Not parked again: the model must not re-request after a cancel.
    next.succeeded();

    t.check(
      seerr.requests.filter(posted => posted.mediaId === HEAT),
      equals([]),
    );
    t.calledTool('request_media', { count: 0 });
    t.check(next.message, includes(/nothing|not requested|cancel/iu));
  },
});
