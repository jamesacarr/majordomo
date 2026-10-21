import type { Availability, RequestStatus } from './types';

/**
 * Seerr's `MediaStatus` codes in 3.4.1 (`server/constants/media.ts`). The
 * OpenAPI spec omits `BLOCKLISTED` and so numbers `DELETED` 6; the source has it at 7.
 */
export const AVAILABILITY_BY_STATUS: Readonly<Record<number, Availability>> = {
  1: 'unknown',
  2: 'pending',
  3: 'processing',
  4: 'partially_available',
  5: 'available',
  6: 'blocklisted',
  7: 'deleted',
};

/** Seerr's `MediaRequestStatus` codes in 3.4.1 (`server/constants/media.ts`). */
export const REQUEST_STATUS_BY_CODE: Readonly<Record<number, RequestStatus>> = {
  1: 'pending_approval',
  2: 'approved',
  3: 'declined',
  4: 'failed',
  5: 'completed',
};

/** `search_media` and recommendations truncate overviews to this many characters. */
export const OVERVIEW_MAX_LENGTH = 200;

/** How long one Seerr call may take, request to full body, before it is aborted. */
export const REQUEST_TIMEOUT_MS = 10_000;
