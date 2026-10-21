import { labelCandidates } from './label-candidates';
import { toOptionId } from './to-option-id';
import type { MediaDetails, PickOption } from './types';

/** Builds the `pick_media` buttons, labelled by `labelCandidates`, in input order. */
export const toPickOptions = (details: readonly MediaDetails[]): PickOption[] =>
  labelCandidates(details).map(({ item, label }) => ({
    id: toOptionId(item),
    label,
  }));
