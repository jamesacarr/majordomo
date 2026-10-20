import { createClient } from '../seerr/create-client';
import type { Client } from '../seerr/types';
import type { Env } from '../types';
import { SEERR_API_KEY_ENV, SEERR_URL_ENV } from './constants';

const readRequired = (env: Env, name: string): string => {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not set, so majordomo cannot reach Seerr.`);
  }

  return value;
};

/**
 * Builds the Seerr client from `SEERR_URL` and `SEERR_API_KEY`. Throws naming
 * the variable when either is missing or blank, so misconfiguration fails at
 * the first tool call, as the allowlist does.
 */
export const getClient = (env: Env = process.env): Client =>
  createClient({
    apiKey: readRequired(env, SEERR_API_KEY_ENV),
    baseUrl: readRequired(env, SEERR_URL_ENV),
  });
