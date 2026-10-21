import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const ARRIVAL = 329_865;

// The requester comes from MAJORDOMO_DEV_USER ('Eval Tester'), set by the
// `eval` script, so a `requested` outcome also shows the tool found one.
export default defineEval<typeof config>({
  description:
    'Approving a request for a title not on the server posts it once, tagged seerr and with the requester tag, and reports the title, year and status.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withTags(
      [
        { id: 1, label: 'seerr' },
        { id: 2, label: 'eval-tester' },
      ],
      async () => {
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
          equals([{ mediaId: ARRIVAL, mediaType: 'movie', tags: [1, 2] }]),
        );
        t.calledTool('request_media', {
          output: { outcome: 'requested', status: 'approved' },
        });
        t.check(next.message, includes('<b>Arrival</b>'));
        t.check(next.message, includes('2016'));
        t.check(next.message, includes(/approved/iu));
      },
    );
  },
  timeoutMs: 300_000,
});
