import { ALLOWLIST_ENV, DEV_SEERR_USER_ENV } from '../constants';

/**
 * Seerr's auth middleware found no user with the `X-API-User` id the client
 * sent. A configuration error for the admin, so it deliberately isn't an
 * `ApiError`: callers that treat a 403 `ApiError` as "Seerr refused" can't
 * mistake it for one.
 */
export class UnknownUserError extends Error {
  override readonly name = 'UnknownUserError';
  readonly seerrUserId: number;

  constructor(seerrUserId: number) {
    super(
      `Seerr has no user with id ${seerrUserId} (X-API-User). Check ${ALLOWLIST_ENV}, or ${DEV_SEERR_USER_ENV} in development.`,
    );
    this.seerrUserId = seerrUserId;
  }
}
