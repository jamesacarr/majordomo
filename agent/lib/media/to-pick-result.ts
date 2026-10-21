import { labelCandidates } from './label-candidates';
import { toOptionId } from './to-option-id';
import type { MediaDetails, PickAnswer, PickResult } from './types';

/**
 * Maps eve's answer to a `pick_media` question. An option the person picked
 * gives `chosen`. Anything else, such as a withdrawn question, a session no
 * one can answer, or an id naming no candidate, gives `cancelled` with the
 * labels the person saw, so the model can resolve a typed reference to them.
 */
export const toPickResult = (
  answer: PickAnswer,
  details: readonly MediaDetails[],
): PickResult => {
  const picked =
    answer.status === 'answered'
      ? details.find(item => toOptionId(item) === answer.optionId)
      : undefined;

  if (picked) {
    return {
      mediaType: picked.mediaType,
      status: 'chosen',
      title: picked.title,
      tmdbId: picked.tmdbId,
      year: picked.year,
    };
  }

  return {
    options: labelCandidates(details).map(({ item, label }) => ({
      label,
      mediaType: item.mediaType,
      tmdbId: item.tmdbId,
    })),
    status: 'cancelled',
  };
};
