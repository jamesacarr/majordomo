import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description:
    'A title with one match is answered from search_media without asking which one.',
  async test(t) {
    const turn = await t.send('Is Fight Club on the server?');

    t.succeeded();
    t.calledTool('search_media', { input: { query: /fight club/iu } });
    t.notCalledTool('ask_question');
    t.check(turn.message, includes('<b>Fight Club</b>'));
  },
});
