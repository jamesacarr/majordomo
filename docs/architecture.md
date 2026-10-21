---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T11:35:50Z
---

# Architecture

majordomo is a household agent built on eve and deployed to Vercel. Allowlisted people talk to it through a Telegram bot. Its first capability is requesting movies and TV shows through Seerr, with every request confirmed before submission and made as the person's own Seerr user, so their Seerr permissions, approval rules and quota apply. Each decision behind this design has a record in `docs/decisions/`.

`majordomo` is the role name for the code, repo and Vercel project. The bot's display name is a household name set in BotFather, which Telegram shows to users. The agent never needs to know it, so there is no display-name env var.

## Request flow

1. Telegram posts an update to `POST /eve/v1/telegram`, and eve verifies the secret token header.
2. `onMessage` (`agent/lib/telegram/create-on-message.ts`) drops the update unless the chat is private and the sender is on the allowlist. Otherwise it returns session auth carrying the person's Seerr user id from the allowlist, plus a `requester_name` context line with their Telegram first name so the model can address them. Every tool reads the id back with `requireRequester`, and the Seerr client sends it as `X-API-User` on every call, so Seerr acts as that person (decision 0025).
3. The model runs with the media instructions and tools. `search_media` returns up to eight candidates with TMDB ids and library availability. For a question about an actor or director, `search_media_by_person` returns that person's acting and directing credits as the same candidates (decision 0027).
4. When several titles match, the model asks the user to pick one with `pick_media`, which returns an exact TMDB id. Before the buttons, the Telegram channel sends a card per title with its poster, numbered label and summary (`agent/lib/telegram/create-on-input-requested.ts`, decision 0023).
5. The model calls `request_media` with that id. eve pauses for approval, and Telegram shows the title's poster card, then approve and cancel buttons.
6. On approval, `request_media` posts the request to Seerr as the person's Seerr user. Seerr approves it or leaves it waiting for approval according to that user's permissions, or refuses it for a missing permission, a used-up quota or a blocklisted title.
7. The reply reports the title, year and outcome: approved, waiting for approval, or refused with Seerr's reason.

`get_media_requests` reads the person's own 20 newest requests read-only, including ones made in Seerr's UI, by passing their Seerr id as `requestedBy` (decision 0026).

## Scope restriction

Three layers keep the agent to its job, strongest first:

1. **Structural.** Every built-in tool that reaches the filesystem, shell or web is disabled with `disableTool()` in `agent/tools/`. The only side-effecting tool is `request_media`, and every call needs approval.
2. **Auth.** Nobody outside the allowlist gets a session. The HTTP channel (`agent/channels/eve.ts`) accepts Vercel OIDC and local development only, for the dev TUI and evals.
3. **Instructions.** A standing rule declines unrelated requests in one sentence, and an eval covers it.

## Code organisation

eve treats every file under `agent/tools/`, `agent/channels/`, `agent/instructions/`, `agent/skills/` and `agent/schedules/` as a definition. Files there only bind eve definitions to functions in `agent/lib/`, where the logic and its colocated tests live. Decision 0018 explains why.

Production authenticates to the AI Gateway with Vercel OIDC. Local `eve dev` and `eve eval` use `AI_GATEWAY_API_KEY` from `.env`, and the two paths coexist without a switch.

## Adding a capability

A new capability (lighting, say) adds `agent/lib/<domain>/` with colocated tests, tools named `<verb>_<domain>*`, an `agent/instructions/<NN>-<domain>.md` file and evals. Nothing in the core changes. When a capability's instructions grow past a screen, move the procedure into `agent/skills/<domain>/SKILL.md` so it loads only when relevant.
