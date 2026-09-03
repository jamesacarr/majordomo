/** Read-only view of process.env, so functions can take an injected env in tests. */
export type Env = Readonly<Record<string, string | undefined>>;

/** A household member permitted to talk to the bot, and the identity tools act for. */
export interface AllowedUser {
  /** Display name as written in the allowlist. */
  readonly name: string;
  /** Radarr/Sonarr tag label for this person: the lowercased name. */
  readonly tag: string;
}
