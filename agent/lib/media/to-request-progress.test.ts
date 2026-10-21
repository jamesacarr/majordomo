import { describe, expect, it } from 'vitest';

import type { MediaRequest } from '../seerr/types';
import { toRequestProgress } from './to-request-progress';
import type { RequestProgress } from './types';

const requestWith = (
  status: number,
  mediaStatus: number | null,
): MediaRequest => ({
  id: 1,
  media: mediaStatus === null ? null : { status: mediaStatus, tmdbId: 603 },
  status,
});

describe('toRequestProgress', () => {
  it.each<[number, RequestProgress]>([
    [1, 'pending_approval'],
    [3, 'declined'],
    [4, 'failed'],
  ])(
    'maps request status %i to %s whatever the media says',
    (status, expected) => {
      expect(toRequestProgress(requestWith(status, 5))).toBe(expected);
    },
  );

  it.each<[number, number, RequestProgress]>([
    [2, 1, 'processing'],
    [2, 2, 'processing'],
    [2, 3, 'processing'],
    [2, 4, 'partially_available'],
    [2, 5, 'available'],
    [2, 6, 'blocklisted'],
    [2, 7, 'deleted'],
    [2, 99, 'processing'],
    [5, 1, 'processing'],
    [5, 2, 'processing'],
    [5, 3, 'processing'],
    [5, 4, 'partially_available'],
    [5, 5, 'available'],
    [5, 6, 'blocklisted'],
    [5, 7, 'deleted'],
    [5, 99, 'processing'],
  ])(
    'maps request status %i with media status %i to %s',
    (status, mediaStatus, expected) => {
      expect(toRequestProgress(requestWith(status, mediaStatus))).toBe(
        expected,
      );
    },
  );

  it.each([2, 5])(
    'maps request status %i with no media to processing',
    status => {
      expect(toRequestProgress(requestWith(status, null))).toBe('processing');
    },
  );

  it('maps an unknown request status to unknown', () => {
    expect(toRequestProgress(requestWith(9, 5))).toBe('unknown');
  });
});
