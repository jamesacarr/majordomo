import { defineTool } from 'eve/tools';
import { z } from 'zod';

import { getClient } from '../lib/media/get-client';
import { listRequests } from '../lib/media/list-requests';
import { requireRequester } from '../lib/require-requester';

// Binding only; the behaviour and its tests live under agent/lib/media/.
// listRequests calls the requester thunk only for `mine`, so a session with
// no identity can still list everyone's requests.
export default defineTool({
  description:
    'List up to 20 recent media requests, newest first, each with its title, year, type, status and requested date. Set mine to true to list only the person asking’s requests. Set filter to narrow by state.',
  execute: (input, ctx) =>
    listRequests(getClient(), input, () => requireRequester(ctx)),
  inputSchema: z.object({
    filter: z
      .enum(['available', 'processing'])
      .optional()
      .describe(
        'available: on the server. processing: approved and on its way, including partly downloaded shows. Leave it out for every state.',
      ),
    mine: z
      .boolean()
      .optional()
      .describe('True for only the person asking’s requests.'),
  }),
  label: { start: () => 'Check requests' },
});
