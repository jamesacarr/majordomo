import { defineEvalConfig } from 'eve/evals';

import { startSeerrStub } from './seerr-stub';

/**
 * The stub's address has to come from the shell: eve loads .env before setup
 * and again when it starts the agent, and the second load overwrites any
 * variable .env names unless it was already set when `eve eval` started. The
 * `eval` script in package.json sets both variables. Run any other way, a
 * real SEERR_URL from .env would reach the tools, so setup refuses.
 */
const stubAddress = () => {
  const url = new URL(process.env.SEERR_URL ?? 'http://invalid');
  const apiKey = process.env.SEERR_API_KEY;

  if (url.hostname !== '127.0.0.1' || url.port === '' || !apiKey) {
    throw new Error(
      'Evals must run against the Seerr stub: use `pnpm eval`, which points SEERR_URL at a loopback port.',
    );
  }

  return { apiKey, port: Number(url.port) };
};

export default defineEvalConfig({
  async setup() {
    return { seerr: await startSeerrStub(stubAddress()) };
  },
  async teardown(context) {
    await context?.seerr.close();
  },
});
