import { defineEval } from 'eve/evals';
import { includes, satisfies } from 'eve/evals/expect';

export default defineEval({
  description:
    'A name with no person in Seerr gets a reply that nobody was found, with no titles named.',
  async test(t) {
    const turn = await t.send('Any films with Zorblax Quimby?');

    t.succeeded();
    t.calledTool('search_media_by_person', {
      output: { outcome: 'no_person' },
    });
    t.check(
      turn.message,
      includes(/(couldn't|could not|can't) find|no one|nobody/iu),
    );
    t.check(
      turn.message,
      satisfies<string | undefined>(
        message => !(message ?? '').includes('<b>'),
        'names no title',
      ),
    );
  },
});
