---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T10:48:18Z
status: superseded
---

# 0004. Attribute requests with Radarr/Sonarr tags

Decided 2026-09-03. Superseded by 0025.

## Context

The bot submits every request through one Seerr API key, so Seerr records the same user for every request. The household still wants to tell who asked for what, and to tell bot requests apart from others.

## Decision

Every request carries two Radarr/Sonarr tags: the fixed `seerr` tag (`SEERR_TAG` in `agent/lib/seerr/constants.ts`) and the requester's display name, slugified to lowercase letters, digits and hyphens (`Mary Jane` becomes `mary-jane`, `agent/lib/to-tag.ts`). There's no mapping from Telegram users to Seerr users.

Two allowlisted names with the same slug are rejected rather than suffixed. A suffix would depend on who else is listed, so adding a person could move a tag between people.

## Consequences

- Seerr has no API to create tags, so `seerr` and one tag per allowlisted name must be created by hand in both Radarr and Sonarr.
- `POST /request` accepts `tags` even though the published spec omits it (`server/entity/MediaRequest.ts` at Seerr v3.4.1). Re-check this when Seerr is upgraded.
- The slug assumes Radarr and Sonarr restrict tag labels to `[a-z0-9-]`. This hasn't been verified.
- Listing "my requests" means filtering by the requester's tag id, not by Seerr user.
