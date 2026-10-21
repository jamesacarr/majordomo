import { renderTelegramInputRequest } from 'eve/channels/telegram';
import { describe, expect, it } from 'vitest';

import { numberOptions } from './number-options';
import type { InputRequest } from './types';

const request = (labels: readonly string[]): InputRequest => ({
  action: {
    callId: 'call-1',
    input: {},
    kind: 'tool-call',
    toolName: 'pick_media',
  },
  kind: 'question',
  options: labels.map((label, i) => ({ id: `movie:${i + 1}`, label })),
  prompt: 'Which one do you mean?',
  requestId: 'req-1',
});

describe('numberOptions', () => {
  it('prefixes each label with its position and keeps the ids', () => {
    expect(
      numberOptions(request(['Dune (2021)', 'Dune (1984)'])).options,
    ).toEqual([
      { id: 'movie:1', label: '1. Dune (2021)' },
      { id: 'movie:2', label: '2. Dune (1984)' },
    ]);
  });

  it('leaves the original request untouched', () => {
    const original = request(['Dune (2021)']);

    numberOptions(original);

    expect(original.options).toEqual([{ id: 'movie:1', label: 'Dune (2021)' }]);
  });

  it('returns a request with no options as it is', () => {
    const { options: _dropped, ...withoutOptions } = request([]);

    expect(numberOptions(withoutOptions)).toBe(withoutOptions);
  });

  it('pushes the end of a near-64-character label past eve’s button truncation', () => {
    // 62 characters: fits a button alone, but not with the "1. " prefix.
    const label = `${'A Very Long Title That Goes On And On'.padEnd(52, '.')} (2018, TV)`;
    const rendered = renderTelegramInputRequest(
      numberOptions(request([label, 'Other'])),
      {},
    );
    const buttons = rendered.replyMarkup?.inline_keyboard as
      | { text: string }[][]
      | undefined;

    expect(label.length).toBeLessThanOrEqual(64);
    expect(buttons?.[0]?.[0]?.text).toHaveLength(64);
    expect(buttons?.[0]?.[0]?.text).not.toContain('(2018, TV)');
  });
});
