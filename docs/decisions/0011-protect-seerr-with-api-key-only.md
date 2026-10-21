---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0011. Protect the Seerr tunnel with its API key only

Decided 2026-09-03.

## Context

Seerr is already published over https through a Cloudflare Tunnel managed outside this repo. Vercel functions have no fixed egress IP on the free tier, so the tunnel can't allowlist the agent by IP.

## Decision

Rely on Seerr's API key for now. `SEERR_URL` points at the tunnel hostname, which lives only in `.env` and the Vercel project.

## Consequences

The API key is the only barrier between the internet and request creation. Cloudflare Access in front of the hostname, with a service token sent as `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers, would add a second one. The client accepts extra headers, so that change is additive.
