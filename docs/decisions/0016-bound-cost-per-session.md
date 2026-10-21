---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T06:23:12Z
status: accepted
---

# 0016. Bound model cost per session

Decided 2026-09-03.

## Context

A Telegram private chat maps to one eve session, and every model call re-sends that session's history. Cost grows with conversation length times turn count.

## Decision

- **`sessionTimeoutMs` of 24 hours** in `agent/agent.ts` (eve's default is 30 days). It's an absolute lifetime from session creation, not an idle timeout. A request bot needs nothing remembered across days.
- **Token budgets** of 250,000 input and 25,000 output tokens per session (eve's defaults are 40 million and unset). When a session crosses one, eve asks the user to approve a fresh window or stop, so they bound accidents rather than intent. Since eve 0.75.1, compaction's tokens count toward them.
- **Compaction** stays at the default `thresholdPercent` of 0.9. Compaction is itself a model call, so lowering the threshold would add cost here.
- **Small tool outputs.** Search and recommendations return at most eight candidates with overviews truncated to 200 characters. Tool output is re-sent on every later call in the session.
- **A spend cap on the AI Gateway**, the only hard financial limit, set before go-live. It's a team budget, so it also caps the development API key and every other project in the team (`docs/runbook.md`).

## Consequences

The session lifetime and budgets are starting guesses, to be tuned against real usage. If reasoning tokens count as output, the output budget binds sooner. In that case, lower `reasoning` before raising the budget.
