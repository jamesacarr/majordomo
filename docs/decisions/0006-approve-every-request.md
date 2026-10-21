---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0006. Require approval for every request

Decided 2026-09-03.

## Context

`request_media` is the agent's only side-effecting tool, and a request starts a download. The model can misread which title someone meant.

## Decision

Every `request_media` call is gated with eve's `approval: always()`. The user sees a prompt naming the title and year and taps approve or cancel before anything reaches Seerr.

## Consequences

- One extra tap per request.
- The tool trusts only the TMDB id. The title and year in its input exist so the approval prompt is readable.
