---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
---

# Architecture

majordomo is a household agent built on eve and deployed to Vercel. Allowlisted people talk to it through a Telegram bot. Its first capability is requesting movies and TV shows through Seerr, with every request confirmed before submission and tagged in Radarr/Sonarr with the requester's name. Each decision behind this design has a record in `docs/decisions/`.

`majordomo` is the role name for the code, repo and Vercel project. The bot's display name is a household name set in BotFather, which Telegram shows to users. The agent never needs to know it, so there is no display-name env var.

## Request flow

1. Telegram posts an update to `POST /eve/v1/telegram`, and eve verifies the secret token header.
2. `onMessage` (`agent/lib/telegram/create-on-message.ts`) drops the update unless the chat is private and the sender is on the allowlist. Otherwise it returns session auth carrying the user's name and tag, plus a `requester_name` context line so the model can address them.
3. The model runs with the media instructions and tools. `search_media` returns up to eight candidates with TMDB ids and library availability.
4. When several titles match, the model asks the user to pick one with `pick_media`, which returns an exact TMDB id.
5. The model calls `request_media` with that id. eve pauses for approval, and Telegram shows approve and cancel buttons.
6. On approval, `request_media` reads the requester's tag from the session, resolves the `seerr` and requester tag ids on the default Radarr or Sonarr server, and posts the request to Seerr with both.
7. The reply reports the title, year and Seerr's status.

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
