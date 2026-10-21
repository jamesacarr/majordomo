---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0019. Validate every Seerr response with zod

Decided 2026-10-20.

## Context

The Seerr client cast each JSON body to its declared type, so a field Seerr renamed or dropped surfaced as `undefined` far from the cause. The worst case was a missing `mediaInfo.status`, read as "not requested", so the agent would offer to request something already on the server.

## Decision

Every client method parses its response with a zod schema (`agent/lib/seerr/schemas.ts`), and the types are inferred from the schemas. A mismatch throws, naming the call and the field.

Schemas require only what the logic depends on: `id`, `mediaType`, `title` or `name`, and `mediaInfo.status` on results; tag `id` and `label`; request `id`, `status` and `tags`. Everything else is optional or nullable, because TMDB already sends `posterPath: null`, empty release dates and missing overviews.

## Alternatives considered

- **Check only the decision fields** (availability, tag ids, created-request tags) inside the tools that use them. Rejected: less code, but the checks would be scattered and every new tool would have to remember them.

## Consequences

An upstream change to a required field makes the affected calls fail loudly instead of returning wrong answers. An over-strict schema would turn a harmless upstream change into every search failing, which is why so little is required.
