import type { LabelledCandidate, MediaDetails } from './types';

const toLabel = (title: string, parts: readonly string[]): string =>
  parts.length === 0 ? title : `${title} (${parts.join(', ')})`;

const yearPart = ({ year }: MediaDetails): string[] =>
  year === null ? [] : [String(year)];

const firstPerson = (item: MediaDetails): string | undefined =>
  item.mediaType === 'movie' ? item.directors[0] : item.creators[0];

interface Draft {
  readonly item: MediaDetails;
  readonly parts: readonly string[];
}

const labelOf = ({ item, parts }: Draft): string => toLabel(item.title, parts);

/** Applies `extend` to every draft whose label appears more than once. */
const extendClashing = (
  drafts: readonly Draft[],
  extend: (draft: Draft) => readonly string[],
): Draft[] => {
  const labels = drafts.map(labelOf);

  return drafts.map((draft, i) =>
    labels.filter(label => label === labels[i]).length > 1
      ? { item: draft.item, parts: extend(draft) }
      : draft,
  );
};

const withTv = ({ item, parts }: Draft): readonly string[] =>
  item.mediaType === 'tv' ? [...parts, 'TV'] : parts;

const withPerson = ({ item, parts }: Draft): readonly string[] => {
  const person = firstPerson(item);

  return person ? [...parts, person] : parts;
};

/**
 * Labels the `pick_media` buttons from Seerr data only: "Title (Year)", or the
 * title alone with no year. When labels collide, TV shows gain "TV"; when they
 * still collide, each gains its first director or creator. A label with no
 * person to add stays as it is, since the option ids still differ. Keeps the
 * input order.
 */
export const labelCandidates = (
  details: readonly MediaDetails[],
): LabelledCandidate[] => {
  const base = details.map(item => ({ item, parts: yearPart(item) }));
  const drafts = extendClashing(extendClashing(base, withTv), withPerson);

  return drafts.map(draft => ({ item: draft.item, label: labelOf(draft) }));
};
