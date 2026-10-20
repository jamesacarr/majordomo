import { defineTool } from 'eve/tools';
import { z } from 'zod';

import { details } from '../lib/media/details';
import { getClient } from '../lib/media/get-client';

// Binding only; the behaviour and its tests live under agent/lib/media/.
export default defineTool({
  description:
    'Get the details of one movie or TV show: genres, top-billed cast, director or creators, runtime or number of seasons, and availability on the server. Use it to answer questions about a title, such as who is in it or which version is which. Takes a TMDB id from search_media or get_media_recommendations.',
  execute: input => details(getClient(), input),
  inputSchema: z.object({
    mediaType: z.enum(['movie', 'tv']),
    tmdbId: z.number().int().positive(),
  }),
  label: { start: () => 'Look up details' },
});
