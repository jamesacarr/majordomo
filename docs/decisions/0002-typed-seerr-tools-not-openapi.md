---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T10:48:18Z
status: accepted
---

# 0002. Hand-author typed Seerr tools instead of an OpenAPI connection

Decided 2026-09-03.

## Context

eve can expose an OpenAPI spec as a connection. Seerr's spec has about 200 operations, and it omits the `tags` field on `POST /request` that attribution depends on (0004).

## Decision

The agent's Seerr tools are hand-authored over a thin client in `agent/lib/seerr/`. The model sees only the tools this repo defines.

## Consequences

- The model can't reach unrelated Seerr operations, which enforces the agent's scope structurally rather than by instruction.
- Each new Seerr capability needs a client method, a schema (0019) and a tool.
- The client authenticates with one admin API key in the `X-Api-Key` header.
- Amended by 0025: the client also sends `X-API-User` with the requester's Seerr user id on every call, and requests no longer carry `tags`, so the spec's missing `tags` field no longer motivates hand-authoring. The rest of this decision stands.
