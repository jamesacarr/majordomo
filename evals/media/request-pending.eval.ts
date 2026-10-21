import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const BLADE_RUNNER = 78;

export default defineEval<typeof config>({
  description:
    'When the requester’s Seerr user doesn’t auto-approve, the request is posted and the reply says it’s waiting for approval.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withProfile('manual', async () => {
      const turn = await t.send('Can you get Blade Runner?');

      turn.parked();

      const request = turn.session.requireInputRequest({
        toolName: 'request_media',
      });
      const next = await turn.session.respond([
        { optionId: 'approve', requestId: request.requestId },
      ]);

      t.calledTool('request_media', {
        output: { outcome: 'requested', status: 'pending_approval' },
      });
      t.check(
        seerr.requests.filter(posted => posted.mediaId === BLADE_RUNNER),
        equals([{ mediaId: BLADE_RUNNER, mediaType: 'movie' }]),
      );
      t.check(
        next.message,
        includes(
          /waiting for [^.]{0,30}approv|pending approval|needs? approv/iu,
        ),
      );
    });
  },
  timeoutMs: 300_000,
});
