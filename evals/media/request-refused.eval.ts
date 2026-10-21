import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const ALIEN = 348;

export default defineEval<typeof config>({
  description:
    'When Seerr refuses the requester, nothing is requested and the reply says so and gives Seerr’s reason.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withProfile('refused', async () => {
      const turn = await t.send('Can you get Alien?');

      turn.parked();

      const request = turn.session.requireInputRequest({
        toolName: 'request_media',
      });
      const next = await turn.session.respond([
        { optionId: 'approve', requestId: request.requestId },
      ]);

      t.calledTool('request_media', {
        output: {
          message: 'You do not have permission to make movie requests.',
          outcome: 'refused',
        },
      });
      t.check(
        seerr.requests.filter(posted => posted.mediaId === ALIEN),
        equals([]),
      );
      t.check(
        next.message,
        includes(
          /nothing (was|has been) requested|n.t (been )?requested|couldn.t request/iu,
        ),
      );
      t.check(next.message, includes(/permission/iu));
    });
  },
  timeoutMs: 300_000,
});
