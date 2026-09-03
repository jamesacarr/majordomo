import { BOLD_TAG } from './bold-tag';

/** Drops the bold tags and leaves everything else as the model wrote it. */
export const stripHtml = (text: string): string => text.replace(BOLD_TAG, '');
