import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description:
    'A question about who is in a title is answered from get_media_details, not memory.',
  async test(t) {
    const turn = await t.send(
      'Who directed the 1984 Dune, and who played Paul in it?',
    );

    t.succeeded();
    t.toolOrder(['search_media', 'get_media_details']);
    t.calledTool('get_media_details', {
      input: { mediaType: 'movie', tmdbId: 841 },
    });
    t.check(turn.message, includes('David Lynch'));
    t.check(turn.message, includes('Kyle MacLachlan'));
  },
});
