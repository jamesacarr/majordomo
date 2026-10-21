import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const ARRIVAL = 329_865;

// The requester is Seerr user 2, from MAJORDOMO_DEV_SEERR_USER_ID in the
// `eval` script. The stub approves user 2's requests unless an eval sets
// another profile, and it takes the profile lock here so a concurrent
// pending or refused eval can't change the answer.
export default defineEval<typeof config>({
  description:
    'Approving a request for a title not on the server posts only its media id and type, once, and reports the title, year and approved status.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withProfile('auto', async () => {
      const turn = await t.send('Can you get Arrival?');

      turn.parked();

      const request = turn.session.requireInputRequest({
        prompt: 'Request Arrival (2016)?',
        toolName: 'request_media',
      });
      const next = await turn.session.respond([
        { optionId: 'approve', requestId: request.requestId },
      ]);

      t.check(
        seerr.requests.filter(posted => posted.mediaId === ARRIVAL),
        equals([{ mediaId: ARRIVAL, mediaType: 'movie' }]),
      );
      t.calledTool('request_media', {
        output: { outcome: 'requested', status: 'approved' },
      });
      t.check(next.message, includes('<b>Arrival</b>'));
      t.check(next.message, includes('2016'));
      t.check(next.message, includes(/approved/iu));
    });
  },
  timeoutMs: 300_000,
});
