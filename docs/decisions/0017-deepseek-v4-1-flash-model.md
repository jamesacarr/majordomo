---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-23T00:58:16Z
status: accepted
---

# 0017. Use `deepseek/deepseek-v4.1-flash-1017`

Decided 2026-10-20, replacing `minimax/minimax-m3.1-flash`.

## Context

The agent's risk is tool-call reliability rather than prose: it must chain search, pick and request correctly, and stop when a request is unrelated. minimax-m3.1-flash is free, but its free-tier limit of 5 requests per minute forced evals to run one at a time, and the owner wanted to move off it on mixed reviews.

## Decision

Use `deepseek/deepseek-v4.1-flash-1017` through the AI Gateway. The eval suite is the gate for this and any future switch.

## Consequences

- It's paid. On 2026-10-20 the gateway listed US$0.075 per million input tokens and US$0.30 per million output, doubled on weekdays 01:00 to 04:00 and 06:00 to 10:00 UTC. The listing also carried a `us` regional rate six times higher. Rates are per provider, and the providers preferred since decision 0028 list no regional rate, so calls they serve bill at their base rate.
- It reasons, and eve leaves `reasoning` unset, so the provider default applies.
- `zdr` and `no_training` are `some`: some of its providers offer zero data retention and no training, not all. Decision 0028 prefers one that offers both.
- `deepseek/deepseek-v4.1-flash` isn't an alias for `-1017`. It's the 2026-09-08 release, with different regional pricing.
- Switching is a one-line change in `agent/agent.ts`. Re-check pricing before choosing, and run `pnpm eval`.
