import { defineEval } from 'eve/evals';
import { satisfies } from 'eve/evals/expect';

// Every title get_media_recommendations returns for Fight Club in the fixtures.
const RECOMMENDED = [
  'Se7en',
  'Pulp Fiction',
  'Memento',
  'American Psycho',
  'The Usual Suspects',
  'The Machinist',
];

// 10-core.md wraps every title in <b>, so the bold spans are the titles named.
const ALLOWED_TITLES = new Set(['Fight Club', ...RECOMMENDED]);

const boldTitles = (message: string | undefined): string[] =>
  [...(message ?? '').matchAll(/<b>(.*?)<\/b>/gu)].map(match =>
    (match[1] ?? '').trim(),
  );

export default defineEval({
  description:
    'A "something like X" question searches X, then suggests up to five titles, all from get_media_recommendations.',
  async test(t) {
    const turn = await t.send('Suggest some films like Fight Club.');

    t.succeeded();
    t.toolOrder(['search_media', 'get_media_recommendations']);
    t.calledTool('get_media_recommendations', {
      input: { mediaType: 'movie', tmdbId: 550 },
    });
    t.check(
      boldTitles(turn.message),
      satisfies<string[]>(
        titles =>
          titles.filter(title => RECOMMENDED.includes(title)).length >= 3,
        'bolds at least three recommended titles',
      ),
    );
    t.check(
      boldTitles(turn.message),
      satisfies<string[]>(
        titles => titles.every(title => ALLOWED_TITLES.has(title)),
        'bolds no title the tool did not return',
      ),
    );
    t.check(
      turn.message,
      satisfies<string | undefined>(
        message => (message?.match(/^\s*\d+[.)]/gmu) ?? []).length <= 5,
        'lists at most five suggestions',
      ),
    );
  },
});
