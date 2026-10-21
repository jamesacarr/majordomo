import { defineEval } from 'eve/evals';
import { satisfies } from 'eve/evals/expect';

// Guards `allowFreeform: false`: eve must still resolve a typed "2" to the
// second option, or every typed pick would steer and cancel the question.
export default defineEval({
  description:
    'Typing "2" at a pick_media question picks the second option, as tapping its button would.',
  async test(t) {
    const turn = await t.send("Who's in Dune?");

    turn.parked();

    const request = turn.session.requireInputRequest({
      toolName: 'pick_media',
    });
    const second = await t.require(
      request.options?.[1],
      satisfies(option => option !== undefined, 'a second option is shown'),
    );
    const [mediaType, tmdbId] = second?.id.split(':') ?? [];

    // Steer is Telegram's turn policy; the eval driver defaults to queue.
    await turn.session.send('2', { turnPolicy: 'steer' });

    t.calledTool('pick_media', {
      output: { mediaType, status: 'chosen', tmdbId: Number(tmdbId) },
    });
  },
});
