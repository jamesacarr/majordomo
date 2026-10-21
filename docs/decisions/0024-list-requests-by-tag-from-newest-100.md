---
created_at: 2026-10-21T06:45:38Z
updated_at: 2026-10-21T10:48:18Z
status: superseded
---

# 0024. List requests by tag from Seerr's newest 100

Decided 2026-10-21. Superseded by 0026.

## Context

Household members want to ask what they've requested and how a request is going without opening Seerr. Seerr can't answer "mine": every bot request is saved under Seerr user 1 because the bot uses one admin API key (decision 0004), so `requestedBy` identifies nobody. What does identify the requester is their Radarr or Sonarr tag. Seerr 3.4.1's `GET /request` has no tag filter, but each request row carries its tag ids, and no title.

## Decision

`get_media_requests` is read-only and needs no approval. It reads Seerr's 100 newest requests in one call and returns at most 20 rows.

- **Mine by tag, in code.** With `mine`, it resolves the requester's tag id on the default Radarr and Sonarr servers and keeps rows carrying the id for their media type. A server with no tag for the requester contributes no rows and is named in `tagMissingOn`; the tool never falls back to everyone's requests.
- **Always scan 100.** Scanning only 20 would cover the household's 20 newest requests, often fewer than one person has, and would miss an older request when someone asks about one title. Only the Seerr response grows, not the tool output.
- **Newest row per title.** A show requested in season batches creates several Seerr requests, so rows are deduplicated by media type and TMDB id, keeping the newest.
- **Combined status.** Bot requests auto-approve (decision 0010), so request status alone reads `approved` until the download finishes. Pending, declined and failed requests report their own state. Approved and completed requests report the media's availability, with anything not yet on the server as `processing`.
- **Seerr's own `filter`, narrowed to `available` and `processing`.** Seerr marks a request completed once its media is available, so its `available` filter matches the combined `available`, and its `processing` filter (approved, media not fully available) matches `processing` and `partially_available`. Pending, declined and failed are rare under auto-approval and still appear unfiltered, so the ticket's `pending` and `approved` values were dropped. Filtering in Seerr also spends the 100-row scan on matching rows only.
- **Year on every row.** Each row has `title`, `year`, `mediaType`, `status` and `requestedOn`. The year goes beyond the ticket's four fields: it tells Dune (1984) from Dune (2021), and the title fetch already returns it. A failed title fetch gives that row a `null` title and year instead of failing the list.
- **List first for request-status questions.** "How's Dune going" starts with `get_media_requests`, not `search_media`. The request list holds only titles someone requested, so it disambiguates "Dune" without asking, and it reports pending approval, declined and failed, which search can't. Questions about whether something is on the server still start with search.

## Alternatives considered

- **Scan 20, then filter by tag** (the ticket as written). Rejected: returns only the requester's share of the household's 20 newest, with no sign that more exist.
- **Page through `GET /request` until 20 rows match.** Rejected: unbounded Seerr calls in one model turn, behind a tunnel that can stall.
- **Per-user Seerr attribution via `X-API-User`.** Seerr acts as the user named in that header when the admin API key is used (`server/middleware/auth.ts`, 3.4.1), so `mine` could become `requestedBy=<id>` with no scan limit and would include requests made in Seerr's UI. Deferred: it reverses decision 0004, changes `request_media` and the allowlist format, and enables the per-user quotas decision 0010 relies on bypassing.
- **A filter value per combined status, applied in code.** Rejected: Seerr's `available` and `processing` already line up, the extra values serve rare states, and filtering in code wastes the scan on rows that don't match.
- **Narrow the scan with `requestedBy=1`.** Rejected: it hard-codes Seerr's admin id, the owner may also request in Seerr's UI as user 1, and plain listings should include UI requests.
- **Request status only.** Rejected: every auto-approved request would read `approved` until it completes.

## Consequences

Requests made in Seerr's own UI carry no tags, so they are never "mine". Anything older than the household's 100 newest requests is invisible to every mode, and `mine` can return fewer than 20 rows even when the person has more requests. The instructions state both limits. Each listing costs one Seerr list call, with `mine` a tag lookup on each default server (two Seerr calls each), and one title fetch per row returned.
