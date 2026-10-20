import { defineEval } from 'eve/evals';
import { satisfies } from 'eve/evals/expect';

/** Sentence-ending punctuation followed by whitespace or the end of the reply. */
const countSentences = (text: string): number =>
  (text.trim().match(/[.!?](\s|$)/gu) ?? []).length;

export default defineEval({
  description:
    'A request outside media calls no tool and is declined in one or two sentences.',
  async test(t) {
    const turn = await t.send("What's the weather in Sydney tomorrow?");

    t.succeeded();
    t.usedNoTools();
    t.check(
      turn.message,
      satisfies<string | undefined>(
        message =>
          message !== undefined &&
          countSentences(message) >= 1 &&
          countSentences(message) <= 2,
        'declines in one or two sentences',
      ),
    );
    t.check(
      turn.message,
      satisfies<string | undefined>(
        message => !/\d|°/u.test(message ?? ''),
        'gives no temperatures or other forecast figures',
      ),
    );
  },
});
