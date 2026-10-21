---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T03:08:08Z
status: accepted
---

# 0021. Pick between titles with a `pick_media` tool

Decided 2026-10-20, replacing `ask_question` for choosing between titles.

## Context

The media evals showed two problems with eve's `ask_question`:

- The model writes the option labels and descriptions, and puts cast and directors in descriptions from memory, because the built-in schema asks for "the impact or tradeoff of choosing this option".
- The answer is a label the model maps back to a TMDB id. That mapping is ambiguous when two candidates share a title and year, and once requesting exists it decides what gets requested.

## Decision

A workflow tool, `pick_media`, takes two to four candidate TMDB ids, fetches their details from Seerr and asks with `ctx.ask`. It builds the labels from Seerr data, uses `<mediaType>:<tmdbId>` option ids (TMDB numbers movies and TV separately), and returns the chosen id. `ask_question` is removed, so the model has one way to ask.

The question sets `allowFreeform: false`. eve resolves a typed reply on the server by matching the option id, then the label, then a 1-based index ("2"). With `allowFreeform: true`, any reply that matches none of these becomes a free-text answer, so a person who changes the subject could never steer away from the question. With `false`, an unmatched reply withdraws the question and reaches the model as the person's next message. `pick_media` returns two statuses:

- `chosen`, with the title's `tmdbId`, `mediaType`, `title` and `year`.
- `cancelled`, with the `options` the person saw, in button order, so the model can resolve "the second one" against them.

The ticket's `replied` status, which carried free text back through the tool result, is dropped. The options carry no descriptions, and a label adds `TV` and then the director or creator only when labels would otherwise collide.

## Alternatives considered

- **A `defineState` slot holding the last search's candidates.** Rejected: reading state needs an active eve context, and whether a replayed workflow body has one is unverified. A slot can also go stale when the model passes an id from an earlier search. Fetching details again costs at most four Seerr reads.
- **Labels supplied by the model in the tool input.** Rejected: it reintroduces model-written text.
- **`allowFreeform: true` with a `replied` status.** Rejected: every typed message becomes an answer, so steering away from the question is impossible, and the person's words reach the model as a tool result instead of their own message.
- **Keep `ask_question` until posters are added.** Rejected: the request flow's instructions and evals would be written twice.

## Consequences

Option ids are TMDB ids, so a custom Telegram renderer can key on them, for example to show posters.

Telegram shows only the prompt and the labels, as inline buttons truncated to 64 characters. A description would never be seen, which is why options have none.

An id the model resolves after `cancelled`, for example from "the Lynch one", is mapped by the model rather than picked by the person. `request_media` (#10) decides whether a request needs its own confirmation. Its approval prompt already shows the title.

At most four titles are offered. Telegram lays buttons out two per row, so a fourth costs no extra space, and it fits titles with several versions, such as *A Star Is Born*. More would need a third row, and a person facing that many is better off adding the year.

The details fetch is a step with `maxRetries = 0`. A failed Seerr read fails the tool on the first attempt, as `get_media_details` does, instead of retrying three times with backoff while the turn is parked.
