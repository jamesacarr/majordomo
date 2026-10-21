---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0008. Never set `is4k` on a request

Decided 2026-09-03.

## Context

In Seerr, `is4k` on a request selects a server flagged as a 4K server. It doesn't choose a quality. The household's Radarr and Sonarr servers are both `isDefault: true, is4k: false`.

## Decision

The bot never sets `is4k`. Every request goes to the default servers, which apply their own default quality profile (which may itself be 4K).

## Consequences

`is4k` only becomes relevant if a separately flagged 4K server is added to Seerr. That would need a new decision.
