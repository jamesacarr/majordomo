import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description:
    'Typing "the Lynch one" at a pick_media question cancels it, and the model resolves the reply to the 1984 film.',
  async test(t) {
    const turn = await t.send("Who's in Dune?");

    turn.parked();
    t.calledTool('search_media', { input: { query: /dune/iu } });
    turn.session.requireInputRequest({ toolName: 'pick_media' });

    // Steer is Telegram's turn policy; the eval driver defaults to queue.
    const next = await turn.session.send('the Lynch one', {
      turnPolicy: 'steer',
    });

    t.calledTool('pick_media', { output: { status: 'cancelled' } });
    t.notCalledTool('search_media_by_person');
    // The follow-up turn, so a lookup made before asking doesn't count.
    next.calledTool('get_media_details', {
      input: { mediaType: 'movie', tmdbId: 841 },
    });
    // The cast answers "Who's in Dune?"; the director's name may come back
    // as the person's own "Lynch".
    t.check(next.message, includes('Kyle MacLachlan'));
  },
});
