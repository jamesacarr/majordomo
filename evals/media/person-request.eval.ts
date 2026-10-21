import { defineEval } from 'eve/evals';
import { equals } from 'eve/evals/expect';

import type config from '../evals.config';

const MONEYBALL = 60_308;

// SEARCH_RESULTS has no Moneyball entry, so the request can only use the id
// from Brad Pitt's credits.
export default defineEval<typeof config>({
  description:
    'A title from search_media_by_person can be requested by its TMDB id without searching for it again.',
  async test(t) {
    const { seerr } = t.context;

    await seerr.withTags(
      [
        { id: 1, label: 'seerr' },
        { id: 2, label: 'eval-tester' },
      ],
      async () => {
        const turn = await t.send('Films with Brad Pitt?');

        t.calledTool('search_media_by_person', {
          input: { name: /brad pitt/iu },
        });

        const next = await turn.session.send('Can you get Moneyball?');

        next.parked();

        const request = next.session.requireInputRequest({
          prompt: 'Request Moneyball (2011)?',
          toolName: 'request_media',
        });

        await next.session.respond([
          { optionId: 'approve', requestId: request.requestId },
        ]);

        t.notCalledTool('search_media');
        t.calledTool('request_media', {
          input: { mediaType: 'movie', tmdbId: MONEYBALL },
          output: { outcome: 'requested' },
        });
        t.check(
          seerr.requests.filter(posted => posted.mediaId === MONEYBALL),
          equals([{ mediaId: MONEYBALL, mediaType: 'movie', tags: [1, 2] }]),
        );
      },
    );
  },
  timeoutMs: 300_000,
});
