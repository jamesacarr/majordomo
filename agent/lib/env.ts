/** Read-only view of process.env, so functions can take an injected env in tests. */
export type Env = Readonly<Record<string, string | undefined>>;
