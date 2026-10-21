import { defineEval } from 'eve/evals';
import { satisfies } from 'eve/evals/expect';

// Brad Pitt's cast credits in the fixtures that findPersonCredits keeps.
const ACTING = [
  'Fight Club',
  'Se7en',
  'Once Upon a Time... in Hollywood',
  'Moneyball',
];

// 10-core.md wraps every title in <b>, so the bold spans are the titles named.
const ALLOWED = new Set(['Brad Pitt', ...ACTING]);

// A talk-show appearance, a one-episode guest spot and a producer-only credit.
// Case-sensitive, so the word "friends" in an overview doesn't count.
const DROPPED = /Tonight Show|\bFriends\b|12 Years a Slave/u;

const boldTitles = (message: string | undefined): string[] =>
  [...(message ?? '').matchAll(/<b>(.*?)<\/b>/gu)].map(match =>
    (match[1] ?? '').trim(),
  );

export default defineEval({
  description:
    'Asking what an actor has been in lists titles from search_media_by_person only, without self appearances, guest spots or producer credits.',
  async test(t) {
    const turn = await t.send('What has Brad Pitt been in?');

    t.succeeded();
    t.calledTool('search_media_by_person', { input: { name: /brad pitt/iu } });
    t.notCalledTool('search_media');
    t.check(
      boldTitles(turn.message),
      satisfies<string[]>(
        titles => titles.filter(title => ACTING.includes(title)).length >= 3,
        'bolds at least three acting credits',
      ),
    );
    t.check(
      boldTitles(turn.message),
      satisfies<string[]>(
        titles => titles.every(title => ALLOWED.has(title)),
        'bolds no title the tool did not return',
      ),
    );
    t.check(
      turn.message,
      satisfies<string | undefined>(
        message => !DROPPED.test(message ?? ''),
        'names no dropped credit',
      ),
    );
  },
});
