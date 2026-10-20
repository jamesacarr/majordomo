import { describe, expect, it } from 'vitest';

import { SEERR_TAG } from './constants';
import { resolveTagIds } from './resolve-tag-ids';
import type { ServiceServer, ServiceTag } from './types';

const server = (overrides: Partial<ServiceServer>): ServiceServer => ({
  id: 0,
  is4k: false,
  isDefault: true,
  name: 'Main',
  ...overrides,
});

/**
 * An in-memory Seerr with Radarr and Sonarr servers, each holding its own tags.
 * Server ids are distinct across services so a lookup against the wrong one fails.
 */
const fakeSeerr = ({
  radarr = [server({ id: 0 })],
  sonarr = [server({ id: 10 })],
  tags = {},
}: {
  readonly radarr?: readonly ServiceServer[];
  readonly sonarr?: readonly ServiceServer[];
  readonly tags?: Readonly<Record<number, ServiceTag[]>>;
}) => {
  const details = (servers: readonly ServiceServer[]) => (id: number) => {
    const found = servers.find(s => s.id === id);

    return found === undefined
      ? Promise.reject(new Error(`no server ${id}`))
      : Promise.resolve({ server: found, tags: tags[id] ?? [] });
  };

  return {
    radarrServer: details(radarr),
    radarrServers: async () => radarr,
    sonarrServer: details(sonarr),
    sonarrServers: async () => sonarr,
  };
};

const labels = [SEERR_TAG, 'mary-jane'];

describe('resolveTagIds', () => {
  it('returns both ids, in label order, when the default Radarr server has both tags', async () => {
    const client = fakeSeerr({
      tags: {
        0: [
          { id: 9, label: 'mary-jane' },
          { id: 4, label: 'seerr' },
        ],
      },
    });

    await expect(resolveTagIds(client, 'movie', labels)).resolves.toEqual({
      ids: [4, 9],
      missing: [],
    });
  });

  it('reads TV tags from the default Sonarr server, not Radarr', async () => {
    const client = fakeSeerr({
      tags: {
        0: [{ id: 1, label: 'seerr' }],
        10: [
          { id: 21, label: 'seerr' },
          { id: 22, label: 'mary-jane' },
        ],
      },
    });

    await expect(resolveTagIds(client, 'tv', labels)).resolves.toEqual({
      ids: [21, 22],
      missing: [],
    });
  });

  it('matches labels case-insensitively', async () => {
    const client = fakeSeerr({
      tags: {
        0: [
          { id: 4, label: 'Seerr' },
          { id: 9, label: 'MARY-JANE' },
        ],
      },
    });

    await expect(resolveTagIds(client, 'movie', labels)).resolves.toEqual({
      ids: [4, 9],
      missing: [],
    });
  });

  it('reports the user tag as missing when only the seerr tag exists', async () => {
    const client = fakeSeerr({ tags: { 0: [{ id: 4, label: 'seerr' }] } });

    await expect(resolveTagIds(client, 'movie', labels)).resolves.toEqual({
      ids: [4],
      missing: ['mary-jane'],
    });
  });

  it('reports the seerr tag as missing when only the user tag exists', async () => {
    const client = fakeSeerr({ tags: { 0: [{ id: 9, label: 'mary-jane' }] } });

    await expect(resolveTagIds(client, 'movie', labels)).resolves.toEqual({
      ids: [9],
      missing: ['seerr'],
    });
  });

  it('reports both labels as missing when the server has neither tag', async () => {
    const client = fakeSeerr({ tags: { 0: [{ id: 2, label: 'other' }] } });

    await expect(resolveTagIds(client, 'movie', labels)).resolves.toEqual({
      ids: [],
      missing: ['seerr', 'mary-jane'],
    });
  });

  it('uses the default non-4K server when a 4K server is also flagged default', async () => {
    const client = fakeSeerr({
      radarr: [
        server({ id: 0, is4k: true, name: '4K' }),
        server({ id: 1, name: 'HD' }),
      ],
      tags: {
        0: [{ id: 40, label: 'seerr' }],
        1: [{ id: 4, label: 'seerr' }],
      },
    });

    await expect(
      resolveTagIds(client, 'movie', [SEERR_TAG]),
    ).resolves.toMatchObject({ ids: [4] });
  });

  it('throws naming Radarr when no Radarr server is the non-4K default', async () => {
    const client = fakeSeerr({
      radarr: [server({ isDefault: false }), server({ id: 1, is4k: true })],
    });

    await expect(resolveTagIds(client, 'movie', labels)).rejects.toThrow(
      'Seerr has no default non-4K Radarr server',
    );
  });

  it('throws naming Sonarr when Seerr has no Sonarr server at all', async () => {
    const client = fakeSeerr({ sonarr: [] });

    await expect(resolveTagIds(client, 'tv', labels)).rejects.toThrow(
      'Seerr has no default non-4K Sonarr server',
    );
  });
});
