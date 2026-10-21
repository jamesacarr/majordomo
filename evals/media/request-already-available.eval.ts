import { defineEval } from 'eve/evals';
import { equals, includes } from 'eve/evals/expect';

import type config from '../evals.config';

const FIGHT_CLUB = 550;

// Tests the instructions: a title that's already there is reported, not
// requested. request_media's own refusal is covered by its unit tests.
export default defineEval<typeof config>({
  description:
    'Asking for a title already on the server says so without calling request_media.',
  async test(t) {
    const { seerr } = t.context;
    const turn = await t.send('Can you get Fight Club?');

    t.succeeded();
    t.notCalledTool('request_media');
    t.check(
      seerr.requests.filter(posted => posted.mediaId === FIGHT_CLUB),
      equals([]),
    );
    t.check(turn.message, includes('<b>Fight Club</b>'));
  },
});
