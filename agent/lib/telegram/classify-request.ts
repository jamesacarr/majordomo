import { z } from 'zod';

import { MAX_PICK_OPTIONS } from '../media/constants';
import { parseOptionId } from '../media/parse-option-id';
import type { MediaRef } from '../media/types';
import { PICK_TOOL_NAME, REQUEST_TOOL_NAME } from './constants';
import type { InputRequest, RequestPreview } from './types';

const approvalInputSchema = z.object({
  mediaType: z.enum(['movie', 'tv']),
  tmdbId: z.number().int().positive(),
});

const DEFAULT: RequestPreview = { kind: 'default' };

const classifyPick = (request: InputRequest): RequestPreview => {
  const options = request.options ?? [];

  if (options.length < 2 || options.length > MAX_PICK_OPTIONS) {
    return DEFAULT;
  }

  const titles: { label: string; ref: MediaRef }[] = [];

  for (const { id, label } of options) {
    const ref = parseOptionId(id);

    if (ref === undefined) {
      return DEFAULT;
    }

    titles.push({ label, ref });
  }

  return { kind: 'pick', titles };
};

const classifyApproval = (request: InputRequest): RequestPreview => {
  const parsed = approvalInputSchema.safeParse(request.action.input);

  return parsed.success ? { kind: 'approval', ref: parsed.data } : DEFAULT;
};

/**
 * Decides whether a request gets poster cards (decision 0023): a `pick_media`
 * question whose 2 to `MAX_PICK_OPTIONS` option ids all name a title, or a
 * `request_media` approval with a valid title. Everything else renders as
 * eve's default.
 */
export const classifyRequest = (request: InputRequest): RequestPreview => {
  const { toolName } = request.action;

  if (request.kind === 'question' && toolName === PICK_TOOL_NAME) {
    return classifyPick(request);
  }

  if (request.kind === 'tool-approval' && toolName === REQUEST_TOOL_NAME) {
    return classifyApproval(request);
  }

  return DEFAULT;
};
