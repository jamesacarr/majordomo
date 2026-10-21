---
created_at: 2026-10-21T06:22:13Z
updated_at: 2026-10-21T06:22:13Z
---

# Runbook

Setup, go-live and recurring chores for majordomo. Work through the sections in order for a first deploy. Later chores (adding a user, rotating a credential) stand alone.

## Overview

| Piece | Where it runs |
|-------|---------------|
| The agent | Vercel project `majordomo` in team `james-carrs-projects-e57e5dc3`, served at `https://majordomo.jamescarr.dev` |
| Telegram | Production bot with its webhook on the Vercel deployment, plus a separate development bot (0014) |
| Seerr | Home server, reachable over https through a Cloudflare Tunnel managed outside this repo |
| Radarr and Sonarr | Behind Seerr. The bot never calls them directly |
| Models | Vercel AI Gateway. Production authenticates with Vercel OIDC, development with `AI_GATEWAY_API_KEY` |

`.vercel/` is gitignored, so a fresh checkout isn't linked to the project. Every `vercel` command below passes `--scope james-carrs-projects-e57e5dc3`, and every `eve link` or `eve deploy` passes `--project majordomo --team james-carrs-projects-e57e5dc3`.

The design is in [architecture.md](architecture.md). The decisions this runbook relies on are [0001](decisions/0001-deploy-to-vercel-from-main.md) (deploys), [0003](decisions/0003-allowlist-private-chats.md) (allowlist), [0004](decisions/0004-tag-requests-with-seerr-and-requester.md) (tags), [0014](decisions/0014-separate-development-bot.md) (development bot) and [0016](decisions/0016-bound-cost-per-session.md) (cost).

## Development bot

Telegram allows one webhook or poller per token, so `eve dev` and manual testing use their own bot.

1. In Telegram, message [@BotFather](https://t.me/BotFather) and send `/newbot`. Give it a name that marks it as the development bot.
2. Send `/setjoingroups`, pick the bot, then **Disable**. The bot drops group messages anyway (0003). Disabling joins stops anyone adding it to a group at all.
3. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN` to the new token.

`eve dev` listens on port 2000 by default (`--port` changes it). eve doesn't provide a tunnel, so testing the development bot on Telegram needs a public https URL of your choice in front of that port. Register it with the same `setWebhook` call as [Go-live](#go-live), using the development token and the tunnel URL.

## Seerr

Seerr is already reachable over https through the Cloudflare Tunnel. Nothing in this repo sets that up.

1. In Seerr, open **Settings > General** and copy the **API Key**. This is `SEERR_API_KEY`. The key is the only barrier in front of request creation ([0011](decisions/0011-protect-seerr-with-api-key-only.md)), so treat it as a secret.
2. Set `SEERR_URL` to the tunnel's https origin, with no path.
3. From outside the home network, check the key and list the servers the bot routes to:

```bash
curl -fsS -H "X-Api-Key: $SEERR_API_KEY" "$SEERR_URL/api/v1/service/radarr"
curl -fsS -H "X-Api-Key: $SEERR_API_KEY" "$SEERR_URL/api/v1/service/sonarr"
```

Each must return a JSON array containing exactly one server with `"isDefault": true` and `"is4k": false`. That's the server the bot tags requests on ([0009](decisions/0009-route-to-default-non-4k-server.md)). Note its `id` for the next section.

## Radarr and Sonarr tags

Every request carries two tags: `seerr`, and the requester's tag ([0004](decisions/0004-tag-requests-with-seerr-and-requester.md)). Seerr has no API to create tags, so create them by hand on the default non-4K Radarr server and the default non-4K Sonarr server from [Seerr](#seerr).

The requester's tag comes from their display name in `MAJORDOMO_ALLOWED_USERS` (`agent/lib/to-tag.ts`):

1. Accents are dropped and letters lowercased.
2. Each run of other characters becomes one hyphen.
3. Leading and trailing hyphens are trimmed.

`Mary Jane` becomes `mary-jane`, and `Zoë O'Brien` becomes `zoe-o-brien`. Radarr and Sonarr only accept labels of letters, digits and hyphens, and every tag this rule produces fits.

In both Radarr and Sonarr, open **Settings > Tags** and add `seerr`, then one tag per allowlisted name. To use their APIs instead, run this against each app, using its own URL and API key (**Settings > General**):

```bash
curl -fsS -X POST "$ARR_URL/api/v3/tag" \
  -H "X-Api-Key: $ARR_API_KEY" -H "Content-Type: application/json" \
  -d '{"label":"seerr"}'
```

Confirm Seerr sees them, using the server `id` from [Seerr](#seerr):

```bash
curl -fsS -H "X-Api-Key: $SEERR_API_KEY" "$SEERR_URL/api/v1/service/radarr/<id>"
curl -fsS -H "X-Api-Key: $SEERR_API_KEY" "$SEERR_URL/api/v1/service/sonarr/<id>"
```

The `tags` array in each response must include every label. A missing tag doesn't break anything silently. `request_media` refuses and names the missing tag ([0005](decisions/0005-fail-closed-on-missing-tag.md)).

## Vercel environment variables

These match [.env.example](../.env.example). Set each one on both **Production** and **Preview**, because preview deployments use the production values (0001).

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | The **production** bot's token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | A random string. Generate it with `openssl rand -hex 32`, which fits Telegram's allowed characters (`A-Z`, `a-z`, `0-9`, `_`, `-`, up to 256) |
| `SEERR_URL` | From [Seerr](#seerr) |
| `SEERR_API_KEY` | From [Seerr](#seerr) |
| `MAJORDOMO_ALLOWED_USERS` | JSON map of Telegram user id to display name, for example `{"123456789":"Alice"}` |

Two variables in `.env.example` stay out of Vercel. `MAJORDOMO_DEV_USER` is ignored unless `EVE_DEV=1`, which only `eve dev` sets. `AI_GATEWAY_API_KEY` is for local use; production authenticates with OIDC.

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
2. Create their tag in both Radarr and Sonarr first ([Radarr and Sonarr tags](#radarr-and-sonarr-tags)). Until the tag exists, their requests are refused.
3. Add `"<id>":"<Name>"` to `MAJORDOMO_ALLOWED_USERS` on Production and Preview with `vercel env add ... --force` ([Vercel environment variables](#vercel-environment-variables)). Two names that slugify to the same tag are rejected (0004).
4. [Redeploy](#redeploy). A cold start of the existing deployment still reads the old value.
5. Ask them to send the bot a message.

## Rotating credentials

**Bot token.** In BotFather, send `/revoke` and pick the bot. Update `TELEGRAM_BOT_TOKEN` on Vercel, [redeploy](#redeploy), then re-run the [Go-live](#go-live) `setWebhook` call with the new token and check `getWebhookInfo`.

**Webhook secret.** Generate a new one, update `TELEGRAM_WEBHOOK_SECRET_TOKEN` on Vercel and [redeploy](#redeploy). Then re-run `setWebhook` with the new secret. Updates that arrive between the two steps get a 401, and Telegram retries them.

**Seerr API key.** Regenerate it in **Settings > General**, update `SEERR_API_KEY` on Vercel and [redeploy](#redeploy). Requests fail until the redeploy finishes.

## Smoke-test checklist

Run after go-live and after any change to the channel, allowlist or Seerr setup. Untick every item before a new run.

Last passed (UTC): not yet run

- [ ] `curl -fsS https://majordomo.jamescarr.dev/eve/v1/health` succeeds
- [ ] `getWebhookInfo` shows `https://majordomo.jamescarr.dev/eve/v1/telegram`, `allowed_updates` of `message` and `callback_query`, and no `last_error_message`
- [ ] A Telegram account not on the allowlist messages the bot, and the bot sends nothing
- [ ] A message in a group containing the bot, including one that mentions it, gets no reply. To add the bot, enable `/setjoingroups` in BotFather, then remove the bot from the group and set it back to **Disable**
- [ ] An allowlisted user searches for a title with several matches, picks one and taps **Approve**. The request appears in Seerr, and in Radarr or Sonarr with both the `seerr` tag and their own tag
- [ ] `vercel ai-gateway budgets list --scope james-carrs-projects-e57e5dc3` shows the team budget at US$5 monthly
- [ ] The previous implementation's service is stopped
