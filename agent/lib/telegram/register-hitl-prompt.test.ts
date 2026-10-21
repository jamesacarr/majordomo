import type { TelegramHitlState } from 'eve/channels/telegram';
import { describe, expect, it } from 'vitest';

import { registerHitlPrompt } from './register-hitl-prompt';
import type { InputRequest } from './types';

const request = (requestId: string): InputRequest => ({
  action: {
    callId: 'call-1',
    input: {},
    kind: 'tool-call',
    toolName: 'pick_media',
  },
  kind: 'question',
  options: [
    {
      description: 'unused',
      id: 'movie:1',
      label: '1. Dune (2021)',
      style: 'primary',
    },
  ],
  prompt: 'Which one do you mean?',
  requestId,
});

describe('registerHitlPrompt', () => {
  it('records the first prompt on empty state, keeping only option ids and labels', () => {
    const state: TelegramHitlState = {};

    registerHitlPrompt(state, request('req-1'), {
      messageId: '10',
      text: 'Which one?',
    });

    expect(state.hitlPrompts).toEqual({
      'req-1': {
        messageId: '10',
        options: [{ id: 'movie:1', label: '1. Dune (2021)' }],
        text: 'Which one?',
      },
    });
  });

  it('keeps earlier prompts and replaces the map rather than mutating it', () => {
    const state: TelegramHitlState = {};

    registerHitlPrompt(state, request('req-1'), {
      messageId: '10',
      text: 'First',
    });
    const before = state.hitlPrompts;
    registerHitlPrompt(state, request('req-2'), {
      messageId: '11',
      text: 'Second',
    });

    expect(state.hitlPrompts).not.toBe(before);
    expect(Object.keys(state.hitlPrompts ?? {})).toEqual(['req-1', 'req-2']);
  });

  it('records a request with no options as having none', () => {
    const state: TelegramHitlState = {};
    const { options: _dropped, ...withoutOptions } = request('req-1');

    registerHitlPrompt(state, withoutOptions, {
      messageId: '10',
      text: 'Why?',
    });

    expect(state.hitlPrompts?.['req-1']?.options).toEqual([]);
  });
});
