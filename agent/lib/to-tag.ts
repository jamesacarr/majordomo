/**
 * Derives a person's Radarr/Sonarr tag label from their display name. Assumes
 * labels are limited to lowercase letters, digits and hyphens, so accents are
 * dropped and any other run of characters becomes one hyphen. Returns an empty
 * string when nothing usable is left; callers reject that.
 */
export const toTag = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
