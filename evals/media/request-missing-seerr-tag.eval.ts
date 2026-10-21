import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const BLADE_RUNNER = 78;

export default defineEval<typeof config>({
  description:
    'When the server has no seerr tag, an approved request posts nothing and the reply names the missing tag.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withTags([{ id: 2, label: 'eval-tester' }], async () => {
      const turn = await t.send('Can you get Blade Runner?');

      turn.parked();

      const request = turn.session.requireInputRequest({
        toolName: 'request_media',
      });
      const next = await turn.session.respond([
        { optionId: 'approve', requestId: request.requestId },
      ]);

      t.calledTool('request_media', {
        output: { missing: ['seerr'], outcome: 'missing_tags' },
      });
      t.check(
        seerr.requests.filter(posted => posted.mediaId === BLADE_RUNNER),
        equals([]),
      );
      t.check(
        next.message,
        includes(/\bseerr\b[^.]{0,8}\btag\b|\btag\b[^.]*\bseerr\b/iu),
      );
    });
  },
  timeoutMs: 300_000,
});
