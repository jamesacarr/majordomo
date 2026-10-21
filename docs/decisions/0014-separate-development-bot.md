---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0014. Use a separate development bot

Decided 2026-09-03.

## Context

Telegram allows one webhook or one poller per bot token, not both. The production bot serves a previous implementation until this one goes live.

## Decision

A separate development bot serves `eve dev` and manual testing. At go-live, the production bot's token moves to Vercel and its webhook points at the production deployment.

## Consequences

Changes reach the production bot without being tested on Telegram first, because preview deployments currently share production's bot token (0001).
