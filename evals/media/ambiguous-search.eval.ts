import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

// Both films must be offered. The 2000 miniseries may be, since the model
// sometimes leaves it out and the person can ask for it. Anything else, such
// as the Part Two sequel, fails.
const DUNE_FILMS = ['movie:438631', 'movie:841'];
const DUNE_VERSIONS = new Set([...DUNE_FILMS, 'tv:1910']);

const offersDuneVersions = (ids: readonly string[]): boolean =>
  DUNE_FILMS.every(id => ids.includes(id)) &&
  ids.every(id => DUNE_VERSIONS.has(id));

export default defineEval({
  description:
    'A title with several versions asks with pick_media, offering both Dune films and never the sequel, and tapping a button carries on with that title.',
  async test(t) {
    const turn = await t.send("Who's in Dune?");

    turn.parked();
    t.calledTool('search_media', { input: { query: /dune/iu } });
    t.notCalledTool('ask_question');

    const request = turn.session.requireInputRequest({
      optionIds: offersDuneVersions,
      toolName: 'pick_media',
    });
    const next = await turn.session.respond([
      { optionId: 'movie:841', requestId: request.requestId },
    ]);

    t.calledTool('pick_media', { output: { status: 'chosen', tmdbId: 841 } });
    // The follow-up turn, so a lookup made before asking doesn't count.
    next.calledTool('get_media_details', {
      input: { mediaType: 'movie', tmdbId: 841 },
    });
    t.check(next.message, includes('David Lynch'));
  },
});
