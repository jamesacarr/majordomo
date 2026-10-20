import type { Availability } from './types';

/** Radarr/Sonarr tag label applied to every request majordomo submits, beside the requester's own tag. */
export const SEERR_TAG = 'seerr';

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

/** `search_media` and recommendations truncate overviews to this many characters. */
export const OVERVIEW_MAX_LENGTH = 200;

/** How long one Seerr call may take, request to full body, before it is aborted. */
export const REQUEST_TIMEOUT_MS = 10_000;
