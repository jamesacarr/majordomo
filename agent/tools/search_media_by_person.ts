import { defineTool } from 'eve/tools';
import { z } from 'zod';

import { findPersonCredits } from '../lib/media/find-person-credits';
import { getClient } from '../lib/media/get-client';

// Binding only; the behaviour and its tests live under agent/lib/media/.
export default defineTool({
  description:
    "Find movies and TV shows a person acted in or directed, by the person's name. Uses the top match for that name. Returns their name and up to 8 acting and directing credits, best known first, each with its TMDB id, type, year, a short overview, and availability on the server.",
  execute: input => findPersonCredits(getClient(), input),
  inputSchema: z.object({
    mediaType: z
      .enum(['movie', 'tv'])
      .optional()
      .describe(
        'movie when they said film or movie, tv when they said show or series. Omit otherwise.',
      ),
    name: z.string().trim().min(1).describe("The person's name alone."),
    role: z
      .enum(['acting', 'directing'])
      .optional()
      .describe(
        'directing when they asked what the person directed, acting when they asked what the person acted in. Omit otherwise: acting and directing credits both come back.',
      ),
  }),
  label: { start: ({ name }) => `Find titles with “${name}”` },
});
