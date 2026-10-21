---
created_at: 2026-10-21T04:09:31Z
updated_at: 2026-10-21T04:09:31Z
status: accepted
---

# 0022. Check the approved title against Seerr before requesting

Decided 2026-10-21.

## Context

The `request_media` approval prompt is built from the `title` and `year` the model passes (0006), but the request itself goes by `tmdbId`. If the model pairs the right title with the wrong id, for example one copied from a neighbouring search result, the person approves "Request Arrival (2016)?" and something else downloads. eve's approval `prompt` callback is synchronous (`approval/definition.d.ts`, eve 0.81.1), so the prompt can't be built from a Seerr lookup.

## Decision

After approval, `request_media` reads the title from Seerr by `tmdbId` and posts nothing when Seerr's title differs from the approved one (case-insensitive, whitespace collapsed) or, when a year was approved, the year differs. It returns `title_mismatch` with Seerr's title, and the model says so instead of retrying.

## Alternatives considered

- **Build the prompt from Seerr data.** Rejected: needs an async prompt, which eve doesn't support.
- **Trust the id alone, as 0006 states.** Rejected: the prompt would then confirm a label nothing checks.

## Consequences

- A model that rewrites a title it copied, such as dropping a subtitle, gets a false `title_mismatch`. The tool description and instructions tell it to pass the title exactly as the result gave it.
- A title with no release date has `year: null`, which skips the year comparison.
