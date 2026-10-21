import { describe, expect, it } from 'vitest';

import { classifyRequest } from './classify-request';
import type { InputRequest } from './types';

const pick = (ids: readonly string[]): InputRequest => ({
  action: {
    callId: 'call-1',
    input: { candidates: [] },
    kind: 'tool-call',
    toolName: 'pick_media',
  },
  allowFreeform: false,
  display: 'select',
  kind: 'question',
  options: ids.map((id, i) => ({ id, label: `Title ${i + 1}` })),
  prompt: 'Which one do you mean?',
  requestId: 'req-1',
});

const approval = (
  input: InputRequest['action']['input'],
  toolName = 'request_media',
): InputRequest => ({
  action: { callId: 'call-2', input, kind: 'tool-call', toolName },
  kind: 'tool-approval',
  options: [
    { id: 'approve', label: 'Approve' },
    { id: 'deny', label: 'Cancel' },
  ],
  prompt: 'Request Dune (2021)?',
  requestId: 'req-2',
});

describe('classifyRequest', () => {
  it('reads a pick_media question into its titles, in button order', () => {
    expect(classifyRequest(pick(['movie:438631', 'tv:1910']))).toEqual({
      kind: 'pick',
      titles: [
        { label: 'Title 1', ref: { mediaType: 'movie', tmdbId: 438_631 } },
        { label: 'Title 2', ref: { mediaType: 'tv', tmdbId: 1_910 } },
      ],
    });
  });

  it('accepts four options', () => {
    expect(
      classifyRequest(pick(['movie:1', 'movie:2', 'movie:3', 'movie:4'])),
    ).toMatchObject({ kind: 'pick' });
  });

  it.each([
    ['no options', []],
    ['one option', ['movie:1']],
    ['five options', ['movie:1', 'movie:2', 'movie:3', 'movie:4', 'movie:5']],
    ['an id that names no title', ['movie:1', 'other']],
  ])('renders a pick_media question with %s as the default', (_, ids) => {
    expect(classifyRequest(pick(ids))).toEqual({ kind: 'default' });
  });

  it('renders the same question from another tool as the default', () => {
    const request = pick(['movie:1', 'movie:2']);

    expect(
      classifyRequest({
        ...request,
        action: { ...request.action, toolName: 'other_tool' },
      }),
    ).toEqual({ kind: 'default' });
  });

  it('reads a request_media approval into its title', () => {
    expect(
      classifyRequest(
        approval({
          mediaType: 'movie',
          title: 'Dune',
          tmdbId: 438_631,
          year: 2021,
        }),
      ),
    ).toEqual({
      kind: 'approval',
      ref: { mediaType: 'movie', tmdbId: 438_631 },
    });
  });

  it.each([
    ['a non-numeric tmdbId', { mediaType: 'movie', tmdbId: '438631' }],
    ['an unknown media type', { mediaType: 'book', tmdbId: 1 }],
    ['no tmdbId', { mediaType: 'tv' }],
  ])('renders an approval with %s as the default', (_, input) => {
    expect(classifyRequest(approval(input))).toEqual({ kind: 'default' });
  });

  it('renders an approval for another tool as the default', () => {
    expect(
      classifyRequest(
        approval({ mediaType: 'movie', tmdbId: 1 }, 'other_tool'),
      ),
    ).toEqual({ kind: 'default' });
  });

  it('renders a session-limit request as the default', () => {
    expect(
      classifyRequest({
        ...approval({ mediaType: 'movie', tmdbId: 1 }),
        kind: 'session-limit',
      }),
    ).toEqual({ kind: 'default' });
  });
});
