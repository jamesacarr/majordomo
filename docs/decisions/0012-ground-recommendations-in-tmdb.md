---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0012. Ground recommendations in TMDB data

Decided 2026-09-03.

## Context

A model asked for "films like Fight Club" will answer from memory, and some of those titles won't exist or won't match a TMDB id.

## Decision

Recommendations come from Seerr's TMDB-backed `/movie/{id}/recommendations` and `/similar` endpoints and their TV equivalents, never from the model's memory.

## Consequences

Every suggestion arrives with a TMDB id and library availability, so it can be requested directly. Suggestions are limited to what TMDB links to the named title.
