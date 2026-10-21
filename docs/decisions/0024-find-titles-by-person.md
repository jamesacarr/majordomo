---
created_at: 2026-10-21T06:51:25Z
updated_at: 2026-10-21T06:51:25Z
status: accepted
---

# 0024. Find titles by person with `search_media_by_person`

Decided 2026-10-21, for #16.

## Context

Asked "films with Brad Pitt", the model could only answer from memory, because `search_media` drops person results. Titles from memory may not exist, may not match a TMDB id, and carry no availability, so they can't be requested directly. Recommendations are already grounded in TMDB (0012), and person questions need the same.

## Decision

One tool, `search_media_by_person`, takes a person's name and an optional `role` (`acting` or `directing`) and `mediaType`. It searches Seerr for the name, takes the first person result in Seerr's order (TMDB multi search), fetches that person's combined credits, and returns up to eight as the same candidates `search_media` returns, with TMDB ids and availability.

Credit selection:

- Only acting and directing credits come back: cast, and crew with the job `Director`. An omitted `role` returns both. Producer, writer and other crew credits are never returned, because "films with X" means titles X was in or made, and a producer-only credit reads as wrong.
- Self appearances (a `character` starting with Self, Himself, Herself or Themselves) are dropped, so talk shows and award ceremonies don't fill the list.
- TV acting and directing credits under three episodes are dropped, so a guest spot or a one-off episode directed can't outrank films.
- Credits are de-duplicated by media type and TMDB id, then ranked by vote count, so well-known titles come first.

The tool is named `search_` rather than `get_` because it takes free text, as `search_media` does; the `get_` tools take a TMDB id. The name reads as "search media, by person", which matches the output: a list of titles. The ticket's working name, `get_person_credits`, doesn't follow the `<verb>_<domain>*` convention.

The instructions let the model request a title from these results directly, without searching for it again, and tell it to name the person as the tool gave it, so a wrong namesake is obvious.

## Alternatives considered

- **Instructions only.** Name titles from memory, then ground each with `search_media`. Rejected: the titles still come from memory, and it costs one search per title.
- **Separate `search_people` and `get_person_credits({ personId })`.** Rejected: an extra tool and an extra model round trip on every person question, plus instructions for choosing a person in text.
- **People in `search_media` results.** Rejected: it still needs a credits tool and two calls per question. It also widens the candidate's `mediaType`, which `pick_media`, `get_media_details` and `request_media` would each have to guard against, and people would share the eight-result cap with titles.

## Consequences

A less famous person who shares a name with a better-known one can't be reached. An optional `personId` input would fix that without breaking callers.

TV acting and directing credits under three episodes never come back, even when that's the credit someone wants.

TV creators (job `Creator`) aren't returned, so "shows Vince Gilligan made" finds nothing until a `creating` role is added.
