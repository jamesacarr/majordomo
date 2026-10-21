---
created_at: 2026-10-21T10:48:18Z
updated_at: 2026-10-21T11:00:48Z
status: accepted
---

# 0025. Act as each person's Seerr user

Decided 2026-10-21.

## Context

Every Seerr call used the admin API key with no user, so Seerr treated every Telegram request as Seerr user 1. It auto-approved them, skipped quotas and recorded the admin as the requester (decision 0010). A household member with restricted Seerr permissions could request anything through Telegram.

Attribution relied on Radarr and Sonarr tags instead (decisions 0004, 0005 and 0009). Those tags had to be created by hand, and Radarr and Sonarr delete any unused tag every 24 hours (`CleanupUnusedTags`), so a tag created ahead of time could vanish before its first use.

With the admin API key, Seerr acts as the user whose id is in the `X-API-User` header (`server/middleware/auth.ts`, v3.5.0). That user's permissions, auto-approval and quota apply, and Seerr records them as the requester.

## Decision

The bot acts as each person's own Seerr user on every Seerr call.

- **Allowlist.** `MAJORDOMO_ALLOWED_USERS` is a JSON map of Telegram user id to Seerr user id, for example `{"123456789": 7}`. The Seerr id is a JSON positive whole number, not a string. Two Telegram ids may map to the same Seerr id, for one person with two Telegram accounts. A missing value, invalid JSON or a bad entry throws, naming the variable and the entry (`agent/lib/parse-allowlist.ts`).
- **Who may reach the bot.** These rules carry over from decision 0003. Only private chats reach the agent. Messages from anyone not on the allowlist, and every group message, are dropped without a reply. Adding a person is an env var change, and silence avoids confirming to strangers that the bot exists, at the cost of no feedback for a household member whose id is wrong. Group chats stay unsupported.
- **Names come from Telegram.** `onMessage` (`agent/lib/telegram/create-on-message.ts`) takes the person's trimmed Telegram first name. With one, the session gets a `requester_name: Mary` context line and the title `Mary`. Without one, it gets neither, and eve's default title applies.
- **Session identity.** The session's auth attributes carry the Seerr id as the string `seerr_user_id`, beside `chat_id` and `user_id`, because eve's attributes are strings. `requireRequester` (`agent/lib/require-requester.ts`) reads it back and rejects anything that isn't a positive whole number. Sessions from the `eve dev` TUI and evals carry no Telegram identity, so under `EVE_DEV=1` the id falls back to `MAJORDOMO_DEV_SEERR_USER_ID`. A value there that isn't a positive whole number throws, naming the variable. Outside `eve dev`, a session without an identity fails before any Seerr call.
- **Every call carries the id.** `createClient` and `getClient` require a Seerr user id, and the client sends it as `X-API-User` beside the admin `X-Api-Key`. Every tool builds its client from `requireRequester(ctx)`, including `pick_media`'s title fetches and the Telegram poster cards (decision 0023). A card fetch with no identity sends no cards, and the keyboard still goes out.
- **Unknown Seerr ids.** When the id names no user, Seerr's `isAuthenticated` middleware answers 403 with `{ status, error }` and no `message`. The client turns exactly that answer into an `UnknownUserError` naming the id, such as `Seerr has no user with id 42 (X-API-User). Check MAJORDOMO_ALLOWED_USERS, or MAJORDOMO_DEV_SEERR_USER_ID in development.` It isn't an `ApiError`, so `request_media` can't report it as a refusal. Nothing checks the id when a message arrives, so the first tool call is where it shows.
- **Request outcomes.** `request_media` posts no tags and makes no `/service` calls. Seerr creates the request approved when the user has `AUTO_APPROVE`, `AUTO_APPROVE_MOVIE` or `AUTO_APPROVE_TV`, or `MANAGE_REQUESTS`, and pending otherwise (`server/entity/MediaRequest.ts`). The tool reports `requested` with `status` `approved` or `pending_approval`. A 403 `ApiError` from the post (no permission for that media type, quota used up, or a blocklisted title) is reported as `refused` with Seerr's own message, and nothing is created. `already_on_server` and `title_mismatch` are unchanged (decision 0022). `missing_tags` and `requested_unconfirmed` are gone.
- **Tags are optional.** The bot no longer depends on Radarr or Sonarr tags. Seerr's own "Tag Requests" setting can still tag requests, and nothing in the bot reads those tags.

`UnknownUserError` rests on one assumption. `isAuthenticated` sends the same `{ error }` body when the id names no user and when the user lacks the route's permission (`server/middleware/auth.ts`). Every route the bot calls (`/search`, `/movie`, `/tv`, `/person`, `/request`, `/service`) mounts `isAuthenticated()` with no permission (`server/routes/index.ts`), so today the body can only mean "no such user". A call to a permission-gated route such as `/settings` would need this revisited. A comment in `agent/lib/seerr/create-client.ts` records the same assumption.

## Alternatives considered

- **Keep tags and add only `X-API-User`.** The smallest change: Seerr would enforce permissions and quotas while `request_media` kept tagging. Rejected: tags still vanish after `CleanupUnusedTags`, the allowlist still needs unique name slugs, and a person's list still misses requests made in Seerr's UI.
- **A Seerr API key or Plex login per person.** Rejected: it needs a secret per person in the environment, and Seerr issues one API key. `X-API-User` with the admin key is the documented path.
- **Check each Seerr id when a message arrives** (`GET /user/:id`). Rejected: an extra Seerr call on every message, behind a tunnel that can stall, and the first tool call already fails naming the id.
- **Add the `X-API-User` id to every `ApiError` message.** Rejected: every error a person might see would carry a configuration detail, and the admin would still get "Forbidden" rather than "no such user".
- **Treat any 403 without a `message` as `refused`.** Rejected: an unknown id would reach the person as a permission problem instead of a configuration error for the admin.
- **An allowlist value of `{ "seerrUserId": 7, "name": "Mary" }`.** Rejected: Telegram already supplies the name, and a second source would drift.

## Consequences

- This supersedes decisions 0003, 0004, 0005, 0009 and 0010. Decision 0026 covers listing requests.
- It amends two decisions whose core stands. In 0002, the client now sends `X-API-User` beside the admin key, and the `tags` field no longer motivates hand-authoring. In 0019, a created request no longer needs `tags`, so `createRequest` parses its answer with `mediaRequestSchema`, where `tags` is optional.
- Every allowlisted person needs a Seerr account, and the admin must look up each one's Seerr user id. A wrong id fails each tool call with an error naming it.
- Seerr's permissions, auto-approval and quotas now govern Telegram requests. The bot's allowlist and confirmation prompt (decision 0006) still apply on top.
- Requests made through the bot before this change belong to Seerr user 1, so they drop out of every person's list.
- The tag lookup code (`resolveTagIds`, `toTag`, `SEERR_TAG`, the `/service` client methods) is unused and stays until a follow-up removes it.
