---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0009. Resolve tags on the default non-4K server

Decided 2026-09-03.

## Context

Seerr can have several Radarr and Sonarr servers. Tag ids are per server, so the bot must resolve them on the server Seerr will send the request to.

## Decision

Use the server Seerr marks `isDefault` and not `is4k`, which is how Seerr routes an `is4k: false` request (`MediaRequest.ts` in v3.4.1, lines 248 to 253). Fail with a clear error if no such server exists.

## Consequences

Adding servers to Seerr changes nothing unless the default changes, in which case the requester tags must exist on the new default too.
