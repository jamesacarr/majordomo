import { defineTool } from 'eve/tools';
import { always } from 'eve/tools/approval';
import { z } from 'zod';

import { getClient } from '../lib/media/get-client';
import { request } from '../lib/media/request';
import { toApprovalPrompt } from '../lib/media/to-approval-prompt';
import { requireRequester } from '../lib/require-requester';

// Binding only; the behaviour and its tests live under agent/lib/media/.
// requireRequester runs before the client is built, so a session with no
// identity fails before any Seerr call.
export default defineTool({
  approval: {
    prompt: ({ input }) => toApprovalPrompt(input),
    request: always(),
  },
  description:
    'Request one movie or TV show on the media server as the person asking, with their own Seerr permissions, approval and quota. Use it only after they asked for that title. Takes the tmdbId and mediaType from search_media, get_media_recommendations, search_media_by_person or pick_media, and the title and year exactly as that result gave them. The person approves or cancels with buttons, so do not ask for confirmation first. For TV, pass seasons only when they named some. Returns an `outcome` to report.',
  execute: (input, ctx) =>
    request(getClient(requireRequester(ctx).seerrUserId), input),
  inputSchema: z.object({
    mediaType: z.enum(['movie', 'tv']),
    seasons: z
      .union([
        z
          .array(z.number().int().min(1))
          .nonempty()
          .refine(
            seasons => new Set(seasons).size === seasons.length,
            'List each season once.',
          ),
        z.literal('all'),
      ])
      .optional()
      .describe(
        'TV only: the season numbers they named, or "all". Leave it out to request every season.',
      ),
    title: z.string().trim().min(1),
    tmdbId: z.number().int().positive(),
    year: z
      .number()
      .int()
      .nullish()
      .describe('As the result gave it, including null.'),
  }),
  label: { start: ({ title }) => `Request “${title}”` },
});
