import { defineTool } from 'eve/tools';
import { z } from 'zod';

import { getClient } from '../lib/media/get-client';
import { search } from '../lib/media/search';

// Binding only; the behaviour and its tests live under agent/lib/media/.
export default defineTool({
  description:
    'Search the media server for movies and TV shows by title. Returns up to 8 matches in relevance order, each with its TMDB id, type, year, a short overview, and availability on the server. Use it before answering anything about a specific title.',
  execute: input => search(getClient(), input),
  inputSchema: z.object({
    mediaType: z
      .enum(['movie', 'tv'])
      .optional()
      .describe('Only when the person said movie or TV show.'),
    query: z
      .string()
      .trim()
      .min(1)
      .describe('The title alone, without the year or words like "movie".'),
  }),
  label: { start: ({ query }) => `Search for “${query}”` },
});
