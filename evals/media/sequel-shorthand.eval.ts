import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

// Mad Max isn't one of the instructions' examples, so passing shows the
// sequel rule generalises rather than repeating an answer it was given.
export default defineEval({
  description:
    'A numbered sequel name that matches no title ("Mad Max 4") resolves to the one film it means, without asking which.',
  async test(t) {
    const turn = await t.send("Who's in Mad Max 4?");

    t.succeeded();
    t.calledTool('search_media', { input: { query: /mad max/iu } });
    t.notCalledTool('pick_media');
    t.calledTool('get_media_details', {
      input: { mediaType: 'movie', tmdbId: 76_341 },
    });
    t.check(turn.message, includes('Tom Hardy'));
  },
});
