import { defineTool } from 'eve/tools';
import { z } from 'zod';

import { MAX_CANDIDATES } from '../lib/media/constants';
import { getClient } from '../lib/media/get-client';
import { recommend } from '../lib/media/recommend';
import { requireRequester } from '../lib/require-requester';

// Binding only; the behaviour and its tests live under agent/lib/media/.
export default defineTool({
  description:
    'Find movies or TV shows like a given title, from TMDB recommendations and similar titles, best rated first. Each comes with its TMDB id, year, a short overview, and availability on the server. Takes a TMDB id from search_media.',
  execute: (input, ctx) =>
    recommend(getClient(requireRequester(ctx).seerrUserId), input),
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_CANDIDATES)
      .optional()
      .describe(`How many to return; defaults to ${MAX_CANDIDATES}.`),
    mediaType: z.enum(['movie', 'tv']),
    tmdbId: z.number().int().positive(),
  }),
  label: { start: () => 'Find similar titles' },
});
