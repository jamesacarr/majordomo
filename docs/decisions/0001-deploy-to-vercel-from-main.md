---
created_at: 2026-10-21T01:34:23Z
updated_at: 2026-10-21T01:34:23Z
status: accepted
---

# 0001. Deploy to Vercel from `main`

Decided 2026-09-03.

## Context

Telegram delivers updates to a public webhook URL, so the agent needs public hosting. eve deploys to Vercel by default, and the free tier covers a household's traffic.

## Decision

The GitHub repo is connected to Vercel, which deploys `main` to production on every push. Vercel builds a protected preview deployment for each pull request, not for every branch push. There is one environment: Preview-scoped env vars hold the production values.

Any env var a change reads must exist on the Vercel project before that change merges.

## Consequences

- Merging to `main` is releasing. There is no staging step.
- eve builds and boots without `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET_TOKEN`. The webhook route logs a warning and answers 401 until they're set (verified on eve 0.50.0 on 2026-09-03 and on 0.81.1 on 2026-10-20). Merging channel code before the secrets exist fails closed rather than breaking the deploy.
- eve doesn't call Telegram's `setWebhook`, so registering the webhook is a manual step.
