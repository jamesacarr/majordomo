import { afterEach, describe, expect, it, vi } from 'vitest';

import { SEERR_API_KEY_ENV, SEERR_URL_ENV } from './constants';
import { getClient } from './get-client';

const env = {
  [SEERR_API_KEY_ENV]: 'secret-key',
  [SEERR_URL_ENV]: 'https://seerr.example.test',
};

describe('getClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a client that calls SEERR_URL authenticated with SEERR_API_KEY', async () => {
    const sent: { url: string; apiKey: string | undefined }[] = [];
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      sent.push({ apiKey: headers?.['X-Api-Key'], url: String(input) });
      return Promise.resolve(Response.json({ id: 603, title: 'The Matrix' }));
    });

    await getClient(env).movie(603);

    expect(sent).toEqual([
      {
        apiKey: 'secret-key',
        url: 'https://seerr.example.test/api/v1/movie/603',
      },
    ]);
  });

  it.each([SEERR_URL_ENV, SEERR_API_KEY_ENV])(
    'throws naming %s when it is not set',
    name => {
      expect(() => getClient({ ...env, [name]: undefined })).toThrow(
        `${name} is not set`,
      );
    },
  );

  it.each([SEERR_URL_ENV, SEERR_API_KEY_ENV])(
    'throws naming %s when it is blank',
    name => {
      expect(() => getClient({ ...env, [name]: '  ' })).toThrow(
        `${name} is not set`,
      );
    },
  );
});
