import { defineEval } from 'eve/evals';
import { includes, satisfies } from 'eve/evals/expect';

import type config from '../evals.config';

// The requester is Seerr user 2, from MAJORDOMO_DEV_SEERR_USER_ID in the
// `eval` script. The stub lists only user 2's requests, including The Matrix,
// made in Seerr's own UI. Fight Club is user 3's, so it may not appear.
export default defineEval<typeof config>({
  description:
    '"What have I requested?" lists the requester’s own Seerr requests, including ones made in Seerr itself, and no one else’s.',
  async test(t) {
    const turn = await t.send('What have I requested?');

    t.succeeded();
    t.calledTool('get_media_requests');
    t.check(turn.message, includes('Dune'));
    t.check(turn.message, includes('Severance'));
    t.check(turn.message, includes('Matrix'));
    t.check(
      turn.message,
      satisfies<string>(
        text => !/Fight Club/u.test(text),
        'names no one else’s requests',
      ),
    );
  },
  timeoutMs: 300_000,
});
