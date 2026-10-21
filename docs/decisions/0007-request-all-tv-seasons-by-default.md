---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0007. Request all TV seasons by default

Decided 2026-09-03.

## Decision

A TV request asks for all seasons unless the user names specific ones. The approval prompt shows which seasons will be requested.

## Consequences

Asking for a show downloads every season, which can be large. The approval prompt is the check against that.
