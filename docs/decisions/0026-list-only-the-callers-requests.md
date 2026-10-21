---
created_at: 2026-10-21T10:48:18Z
updated_at: 2026-10-21T10:48:18Z
status: accepted
---

# 0026. List only the caller's own requests

Decided 2026-10-21.

## Context

Decision 0024 listed requests by scanning Seerr's 100 newest and keeping the requester's by Radarr or Sonarr tag, because every bot request belonged to Seerr user 1. Now the bot acts as each person's own Seerr user (decision 0025), so Seerr records the real requester, and its `GET /request` filters by user with `requestedBy`. Listing everyone's requests is no longer needed.

In Seerr v3.5.0 (`server/routes/request.ts`), a user without `MANAGE_REQUESTS` or `REQUEST_VIEW` only ever gets their own requests. A user with either permission gets the requests of whoever `requestedBy` names, and everyone's when it's left out.

## Decision

`get_media_requests` lists only the person asking's requests, including the ones they made in Seerr's own UI. It has no `mine` input.

- **One call, always with `requestedBy`.** `listRequests` (`agent/lib/media/list-requests.ts`) calls `GET /request` with `requestedBy` set to the person's Seerr id, `sort=added` and `take=20`, plus `filter` when given. `requestedBy` is a required parameter of the client's `listRequests`, so a call without it doesn't compile, and a person with `MANAGE_REQUESTS` can't see the household's requests by accident.
- **Newest row per title, carried over from 0024.** A show requested in season batches makes several Seerr requests, so rows are deduplicated by media type and TMDB id, keeping the newest. Duplicate rows for one show with different statuses would confuse the answer.
- **Combined status, carried over from 0024.** Pending, declined and failed requests report their own state. Approved and completed requests report the media's availability, with anything not yet on the server as `processing` (`toRequestProgress`).
- **`filter` gains `pending`.** The values are `available`, `processing` and `pending`, passed to Seerr unchanged. Seerr's `pending` matches requests waiting for approval. Decision 0024 dropped it because auto-approval made pending requests rare. With each person's own approval rules (decision 0025), waiting for approval is a normal state, and "what's waiting for approval" is a natural question.
- **Unchanged from 0024:** every row has `title`, `year`, `mediaType`, `status` and `requestedOn`; a failed title fetch gives that row a `null` title and year instead of failing the list; and a request-status question such as "how's Dune going" starts with `get_media_requests`, not `search_media`.

## Alternatives considered

- **Leave out `requestedBy` and rely on Seerr's own restriction.** Rejected: a person with `MANAGE_REQUESTS` or `REQUEST_VIEW` would get everyone's requests.
- **Drop the deduplication and return raw request rows.** Rejected: a show requested in season batches would appear several times with differing statuses.
- **Page through `GET /request` until 20 titles remain after deduplication.** Rejected for the reason in 0024: unbounded Seerr calls in one model turn, behind a tunnel that can stall.
- **Keep `filter` to `available` and `processing`, as the ticket asked.** Rejected: pending requests are now common, and Seerr filters them in the same call.

## Consequences

This supersedes decision 0024. The list reaches past the household's 100 newest requests and includes requests made in Seerr's UI. It shows at most the person's 20 newest requests, and fewer than 20 rows when a show among them was requested in season batches. Requests the bot made before decision 0025 belong to Seerr user 1 and appear in nobody's list. Each listing costs one Seerr list call and one title fetch per row, with no tag lookups.
