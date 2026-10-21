---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0003. Allowlist users by Telegram id, private chats only

Decided 2026-09-03.

## Context

The bot can submit requests to the household's media server, so only household members should reach it. Anyone on Telegram can find and message a bot.

## Decision

The allowlist is JSON in the `MAJORDOMO_ALLOWED_USERS` env var, mapping Telegram user id to display name. Only private chats reach the agent. Messages from anyone not on the allowlist, and every group message, are dropped without a reply.

## Consequences

- Adding a user is an env var change, not a code change.
- Silence avoids confirming to strangers that the bot exists, at the cost of no feedback for a household member whose id is wrong.
- Group chats are unsupported. Supporting them would need mention detection (`botUsername`) and a decision about who a request is attributed to.
