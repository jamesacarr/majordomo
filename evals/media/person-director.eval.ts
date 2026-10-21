import { defineEval } from 'eve/evals';
import { satisfies } from 'eve/evals/expect';

// Clint Eastwood's directing credits in the fixtures.
const DIRECTING = ['Gran Torino', 'Unforgiven', 'Million Dollar Baby'];

// The model may bold the person's name as well as the titles.
const ALLOWED = new Set(['Clint Eastwood', ...DIRECTING]);

const boldTitles = (message: string | undefined): string[] =>
  [...(message ?? '').matchAll(/<b>(.*?)<\/b>/gu)].map(match =>
    (match[1] ?? '').trim(),
  );

export default defineEval({
  description:
    'Asking what someone directed lists only their directing credits, not titles they only acted in.',
  async test(t) {
    const turn = await t.send('Which films did Clint Eastwood direct?');

    t.succeeded();
    t.calledTool('search_media_by_person', {
      input: { name: /clint eastwood/iu, role: 'directing' },
    });
    t.check(
      boldTitles(turn.message),
      satisfies<string[]>(
        titles =>
          titles.filter(title => DIRECTING.includes(title)).length >= 2 &&
          titles.every(title => ALLOWED.has(title)),
        'bolds only directing credits',
      ),
    );
    t.check(
      turn.message,
      satisfies<string | undefined>(
        message => !/The Good, the Bad and the Ugly/iu.test(message ?? ''),
        'does not name an acting-only credit',
      ),
    );
  },
});
