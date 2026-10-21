import { defineEval } from 'eve/evals';
import { includes, satisfies } from 'eve/evals/expect';

import type config from '../evals.config';

// The requester comes from MAJORDOMO_DEV_USER ('Eval Tester'), whose tag id
// is 2 in the stub. Fight Club carries another person's tag and The Matrix
// none, so neither may appear.
export default defineEval<typeof config>({
  description:
    '"What have I requested?" lists only the requests carrying the requester’s tag.',
  async test(t) {
    await t.context.seerr.withTags(
      [
        { id: 1, label: 'seerr' },
        { id: 2, label: 'eval-tester' },
      ],
      async () => {
        const turn = await t.send('What have I requested?');

        t.succeeded();
        t.calledTool('get_media_requests', { input: { mine: true } });
        t.check(turn.message, includes('Dune'));
        t.check(turn.message, includes('Severance'));
        t.check(
          turn.message,
          satisfies<string>(
            text => !/Fight Club|Matrix/u.test(text),
            'names no one else’s requests',
          ),
        );
      },
    );
  },
  timeoutMs: 300_000,
});
