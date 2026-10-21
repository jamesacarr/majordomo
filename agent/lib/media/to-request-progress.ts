import {
  AVAILABILITY_BY_STATUS,
  REQUEST_STATUS_BY_CODE,
} from '../seerr/constants';
import type { MediaRequest } from '../seerr/types';
import type { RequestProgress } from './types';

/**
 * Combines a request's status with its media's into one word. Pending,
 * declined and failed requests report their own state. Approved and completed
 * requests report the media's availability, with anything not yet on the
 * server (unknown, pending, an unmapped code or no media) as `processing`.
 * Any other request status is `unknown`.
 */
export const toRequestProgress = (request: MediaRequest): RequestProgress => {
  const status = REQUEST_STATUS_BY_CODE[request.status];

  if (status === 'approved' || status === 'completed') {
    const availability =
      request.media == null
        ? undefined
        : AVAILABILITY_BY_STATUS[request.media.status];

    switch (availability) {
      case 'partially_available':
      case 'available':
      case 'blocklisted':
      case 'deleted':
        return availability;
      default:
        return 'processing';
    }
  }

  return status === 'pending_approval' ||
    status === 'declined' ||
    status === 'failed'
    ? status
    : 'unknown';
};
