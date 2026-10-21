import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const ALIEN = 348;

export default defineEval<typeof config>({
  description:
    'When the server has no tag for the requester, an approved request posts nothing and the reply names the missing tag.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withTags([{ id: 1, label: 'seerr' }], async () => {
      const turn = await t.send('Can you get Alien?');

      turn.parked();

      const request = turn.session.requireInputRequest({
        toolName: 'request_media',
      });
      const next = await turn.session.respond([
        { optionId: 'approve', requestId: request.requestId },
      ]);

      t.calledTool('request_media', {
        output: { missing: ['eval-tester'], outcome: 'missing_tags' },
      });
      t.check(
        seerr.requests.filter(posted => posted.mediaId === ALIEN),
        equals([]),
      );
      t.check(
        next.message,
        includes(
          /\beval-tester\b[^.]{0,8}\btag\b|\btag\b[^.]*\beval-tester\b/iu,
        ),
      );
    });
  },
  timeoutMs: 300_000,
});
