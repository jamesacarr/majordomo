import type { Client, MediaType } from './types';

type TagClient = Pick<
  Client,
  'radarrServer' | 'radarrServers' | 'sonarrServer' | 'sonarrServers'
>;

/**
 * Resolves Radarr (movies) or Sonarr (TV) tag labels to ids on the server
 * Seerr routes a non-4K request to: the one flagged `isDefault` and not
 * `is4k`. Labels match case-insensitively. Returns the ids found, in label
 * order, and the labels that have no tag, so the caller can name exactly
 * which is missing. Throws when no such default server exists.
 */
export const resolveTagIds = async (
  client: TagClient,
  mediaType: MediaType,
  labels: readonly string[],
): Promise<{ readonly ids: number[]; readonly missing: string[] }> => {
  const service =
    mediaType === 'movie'
      ? {
          details: client.radarrServer,
          list: client.radarrServers,
          name: 'Radarr',
        }
      : {
          details: client.sonarrServer,
          list: client.sonarrServers,
          name: 'Sonarr',
        };
  const server = (await service.list()).find(s => s.isDefault && !s.is4k);

  if (server === undefined) {
    throw new Error(
      `Seerr has no default non-4K ${service.name} server, so it has nowhere to send the request.`,
    );
  }

  const { tags } = await service.details(server.id);
  const idsByLabel = new Map(
    tags.map(tag => [tag.label.toLowerCase(), tag.id]),
  );

  const ids: number[] = [];
  const missing: string[] = [];

  for (const label of labels) {
    const id = idsByLabel.get(label.toLowerCase());

    if (id === undefined) {
      missing.push(label);
    } else {
      ids.push(id);
    }
  }

  return { ids, missing };
};
