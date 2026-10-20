---
created_at: 2026-09-03T03:01:42Z
updated_at: 2026-10-20T04:37:02Z
status: draft
---

# majordomo implementation plan

majordomo is a household agent, built on eve 0.81 and deployed to Vercel, that lets an allowlisted set of people request movies and TV shows through Seerr. Every request is confirmed with an inline keyboard before submission and tagged in Radarr/Sonarr with a fixed `seerr` tag plus the requester's name. The structure leaves room for more home capabilities later (deleting media, lighting) without reworking the core.

Naming: `majordomo` is the role name for the code, repo, and Vercel project. The Telegram bot's display name is a household name set in BotFather. Telegram shows that name to users; the agent itself never needs to know it, so there is no display-name env var. If the instructions ever need the agent to name itself, write the name into `agent/instructions.md` as ordinary authored content.

Work through this document one MR at a time. Each MR section lists the eve doc pages to read first (paths under `node_modules/eve/docs/`), the files to touch, and the check that proves it works. Update `updated_at` and the status table when an MR lands or a decision changes.

## Decisions already made

| Topic | Decision | Why |
| --- | --- | --- |
| Hosting | Vercel via `eve deploy`. | eve's default path. Telegram needs a public webhook URL either way. |
| Deployment | The GitHub repo is connected to Vercel, which deploys `main` to production on every push. Vercel builds a protected preview deployment for each pull request, not for every branch push; Preview-scoped env vars currently hold the production values. Any env var a change reads must exist on the Vercel project before that change merges. | One environment keeps the free tier simple. eve builds and boots without `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN`; the webhook route logs a warning and answers 401 until they are set (verified on eve 0.50.0, 2026-09-03, and again on 0.81.1, 2026-10-20), so merging channel code before the secrets exist fails closed rather than breaking the deploy. |
| Seerr endpoint | An existing Seerr 3.4.1 instance, published over https through a Cloudflare Tunnel that is independent of the agent. `SEERR_URL` points at it; the hostname lives only in `.env` and the Vercel project. | Already running. The agent only needs an API key. |
| Seerr integration | Hand-authored typed tools over a thin `agent/lib/seerr` client. Not an OpenAPI connection. | The Seerr spec has ~200 operations. Exposing only four tools enforces "nothing unrelated" structurally, and the spec omits the `tags` field we need. |
| Attribution | Every request carries two Radarr/Sonarr tags: a fixed `seerr` tag and the requester's display name from the allowlist, slugified to lowercase letters, digits and hyphens (`Mary Jane` becomes `mary-jane`). Bot uses one Seerr API key. No Seerr user mapping. | Confirmed 2026-09-03. The `seerr` tag marks everything that came through Seerr regardless of who asked. Slugifying assumes Radarr and Sonarr restrict tag labels to `[a-z0-9-]`; this was not verified. Two names with the same slug are rejected rather than suffixed, because a suffix would depend on who else is listed and could move a tag between people. |
| Confirmation | Every `request_media` call is gated with eve's `approval: always()`. Ambiguous searches use the built-in `ask_question` tool so the user picks from a keyboard. | Confirmed 2026-09-03. `ask_question` was a default tool then and is opt-in since eve 0.65; it stays enabled, but MR 4 decides whether it earns its place over a numbered text list. |
| Allowlist | JSON in the `MAJORDOMO_ALLOWED_USERS` env var, keyed by Telegram user id. Private chats only. Non-allowlisted messages and all group messages are dropped silently. | Adding a user is an env change, not a deploy. Silence avoids confirming the bot exists to strangers. |
| Recommendations | Grounded in Seerr's TMDB-backed `/movie/{id}/recommendations`, `/similar` and TV equivalents, not model memory. | Titles come back with TMDB ids and library availability, so each suggestion is directly requestable and never hallucinated. |
| Model | `minimax/minimax-m3.1-flash` through the AI Gateway, switched from `minimax/minimax-m3` on 2026-10-20. Evals are the gate for switching. | Priced at $0 on the gateway; `minimax-m3` now costs $0.30 / $1.20 per million input/output tokens. See "Model choice" below. |
| Gateway auth | Production authenticates to the AI Gateway with Vercel OIDC automatically. Local `eve dev` and `eve eval` use `AI_GATEWAY_API_KEY` from `.env`. | No switch needed; the two paths coexist. |
| Seerr approval | All bot requests are auto-approved, because they arrive through one admin API key. Seerr's per-user quotas and approval rules do not apply. | Confirmed 2026-09-03. Per-user rules, if ever wanted, would live in the bot. |
| Bots | A separate development bot for `eve dev` and testing. The production bot keeps serving the previous implementation until go-live, when its token moves to Vercel. Wanted, not scheduled: a test bot to verify changes before they reach production, likely by giving the Preview environment its own `TELEGRAM_BOT_TOKEN` and webhook secret and pointing the test bot's webhook at a PR's preview deployment. | Telegram allows one webhook or one poller per token, not both. |
| Runtime | Node 24, the newest version Vercel's functions runtime supports. `engines.node`, `mise.toml`, and `@types/node` all say 24. | Verified 2026-09-03 against Vercel's supported-versions docs and `@vercel/build-utils`, which reject unknown versions at build time rather than falling back. Node 26 is only available in Vercel Sandboxes. |
| Telegram formatting | Deliver replies with `parse_mode: HTML` and fall back to plain text if Telegram rejects the message. The model may use `<b>` for titles and nothing else. | eve's default handler sends plain text, but its `sendMessage` body is spread through, so a custom `message.completed` handler can add `parse_mode`. HTML needs only `<`, `>`, `&` escaped; MarkdownV2 needs a dozen characters escaped and the model will get it wrong. Implemented in MR 2. eve's `sendMessage` wrapper throws a plain `Error` with the HTTP status in its message, so the 400 fallback matches on that text. |
| Cost bounds | Session lifetime and token budgets in `agent.ts` `limits`, small tool outputs, and a spend cap on the AI Gateway. | See "Cost controls" below. |

## Decisions still open

All five are resolved. Kept for the reasoning; reopen by editing the entry.

1. **Missing tag in Radarr/Sonarr.** Resolved 2026-09-03: fail closed if either the `seerr` tag or the user tag is absent. The request is not submitted and the bot names the missing tag. Alternative: submit with whatever tags resolved and warn. Seerr has no API to create a tag, so `seerr` and one tag per allowlisted name must be pre-created in both Radarr and Sonarr.
2. **TV seasons.** Resolved 2026-09-03: request all seasons unless the user names specific ones. The confirmation prompt shows which.
3. **4K.** Resolved 2026-09-03: the bot never sets `is4k` on a request. In Seerr, `is4k` selects a server flagged as a 4K server, and the owner's Radarr and Sonarr servers are `isDefault: true, is4k: false`, so every request goes to them and they apply their own default quality profile (which may itself be 4K). Seerr's `is4k` only becomes relevant if a separately flagged 4K server is added.
4. **Multiple Radarr/Sonarr servers in Seerr.** Default: use the server Seerr marks `isDefault` and not `is4k`, which is how Seerr itself routes an `is4k: false` request (`MediaRequest.ts` in v3.4.1, lines 248 to 253). Fail with a clear error if no such server exists.
5. **Protecting the Seerr tunnel.** Resolved 2026-09-03 as "API key only for now". Seerr is already public, and Vercel functions have no fixed egress IP on the free tier, so IP allowlisting the tunnel is not an option. Follow-on, not scheduled: put Cloudflare Access in front of the hostname and send a service token from the client (`CF-Access-Client-Id` / `CF-Access-Client-Secret` headers). The client accepts extra headers, so this is additive.

## Architecture

### Request flow

1. Telegram posts an update to `POST /eve/v1/telegram`. eve verifies the secret token header.
2. `onMessage` (`lib/telegram/create-on-message.ts`, wired up by `agent/channels/telegram.ts`) drops the update unless the chat is private and `message.from.id` is in the allowlist. Otherwise it returns a `SessionAuthContext` whose attributes carry the user's display name and tag, plus a `requester_name` context line so the model can address them by name.
3. The model runs with the media instructions and four tools. `search_media` returns normalised candidates with TMDB ids and availability.
4. If more than one plausible match, the model calls the built-in `ask_question` with the candidates. Telegram renders inline-keyboard buttons.
5. The model calls `request_media` with the chosen TMDB id. eve pauses for approval before `execute` runs. Telegram renders approve/cancel buttons.
6. On approval, `request_media` reads the requester's tag from `ctx.session.auth.current.attributes`, resolves the ids of the `seerr` tag and the user tag on the default Radarr or Sonarr server, and posts to Seerr `/request` with `tags: [seerrTagId, userTagId]`.
7. The reply reports the title, year, and Seerr's status (pending approval or approved, depending on Seerr's own rules for the API key's user).

### Layout

Tools in eve are flat files under `agent/tools/` and the filename is the model-facing tool name, so capability modules are expressed by naming convention plus a `lib/<domain>/` directory and an `instructions/<domain>.md` file.

```
agent/
  agent.ts                      model config only
  sandbox.ts                    just-bash sandbox; nothing uses it, but builds prepare one
  instructions.md               identity, tone, standing rules (scope refusal, one-line replies)
  instructions/
    10-core.md                  how to talk on Telegram (<b> titles only, no other markup, 4096 cap)
    20-media.md                 search -> disambiguate -> confirm -> request procedure
  channels/
    eve.ts                      HTTP channel for dev TUI and evals; [vercelOidc(), localDev()]
    telegram.ts                 binds lib/telegram handlers to telegramChannel
  tools/
    ask_question.ts             opt-in built-in since eve 0.65; renders as Telegram buttons
    bash.ts, read_file.ts, write_file.ts, web_fetch.ts, web_search.ts, agent.ts
                                each exports disableTool()
    search_media.ts
    get_media_recommendations.ts
    request_media.ts            approval: always()
    list_media_requests.ts
  lib/                          all logic lives here; one function per file, named after it
    constants.ts                ALLOWLIST_ENV, ALLOWLIST_AUTHENTICATOR
    types.ts                    Env (injectable process.env view), AllowedUser { name, tag }
    to-tag.ts                   toTag: display name -> slug, shared by allowlist and dev fallback
    parse-allowlist.ts          parseAllowlist: JSON -> Map<userId, AllowedUser>, throws if bad or tags clash
    lookup-user.ts              lookupUser(telegramUserId): AllowedUser | null
    require-requester.ts        requireRequester(ctx): name/tag from session, dev fallback
    telegram/
      create-on-message.ts      createOnMessage: private chats + allowlist -> auth
      constants.ts              BOLD_TAG regex shared by render and strip
      render-html.ts            renderHtml: escape all but <b>
      strip-html.ts             stripHtml: plain-text fallback body
      is-bad-request.ts         isBadRequest: detect eve's HTTP 400 send error
      on-message-completed.ts   onMessageCompleted: HTML send, plain-text retry on 400
    seerr/
      constants.ts              SEERR_TAG, AVAILABILITY_BY_STATUS, OVERVIEW_MAX_LENGTH
      schemas.ts                zod schemas for every Seerr answer; non-movie/TV search results dropped
      types.ts                  response types inferred from schemas.ts; inputs, Client, MediaCandidate
      api-error.ts              ApiError: non-2xx status plus Seerr's message
      create-client.ts          createClient: fetch wrapper with X-Api-Key
      resolve-tag-ids.ts        resolveTagIds: tag labels -> ids on the default server
      to-candidate.ts           toCandidate: MovieResult/TvResult -> MediaCandidate
    media/
      search.ts, recommend.ts, request.ts, list-requests.ts
                                tool bodies; the files in tools/ only bind schema to these
      stub-server.ts            fixture-backed Seerr HTTP stub for evals
evals/
  evals.config.ts
  media/*.eval.ts
docs/
  plan.md                       this file
  runbook.md                    deploy, setWebhook, tunnel, adding a user (MR 6)
.env.example
```

Adding a future capability (say lighting) means: `lib/lighting/` with colocated tests, tools named `<verb>_light*`, `instructions/30-lighting.md`, and evals. Nothing in the core changes. If the per-capability instructions grow past a screen, move the procedure into `agent/skills/<domain>/SKILL.md` so it loads only when relevant.

### Tests are colocated, but only under `lib/`

Tests sit next to the code as `*.test.ts`. eve discovers every file under `agent/tools/`, `agent/channels/`, `agent/instructions/`, `agent/skills/`, and `agent/schedules/`, so a test file there breaks the build: `eve build` rejects `agent/tools/probe.test.ts` with "Tool filename \"probe.test\" is not a legal tool name" (verified on eve 0.50.0 on 2026-09-03). `agent/lib/` is not discovered, so tests there are safe.

The consequence is a rule: files in the discovered directories only bind eve definitions (`defineTool`, `telegramChannel`) to functions exported from `lib/`. Logic and its tests live in `lib/`. Each function lives in its own `lib/` file named after it in kebab-case (`requireRequester` in `require-requester.ts`, with `require-requester.test.ts` beside it), without repeating the folder name (`lib/telegram/render-html.ts` exports `renderHtml`). Constants share a `constants.ts` and types a `types.ts` per directory. The thin binding files are covered by evals, which exercise the real tool registration. Vitest's default `include` glob already matches these, and Biome covers `agent/**`.

### Scope restriction

Three layers, in order of strength:

1. **Structural.** All built-in tools that reach the filesystem, shell or web are disabled. The only side-effecting tool is `request_media`, and it is approval-gated.
2. **Auth.** Nobody outside the allowlist gets a session. The Vercel OIDC path on the HTTP channel is for the dev TUI and evals only.
3. **Instructions.** A standing rule to decline unrelated requests in one sentence. Evals cover this.

### Tool contracts

`search_media`
Input: `{ query: string, mediaType?: "movie" | "tv" }`. Calls `GET /search?query=`. The client already drops people, collections and any other non-movie, non-TV result. Returns up to 8 `MediaCandidate` items: `{ tmdbId, mediaType, title, year, overview (truncated ~200 chars), availability: "unknown" | "pending" | "processing" | "partially_available" | "available" | "blocklisted" | "deleted" | "not_requested" }`. Availability comes from `mediaInfo.status` (1 unknown, 2 pending, 3 processing, 4 partially available, 5 available, 6 blocklisted, 7 deleted). No `mediaInfo` means not requested; a code outside that list maps to unknown.

`get_media_recommendations`
Input: `{ tmdbId: number, mediaType: "movie" | "tv", limit?: number }`. Calls `/movie/{id}/recommendations` and `/movie/{id}/similar` (or TV equivalents), merges, de-duplicates by TMDB id, ranks by vote average with a vote-count floor, returns `MediaCandidate[]`. The model resolves "movies like Fight Club" by calling `search_media` first.

`request_media`
Input: `{ tmdbId: number, mediaType: "movie" | "tv", title: string, year?: number, seasons?: number[] | "all" }`. `title` and `year` exist so the approval prompt is readable; the tool trusts only `tmdbId`. `approval: always()`. Steps inside `execute`: read requester from `ctx` (fail if absent), fetch details from `/movie/{id}` or `/tv/{id}` to get the real title, refuse if already available or already requested, resolve both tag ids (`seerr` and the user tag), `POST /request { mediaType, mediaId, seasons?, tags: [seerrTagId, userTagId] }`, return `{ requestId, title, year, status, tags }`. The `seerr` label is the `SEERR_TAG` constant in `lib/seerr/constants.ts`, not an env var.

`list_media_requests`
Input: `{ mine?: boolean, filter?: "pending" | "approved" | "available" | "processing" }`. Calls `GET /request?take=20&sort=added`. When `mine` is true, keeps only requests whose `tags` include the requester's tag id. Returns title, type, status, requested date.

### Seerr facts the implementation relies on

- Auth is the `X-Api-Key` header.
- `POST /request` accepts `tags: number[]` even though the published OpenAPI spec omits it. Confirmed in `server/entity/MediaRequest.ts` at tag `v3.4.1`, the version running at planning time (`let tags = requestBody.tags`). Re-check this line when Seerr is upgraded.
- Tag ids come from `GET /service/radarr/{id}` and `GET /service/sonarr/{id}`, which return `tags: { id, label }[]` alongside profiles and root folders. The spec under-documents this too.
- Media status codes in 3.4.1 (`server/constants/media.ts`): 1 unknown, 2 pending, 3 processing, 4 partially available, 5 available, 6 blocklisted, 7 deleted. The OpenAPI spec omits blocklisted and so numbers deleted 6; the source wins.
- Request status codes: 1 pending approval, 2 approved, 3 declined, 4 failed, 5 completed. Requests made with an admin API key are auto-approved unless Seerr is configured otherwise.
- `/service/radarr/{id}` and `/service/sonarr/{id}` return `{ server, profiles, rootFolders, tags }`; the list endpoints return `{ id, name, is4k, isDefault, ... }` per server (`server/routes/service.ts`, 3.4.1).
- Errors come back as `{ message, errors }` with the HTTP status (`server/index.ts`).
- Seerr validates requests with `express-openapi-validator` 5.6.2, which answers 400 ("must be url encoded") to a raw query value containing any RFC 3986 reserved character. `encodeURIComponent` leaves `!`, `'`, `(`, `)` and `*` unescaped, so the client escapes those too; otherwise a search for "Ocean's Eleven (2001)" fails.
- Seerr rejects a duplicate request for media that is already requested or available. Check `mediaInfo.status` first anyway so the user gets a clear message instead of an API error.

### eve facts the implementation relies on

- `onMessage` returning `null` drops the update with no reply. `ctx.telegram` is available inside `onMessage` if a reply is ever wanted.
- `SessionAuthContext.attributes` values must be strings or string arrays.
- Tools read the caller via `ctx.session.auth.current?.attributes.<key>`. Sessions started from the HTTP channel (dev TUI, evals) will not carry the Telegram attributes, so `lib/require-requester.ts` falls back to `MAJORDOMO_DEV_USER` only when `EVE_DEV=1`, and fails otherwise.
- Built-in tools are disabled per slot by exporting `disableTool()` from `agent/tools/<slug>.ts`. A typo in the slug fails the build. So does disabling a tool that is not a default: since eve 0.65 `todo` no longer exists and `ask_question` is opt-in, enabled by exporting `askQuestion()` from `agent/tools/ask_question.ts`.
- `ask_question` takes one `question` and 2 to 3 options of `{ label, description }`, with no option id, and returns `{ status: "answered", answer }` where `answer` is the chosen label or typed text (eve 0.81.1).
- Production builds prepare a sandbox template eagerly, even when no tool uses the sandbox. Without `agent/sandbox.ts`, eve picks Vercel Sandbox on Vercel and Docker, microsandbox or just-bash locally, and a local build fails when microsandbox is chosen but not installed. `agent/sandbox.ts` pins just-bash so every build prepares it in-process.
- eve replays interrupted tool steps, so `request_media` must tolerate a re-run: the availability check plus Seerr's own duplicate rejection cover this.
- Default Telegram delivery sends plain text with no `parse_mode`. `lib/telegram/on-message-completed.ts` replaces it with an HTML send and a plain-text fallback; the instructions allow `<b>` and nothing else.
- `TelegramMessageBody` omits `parse_mode`, but eve spreads the body into `sendMessage` unchanged, so a wider object type passes it through. `channel.telegram.post` splits text over 4096 characters, but sends every chunk after the first with only `text` (and `ephemeral_message_parameters`), dropping `parse_mode` (unchanged in eve 0.81.1). `on-message-completed.ts` therefore sends any reply whose escaped HTML exceeds `TELEGRAM_MESSAGE_TEXT_MAX_LENGTH` as plain text.
- Missing `TELEGRAM_WEBHOOK_SECRET_TOKEN` or `TELEGRAM_BOT_TOKEN` is not a build or boot error. Verification fails per request with a logged warning and a 401; sends throw when first attempted.
- eve does not call `setWebhook`; it is a one-off curl in the runbook.

## Cost controls

A Telegram private chat maps to one eve session, and every model call re-sends that session's history, so cost grows with conversation length times turn count. eve gives three levers, all in `agent/agent.ts`, plus one outside it:

```ts
export default defineAgent({
  model: "minimax/minimax-m3.1-flash",
  limits: {
    sessionTimeoutMs: 24 * 60 * 60 * 1_000,   // fresh session each day; default is 30 days
    maxInputTokensPerSession: 250_000,         // default is 40 million
    maxOutputTokensPerSession: 25_000,         // unset by default
  },
});
```

- **`sessionTimeoutMs`** is the main lever. It is an absolute lifetime from session creation, not an idle timeout. At the deadline eve finishes the active turn, ends the session, and the next message starts fresh. One day fits a "request a film" bot, where nothing needs remembering across days.
- **Token budgets** are a backstop. When a session crosses one, eve pauses and asks the user to approve a fresh window or stop. Users can keep approving, so this bounds accidents rather than intent. Since eve 0.75.1, compaction's own tokens count toward these budgets.
- **Compaction** stays at the default `thresholdPercent` of 0.9. It summarises history near the context window, which the limits above should stop us reaching. Compaction is itself a model call, so lowering the threshold adds cost rather than saving it here.
- **Small tool outputs** matter more than any setting. `search_media` returns at most eight candidates with overviews truncated to about 200 characters, recommendations return at most eight, and request listings return twenty rows of four fields. Tool output is re-sent on every subsequent call in the session.
- **A spend cap on the AI Gateway** is the only hard financial limit. Set a budget in the Vercel AI Gateway dashboard before go-live. Verify the exact control during MR 6; I have not checked what the dashboard currently offers.

The starting values above are guesses to tune. MR 6 records the first week's gateway usage against them.

## Model choice

`minimax/minimax-m3.1-flash` is the default because the gateway prices it at $0 (checked against `https://ai-gateway.vercel.sh/v1/models` on 2026-10-20). The risk for this agent is tool-call reliability rather than prose quality: it must chain `search_media`, `ask_question`, and `request_media` correctly, and stop when a request is unrelated. The eval suite in MR 5 is the acceptance test for whichever model is configured.

Unlike `minimax-m3`, it always reasons, with effort `low` to `max`. eve leaves `reasoning` unset, so the provider default applies. Reasoning tokens are likely to count as output tokens, which would make the 25,000-token `maxOutputTokensPerSession` budget bind sooner; MR 6's first-week usage review checks this. If it binds, set `reasoning: "low"` in `agent.ts` rather than raising the budget, and confirm with the evals.

$0 models carry two costs the price doesn't show. The gateway rate limits free-tier requests per model and publishes no numbers; a `429` is retried twice by the AI SDK, then the turn fails. And none of them offer zero data retention or a no-training guarantee (`zdr` and `no_training` are `none`), so the provider may keep the household's messages: names and what they watch.

Switching is a one-line change in `agent/agent.ts`. If minimax-m3.1-flash fails the evals, the other $0 language models on 2026-10-20 were `nvidia/nemotron-3.5-lightning-free`, `reflection/beam-free`, `poolside/laguna-s-2.1-free` and `stealth/glyph-cluster`; paid fallbacks include `minimax/minimax-m3`. Re-check the model list before choosing, because free pricing changes.

## MR stack

Each MR must merge on its own and leave `pnpm lint:ci`, `pnpm typecheck`, and `pnpm test` green. Production code per MR stays under roughly 300 lines; tests, docs, and lockfiles don't count.

| # | MR | Status |
| --- | --- | --- |
| 1 | Repo hygiene and locked-down scaffold | done (2026-09-03) |
| 2 | Telegram channel with allowlist | done (2026-10-19) |
| 3 | Seerr client | done (2026-10-20) |
| 3a | Validate Seerr responses with zod | done (2026-10-20) |
| 4 | Search and recommendation tools | todo |
| 5 | Request tool with confirmation and tagging | todo |
| 6 | Deployment runbook and first production deploy | todo |
| 7 | Request listing | todo |
| 8 | Posters and summaries on disambiguation and confirmation | todo |

### MR 1: Repo hygiene and locked-down scaffold

No behaviour yet. Makes the agent safe by default before any capability exists. The CI workflow and Biome `includes` gaps found during planning were fixed on 2026-09-03 and are not part of this MR.

Read first: `concepts/built-in-tools.md`, `guides/auth-and-route-protection.md`, `instructions.mdx`.

- Add `disableTool()` files for `bash`, `read_file`, `write_file`, `web_fetch`, `web_search`, `agent`, `todo`.
- Replace `placeholderAuth()` in `agent/channels/eve.ts` with `[vercelOidc(), localDev()]`.
- Write `agent/instructions.md` (identity, plain-text Telegram replies, decline unrelated requests) and `agent/instructions/10-core.md`. Static markdown; no build-time values needed.
- Add the `limits` block from "Cost controls" to `agent/agent.ts`, keeping the existing model.
- Add `.env.example` listing `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, `MAJORDOMO_ALLOWED_USERS`, `SEERR_URL`, `SEERR_API_KEY`, `MAJORDOMO_DEV_USER`, and `AI_GATEWAY_API_KEY` for local development. Done on 2026-09-03; keep it in sync if variables change.
- `README.md` intro was replaced during the rename; extend it with setup steps once the runbook exists.

Verify: `pnpm build` succeeds and `eve dev` shows only `ask_question` in the tool list.

### MR 2: Telegram channel with allowlist

Read first: `channels/telegram.mdx`, `channels/overview.mdx`, and the `TelegramInboundResult` type in `node_modules/eve/dist/src/public/channels/telegram/telegramChannel.d.ts`.

- `agent/lib/parse-allowlist.ts` and `agent/lib/lookup-user.ts`: parse `MAJORDOMO_ALLOWED_USERS` (`{"123456789": "Alice"}`) with zod, expose `lookupUser(telegramUserId)` returning `{ name, tag }` where `tag` is the slugified name (`lib/to-tag.ts`). Throw at first use if the env var is missing or malformed, if a name slugifies to nothing, or if two names share a tag.
- `agent/lib/telegram/create-on-message.ts`: `onMessage` handler that drops non-private chats and unknown users. For known users, return `auth` with `principalId: telegram:<id>`, `principalType: "user"`, `authenticator: "majordomo-allowlist"`, attributes `{ user_id, chat_id, name, tag }`. Set `title` to the user's name for the run.
- `agent/channels/telegram.ts`: `telegramChannel({ onMessage, events })`. No `botUsername`: eve only uses it for group mention detection, and groups are dropped.
- `agent/lib/telegram/on-message-completed.ts` (with `render-html.ts`, `strip-html.ts`, `is-bad-request.ts`): a `message.completed` handler that escapes `&`, `<`, `>` outside a whitelist of `<b>`/`</b>` tags, posts with `parse_mode: "HTML"`, and on a Telegram 400 re-posts the tag-stripped plain text. Colocated tests for the escaping and the fallback.
- Update `agent/instructions/10-core.md`: bold titles with `<b>`, no other markup.
- `agent/lib/require-requester.ts`: `requireRequester(ctx)` returns `{ name, tag }` from session attributes, with the `EVE_DEV` fallback described above.

Tests (colocated in `lib/`): allowlist parsing, rejection of malformed JSON, `onMessage` dropping groups and strangers, attribute shape for a known user, `requireRequester` behaviour with and without attributes and in dev mode.

Verify: unit tests, `pnpm build`, and `eve info --json` listing `POST /eve/v1/telegram`. Webhook testing is deferred to MR 6 because Telegram needs a public URL and a bot token. Before merging, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, and `MAJORDOMO_ALLOWED_USERS` on the Vercel project (see the Deployment decision).

### MR 3: Seerr client

Read first: `concepts/security-model.md` (secrets stay in `process.env`, tools run in the app runtime). Reference the Seerr spec at `https://raw.githubusercontent.com/seerr-team/seerr/develop/seerr-api.yml` for response shapes.

File names follow the one-function-per-file rule, so the plan's original `client.ts`, `tags.ts` and `normalise.ts` became `create-client.ts`, `resolve-tag-ids.ts` and `to-candidate.ts`, and `SeerrError` became `ApiError` in `api-error.ts` (the folder already says Seerr).

- `agent/lib/seerr/create-client.ts`: `createClient({ baseUrl, apiKey, fetch? })` with methods `search(query)`, `movie(id)`, `tv(id)`, `movieRecommendations(id)`, `movieSimilar(id)`, `tvRecommendations(id)`, `tvSimilar(id)`, `createRequest(body)`, `listRequests(params)`, `radarrServers()`, `radarrServer(id)`, `sonarrServers()`, `sonarrServer(id)`. Injectable `fetch` for tests. Non-2xx responses throw an `ApiError` carrying status and Seerr's message. Each call is aborted after `timeoutMs` (default `REQUEST_TIMEOUT_MS`, 10 s), covering the request and the body read, and throws an error naming the path: the tunnel can stall, and a hung call would hold the agent's turn.
- `agent/lib/seerr/types.ts`: only the fields the tools use.
- `agent/lib/seerr/to-candidate.ts`: `toCandidate(result)` mapping `MovieResult`/`TvResult` to `MediaCandidate`, including the `mediaInfo.status` mapping.
- `agent/lib/seerr/constants.ts` exports `SEERR_TAG = "seerr"`; `agent/lib/seerr/resolve-tag-ids.ts` exports `resolveTagIds(client, mediaType, labels)`, which picks the default non-4K server, fetches its tags once, matches each label case-insensitively, and returns `{ ids, missing }` so the caller can report exactly which label is absent.

Tests: each client method builds the right path, query and headers against a fake fetch. Normalisation covers movie, TV, person (dropped), and every status code. Tag resolution covers both labels found, only `seerr` found, only the user tag found, neither found, and no default server.

### MR 3a: Validate Seerr responses with zod

Added 2026-10-20 after the MR 3 review. Starts once MR 3 merges and lands before MR 4, so the tools are written against validated types.

The client casts each JSON body to its declared type, so a field Seerr renames or drops surfaces as `undefined` far from the cause. The worst case is a missing `mediaInfo.status`, which `toCandidate` reads as `not_requested`, so the agent would offer to request something already on the server.

- Replace the interfaces in `agent/lib/seerr/types.ts` with zod schemas and derive the types with `z.infer`. Give `call` in `create-client.ts` a schema per method and parse every response, so a mismatch throws naming the call and the field.
- Require only what the logic depends on: `id`, `mediaType`, `title` or `name`, and `mediaInfo.status` on results; tag `id` and `label`; request `id`, `status` and `tags`. Everything else is optional or nullable. TMDB already sends `posterPath: null`, empty `releaseDate` strings and missing overviews, and an over-strict schema would turn a harmless upstream change into every search failing.
- Client tests answer with realistic fixtures instead of `{ ok: true }`, and gain a test per required field that a response without it throws.

As built: Seerr maps every TMDB type it doesn't recognise to a person-shaped result that keeps TMDB's `media_type` (3.4.1, `mapSearchResults`), so `/search` can return any `mediaType`, `collection` included. The search schema relabels anything other than `movie` or `tv` before a discriminated union runs, then drops it. A plain `z.union` would have reported a malformed movie only as "Invalid input at results[0]"; the discriminated union names the field. `toCandidate` therefore takes only movie and TV results and no longer returns `null`. Parsed types are mutable (`z.output`), which is harmless for freshly parsed data.

Rejected: checking only the three decision fields (availability, tag ids, created-request tags) inside MR 4 and MR 5. Less code, but the checks would be scattered across the tools and every new tool would have to remember them.

### MR 4: Search and recommendation tools

Read first: `tools/overview.mdx`, `evals/overview.mdx`.

- `agent/lib/media/get-client.ts`: `getClient(env = process.env)` builds the Seerr client from `SEERR_URL` and `SEERR_API_KEY`, and throws naming the variable when either is missing or blank, so misconfiguration fails at first use like the allowlist does. The env var names go in `lib/media/constants.ts`.
- `agent/lib/media/search.ts`, `agent/lib/media/recommend.ts`, and `agent/lib/media/details.ts` hold the logic with colocated tests. `agent/tools/search_media.ts`, `agent/tools/get_media_recommendations.ts`, and `agent/tools/get_media_details.ts` bind the zod schemas to them.
- `get_media_details` takes `{ tmdbId, mediaType }` and returns title, year, overview, runtime or season count, genres, top-billed cast, director or creators, and availability from `/movie/{id}` or `/tv/{id}`. It exists so "is that the Christian Bale one?" is answered from data, not memory.
- `agent/instructions/20-media.md`: the procedure. Search first. If one result clearly matches (title and year agree, or only one non-person result), proceed. If several plausible matches, call `ask_question` with the two or three likeliest options labelled "Title (Year)" (the tool accepts 2 to 3). Availability is part of every search result: when someone asks whether something is on the server, call `search_media` and answer from the `availability` field without offering to request it. When they ask to request something that is already available, say so and stop; if it is pending or processing, say it's on its way and stop. If it is blocklisted, say the server owner has blocked it and stop. Do not request again in either case. For clarifying questions about a candidate (cast, director, which version), call `get_media_details` before answering. For recommendation questions, search the named title, then call `get_media_recommendations`, and present up to five with one-line reasons. Never use Markdown.
- `evals/evals.config.ts` and first evals: a clear search calls `search_media`; an ambiguous search (for example "Dune") calls `ask_question` and `session.requireInputRequest` sees more than one option; a recommendation question calls both tools; an unrelated request ("what's the weather") calls no tool and declines. Point the eval Seerr URL at a local stub (`agent/lib/media/stub-server.ts`, an HTTP server serving fixture JSON) so evals are deterministic and free of network.
- Decide whether `ask_question` stays. It gives tap-to-pick buttons for one 4-line binding, but options carry no id, so the model maps the chosen "Title (Year)" label back to a TMDB id from the search results. That mapping is ambiguous when two candidates share a title and year, so add the media type or a distinguishing detail to those labels. Its built-in description also tells the model to end the recommended option's label with "(Recommended)"; `20-media.md` must forbid that for title choices. The alternative is a numbered text list, which `10-core.md` already describes. Typed replies that match an option label or number answer `ask_question` too, so the two differ mainly in buttons. Run the ambiguous-search evals with `ask_question` enabled; if they pass with the text list as well and buttons add nothing, remove `agent/tools/ask_question.ts`. Record the outcome in the Confirmation decision row.

Verify: `pnpm test` and `eve eval media`.

### MR 5: Request tool with confirmation and tagging

Read first: `tools/human-in-the-loop.md` (the `approval` section), `guides/session-context.md`.

- `agent/lib/media/request.ts` holds the logic with colocated tests. `agent/tools/request_media.ts` binds it per the contract, with `approval: always()` from `eve/tools/approval`.
- Extend `20-media.md`: after the user picks or confirms a title, call `request_media` with the title and year filled in from the search result. Report Seerr's outcome. If the tool reports a missing tag, tell the user plainly and do not retry.
- Set the approval text with the object form `approval: { prompt: ({ input }) => ... }` (eve 0.79), formatted as "Request Title (Year)?" from the tool input. This replaces the earlier plan to override the `input.requested` handler; only fall back to an override if the spike shows the prompt still renders badly.
- Spike inside this MR, two questions. First, how the approval renders on Telegram (button labels, and whether the tool input appears alongside the prompt). Second, what happens to an abandoned approval: if the user ignores the prompt and sends an unrelated message hours later, does eve treat it as a decline, keep the prompt pending, or steer the turn? The docs (`tools/human-in-the-loop.md`) say a typed reply matching `approve` or `cancel` answers it and that steering messages withdraw `ctx.ask()` questions, but don't say what an unrelated message does to a pending approval. Record the answer here and make the instructions match.
- Approval semantics to rely on as of eve 0.81.1, all from the changelog: without an `approval.response` policy only the person whose turn requested the approval can answer it (0.72); the approved call runs as the requester, so `requireRequester` sees the requester's identity (0.78); the first answer decides, so a double tap or Cancel then Approve stays cancelled (0.81). If a response policy is ever added, it receives `response.decision` (`"approve"` or `"cancel"`) and `response.principal` (0.69).
- The client's `createRequest` throws when Seerr's answer has no `tags` array (MR 3a). By then Seerr has already accepted the request, so the tool must report it as "requested, but the tags could not be confirmed" and not as a failure the user should retry.
- Unit tests: the request body sent to the stub carries exactly `[seerrTagId, userTagId]`, and the tool refuses when either is missing.
- Evals: happy path with `session.respond` approving; decline path where the request is not submitted; already-available path where the tool refuses before approval; missing-tag path for each of the two tags. Also assert that a reply naming a title wraps it in `<b>`: eve's per-message Telegram context asks for plain text, and `10-core.md` overrides that only by instruction.

Verify: unit tests, `eve eval media`, and a manual run in `eve dev` with `MAJORDOMO_DEV_USER` set and the stub Seerr.

### MR 6: Deployment runbook and first production deploy

Read first: `guides/deployment/vercel.mdx`, `channels/telegram.mdx` (webhook registration).

- `docs/runbook.md`: create a development bot with BotFather for `eve dev` and a test deployment, and disable group joining on it; at go-live, stop the previous implementation, then register the webhook against the production bot's token; set the AI Gateway spend cap; note that Seerr is already reachable over https through a Cloudflare Tunnel managed outside this repo, and generate an API key in Seerr settings; create the `seerr` tag plus one tag per allowlisted name in both Radarr and Sonarr; set env vars on the Vercel project; `eve link` and `eve deploy --non-interactive --yes`; the `setWebhook` curl with `allowed_updates: ["message","callback_query"]`; smoke test steps; how to add a user (edit env var, redeploy or wait for the next cold start, create their tag in Radarr and Sonarr).
- Deploy, register the webhook, and run the smoke test from a real Telegram account: stranger is ignored, allowlisted user searches, disambiguates, confirms, and the request appears in Seerr, Radarr or Sonarr with both the `seerr` tag and the user's tag.

Verify: the smoke test checklist in the runbook, ticked off with the date. One week after go-live, compare gateway usage with the `limits` values and adjust.

### MR 7: Request listing

- `agent/lib/media/list-requests.ts` with colocated tests, bound by `agent/tools/list_media_requests.ts` per the contract.
- Instructions: answer "what have I requested" and "what's the status of X" with this tool.
- Evals for both phrasings.

### MR 8: Posters and summaries on disambiguation and confirmation

Needs redesign before starting: since eve 0.65, `ask_question` options have no `id` (only `label` and `description`), so the handler below can no longer key candidates by TMDB id. Pick one of these when the MR starts:

- **Match on the label.** Keep `ask_question` and look up each option's "Title (Year)" label in the candidates slot. No new tool, but it breaks when two candidates share a label (MR 4's labelling rule reduces this) and couples the handler to label wording.
- **A `pick_media` tool of our own (preferred).** A workflow tool that takes `{ tmdbIds, mediaType }`, builds "Title (Year)" labels from the candidates slot, and calls `ctx.ask({ prompt, display: "select", options })` with each TMDB id as the option `id`. `ctx.ask()` returns the chosen `optionId` (eve 0.81.1, `ToolInputResponse` in `tools/definition.d.ts`), so the tool returns an exact TMDB id. eve still renders the buttons, accepts typed label or number replies, and withdraws the question when a new message arrives. The handler below keys on option ids as originally designed. Costs: one more tool and its schema, plus deciding whether `pick_media` replaces `ask_question` entirely (MR 4's decision may already have removed it).

The approval half of this MR (a poster before the approve/cancel keyboard) is unaffected either way.

eve's default Telegram renderer shows a question as the prompt text plus one button per option label. Option `description` is not rendered, and nothing carries images. This MR replaces the `input.requested` handler so that choosing between titles, and confirming a request, shows each candidate's poster and a one-line summary.

Read first: `channels/telegram.mdx` (event handler overrides), `concepts/state.md` (`defineState`), and the public exports in `node_modules/eve/dist/src/public/channels/telegram/index.d.ts` (`renderTelegramInputRequest`, `registerTelegramFreeformPrompt`).

- `agent/lib/media/last-candidates.ts`: a `defineState` slot keyed by TMDB id holding `{ title, year, summary, posterPath }` for the candidates the last `search_media` or `get_media_recommendations` call returned. Both tools write it; nothing else reads it except the handler below.
- Instructions: when calling `ask_question` to choose between titles, use the TMDB id as each option `id` and "Title (Year)" as the label.
- `agent/lib/telegram/rich-input.ts`: an `input.requested` handler. For `kind: "question"` whose option ids all resolve in the candidates slot, send one `sendMediaGroup` (2 to 10 photos; a single candidate uses `sendPhoto`) with TMDB poster URLs (`https://image.tmdb.org/t/p/w342` plus `posterPath`) and captions numbered to match the buttons, then render the prompt and keyboard exactly as the default does via `renderTelegramInputRequest` and `registerTelegramFreeformPrompt`. For `kind: "tool-approval"` on `request_media`, send the single poster with the title and summary as caption before the approve/cancel keyboard. Anything else falls through to the default rendering.
- Candidates without a `posterPath` get a text-only line in the caption group rather than breaking the whole group.
- Telegram fetches the images itself from the TMDB URL, so nothing is proxied through the agent. Captions are capped at 1024 characters; summaries are already truncated to about 200.
- Colocated tests for the caption builder, the media group shape, and the fall-through cases.

Verify: `eve dev` cannot show photos, so this needs the development bot from MR 6. Ambiguous search shows posters then buttons; a confirmation shows one poster; a question whose ids are not TMDB ids renders as before.

## Risks

- **Tool-call reliability of the default model.** The eval suite is the mitigation. Budget for switching models.
- **Approval rendering on Telegram.** eve renders the approval prompt from `approval.prompt`, which MR 5 sets from the tool input. If Telegram still shows raw JSON alongside it, an `input.requested` handler override fixes it, but that is code we own.
- **Seerr's undocumented `tags` field.** It is in the source, not the spec. Verified for 3.4.1, the running version. A future release could change it, so MR 3a's response schema requires `tags` on the created request and the request tool checks they match what it sent.
- **Seerr is already public.** Its API key is the only barrier between the internet and request creation today. Cloudflare Access is the follow-on; keep it on the open-decisions list until done.
- **Double submission on replay.** Covered by the availability check and Seerr's duplicate rejection, but confirm during MR 5 that an approval survives a function restart without re-prompting.

## Out of scope for now

Group chats, deleting media, 4K, Seerr user mapping, lighting, people searches ("films with Brad Pitt": `search_media` drops `person` results today; Seerr's `/person/{id}/combined_credits` would back a `get_person_credits` tool if wanted, as a small MR after MR 7), proactive notifications when media becomes available (a schedule plus `to(telegram, target).send`, worth a later MR), and memory across sessions.
