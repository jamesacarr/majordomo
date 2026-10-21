import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description:
    'Changing the subject at a pick_media question cancels it, and the model answers the new message.',
  async test(t) {
    const turn = await t.send("Who's in Dune?");

    turn.parked();
    t.calledTool('search_media', { input: { query: /dune/iu } });
    turn.session.requireInputRequest({ toolName: 'pick_media' });

    // Steer is Telegram's turn policy; the eval driver defaults to queue.
    const next = await turn.session.send(
      'Actually, is Fight Club on the server?',
      { turnPolicy: 'steer' },
    );

    t.calledTool('pick_media', { output: { status: 'cancelled' } });
    t.calledTool('search_media', { input: { query: /fight club/iu } });
    t.check(next.message, includes('<b>Fight Club</b>'));
  },
});
