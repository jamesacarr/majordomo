---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T10:48:18Z
status: superseded
---

# 0010. Let Seerr auto-approve bot requests

Decided 2026-09-03. Superseded by 0025.

## Context

The bot authenticates with an admin API key (0002). Seerr auto-approves an admin's requests and doesn't apply its per-user quotas or approval rules to them.

## Decision

Accept auto-approval. The bot's own allowlist (0003) and confirmation prompt (0006) are the controls.

## Consequences

Per-user quotas or approval rules, if ever wanted, would live in the bot, not in Seerr.
