---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0021. Pick between titles with a `pick_media` tool

Decided 2026-10-20, replacing `ask_question` for choosing between titles.

## Context

The media evals showed two problems with eve's `ask_question`:

- The model writes the option labels and descriptions, and puts cast and directors in descriptions from memory, because the built-in schema asks for "the impact or tradeoff of choosing this option".
- The answer is a label the model maps back to a TMDB id. That mapping is ambiguous when two candidates share a title and year, and once requesting exists it decides what gets requested.

## Decision

A workflow tool, `pick_media`, takes two or three candidate TMDB ids, fetches their details from Seerr and asks with `ctx.ask`. It builds the labels from Seerr data, uses `<mediaType>:<tmdbId>` option ids (TMDB numbers movies and TV separately), and returns the chosen id. `ask_question` is removed, so the model has one way to ask.

## Alternatives considered

- **A `defineState` slot holding the last search's candidates.** Rejected: reading state needs an active eve context, and whether a replayed workflow body has one is unverified. A slot can also go stale when the model passes an id from an earlier search. Fetching details again costs at most three Seerr reads.
- **Labels supplied by the model in the tool input.** Rejected: it reintroduces model-written text.
- **Keep `ask_question` until posters are added.** Rejected: the request flow's instructions and evals would be written twice.

## Consequences

Option ids are TMDB ids, so a custom Telegram renderer can key on them, for example to show posters.
