---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0015. Run on Node 24

Decided 2026-09-03.

## Decision

Use Node 24, the newest version Vercel's functions runtime supports. `engines.node`, `mise.toml` and `@types/node` all say 24.

## Consequences

Vercel's `@vercel/build-utils` rejects unknown Node versions at build time rather than falling back (verified 2026-09-03), so upgrading means checking Vercel's supported versions first. Node 26 is only available in Vercel Sandboxes.
