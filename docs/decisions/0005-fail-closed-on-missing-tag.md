---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0005. Fail closed when a tag is missing

Decided 2026-09-03.

## Context

Attribution (0004) needs both tags to exist on the target Radarr or Sonarr server, and the bot can't create them.

## Decision

If either the `seerr` tag or the requester's tag is missing, the request isn't submitted and the bot names the missing tag.

## Alternatives considered

- **Submit with whatever tags resolved and warn.** Rejected: an untagged request loses attribution permanently, while a refused one costs a retry after the tag is created.

## Consequences

Forgetting to create a new user's tags blocks their requests until someone creates them.
