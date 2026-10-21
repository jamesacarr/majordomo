import { defineTool } from 'eve/tools';
import { z } from 'zod';

import { getClient } from '../lib/media/get-client';
import { listRequests } from '../lib/media/list-requests';
import { requireRequester } from '../lib/require-requester';

// Binding only; the behaviour and its tests live under agent/lib/media/.
export default defineTool({
  description:
    "List up to 20 of the person asking's own media requests, newest first, each with its title, year, type, status and requested date. Includes requests they made in Seerr itself. Set filter to narrow by state.",
  execute: (input, ctx) => {
    const { seerrUserId } = requireRequester(ctx);

    return listRequests(getClient(seerrUserId), seerrUserId, input);
  },
  inputSchema: z.object({
    filter: z
      .enum(['available', 'processing', 'pending'])
      .optional()
      .describe(
        'available: on the server. processing: approved and on its way, including partly downloaded shows. pending: waiting for approval. Leave it out for every state.',
      ),
  }),
  label: { start: () => 'Check requests' },
});
