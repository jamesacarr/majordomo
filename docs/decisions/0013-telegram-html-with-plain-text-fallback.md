---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0013. Send Telegram replies as HTML with a plain-text fallback

Decided 2026-09-03.

## Context

Bold titles make replies easier to scan. eve's default Telegram handler sends plain text with no `parse_mode`.

## Decision

Replies go out with `parse_mode: HTML`, and the model may use `<b>` and nothing else. If Telegram rejects a message with HTTP 400, it's re-sent as plain text with the tags stripped. The handler is `agent/lib/telegram/on-message-completed.ts`.

## Alternatives considered

- **MarkdownV2.** Rejected: it needs about a dozen characters escaped, and the model gets that wrong. HTML needs only `<`, `>` and `&` escaped.

## Consequences

- eve's `sendMessage` wrapper throws a plain `Error` with the HTTP status in its message, so the fallback matches on that text.
- eve drops `parse_mode` from every chunk after the first when it splits text over 4096 characters, so a reply that long goes out as plain text.
