/** Read-only view of process.env, so functions can take an injected env in tests. */
export type Env = Readonly<Record<string, string | undefined>>;

/** A household member permitted to talk to the bot, and the identity tools act for. */
export interface AllowedUser {
  /** The Seerr user every Seerr call acts as, via the `X-API-User` header. */
  readonly seerrUserId: number;
}
