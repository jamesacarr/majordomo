---
created_at: 2026-10-21T06:22:13Z
updated_at: 2026-10-21T11:37:13Z
---

# Runbook

Setup, go-live and recurring chores for majordomo. Work through the sections in order for a first deploy. Later chores (adding a user, rotating a credential) stand alone.

## Overview

| Piece | Where it runs |
|-------|---------------|
| The agent | Vercel project `majordomo` in team `james-carrs-projects-e57e5dc3`, served at `https://majordomo.jamescarr.dev` |
| Telegram | Production bot with its webhook on the Vercel deployment, plus a separate development bot (0014) |
| Seerr | Home server, reachable over https through a Cloudflare Tunnel managed outside this repo |
| Seerr users | One per household member. The bot acts as each person's Seerr user, so their Seerr permissions, approval rules and quota apply ([0025](decisions/0025-act-as-each-persons-seerr-user.md)) |
| Models | Vercel AI Gateway. Production authenticates with Vercel OIDC, development with `AI_GATEWAY_API_KEY` |

`.vercel/` is gitignored, so a fresh checkout isn't linked to the project. Every `vercel` command below passes `--scope james-carrs-projects-e57e5dc3`, and every `eve link` or `eve deploy` passes `--project majordomo --team james-carrs-projects-e57e5dc3`.

The design is in [architecture.md](architecture.md). The decisions this runbook relies on are [0001](decisions/0001-deploy-to-vercel-from-main.md) (deploys), [0025](decisions/0025-act-as-each-persons-seerr-user.md) (allowlist and Seerr users), [0014](decisions/0014-separate-development-bot.md) (development bot) and [0016](decisions/0016-bound-cost-per-session.md) (cost).

## Development bot

Telegram allows one webhook or poller per token, so `eve dev` and manual testing use their own bot.

1. In Telegram, message [@BotFather](https://t.me/BotFather) and send `/newbot`. Give it a name that marks it as the development bot.
2. Send `/setjoingroups`, pick the bot, then **Disable**. The bot drops group messages anyway (0025). Disabling joins stops anyone adding it to a group at all.
3. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN` to the new token. Set `MAJORDOMO_DEV_SEERR_USER_ID` to the Seerr user id that `eve dev` TUI sessions and evals act as ([Seerr users](#seerr-users)).

`eve dev` listens on port 2000 by default (`--port` changes it). eve doesn't provide a tunnel, so testing the development bot on Telegram needs a public https URL of your choice in front of that port. Register it with the same `setWebhook` call as [Go-live](#go-live), using the development token and the tunnel URL.

## Seerr

Seerr is already reachable over https through the Cloudflare Tunnel. Nothing in this repo sets that up.

1. In Seerr, open **Settings > General** and copy the **API Key**. This is `SEERR_API_KEY`. The key is the only barrier in front of request creation ([0011](decisions/0011-protect-seerr-with-api-key-only.md)), so treat it as a secret.
2. Set `SEERR_URL` to the tunnel's https origin, with no path.
3. After setting up [Seerr users](#seerr-users), check the key, the tunnel and a user id from outside the home network. This sends the same two headers as the bot:

```bash
curl -fsS -G "$SEERR_URL/api/v1/search" --data-urlencode "query=dune" \
  -H "X-Api-Key: $SEERR_API_KEY" -H "X-API-User: <seerr-user-id>"
```

A JSON body with `results` means all three work. A 403 means Seerr has no user with that id. A 401 means the API key is wrong.

## Seerr users

The bot sends the admin API key with an `X-API-User` header naming the person's Seerr user, so Seerr acts as that user (0025). Each allowlisted person needs their own Seerr account. Their permissions, auto-approval and quota decide what happens to a request:

| Seerr settings for the user | What happens to a request |
|-----------------------------|---------------------------|
| **Auto-Approve** (or the movie or series variant), or **Manage Requests** | Created approved, and the bot reports it as requested |
| **Request** without auto-approval | Created pending, and the bot says it's waiting for approval |
| No permission for that media type, a used-up quota or a blocklisted title | Refused with Seerr's own message, and nothing is created |

1. Make sure each person has a Seerr account. Seerr creates one when they first sign in with their media server login, or you can create one under **Users**.
2. Set their permissions and quota under **Users**, then the person's **Edit Settings**.
3. Find each person's Seerr user id. It's the number in the URL of their page under **Users** (`/users/<id>`), or run:

```bash
curl -fsS -G "$SEERR_URL/api/v1/user" --data-urlencode "take=100" \
  -H "X-Api-Key: $SEERR_API_KEY" | jq '.results[] | {id, displayName, email}'
```

A wrong id doesn't fail when a message arrives. The first tool call fails with an error naming the id, for example `Seerr has no user with id 42 (X-API-User).`

The bot no longer uses Radarr or Sonarr tags. Seerr's own **Tag Requests** setting can still add them, and nothing in the bot reads them.

## Vercel environment variables

These match [.env.example](../.env.example). Set each one on both **Production** and **Preview**, because preview deployments use the production values (0001).

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | The **production** bot's token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | A random string. Generate it with `openssl rand -hex 32`, which fits Telegram's allowed characters (`A-Z`, `a-z`, `0-9`, `_`, `-`, up to 256) |
| `SEERR_URL` | From [Seerr](#seerr) |
| `SEERR_API_KEY` | From [Seerr](#seerr) |
| `MAJORDOMO_ALLOWED_USERS` | JSON map of Telegram user id to Seerr user id, for example `{"123456789":2}`. The Seerr id is a JSON number, not a string. Two Telegram ids may map to the same Seerr id, for one person with two Telegram accounts |

Two variables in `.env.example` stay out of Vercel. `MAJORDOMO_DEV_SEERR_USER_ID` is ignored unless `EVE_DEV=1`, which only `eve dev` sets. `AI_GATEWAY_API_KEY` is for local use; production authenticates with OIDC.

Add each variable as a secret and enter the value at the prompt, which keeps it out of shell history:

```bash
vercel env add TELEGRAM_BOT_TOKEN production --sensitive --project majordomo --scope james-carrs-projects-e57e5dc3
vercel env add TELEGRAM_BOT_TOKEN preview --sensitive --project majordomo --scope james-carrs-projects-e57e5dc3
```

Repeat for each variable. To change an existing value, add `--force`. Env var changes only apply to new deployments, so redeploy afterwards ([Redeploy](#redeploy)).

Any env var a change reads must exist on Vercel before that change merges (0001).

## AI Gateway spend cap

The spend cap is an AI Gateway **team budget**: US$5 a month. It's the only hard financial limit (0016).

A team budget counts every gateway request in the team, whether it comes from production (OIDC), the development `AI_GATEWAY_API_KEY`, or any other project in `james-carrs-projects-e57e5dc3`. Once spend reaches the limit, the gateway rejects every request from the team with HTTP 402 (`quota_for_entity_exceeded`) until the first of the next month (UTC). The check runs before each request, so the request that crosses the limit still completes.

Set it in the dashboard under **AI Gateway > Budgets > Team > Add budget**, or with the CLI:

```bash
vercel ai-gateway budgets set team --limit 5 --refresh-period monthly --scope james-carrs-projects-e57e5dc3
vercel ai-gateway budgets list --scope james-carrs-projects-e57e5dc3
```

In the dashboard, edit the budget and turn on the 50%, 75% and 100% email alerts. They go to team owners. Vercel's [budget documentation](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets) covers the other scopes.

## Link and deploy

Link the checkout, which also pulls the project's env vars into `.env.local`:

```bash
eve link --non-interactive --project majordomo --team james-carrs-projects-e57e5dc3
```

The first deploy goes from a clean, up-to-date `main`, because `eve deploy` uploads the local working tree:

```bash
git switch main && git pull --ff-only && git status --short
eve deploy --non-interactive --yes --project majordomo --team james-carrs-projects-e57e5dc3
```

After that, Vercel deploys `main` on every push (0001). Check the deployment is serving:

```bash
curl -fsS https://majordomo.jamescarr.dev/eve/v1/health
```

The production domain must stay public. Telegram can't pass Vercel Authentication, so a protected production URL rejects every update.

### Redeploy

To apply changed env vars without shipping local code, rebuild the current production deployment:

```bash
vercel ls majordomo --environment production --scope james-carrs-projects-e57e5dc3
vercel redeploy <deployment-url> --target production --scope james-carrs-projects-e57e5dc3
```

`<deployment-url>` is the newest **Ready** deployment in the list.

## Go-live

The production bot serves the previous implementation, which receives its updates by webhook on another host. Registering the new webhook replaces the old one in a single call.

1. Confirm the environment variables are set and the health check passes ([Link and deploy](#link-and-deploy)).
2. Point the production bot at this deployment. Export `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN` with the production values first:

```bash
curl -fsS -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://majordomo.jamescarr.dev/eve/v1/telegram",
       "secret_token":"'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'",
       "allowed_updates":["message","callback_query"],
       "drop_pending_updates":true}'
```

`drop_pending_updates` discards updates queued for the old implementation, so the new bot doesn't answer stale messages.

3. Check the registration:

```bash
curl -fsS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Expect the new `url`, `allowed_updates` of `message` and `callback_query`, and no `last_error_message`. A 401 error there means the secret on Vercel and the one registered don't match.

4. Shut down the previous implementation's service. Keep its configuration until the smoke test passes.
5. Run the [smoke test](#smoke-test-checklist).

To roll back, call `setWebhook` with the old service's URL and secret, then restart that service.

## Adding a user

1. Get the person's numeric Telegram user id. A third-party bot such as [@userinfobot](https://t.me/userinfobot) replies with it.
2. Set up their Seerr account, permissions and quota, and note their Seerr user id ([Seerr users](#seerr-users)).
3. Add `"<telegram-id>":<seerr-id>` to `MAJORDOMO_ALLOWED_USERS` on Production and Preview with `vercel env add ... --force` ([Vercel environment variables](#vercel-environment-variables)). The bot parses the allowlist on every private message and throws on invalid JSON or a bad entry, so one typo stops the bot answering anyone. Check the JSON before saving.
4. [Redeploy](#redeploy). A cold start of the existing deployment still reads the old value.
5. Ask them to send the bot a message. The bot addresses them by their Telegram first name.

## Rotating credentials

**Bot token.** In BotFather, send `/revoke` and pick the bot. Update `TELEGRAM_BOT_TOKEN` on Vercel, [redeploy](#redeploy), then re-run the [Go-live](#go-live) `setWebhook` call with the new token and check `getWebhookInfo`.

**Webhook secret.** Generate a new one, update `TELEGRAM_WEBHOOK_SECRET_TOKEN` on Vercel and [redeploy](#redeploy). Then re-run `setWebhook` with the new secret. Updates that arrive between the two steps get a 401, and Telegram retries them.

**Seerr API key.** Regenerate it in **Settings > General**, update `SEERR_API_KEY` on Vercel and [redeploy](#redeploy). Requests fail until the redeploy finishes.

## Smoke-test checklist

Run after go-live and after any change to the channel, allowlist or Seerr users. Untick every item before a new run.

Last passed (UTC): not yet run

- [ ] `curl -fsS https://majordomo.jamescarr.dev/eve/v1/health` succeeds
- [ ] `getWebhookInfo` shows `https://majordomo.jamescarr.dev/eve/v1/telegram`, `allowed_updates` of `message` and `callback_query`, and no `last_error_message`
- [ ] A Telegram account not on the allowlist messages the bot, and the bot sends nothing
- [ ] A message in a group containing the bot, including one that mentions it, gets no reply. To add the bot, enable `/setjoingroups` in BotFather, then remove the bot from the group and set it back to **Disable**
- [ ] An allowlisted user searches for a title with several matches. Each candidate arrives as a numbered card, with a poster where TMDB has one, before the keyboard
- [ ] They pick one and tap **Approve** on the confirmation card. The request appears in Seerr with them as the requester, approved or pending according to their Seerr permissions
- [ ] They ask "what have I requested?" and the list shows that request and none of anyone else's
- [ ] An actor or director search ("films with Tilda Swinton") returns titles from that person's credits
- [ ] `vercel ai-gateway budgets list --scope james-carrs-projects-e57e5dc3` shows the team budget at US$5 monthly
- [ ] The previous implementation's service is stopped
