---
created_at: 2026-09-03T03:01:42Z
updated_at: 2026-09-03T23:07:45Z
status: draft
---

# majordomo implementation plan

majordomo is a household agent, built on eve 0.50 and deployed to Vercel, that lets an allowlisted set of people request movies and TV shows through Seerr. Every request is confirmed with an inline keyboard before submission and tagged in Radarr/Sonarr with a fixed `seerr` tag plus the requester's name. The structure leaves room for more home capabilities later (deleting media, lighting) without reworking the core.

Naming: `majordomo` is the role name for the code, repo, and Vercel project. The Telegram bot's display name is a household name set in BotFather. Telegram shows that name to users; the agent itself never needs to know it, so there is no display-name env var. If the instructions ever need the agent to name itself, write the name into `agent/instructions.md` as ordinary authored content.

Work through this document one MR at a time. Each MR section lists the eve doc pages to read first (paths under `node_modules/eve/docs/`), the files to touch, and the check that proves it works. Update `updated_at` and the status table when an MR lands or a decision changes.

## Decisions already made

| Topic | Decision | Why |
| --- | --- | --- |
| Hosting | Vercel via `eve deploy`. | eve's default path. Telegram needs a public webhook URL either way. |
| Deployment | The GitHub repo is connected to Vercel, which deploys `main` to production on every push. Preview deployments are off, so PRs run only GitHub Actions. Any env var a change reads must exist on the Vercel project before that change merges. | One environment keeps the free tier simple. eve builds and boots without `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN`; the webhook route logs a warning and answers 401 until they are set (verified on eve 0.50.0, 2026-09-03), so merging channel code before the secrets exist fails closed rather than breaking the deploy. |
| Seerr endpoint | An existing Seerr 3.4.1 instance, published over https through a Cloudflare Tunnel that is independent of the agent. `SEERR_URL` points at it; the hostname lives only in `.env` and the Vercel project. | Already running. The agent only needs an API key. |
| Seerr integration | Hand-authored typed tools over a thin `agent/lib/seerr` client. Not an OpenAPI connection. | The Seerr spec has ~200 operations. Exposing only four tools enforces "nothing unrelated" structurally, and the spec omits the `tags` field we need. |
| Attribution | Every request carries two Radarr/Sonarr tags: a fixed `seerr` tag and the requester's display name from the allowlist (lowercased). Bot uses one Seerr API key. No Seerr user mapping. | Confirmed 2026-09-03. The `seerr` tag marks everything that came through Seerr regardless of who asked. |
| Confirmation | Every `request_media` call is gated with eve's `approval: always()`. Ambiguous searches use the built-in `ask_question` tool so the user picks from a keyboard. | Confirmed 2026-09-03. |
| Allowlist | JSON in the `MAJORDOMO_ALLOWED_USERS` env var, keyed by Telegram user id. Private chats only. Non-allowlisted messages and all group messages are dropped silently. | Adding a user is an env change, not a deploy. Silence avoids confirming the bot exists to strangers. |
| Recommendations | Grounded in Seerr's TMDB-backed `/movie/{id}/recommendations`, `/similar` and TV equivalents, not model memory. | Titles come back with TMDB ids and library availability, so each suggestion is directly requestable and never hallucinated. |
| Model | Keep `minimax/minimax-m3` through the AI Gateway as the starting point. Evals are the gate for switching. | See "Model choice" below. |
| Gateway auth | Production authenticates to the AI Gateway with Vercel OIDC automatically. Local `eve dev` and `eve eval` use `AI_GATEWAY_API_KEY` from `.env`. | No switch needed; the two paths coexist. |
| Seerr approval | All bot requests are auto-approved, because they arrive through one admin API key. Seerr's per-user quotas and approval rules do not apply. | Confirmed 2026-09-03. Per-user rules, if ever wanted, would live in the bot. |
| Bots | A separate development bot for `eve dev` and testing. The production bot keeps serving the previous implementation until go-live, when its token moves to Vercel. | Telegram allows one webhook or one poller per token, not both. |
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
2. `onMessage` in `agent/channels/telegram.ts` drops the update unless the chat is private and `message.from.id` is in the allowlist. Otherwise it returns a `SessionAuthContext` whose attributes carry the user's display name and tag.
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
  instructions.md               identity, tone, standing rules (scope refusal, one-line replies)
  instructions/
    10-core.md                  how to talk on Telegram (<b> titles only, no other markup, 4096 cap)
    20-media.md                 search -> disambiguate -> confirm -> request procedure
  channels/
    eve.ts                      HTTP channel for dev TUI and evals; [vercelOidc(), localDev()]
    telegram.ts                 binds lib/telegram handlers to telegramChannel
  tools/
    bash.ts, read_file.ts, write_file.ts, web_fetch.ts, web_search.ts, agent.ts, todo.ts
                                each exports disableTool()
    search_media.ts
    get_media_recommendations.ts
    request_media.ts            approval: always()
    list_media_requests.ts
  lib/                          all logic lives here; one function per file, named after it
    constants.ts                ALLOWLIST_ENV, ALLOWLIST_AUTHENTICATOR
    types.ts                    Env (injectable process.env view), AllowedUser { name, tag }
    parse-allowlist.ts          parseAllowlist: JSON -> Map<userId, AllowedUser>, throws if bad
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
      client.ts                 fetch wrapper with X-Api-Key
      types.ts                  hand-written types for the fields we use
      tags.ts                   resolve tag labels -> ids per service (seerr + user)
      normalise.ts              MovieResult/TvResult -> MediaCandidate
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
Input: `{ query: string, mediaType?: "movie" | "tv" }`. Calls `GET /search?query=`. Drops `person` results. Returns up to 8 `MediaCandidate` items: `{ tmdbId, mediaType, title, year, overview (truncated ~200 chars), availability: "unknown" | "pending" | "processing" | "partially_available" | "available" | "deleted" | "not_requested" }`. Availability comes from `mediaInfo.status` (1 unknown, 2 pending, 3 processing, 4 partially available, 5 available, 6 deleted). No `mediaInfo` means not requested.

`get_media_recommendations`
Input: `{ tmdbId: number, mediaType: "movie" | "tv", limit?: number }`. Calls `/movie/{id}/recommendations` and `/movie/{id}/similar` (or TV equivalents), merges, de-duplicates by TMDB id, ranks by vote average with a vote-count floor, returns `MediaCandidate[]`. The model resolves "movies like Fight Club" by calling `search_media` first.

`request_media`
Input: `{ tmdbId: number, mediaType: "movie" | "tv", title: string, year?: number, seasons?: number[] | "all" }`. `title` and `year` exist so the approval prompt is readable; the tool trusts only `tmdbId`. `approval: always()`. Steps inside `execute`: read requester from `ctx` (fail if absent), fetch details from `/movie/{id}` or `/tv/{id}` to get the real title, refuse if already available or already requested, resolve both tag ids (`seerr` and the user tag), `POST /request { mediaType, mediaId, seasons?, tags: [seerrTagId, userTagId] }`, return `{ requestId, title, year, status, tags }`. The `seerr` label is a constant in `lib/seerr/tags.ts`, not an env var.

`list_media_requests`
Input: `{ mine?: boolean, filter?: "pending" | "approved" | "available" | "processing" }`. Calls `GET /request?take=20&sort=added`. When `mine` is true, keeps only requests whose `tags` include the requester's tag id. Returns title, type, status, requested date.

### Seerr facts the implementation relies on

- Auth is the `X-Api-Key` header.
- `POST /request` accepts `tags: number[]` even though the published OpenAPI spec omits it. Confirmed in `server/entity/MediaRequest.ts` at tag `v3.4.1`, the version running at planning time (`let tags = requestBody.tags`). Re-check this line when Seerr is upgraded.
- Tag ids come from `GET /service/radarr/{id}` and `GET /service/sonarr/{id}`, which return `tags: { id, label }[]` alongside profiles and root folders. The spec under-documents this too.
- Request status codes: 1 pending approval, 2 approved, 3 declined. Requests made with an admin API key are auto-approved unless Seerr is configured otherwise.
- Seerr rejects a duplicate request for media that is already requested or available. Check `mediaInfo.status` first anyway so the user gets a clear message instead of an API error.

### eve facts the implementation relies on

- `onMessage` returning `null` drops the update with no reply. `ctx.telegram` is available inside `onMessage` if a reply is ever wanted.
- `SessionAuthContext.attributes` values must be strings or string arrays.
- Tools read the caller via `ctx.session.auth.current?.attributes.<key>`. Sessions started from the HTTP channel (dev TUI, evals) will not carry the Telegram attributes, so `lib/require-requester.ts` falls back to `MAJORDOMO_DEV_USER` only when `EVE_DEV=1`, and fails otherwise.
- Built-in tools are disabled per slot by exporting `disableTool()` from `agent/tools/<slug>.ts`. A typo in the slug fails the build.
- eve replays interrupted tool steps, so `request_media` must tolerate a re-run: the availability check plus Seerr's own duplicate rejection cover this.
- Default Telegram delivery sends plain text with no `parse_mode`. `lib/telegram/on-message-completed.ts` replaces it with an HTML send and a plain-text fallback; the instructions allow `<b>` and nothing else.
- `TelegramMessageBody` omits `parse_mode`, but eve spreads the body into `sendMessage` unchanged, so a wider object type passes it through. `channel.telegram.post` keeps the 4096-character split.
- Missing `TELEGRAM_WEBHOOK_SECRET_TOKEN` or `TELEGRAM_BOT_TOKEN` is not a build or boot error. Verification fails per request with a logged warning and a 401; sends throw when first attempted.
- eve does not call `setWebhook`; it is a one-off curl in the runbook.

## Cost controls

A Telegram private chat maps to one eve session, and every model call re-sends that session's history, so cost grows with conversation length times turn count. eve gives three levers, all in `agent/agent.ts`, plus one outside it:

```ts
export default defineAgent({
  model: "minimax/minimax-m3",
  limits: {
    sessionTimeoutMs: 24 * 60 * 60 * 1_000,   // fresh session each day; default is 30 days
    maxInputTokensPerSession: 250_000,         // default is 40 million
    maxOutputTokensPerSession: 25_000,         // unset by default
  },
});
```

- **`sessionTimeoutMs`** is the main lever. It is an absolute lifetime from session creation, not an idle timeout. At the deadline eve finishes the active turn, ends the session, and the next message starts fresh. One day fits a "request a film" bot, where nothing needs remembering across days.
- **Token budgets** are a backstop. When a session crosses one, eve pauses and asks the user to approve a fresh window or stop. Users can keep approving, so this bounds accidents rather than intent.
- **Compaction** stays at the default `thresholdPercent` of 0.9. It summarises history near the context window, which the limits above should stop us reaching. Compaction is itself a model call, so lowering the threshold adds cost rather than saving it here.
- **Small tool outputs** matter more than any setting. `search_media` returns at most eight candidates with overviews truncated to about 200 characters, recommendations return at most eight, and request listings return twenty rows of four fields. Tool output is re-sent on every subsequent call in the session.
- **A spend cap on the AI Gateway** is the only hard financial limit. Set a budget in the Vercel AI Gateway dashboard before go-live. Verify the exact control during MR 6; I have not checked what the dashboard currently offers.

The starting values above are guesses to tune. MR 6 records the first week's gateway usage against them.

## Model choice

`minimax/minimax-m3` stays as the default because it is cheap and on the gateway free tier. The risk for this agent is tool-call reliability rather than prose quality: it must chain `search_media`, `ask_question`, and `request_media` correctly, and stop when a request is unrelated. The eval suite in MR 5 is the acceptance test for whichever model is configured.

Switching is a one-line change in `agent/agent.ts`. If minimax-m3 fails the evals, candidates to run the same suite against are Anthropic's Haiku 4.5, Google's Gemini Flash class, and OpenAI's mini class. I have not verified current gateway pricing or free-tier availability for any of these, so check the gateway model list before choosing. Do not add `reasoning` config until an eval shows it is needed.

## MR stack

Each MR must merge on its own and leave `pnpm lint:ci`, `pnpm typecheck`, and `pnpm test` green. Production code per MR stays under roughly 300 lines; tests, docs, and lockfiles don't count.

| # | MR | Status |
| --- | --- | --- |
| 1 | Repo hygiene and locked-down scaffold | done (2026-09-03) |
| 2 | Telegram channel with allowlist | in review |
| 3 | Seerr client | todo |
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

- `agent/lib/parse-allowlist.ts` and `agent/lib/lookup-user.ts`: parse `MAJORDOMO_ALLOWED_USERS` (`{"123456789": "Alice"}`) with zod, expose `lookupUser(telegramUserId)` returning `{ name, tag }` where `tag` is the lowercased name. Throw at first use if the env var is missing or malformed.
- `agent/lib/telegram/create-on-message.ts`: `onMessage` handler that drops non-private chats and unknown users. For known users, return `auth` with `principalId: telegram:<id>`, `principalType: "user"`, `authenticator: "majordomo-allowlist"`, attributes `{ user_id, chat_id, name, tag }`. Set `title` to the user's name for the run.
- `agent/channels/telegram.ts`: `telegramChannel({ onMessage, events })`. No `botUsername`: eve only uses it for group mention detection, and groups are dropped.
- `agent/lib/telegram/on-message-completed.ts` (with `render-html.ts`, `strip-html.ts`, `is-bad-request.ts`): a `message.completed` handler that escapes `&`, `<`, `>` outside a whitelist of `<b>`/`</b>` tags, posts with `parse_mode: "HTML"`, and on a Telegram 400 re-posts the tag-stripped plain text. Colocated tests for the escaping and the fallback.
- Update `agent/instructions/10-core.md`: bold titles with `<b>`, no other markup.
- `agent/lib/require-requester.ts`: `requireRequester(ctx)` returns `{ name, tag }` from session attributes, with the `EVE_DEV` fallback described above.

Tests (colocated in `lib/`): allowlist parsing, rejection of malformed JSON, `onMessage` dropping groups and strangers, attribute shape for a known user, `requireRequester` behaviour with and without attributes and in dev mode.

Verify: unit tests, `pnpm build`, and `eve info --json` listing `POST /eve/v1/telegram`. Webhook testing is deferred to MR 6 because Telegram needs a public URL and a bot token. Before merging, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, and `MAJORDOMO_ALLOWED_USERS` on the Vercel project (see the Deployment decision).

### MR 3: Seerr client

Read first: `concepts/security-model.md` (secrets stay in `process.env`, tools run in the app runtime). Reference the Seerr spec at `https://raw.githubusercontent.com/seerr-team/seerr/develop/seerr-api.yml` for response shapes.

- `agent/lib/seerr/client.ts`: `createSeerrClient({ baseUrl, apiKey, fetch? })` with methods `search(query)`, `movie(id)`, `tv(id)`, `movieRecommendations(id)`, `movieSimilar(id)`, `tvRecommendations(id)`, `tvSimilar(id)`, `createRequest(body)`, `listRequests(params)`, `radarrServers()`, `radarrServer(id)`, `sonarrServers()`, `sonarrServer(id)`. Injectable `fetch` for tests. Non-2xx responses throw a `SeerrError` carrying status and Seerr's message.
- `agent/lib/seerr/types.ts`: only the fields the tools use.
- `agent/lib/seerr/normalise.ts`: `toCandidate(result)` mapping `MovieResult`/`TvResult` to `MediaCandidate`, including the `mediaInfo.status` mapping.
- `agent/lib/seerr/tags.ts`: exports `SEERR_TAG = "seerr"` and `resolveTagIds(client, mediaType, labels)`, which picks the default non-4K server, fetches its tags once, matches each label case-insensitively, and returns `{ ids, missing }` so the caller can report exactly which label is absent.

Tests: each client method builds the right path, query and headers against a fake fetch. Normalisation covers movie, TV, person (dropped), and every status code. Tag resolution covers both labels found, only `seerr` found, only the user tag found, neither found, and no default server.

### MR 4: Search and recommendation tools

Read first: `tools/overview.mdx`, `evals/overview.mdx`.

- `agent/lib/media/search.ts`, `agent/lib/media/recommend.ts`, and `agent/lib/media/details.ts` hold the logic with colocated tests. `agent/tools/search_media.ts`, `agent/tools/get_media_recommendations.ts`, and `agent/tools/get_media_details.ts` bind the zod schemas to them.
- `get_media_details` takes `{ tmdbId, mediaType }` and returns title, year, overview, runtime or season count, genres, top-billed cast, director or creators, and availability from `/movie/{id}` or `/tv/{id}`. It exists so "is that the Christian Bale one?" is answered from data, not memory.
- `agent/instructions/20-media.md`: the procedure. Search first. If one result clearly matches (title and year agree, or only one non-person result), proceed. If several plausible matches, call `ask_question` with up to five options labelled "Title (Year)". Availability is part of every search result: when someone asks whether something is on the server, call `search_media` and answer from the `availability` field without offering to request it. When they ask to request something that is already available, say so and stop; if it is pending or processing, say it's on its way and stop. Do not request again in either case. For clarifying questions about a candidate (cast, director, which version), call `get_media_details` before answering. For recommendation questions, search the named title, then call `get_media_recommendations`, and present up to five with one-line reasons. Never use Markdown.
- `evals/evals.config.ts` and first evals: a clear search calls `search_media`; an ambiguous search (for example "Dune") calls `ask_question` and `t.requireInputRequest` sees more than one option; a recommendation question calls both tools; an unrelated request ("what's the weather") calls no tool and declines. Point the eval Seerr URL at a local stub (`agent/lib/media/stub-server.ts`, an HTTP server serving fixture JSON) so evals are deterministic and free of network.

Verify: `pnpm test` and `eve eval media`.

### MR 5: Request tool with confirmation and tagging

Read first: `tools/human-in-the-loop.md` (the `approval` section), `guides/session-context.md`.

- `agent/lib/media/request.ts` holds the logic with colocated tests. `agent/tools/request_media.ts` binds it per the contract, with `approval: always()` from `eve/tools/approval`.
- Extend `20-media.md`: after the user picks or confirms a title, call `request_media` with the title and year filled in from the search result. Report Seerr's outcome. If the tool reports a missing tag, tell the user plainly and do not retry.
- Spike inside this MR, two questions. First, how eve renders a tool approval on Telegram (button labels and how the input is shown). Second, what happens to an abandoned approval: if the user ignores the prompt and sends an unrelated message hours later, does eve treat it as a decline, keep the prompt pending, or steer the turn? Record the answer here and make the instructions match. If the rendering is unreadable, override the `input.requested` event handler in `telegramChannel({ events })` to format the prompt as "Request Title (Year)?". Keep the override minimal.
- Unit tests: the request body sent to the stub carries exactly `[seerrTagId, userTagId]`, and the tool refuses when either is missing.
- Evals: happy path with `t.respond` approving; decline path where the request is not submitted; already-available path where the tool refuses before approval; missing-tag path for each of the two tags.

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
- **Approval rendering on Telegram.** eve renders approvals from the model's tool input. If it shows raw JSON, the event handler override in MR 5 fixes it, but that is code we own.
- **Seerr's undocumented `tags` field.** It is in the source, not the spec. Verified for 3.4.1, the running version. A future release could change it, so the request tool validates `tags` in the created request's response and fails loudly.
- **Seerr is already public.** Its API key is the only barrier between the internet and request creation today. Cloudflare Access is the follow-on; keep it on the open-decisions list until done.
- **Double submission on replay.** Covered by the availability check and Seerr's duplicate rejection, but confirm during MR 5 that an approval survives a function restart without re-prompting.

## Out of scope for now

Group chats, deleting media, 4K, Seerr user mapping, lighting, people searches ("films with Brad Pitt": `search_media` drops `person` results today; Seerr's `/person/{id}/combined_credits` would back a `get_person_credits` tool if wanted, as a small MR after MR 7), proactive notifications when media becomes available (a schedule plus `to(telegram, target).send`, worth a later MR), and memory across sessions.
