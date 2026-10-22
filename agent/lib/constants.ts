/** The env var holding the allowlist: a JSON map of Telegram user id to Seerr user id. */
export const ALLOWLIST_ENV = 'MAJORDOMO_ALLOWED_USERS';

/**
 * The env var holding the Seerr user id that `eve dev` and eval sessions act
 * as. Those sessions carry no Telegram identity; only read when `EVE_DEV=1`.
 */
export const DEV_SEERR_USER_ENV = 'MAJORDOMO_DEV_SEERR_USER_ID';
