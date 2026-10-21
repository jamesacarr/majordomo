import type { WorkflowStepToolContext } from 'eve/tools';
import { defineWorkflowTool } from 'eve/tools';
import { z } from 'zod';

import { MAX_PICK_OPTIONS, PICK_PROMPT } from '../lib/media/constants';
import { details } from '../lib/media/details';
import { getClient } from '../lib/media/get-client';
import { toOptionId } from '../lib/media/to-option-id';
import { toPickOptions } from '../lib/media/to-pick-options';
import { toPickResult } from '../lib/media/to-pick-result';
import type { MediaDetails, MediaRef } from '../lib/media/types';
import { requireRequester } from '../lib/require-requester';

// A step, because getClient and requireRequester read process.env and the
// workflow body is replayed. eve hands the step a restricted context that
// still carries the session, so the details are fetched as the person asking.
async function fetchDetails(
  ref: MediaRef,
  ctx: WorkflowStepToolContext,
): Promise<MediaDetails> {
  'use step';

  return await details(getClient(requireRequester(ctx).seerrUserId), ref);
}

// No retries, as get_media_details has none: a 404, a wrong mediaType or a
// missing env var fails the same way every time, and retrying a stalled
// tunnel multiplies the 10-second request timeout while the turn is parked.
fetchDetails.maxRetries = 0;

// Binding only; the labels and the answer mapping live under agent/lib/media/.
export default defineWorkflowTool({
  description:
    'Ask the person which of 2 to 4 movies or TV shows they mean. Shows each as a button labelled from the media server, so write no labels yourself. Takes TMDB ids from search_media, get_media_recommendations or search_media_by_person. Returns `chosen` with the exact title to carry on with, or `cancelled` when the person sent a new message instead or no one can answer: answer their latest message. A cancelled result lists the `options` they saw, in button order, so "the second one" or "the TV one" refers to those.',
  async execute({ candidates }, ctx) {
    'use workflow';

    const found = await Promise.all(
      candidates.map(ref => fetchDetails(ref, ctx)),
    );
    const answer = await ctx.ask({
      allowFreeform: false,
      display: 'select',
      options: toPickOptions(found),
      prompt: PICK_PROMPT,
    });

    return toPickResult(answer, found);
  },
  inputSchema: z.object({
    candidates: z
      .array(
        z.object({
          mediaType: z.enum(['movie', 'tv']),
          tmdbId: z.number().int().positive(),
        }),
      )
      .min(2)
      .max(MAX_PICK_OPTIONS)
      .refine(
        refs => new Set(refs.map(toOptionId)).size === refs.length,
        'List each title once.',
      ),
  }),
  label: { start: () => 'Ask which one' },
});
