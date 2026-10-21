import { describe, expect, it } from 'vitest';

import { toApprovalPrompt } from './to-approval-prompt';

describe('toApprovalPrompt', () => {
  it('asks to request a movie by title and year', () => {
    expect(
      toApprovalPrompt({
        mediaType: 'movie',
        title: 'Arrival',
        tmdbId: 329_865,
        year: 2016,
      }),
    ).toBe('Request Arrival (2016)?');
  });

  it('leaves the year out when it is not known', () => {
    expect(
      toApprovalPrompt({ mediaType: 'movie', title: 'Arrival', tmdbId: 1 }),
    ).toBe('Request Arrival?');
  });

  it('leaves the year out when the search result had none', () => {
    expect(
      toApprovalPrompt({
        mediaType: 'movie',
        title: 'Arrival',
        tmdbId: 1,
        year: null,
      }),
    ).toBe('Request Arrival?');
  });

  it('ignores seasons for a movie', () => {
    expect(
      toApprovalPrompt({
        mediaType: 'movie',
        seasons: [1],
        title: 'Arrival',
        tmdbId: 1,
        year: 2016,
      }),
    ).toBe('Request Arrival (2016)?');
  });

  it.each<[string, readonly number[] | 'all' | undefined, string]>([
    ['no seasons', undefined, 'Request Severance (2022), all seasons?'],
    ["'all'", 'all', 'Request Severance (2022), all seasons?'],
    ['one season', [2], 'Request Severance (2022), season 2?'],
    ['two seasons', [1, 2], 'Request Severance (2022), seasons 1 and 2?'],
    [
      'several seasons',
      [1, 2, 4],
      'Request Severance (2022), seasons 1, 2 and 4?',
    ],
  ])('names the seasons of a TV show given %s', (_label, seasons, prompt) => {
    expect(
      toApprovalPrompt({
        mediaType: 'tv',
        title: 'Severance',
        tmdbId: 95_396,
        year: 2022,
        ...(seasons === undefined ? {} : { seasons }),
      }),
    ).toBe(prompt);
  });

  it('names the seasons of a TV show without a year', () => {
    expect(
      toApprovalPrompt({
        mediaType: 'tv',
        seasons: [3],
        title: 'Severance',
        tmdbId: 95_396,
      }),
    ).toBe('Request Severance, season 3?');
  });

  it('passes question marks and HTML characters in the title through unchanged', () => {
    expect(
      toApprovalPrompt({
        mediaType: 'movie',
        title: 'What <About> Bob & Me?',
        tmdbId: 1,
        year: 1991,
      }),
    ).toBe('Request What <About> Bob & Me? (1991)?');
  });
});
