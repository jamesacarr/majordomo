import { posterCard } from '../media/poster-card';
import type { MediaRef, PosterCard } from '../media/types';
import type { Client } from '../seerr/types';

/**
 * Fetches a poster card for each title in parallel, in input order. A title
 * whose fetch fails, or is still pending after `timeoutMs`, is `undefined`,
 * and so is every title when the client can't be built. Never rejects: the
 * cards are best effort and the keyboard must follow (decision 0023).
 */
export const fetchCards = async (
  makeClient: () => Pick<Client, 'movie' | 'tv'>,
  refs: readonly MediaRef[],
  timeoutMs: number,
): Promise<(PosterCard | undefined)[]> => {
  let client: Pick<Client, 'movie' | 'tv'>;

  try {
    client = makeClient();
  } catch {
    return refs.map(() => undefined);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>(resolve => {
    timer = setTimeout(() => resolve(undefined), timeoutMs);
  });

  try {
    return await Promise.all(
      refs.map(ref =>
        Promise.race([
          posterCard(client, ref).catch(() => undefined),
          deadline,
        ]),
      ),
    );
  } finally {
    clearTimeout(timer);
  }
};
